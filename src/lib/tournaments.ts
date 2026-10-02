import "server-only";
import type { Prisma, Tournament, TournamentStatus } from "@prisma/client";
import { prisma } from "./db";
import { pickRules, type TournamentRules } from "./rules/tournament-rules";

type Db = Prisma.TransactionClient | typeof prisma;

export const PUBLIC_STATUSES: TournamentStatus[] = ["SCHEDULED", "IN_PROGRESS", "FINISHED", "CANCELLED"];

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  IN_PROGRESS: "Em andamento",
  FINISHED: "Finalizado",
  CANCELLED: "Cancelado",
};

export function rulesOf(t: Tournament): TournamentRules {
  return pickRules(t);
}

/** Inscrições que ocupam vaga (pendentes + aprovadas; rejeitadas não contam). */
export function countActiveRegistrations(tournamentId: string, db: Db = prisma): Promise<number> {
  return db.registration.count({ where: { tournamentId, status: { not: "REJECTED" } } });
}

export async function getPublicTournament(slug: string) {
  const tournament = await prisma.tournament.findUnique({ where: { slug } });
  if (!tournament || tournament.status === "DRAFT") return null;
  return tournament;
}

export type TournamentAvailability = {
  registered: number;
  remaining: number | null;
  /** Formulário aceitando inscrições agora */
  open: boolean;
  full: boolean;
};

export function availability(t: Tournament, registered: number): TournamentAvailability {
  const unlimited = t.maxParticipants === 0;
  const full = !unlimited && registered >= t.maxParticipants;
  return {
    registered,
    remaining: unlimited ? null : Math.max(0, t.maxParticipants - registered),
    open: t.status === "SCHEDULED" && t.registrationsOpen && !full,
    full,
  };
}

/** Motivo pelo qual o torneio não aceita inscrições/alterações (null = aceita). */
export function closedReason(t: Tournament, registered?: number): string | null {
  if (t.status !== "SCHEDULED") {
    return t.status === "CANCELLED" ? "Este torneio foi cancelado." : "As inscrições deste torneio estão encerradas.";
  }
  if (!t.registrationsOpen) return "As inscrições deste torneio estão encerradas.";
  if (registered !== undefined && t.maxParticipants > 0 && registered >= t.maxParticipants) {
    return "INSCRIÇÕES ENCERRADAS: todas as vagas foram preenchidas.";
  }
  return null;
}

/** Torneios visíveis no site público com o total de inscritos. */
export async function listPublicTournaments() {
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: PUBLIC_STATUSES } },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { registrations: { where: { status: { not: "REJECTED" } } } } } },
  });
  return tournaments.map((t) => ({ tournament: t, availability: availability(t, t._count.registrations) }));
}

export class TournamentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
