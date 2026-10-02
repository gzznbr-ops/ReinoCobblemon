import "server-only";
import type { Prisma, RegistrationStatus, Tournament } from "@prisma/client";
import { prisma } from "./db";
import { registrationCode } from "./format";
import { getPokemonEntry, type PokemonEntry, type TournamentRules } from "./rules/tournament-rules";
import { analyzeTeam, type TeamAnalysis } from "./pokemon/team-analysis";
import { generateEditCode, hashEditCode } from "./edit-code";
import { closedReason, countActiveRegistrations, rulesOf } from "./tournaments";
import { validateBattleTeam } from "./rules/validate-battle-team";
import { serializeSet, type TeamSet } from "./pokemon/team-set";

export class RegistrationError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
  ) {
    super(message);
  }
}

/** Advisory lock por torneio: serializa operações que ocupam vagas (sem input do usuário no SQL). */
export async function lockCapacity(tx: Prisma.TransactionClient, tournamentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(727274, hashtext(${tournamentId}))`;
}

export function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

/** Converte IDs recebidos do cliente em dados confiáveis do servidor, com a legalidade do torneio. */
export function resolveTeam(rules: TournamentRules, pokemonIds: TeamSet[]): PokemonEntry[] {
  return pokemonIds.map((set) => {
    const entry = getPokemonEntry(rules, set.id);
    if (!entry) throw new RegistrationError("Pokémon inválido na seleção.", 400);
    return { ...entry, set };
  });
}

/** Analisa e valida um time. Lança erro com a primeira regra violada. */
export function validateTeam(rules: TournamentRules, team: PokemonEntry[]): TeamAnalysis {
  const analysis = analyzeTeam(team, rules);
  const errors = validateBattleTeam(rules, team.map(serializeSet));
  if (errors.length) throw new RegistrationError(errors.join("\n"), 422, "invalid_team");
  if (!analysis.valid) throw new RegistrationError(analysis.errors[0] ?? "Time inválido.", 422, "invalid_team");
  return analysis;
}

export function teamRows(team: PokemonEntry[], mainType: string | null) {
  return team.map((p, index) => ({
    slot: index + 1,
    battleSet: serializeSet(p),
    pokemonId: p.id,
    speciesId: p.speciesId,
    pokemonName: p.name,
    types: p.types as string[],
    isWildcard: mainType ? !(p.types as string[]).includes(mainType) : false,
  }));
}

/** APROVADO somente com pagamento + time verificado + formato verificado. */
export function computeStatus(r: {
  status: RegistrationStatus;
  paid: boolean;
  teamVerified: boolean;
  formatVerified: boolean;
}): RegistrationStatus {
  if (r.status === "REJECTED") return "REJECTED";
  return r.paid && r.teamVerified && r.formatVerified ? "APPROVED" : "PENDING";
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

export async function createRegistration(input: { tournamentSlug: string; nickname: string; pokemonIds: TeamSet[] }) {
  const tournament = await prisma.tournament.findUnique({ where: { slug: input.tournamentSlug } });
  if (!tournament || tournament.status === "DRAFT") throw new RegistrationError("Torneio não encontrado.", 404);

  const rules = rulesOf(tournament);
  const team = resolveTeam(rules, input.pokemonIds);
  const analysis = validateTeam(rules, team);
  const mainType = analysis.mainType;
  const nicknameNormalized = normalizeNickname(input.nickname);
  const editCode = generateEditCode();

  try {
    return await prisma.$transaction(async (tx) => {
      await lockCapacity(tx, tournament.id);

      // Relê dentro do lock: o admin pode ter fechado ou alterado o torneio
      const current = await tx.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
      const active = await countActiveRegistrations(current.id, tx);
      const closed = closedReason(current, active);
      if (closed) throw new RegistrationError(closed, 409, "closed");
      if (JSON.stringify(rulesOf(current)) !== JSON.stringify(rules)) {
        throw new RegistrationError("As regras do torneio mudaram. Recarregue a página e confira seu time.", 409, "rules_changed");
      }

      const existing = await tx.registration.findUnique({
        where: { tournamentId_nicknameNormalized: { tournamentId: current.id, nicknameNormalized } },
        select: { id: true },
      });
      if (existing) throw new RegistrationError("Este nick já está inscrito neste torneio.", 409, "nickname_taken");

      const created = await tx.registration.create({
        data: {
          tournamentId: current.id,
          nickname: input.nickname.trim(),
          nicknameNormalized,
          mainType,
          possibleTypes: analysis.possibleTypes,
          typeAmbiguous: analysis.ambiguous,
          editCodeHash: hashEditCode(editCode),
          editCodeCreatedAt: new Date(),
          formatVerified: true,
          formatVerifiedAt: new Date(),
          formatVerifiedBy: "Validação automática",
          pokemon: { create: teamRows(team, mainType) },
        },
        select: { id: true, number: true, nickname: true },
      });
      const code = registrationCode(created.number);
      await tx.registration.update({ where: { id: created.id }, data: { registrationCode: code } });

      // Fecha automaticamente ao atingir o limite (o admin pode reabrir depois)
      if (current.maxParticipants > 0 && active + 1 >= current.maxParticipants) {
        await tx.tournament.update({ where: { id: current.id }, data: { registrationsOpen: false } });
      }

      return { id: created.id, code, nickname: created.nickname, editCode };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RegistrationError("Este nick já está inscrito neste torneio.", 409, "nickname_taken");
    }
    throw error;
  }
}

/**
 * Substitui o time de uma inscrição (usado pelo admin e pelo jogador com
 * código de edição). Revalida as regras atuais do torneio, recalcula o tipo e
 * renova a elegibilidade e exige nova conferência do time no jogo. Retorna os campos a gravar.
 */
export async function replaceTeam(
  tx: Prisma.TransactionClient,
  tournament: Tournament,
  reg: { id: string; mainType: string | null },
  pokemonIds: TeamSet[],
) {
  const rules = rulesOf(tournament);
  const team = resolveTeam(rules, pokemonIds);
  const analysis = validateTeam(rules, team);
  // Mantém o tipo escolhido anteriormente se ele continuar possível
  const mainType =
    reg.mainType && (analysis.possibleTypes as string[]).includes(reg.mainType) ? reg.mainType : analysis.mainType;
  await tx.registrationPokemon.deleteMany({ where: { registrationId: reg.id } });
  await tx.registrationPokemon.createMany({
    data: teamRows(team, mainType).map((row) => ({ ...row, registrationId: reg.id })),
  });
  return {
    team,
    data: {
      mainType,
      possibleTypes: analysis.possibleTypes as string[],
      typeAmbiguous: analysis.possibleTypes.length > 1,
      typeReviewedAt: null,
      typeReviewedBy: null,
      teamVerified: false,
      teamVerifiedAt: null,
      teamVerifiedBy: null,
      formatVerified: true,
      formatVerifiedAt: new Date(),
      formatVerifiedBy: "Validação automática",
    },
  };
}

/** A inscrição já entrou na competição? (bloqueia rejeitar/excluir/trocar time). */
export async function isInCompetition(tx: Prisma.TransactionClient | typeof prisma, registrationId: string): Promise<boolean> {
  const [entry, match] = await Promise.all([
    tx.tournamentParticipant.count({ where: { registrationId } }),
    // Compatibilidade com chaves antigas, anteriores à tabela de participantes.
    tx.match.count({ where: { OR: [{ player1Id: registrationId }, { player2Id: registrationId }, { winnerId: registrationId }] } }),
  ]);
  return entry > 0 || match > 0;
}

/** Alias temporário para os fluxos existentes; remover após a migração de nomes. */
export const isInBracket = isInCompetition;
