import "server-only";
import type { Tournament } from "@prisma/client";
import { storedSet, type TeamSet } from "./pokemon/team-set";
import { prisma } from "./db";
import { matchesEditCode } from "./edit-code";
import { closedReason } from "./tournaments";
import { RegistrationError, computeStatus, isInBracket, normalizeNickname, replaceTeam } from "./registrations";

const INVALID = "Nick ou código de edição inválido.";

type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma;

async function findWithCode(db: Db, tournamentSlug: string, nickname: string, code: string) {
  const tournament = await db.tournament.findUnique({ where: { slug: tournamentSlug } });
  if (!tournament || tournament.status === "DRAFT") throw new RegistrationError("Torneio não encontrado.", 404);
  const reg = await db.registration.findUnique({
    where: { tournamentId_nicknameNormalized: { tournamentId: tournament.id, nicknameNormalized: normalizeNickname(nickname) } },
    include: { pokemon: { orderBy: { slot: "asc" } } },
  });
  // Mesma mensagem para nick inexistente e código errado (não revela quem está inscrito)
  if (!reg || !matchesEditCode(code, reg.editCodeHash)) throw new RegistrationError(INVALID, 401);
  return { tournament, reg };
}

function editBlockReason(status: string, tournament: Tournament): string | null {
  if (status === "REJECTED") return "Sua inscrição foi rejeitada. Fale com a organização.";
  const closed = closedReason(tournament);
  if (closed) return `${closed} O time não pode mais ser alterado.`;
  return null;
}

/** Devolve o time atual somente para quem tem o nick + código corretos. */
export async function lookupForEdit(tournamentSlug: string, nickname: string, code: string) {
  const { tournament, reg } = await findWithCode(prisma, tournamentSlug, nickname, code);
  return {
    nickname: reg.nickname,
    registrationCode: reg.registrationCode,
    pokemonIds: reg.pokemon.map((p) => p.pokemonId),
    pokemon: reg.pokemon.map(storedSet),
    blockedReason: editBlockReason(reg.status, tournament),
  };
}

export async function editTeamWithCode(tournamentSlug: string, nickname: string, code: string, pokemonIds: TeamSet[]) {
  return prisma.$transaction(async (tx) => {
    const { tournament, reg } = await findWithCode(tx, tournamentSlug, nickname, code);
    const blocked = editBlockReason(reg.status, tournament);
    if (blocked) throw new RegistrationError(blocked, 409);
    if (await isInBracket(tx, reg.id)) throw new RegistrationError("Seu time já está nas chaves e não pode ser alterado.", 409);

    const current = reg.pokemon.map(storedSet);
    if (JSON.stringify(current) === JSON.stringify(pokemonIds)) {
      throw new RegistrationError("O time enviado é igual ao atual.", 422);
    }

    const { team, data } = await replaceTeam(tx, tournament, reg, pokemonIds);
    const status = computeStatus({ status: reg.status, paid: reg.paid, teamVerified: false, formatVerified: true });
    await tx.registration.update({ where: { id: reg.id }, data: { ...data, status } });

    await tx.auditLog.create({
      data: {
        adminId: null,
        adminName: reg.nickname,
        tournamentId: tournament.id,
        registrationId: reg.id,
        participantNickname: reg.nickname,
        action: "PLAYER_TEAM_CHANGED",
        description:
          `alterou o próprio time em ${tournament.name} com o código de edição.` +
          " Elegibilidade revalidada automaticamente; conferência presencial pendente.",
        metadata: { from: reg.pokemon.map((p) => p.pokemonName), to: team.map((p) => p.name) },
      },
    });

    return { registrationCode: reg.registrationCode, team: team.map((p) => p.name) };
  });
}
