import "server-only";
import type { Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "./db";
import { formatDate, formatDateTime } from "./format";

export async function listAdminTournaments() {
  const rows = await prisma.tournament.findMany({
    orderBy: [{ startsAt: "desc" }],
    include: {
      _count: { select: { registrations: { where: { status: { not: "REJECTED" } } }, matches: true } },
      registrations: { select: { id: true } },
    },
  });
  const approved = await prisma.registration.groupBy({
    by: ["tournamentId"],
    where: { status: "APPROVED" },
    _count: { _all: true },
  });
  const approvedBy = new Map(approved.map((a) => [a.tournamentId, a._count._all]));
  return rows.map((t) => ({
    ...t,
    active: t._count.registrations,
    totalRegistrations: t.registrations.length,
    approved: approvedBy.get(t.id) ?? 0,
    hasBracket: t._count.matches > 0,
  }));
}

export type AdminTournamentRow = Awaited<ReturnType<typeof listAdminTournaments>>[number];

/** Torneio selecionado nas telas de inscritos/check-in: ?torneio=<id>, senão o próximo ativo. */
export async function resolveAdminTournament(requested?: string) {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, status: true, startsAt: true, formatId: true },
  });
  const chosen =
    tournaments.find((t) => t.id === requested) ??
    tournaments
      .filter((t) => t.status === "SCHEDULED" || t.status === "IN_PROGRESS")
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ??
    tournaments[0] ??
    null;
  return { tournaments, chosen };
}

export async function getDashboardData() {
  const [tournaments, pendingTotal, ambiguous, audit] = await Promise.all([
    listAdminTournaments(),
    prisma.registration.count({ where: { status: "PENDING" } }),
    prisma.registration.findMany({
      where: { typeAmbiguous: true, status: { not: "REJECTED" } },
      select: { id: true, nickname: true, possibleTypes: true, tournament: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return { tournaments, pendingTotal, ambiguous, audit: audit.map(serializeAudit) };
}

export type RegistrationFilter = "all" | "pending" | "approved" | "rejected" | "ambiguous" | "unpaid";

export async function listRegistrations(params: { tournamentId: string; q?: string; filter?: RegistrationFilter }) {
  const where: Prisma.RegistrationWhereInput = { tournamentId: params.tournamentId };
  const q = params.q?.trim().slice(0, 32);
  if (q) {
    where.OR = [
      { nicknameNormalized: { contains: q.toLowerCase() } },
      { registrationCode: { contains: q.toUpperCase() } },
    ];
  }
  const statusMap: Partial<Record<RegistrationFilter, RegistrationStatus>> = {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  if (params.filter && statusMap[params.filter]) where.status = statusMap[params.filter];
  if (params.filter === "ambiguous") where.typeAmbiguous = true;
  if (params.filter === "unpaid") Object.assign(where, { paid: false, status: { not: "REJECTED" } });

  const rows = await prisma.registration.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nickname: true,
      registrationCode: true,
      createdAt: true,
      mainType: true,
      typeAmbiguous: true,
      paid: true,
      teamVerified: true,
      formatVerified: true,
      status: true,
    },
  });
  return rows.map((r) => ({ ...r, createdAt: formatDate(r.createdAt) }));
}

export async function getRegistrationDetail(id: string) {
  const reg = await prisma.registration.findUnique({
    where: { id },
    include: {
      tournament: true,
      pokemon: { orderBy: { slot: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!reg) return null;
  return {
    id: reg.id,
    tournament: reg.tournament,
    code: reg.registrationCode ?? "—",
    nickname: reg.nickname,
    status: reg.status,
    mainType: reg.mainType,
    possibleTypes: reg.possibleTypes,
    typeAmbiguous: reg.typeAmbiguous,
    typeReviewedBy: reg.typeReviewedBy,
    typeReviewedAt: formatDateTime(reg.typeReviewedAt),
    paid: reg.paid,
    paidBy: reg.paidBy,
    paidAt: formatDateTime(reg.paidAt),
    teamVerified: reg.teamVerified,
    teamVerifiedBy: reg.teamVerifiedBy,
    teamVerifiedAt: formatDateTime(reg.teamVerifiedAt),
    formatVerified: reg.formatVerified,
    formatVerifiedBy: reg.formatVerifiedBy,
    formatVerifiedAt: formatDateTime(reg.formatVerifiedAt),
    editCodeCreatedAt: reg.editCodeCreatedAt ? formatDateTime(reg.editCodeCreatedAt) : null,
    rejectionReason: reg.rejectionReason,
    rejectedBy: reg.rejectedBy,
    rejectedAt: formatDateTime(reg.rejectedAt),
    createdAt: formatDateTime(reg.createdAt),
    pokemon: reg.pokemon.map((p) => ({
      battleSet: p.battleSet,
      slot: p.slot,
      pokemonId: p.pokemonId,
      speciesId: p.speciesId,
      name: p.pokemonName,
      types: p.types,
      isWildcard: p.isWildcard,
    })),
    audit: reg.auditLogs.map(serializeAudit),
  };
}

export type RegistrationDetail = NonNullable<Awaited<ReturnType<typeof getRegistrationDetail>>>;

export async function listCheckin(tournamentId: string) {
  return prisma.registration.findMany({
    where: { tournamentId },
    orderBy: { nicknameNormalized: "asc" },
    select: {
      id: true,
      nickname: true,
      registrationCode: true,
      paid: true,
      teamVerified: true,
      formatVerified: true,
      status: true,
      typeAmbiguous: true,
    },
  });
}

export async function listAudit(take = 300, tournamentId?: string) {
  const logs = await prisma.auditLog.findMany({
    where: tournamentId ? { tournamentId } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
  return logs.map(serializeAudit);
}

function serializeAudit(log: {
  id: string;
  adminName: string;
  participantNickname: string | null;
  registrationId: string | null;
  action: string;
  description: string;
  createdAt: Date;
}) {
  return {
    id: log.id,
    adminName: log.adminName,
    participant: log.participantNickname,
    registrationId: log.registrationId,
    action: log.action,
    byPlayer: log.action.startsWith("PLAYER_"),
    description: log.description,
    createdAt: formatDateTime(log.createdAt),
  };
}

export type AuditItem = ReturnType<typeof serializeAudit>;
