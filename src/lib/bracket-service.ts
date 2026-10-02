import "server-only";
import type { Match, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import type { CurrentAdmin } from "./auth";
import type { BracketAction } from "./validation";
import { buildBracket, isBracketComplete, isBye, propagate, shuffle } from "./bracket";
import { buildRoundRobin, roundRobinMatchCount, roundRobinRoundCount } from "./round-robin";
import { fromDateTimeLocalInput } from "./format";
import { TournamentError, rulesOf } from "./tournaments";
import { validateBattleTeam } from "./rules/validate-battle-team";
import { storedSet } from "./pokemon/team-set";
import { lockCapacity } from "./registrations";

type Tx = Prisma.TransactionClient;

function pendingStatus(match: Pick<Match, "scheduledAt">): "SCHEDULED" | "PENDING" {
  return match.scheduledAt ? "SCHEDULED" : "PENDING";
}

/** Grava a diferença entre a chave propagada e o banco. */
async function persistBracket(tx: Tx, rows: Match[]) {
  const next = propagate(rows);
  for (let i = 0; i < rows.length; i++) {
    const before = rows[i]!;
    const after = next[i]!;
    if (before.player1Id === after.player1Id && before.player2Id === after.player2Id && before.winnerId === after.winnerId) continue;
    const bye = isBye(after);
    const resultWasCleared = Boolean(before.winnerId && !after.winnerId);
    await tx.match.update({
      where: { id: before.id },
      data: {
        player1Id: after.player1Id,
        player2Id: after.player2Id,
        winnerId: after.winnerId,
        status: bye ? "BYE" : after.winnerId ? "COMPLETED" : pendingStatus(before),
        ...(resultWasCleared
          ? { resultType: null, player1Score: null, player2Score: null, score: null, completedAt: null }
          : {}),
      },
    });
  }
  return next;
}

async function loadMatches(tx: Tx, tournamentId: string) {
  return tx.match.findMany({ where: { tournamentId }, orderBy: [{ round: "asc" }, { position: "asc" }] });
}

function scoreTarget(matchFormat: string): number {
  return matchFormat === "MD5" ? 3 : matchFormat === "MD3" ? 2 : 1;
}

function parseAndValidateScore(
  raw: string | undefined,
  match: Pick<Match, "player1Id" | "player2Id">,
  winnerId: string | null,
  resultType: "NORMAL" | "DRAW" | "WALKOVER" | "DISQUALIFICATION",
  matchFormat: string,
): { player1Score: number | null; player2Score: number | null; score: string | null } {
  const target = scoreTarget(matchFormat);
  if (!raw && (resultType === "WALKOVER" || resultType === "DISQUALIFICATION")) {
    const p1Won = winnerId === match.player1Id;
    return { player1Score: p1Won ? target : 0, player2Score: p1Won ? 0 : target, score: p1Won ? `${target}-0` : `0-${target}` };
  }
  if (!raw) return { player1Score: null, player2Score: null, score: null };
  const parsed = raw.match(/^\s*(\d{1,2})\s*[-xX]\s*(\d{1,2})\s*$/);
  if (!parsed) throw new TournamentError("Use um placar numérico, por exemplo 2-1.", 422);
  const p1 = Number(parsed[1]);
  const p2 = Number(parsed[2]);
  if (resultType === "DRAW") {
    if (p1 !== p2) throw new TournamentError("Um empate precisa ter placares iguais.", 422);
  } else {
    if (winnerId === match.player1Id && p1 <= p2) throw new TournamentError("O placar não corresponde ao vencedor selecionado.", 422);
    if (winnerId === match.player2Id && p2 <= p1) throw new TournamentError("O placar não corresponde ao vencedor selecionado.", 422);
    if (resultType === "NORMAL" && Math.max(p1, p2) !== target) {
      throw new TournamentError(`${matchFormat} termina quando o vencedor alcança ${target} vitória(s).`, 422);
    }
  }
  return { player1Score: p1, player2Score: p2, score: `${p1}-${p2}` };
}

export async function applyBracketAction(admin: CurrentAdmin, tournamentId: string, input: BracketAction) {
  return prisma.$transaction(async (tx) => {
    await lockCapacity(tx, tournamentId);
    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new TournamentError("Torneio não encontrado.", 404);
    const matches = await loadMatches(tx, tournamentId);
    const participantCount = await tx.tournamentParticipant.count({ where: { tournamentId } });
    const nick = async (id: string | null) =>
      id ? ((await tx.registration.findUnique({ where: { id }, select: { nickname: true } }))?.nickname ?? "?") : "?";
    const audit = (action: string, description: string, metadata?: Prisma.InputJsonValue) =>
      writeAudit(tx, { admin, tournamentId, action, description, metadata });

    switch (input.action) {
      case "generate": {
        if (matches.length > 0 || participantCount > 0) {
          throw new TournamentError("Os confrontos já foram gerados. Resete antes de gerar novamente.", 409);
        }
        if (tournament.status === "DRAFT" || tournament.status === "CANCELLED") {
          throw new TournamentError("Publique o torneio antes de gerar os confrontos.", 409);
        }
        const approved = await tx.registration.findMany({
          where: { tournamentId, status: "APPROVED" },
          orderBy: { createdAt: "asc" },
          select: { id: true, nickname: true, pokemon: { orderBy: { slot: "asc" } } },
        });
        if (approved.length < 2) throw new TournamentError("São necessários pelo menos 2 inscritos APROVADOS.", 409);
        for (const reg of approved) {
          const errors = validateBattleTeam(rulesOf(tournament), reg.pokemon.map(storedSet));
          if (errors.length) throw new TournamentError(`Complete ou corrija o time de ${reg.nickname} antes de gerar os confrontos: ${errors[0]}`, 422);
        }
        if (tournament.competitionFormat === "ROUND_ROBIN" && approved.length > 32) {
          throw new TournamentError("Pontos corridos está limitado a 32 participantes por causa do número de partidas.", 409);
        }

        const ids = approved.map((r) => r.id);
        const seeded = input.seeding === "random" ? shuffle(ids) : ids;
        await tx.tournamentParticipant.createMany({
          data: seeded.map((registrationId, index) => ({ id: crypto.randomUUID(), tournamentId, registrationId, seed: index + 1 })),
        });

        const now = new Date();
        if (tournament.competitionFormat === "ROUND_ROBIN") {
          const schedule = buildRoundRobin(seeded, tournament.roundRobinTurns);
          await tx.match.createMany({ data: schedule.map((m) => ({ ...m, tournamentId, status: "PENDING" as const })) });
          await audit(
            "ROUND_ROBIN_GENERATED",
            `sorteou os confrontos de pontos corridos de ${tournament.name}: ${ids.length} jogadores, ${roundRobinRoundCount(ids.length, tournament.roundRobinTurns)} rodadas e ${roundRobinMatchCount(ids.length, tournament.roundRobinTurns)} partidas.`,
            { players: ids.length, turns: tournament.roundRobinTurns, seeding: input.seeding },
          );
        } else {
          const bracket = buildBracket(seeded, tournament.thirdPlaceMatch);
          await tx.match.createMany({
            data: bracket.map((m) => ({ ...m, tournamentId, status: isBye(m) ? ("BYE" as const) : ("PENDING" as const) })),
          });
          await audit(
            "BRACKET_GENERATED",
            `gerou as chaves de ${tournament.name} com ${ids.length} jogadores (${input.seeding === "random" ? "sorteio" : "ordem de inscrição"}).`,
          );
        }
        await tx.tournament.update({
          where: { id: tournamentId },
          data: {
            scheduleGeneratedAt: now,
            bracketGeneratedAt: tournament.competitionFormat === "SINGLE_ELIMINATION" ? now : null,
            status: "IN_PROGRESS",
            registrationsOpen: false,
          },
        });
        return { ok: true };
      }

      case "reset": {
        if (matches.length === 0 && participantCount === 0) throw new TournamentError("Não há confrontos para resetar.", 409);
        await tx.match.deleteMany({ where: { tournamentId } });
        await tx.tournamentParticipant.deleteMany({ where: { tournamentId } });
        await tx.tournament.update({
          where: { id: tournamentId },
          data: {
            scheduleGeneratedAt: null,
            bracketGeneratedAt: null,
            status: tournament.status === "IN_PROGRESS" || tournament.status === "FINISHED" ? "SCHEDULED" : tournament.status,
          },
        });
        await audit("COMPETITION_RESET", `resetou os confrontos de ${tournament.name} (todas as partidas e resultados foram apagados).`);
        return { ok: true };
      }

      case "report": {
        const match = matches.find((m) => m.id === input.matchId);
        if (!match) throw new TournamentError("Partida não encontrada.", 404);
        if (!match.player1Id || !match.player2Id) throw new TournamentError("A partida ainda não tem os dois jogadores.", 409);
        if (match.status === "BYE") throw new TournamentError("Uma folga não recebe resultado.", 409);

        if (input.resultType === "DRAW") {
          if (tournament.competitionFormat !== "ROUND_ROBIN" || !tournament.allowDraw) {
            throw new TournamentError("Este torneio não permite empate.", 422);
          }
          if (input.winnerId) throw new TournamentError("Empate não possui vencedor.", 422);
        } else if (input.winnerId !== match.player1Id && input.winnerId !== match.player2Id) {
          throw new TournamentError("O vencedor precisa ser um dos jogadores da partida.", 422);
        }

        const parsedScore = parseAndValidateScore(input.score, match, input.winnerId, input.resultType, tournament.matchFormat);
        const completedAt = new Date();
        await tx.match.update({
          where: { id: match.id },
          data: { winnerId: input.winnerId, resultType: input.resultType, status: "COMPLETED", completedAt, ...parsedScore },
        });

        let complete: boolean;
        let cleared = 0;
        if (tournament.competitionFormat === "SINGLE_ELIMINATION") {
          const updated = matches.map((m) =>
            m.id === match.id
              ? { ...m, winnerId: input.winnerId, resultType: input.resultType, status: "COMPLETED" as const, completedAt, ...parsedScore }
              : m,
          );
          const next = await persistBracket(tx, updated);
          cleared = next.filter((m, i) => updated[i]!.winnerId && !m.winnerId).length;
          complete = isBracketComplete(next);
        } else {
          complete = matches.every((m) => m.id === match.id || m.status === "COMPLETED");
        }

        const loserId = input.winnerId === match.player1Id ? match.player2Id : match.player1Id;
        const description = input.resultType === "DRAW"
          ? `registrou empate entre ${await nick(match.player1Id)} e ${await nick(match.player2Id)}${parsedScore.score ? ` (${parsedScore.score})` : ""}.`
          : `lançou resultado: ${await nick(input.winnerId)} venceu ${await nick(loserId)}${parsedScore.score ? ` (${parsedScore.score})` : ""}${input.resultType === "WALKOVER" ? " por W.O." : input.resultType === "DISQUALIFICATION" ? " por desclassificação" : ""}.${cleared ? ` ${cleared} resultado(s) seguinte(s) apagado(s).` : ""}`;
        await audit("MATCH_RESULT", description, { matchId: match.id, winnerId: input.winnerId, resultType: input.resultType, score: parsedScore.score });

        if (complete && tournament.status !== "FINISHED") {
          await tx.tournament.update({ where: { id: tournamentId }, data: { status: "FINISHED" } });
          await audit("TOURNAMENT_FINISHED", `finalizou ${tournament.name} (todas as partidas decididas).`);
        } else if (!complete && tournament.status === "FINISHED") {
          await tx.tournament.update({ where: { id: tournamentId }, data: { status: "IN_PROGRESS" } });
        }
        return { ok: true, finished: complete };
      }

      case "clear": {
        const match = matches.find((m) => m.id === input.matchId);
        if (!match) throw new TournamentError("Partida não encontrada.", 404);
        if (match.status === "BYE" || isBye(match)) throw new TournamentError("Folga não tem resultado para apagar.", 409);
        if (match.status !== "COMPLETED") throw new TournamentError("Esta partida ainda não tem resultado.", 409);
        const cleared = { winnerId: null, resultType: null, player1Score: null, player2Score: null, score: null, completedAt: null, status: pendingStatus(match) };
        await tx.match.update({ where: { id: match.id }, data: cleared });
        if (tournament.competitionFormat === "SINGLE_ELIMINATION") {
          await persistBracket(tx, matches.map((m) => (m.id === match.id ? { ...m, ...cleared } : m)));
        }
        await audit("MATCH_CLEARED", `apagou o resultado de ${await nick(match.player1Id)} × ${await nick(match.player2Id)}.`);
        if (tournament.status === "FINISHED") {
          await tx.tournament.update({ where: { id: tournamentId }, data: { status: "IN_PROGRESS" } });
        }
        return { ok: true };
      }

      case "schedule": {
        const match = matches.find((m) => m.id === input.matchId);
        if (!match) throw new TournamentError("Partida não encontrada.", 404);
        const scheduledAt = input.scheduledAt ? fromDateTimeLocalInput(input.scheduledAt) : null;
        if (input.scheduledAt && !scheduledAt) throw new TournamentError("Horário inválido.", 422);
        await tx.match.update({
          where: { id: match.id },
          data: { scheduledAt, status: match.status === "COMPLETED" || match.status === "BYE" ? match.status : scheduledAt ? "SCHEDULED" : "PENDING" },
        });
        return { ok: true };
      }

      case "swap": {
        if (tournament.competitionFormat !== "SINGLE_ELIMINATION") {
          throw new TournamentError("Em pontos corridos, refaça o sorteio antes do primeiro resultado.", 409);
        }
        if (input.registrationA === input.registrationB) throw new TournamentError("Escolha dois jogadores diferentes.", 422);
        const hasResults = matches.some((m) => m.status === "COMPLETED");
        if (hasResults) throw new TournamentError("Só é possível trocar jogadores antes do primeiro resultado.", 409);
        const firstRound = matches.filter((m) => m.round === 1);
        const slotOf = (id: string) => {
          const m = firstRound.find((x) => x.player1Id === id || x.player2Id === id);
          return m ? { match: m, field: m.player1Id === id ? ("player1Id" as const) : ("player2Id" as const) } : null;
        };
        const a = slotOf(input.registrationA);
        const b = slotOf(input.registrationB);
        if (!a || !b) throw new TournamentError("Os dois jogadores precisam estar na primeira rodada.", 422);

        const updated = matches.map((m) => ({ ...m }));
        const ma = updated.find((m) => m.id === a.match.id)!;
        const mb = updated.find((m) => m.id === b.match.id)!;
        ma[a.field] = input.registrationB;
        mb[b.field] = input.registrationA;
        for (const m of [ma, mb]) m.winnerId = null;
        for (const m of new Set([ma, mb])) {
          await tx.match.update({ where: { id: m.id }, data: { player1Id: m.player1Id, player2Id: m.player2Id, winnerId: null, status: isBye(m) ? "BYE" : "PENDING" } });
        }
        await persistBracket(tx, matches.map((m) => updated.find((u) => u.id === m.id) ?? m));
        await audit("BRACKET_SWAP", `trocou ${await nick(input.registrationA)} e ${await nick(input.registrationB)} de posição nas chaves.`);
        return { ok: true };
      }
    }
  });
}
