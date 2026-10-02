import "server-only";
import { prisma } from "./db";
import { formatDateTime } from "./format";
import { standings } from "./bracket";
import { computeStandings } from "./round-robin";
import type { BracketViewMatch } from "@/components/BracketView";

/**
 * Partidas com os nicks (nenhum time aparece aqui). Com `publicView`, os ids internos
 * das inscrições e partidas são trocados por apelidos (p1, p2… / m1, m2…) antes de ir ao navegador.
 */
export async function getBracket(tournamentId: string, { publicView = false } = {}) {
  const [rows, tournament, entries] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: "asc" }, { position: "asc" }],
      include: {
        player1: { select: { id: true, nickname: true } },
        player2: { select: { id: true, nickname: true } },
      },
    }),
    prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } }),
    prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      orderBy: { seed: "asc" },
      include: { registration: { select: { id: true, nickname: true } } },
    }),
  ]);

  const aliases = new Map<string, string>();
  const alias = (id: string | null, prefix: string) => {
    if (!id || !publicView) return id;
    if (!aliases.has(id)) aliases.set(id, `${prefix}${aliases.size + 1}`);
    return aliases.get(id)!;
  };
  const player = (p: { id: string; nickname: string } | null) => (p ? { id: alias(p.id, "p")!, nickname: p.nickname } : null);

  const matches: BracketViewMatch[] = rows.map((m) => ({
    id: alias(m.id, "m")!,
    round: m.round,
    position: m.position,
    isThirdPlace: m.isThirdPlace,
    player1: player(m.player1),
    player2: player(m.player2),
    winnerId: alias(m.winnerId, "p"),
    status: m.status,
    resultType: m.resultType,
    player1Score: m.player1Score,
    player2Score: m.player2Score,
    score: m.score,
    scheduledAt: m.scheduledAt ? formatDateTime(m.scheduledAt) : null,
  }));

  const nick = new Map(rows.flatMap((m) => [m.player1, m.player2]).filter(Boolean).map((p) => [p!.id, p!.nickname]));
  const podium = standings(rows);
  const fallbackParticipants = [...new Map(
    rows
      .flatMap((m) => [m.player1, m.player2])
      .filter((p): p is { id: string; nickname: string } => Boolean(p))
      .map((p) => [p.id, p]),
  ).values()].map((p, index) => ({ id: p.id, nickname: p.nickname, seed: index + 1 }));
  const participants = entries.length
    ? entries.map((e) => ({ id: e.registration.id, nickname: e.registration.nickname, seed: e.seed }))
    : fallbackParticipants;
  const table = computeStandings(
    participants,
    rows,
    { win: tournament.pointsForWin, draw: tournament.pointsForDraw, loss: tournament.pointsForLoss },
  ).map((row, index) => ({ ...row, id: alias(row.id, "p")!, position: index + 1 }));
  const completed = rows.filter((m) => m.status === "COMPLETED" || m.status === "BYE" || m.status === "CANCELLED").length;
  return {
    matches,
    rawScheduled: publicView ? {} : Object.fromEntries(rows.map((m) => [m.id, m.scheduledAt])),
    podium: {
      first: podium.first ? (nick.get(podium.first) ?? null) : null,
      second: podium.second ? (nick.get(podium.second) ?? null) : null,
      third: podium.third.map((id) => nick.get(id)).filter((n): n is string => Boolean(n)),
    },
    standings: table,
    progress: { completed, total: rows.length },
  };
}
