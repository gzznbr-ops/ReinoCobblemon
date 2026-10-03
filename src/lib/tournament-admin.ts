import "server-only";
import type { Prisma, Tournament } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import type { CurrentAdmin } from "./auth";
import type { TournamentInput } from "./validation";
import { formatDateTime, formatMoney } from "./format";
import { formatLabel } from "./rules/showdown";
import { STATUS_LABELS, TournamentError } from "./tournaments";
import { isUniqueViolation } from "./registrations";
import { RULE_KEYS } from "./rules/tournament-rules";
import { assertRulesAvailable } from "./rules/release-state";

const LABELS: Record<keyof TournamentInput, string> = {
  name: "nome",
  slug: "endereço",
  description: "descrição",
  status: "status",
  startsAt: "data",
  endsAt: "término",
  competitionFormat: "formato da competição",
  roundRobinTurns: "turnos",
  pointsForWin: "pontos por vitória",
  pointsForDraw: "pontos por empate",
  pointsForLoss: "pontos por derrota",
  allowDraw: "empates",
  formatId: "tier",
  teamSize: "tamanho do time",
  matchFormat: "partidas",
  allowRestricted: "lendários restritos",
  allowLegendary: "sub-lendários",
  allowMythical: "míticos",
  allowUltraBeast: "Ultra Beasts",
  allowParadox: "Paradox",
  bannedPokemonIds: "banimentos extras",
  allowedPokemonIds: "exceções",
  monotype: "Monotype",
  monotypeMinimum: "mínimo Monotype",
  maxWildcards: "Coringas",
  customRules: "regras específicas",
  entryFee: "inscrição",
  maxParticipants: "vagas",
  registrationsOpen: "inscrições abertas",
  prizeFirst: "prêmio 1º",
  prizeSecond: "prêmio 2º",
  prizeThird: "prêmio 3º",
  rewardDetails: "recompensas",
  thirdPlaceMatch: "disputa de 3º",
};

function describe(key: keyof TournamentInput, value: unknown): string {
  if (value instanceof Date) return formatDateTime(value);
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  if (Array.isArray(value)) return `${value.length} Pokémon`;
  if (key === "formatId") return formatLabel(String(value));
  if (key === "status") return STATUS_LABELS[value as Tournament["status"]];
  if (key === "maxParticipants") return value === 0 ? "sem limite" : String(value);
  if (key === "entryFee" || key.startsWith("prize")) return formatMoney(Number(value));
  if (typeof value === "string" && value.length > 40) return `${value.slice(0, 40)}…`;
  return String(value);
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return JSON.stringify(a) === JSON.stringify(b);
}

function slugError(error: unknown): never {
  if (isUniqueViolation(error)) throw new TournamentError("Já existe um torneio com este endereço (slug).", 409);
  throw error;
}

export async function createTournament(admin: CurrentAdmin, input: TournamentInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      await assertRulesAvailable(tx);
      const created = await tx.tournament.create({ data: input });
      await writeAudit(tx, {
        admin,
        tournamentId: created.id,
        action: "TOURNAMENT_CREATED",
        description: `criou o torneio ${created.name} (${formatLabel(created.formatId)}, ${formatDateTime(created.startsAt)}).`,
      });
      return created;
    });
  } catch (error) {
    slugError(error);
  }
}

/** Mudanças que não podem acontecer com as chaves já geradas. */
const LOCKED_AFTER_SCHEDULE: (keyof TournamentInput)[] = [
  "competitionFormat",
  "roundRobinTurns",
  "pointsForWin",
  "pointsForDraw",
  "pointsForLoss",
  "allowDraw",
  "thirdPlaceMatch",
];

export async function updateTournament(admin: CurrentAdmin, id: string, patch: Partial<TournamentInput>) {
  try {
    return await prisma.$transaction(async (tx) => {
      await assertRulesAvailable(tx);
      const current = await tx.tournament.findUnique({ where: { id } });
      if (!current) throw new TournamentError("Torneio não encontrado.", 404);

      const keys = (Object.keys(patch) as (keyof TournamentInput)[]).filter((k) => !same(current[k], patch[k]));
      if (keys.length === 0) return current;

      if ((current.scheduleGeneratedAt || current.bracketGeneratedAt) && keys.some((k) => LOCKED_AFTER_SCHEDULE.includes(k))) {
        throw new TournamentError("Resete os confrontos antes de mudar o formato ou as regras da competição.", 409);
      }

      const updated = await tx.tournament.update({ where: { id }, data: patch as Prisma.TournamentUpdateInput });
      if (keys.some(k => (RULE_KEYS as readonly string[]).includes(k))) {
        await tx.registration.updateMany({ where: { tournamentId: id, status: "APPROVED" }, data: { status: "PENDING" } });
        await tx.registration.updateMany({ where: { tournamentId: id }, data: { formatVerified: false, formatVerifiedAt: null, formatVerifiedBy: null } });
      }

      let description = `alterou o torneio ${updated.name} (${keys
        .map((k) => `${LABELS[k]}: ${describe(k, current[k])} → ${describe(k, patch[k])}`)
        .join("; ")}).`;
      if (keys.length === 1 && keys[0] === "registrationsOpen") {
        description = `${patch.registrationsOpen ? "abriu" : "encerrou"} as inscrições de ${updated.name}.`;
      }
      await writeAudit(tx, {
        admin,
        tournamentId: id,
        action: "TOURNAMENT_UPDATED",
        description,
        metadata: Object.fromEntries(
          keys.map((k) => [k, { from: current[k], to: patch[k] }]),
        ) as Prisma.InputJsonValue,
      });
      return updated;
    });
  } catch (error) {
    if (error instanceof TournamentError) throw error;
    slugError(error);
  }
}

/**
 * Exclui o torneio com tudo o que pertence a ele (chaves, inscrições e times).
 * Exige o nome exato do torneio como confirmação. O histórico é mantido: os
 * registros de auditoria perdem o vínculo, mas guardam nome, nicks e descrição.
 */
export async function deleteTournament(admin: CurrentAdmin, id: string, confirmName: string) {
  await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({
      where: { id },
      include: { _count: { select: { registrations: true, matches: true } } },
    });
    if (!t) throw new TournamentError("Torneio não encontrado.", 404);
    if (confirmName.trim() !== t.name.trim()) {
      throw new TournamentError("Digite o nome exato do torneio para confirmar a exclusão.", 422);
    }
    await writeAudit(tx, {
      admin,
      tournamentId: null,
      action: "TOURNAMENT_DELETED",
      description: `excluiu o torneio ${t.name} (${t._count.registrations} inscrição(ões), ${t._count.matches} partida(s)).`,
      metadata: { slug: t.slug, registrations: t._count.registrations, matches: t._count.matches },
    });
    // Ordem importa: partidas referenciam inscrições (Restrict)
    await tx.match.deleteMany({ where: { tournamentId: id } });
    await tx.tournamentParticipant.deleteMany({ where: { tournamentId: id } });
    await tx.registration.deleteMany({ where: { tournamentId: id } });
    await tx.tournament.delete({ where: { id } });
  });
}
