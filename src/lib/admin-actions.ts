import "server-only";
import type { Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import type { CurrentAdmin } from "./auth";
import type { AdminAction } from "./validation";
import { typeLabel } from "./pokemon/types";
import { validateClassification } from "./pokemon/team-analysis";
import { generateEditCode, hashEditCode } from "./edit-code";
import { countActiveRegistrations, rulesOf } from "./tournaments";
import { storedSet } from "./pokemon/team-set";
import { validateBattleTeam } from "./rules/validate-battle-team";
import {
  RegistrationError,
  computeStatus,
  isInBracket,
  isUniqueViolation,
  lockCapacity,
  normalizeNickname,
  replaceTeam,
} from "./registrations";

type AuditEntry = { action: string; description: string; metadata?: Prisma.InputJsonValue };

type Flags = { status?: RegistrationStatus; paid?: boolean; teamVerified?: boolean; formatVerified?: boolean };

const IN_BRACKET = "Este jogador já está nas chaves. Resete as chaves do torneio antes desta alteração.";

export async function applyAdminAction(admin: CurrentAdmin, registrationId: string, input: AdminAction) {
  try {
    return await prisma.$transaction(async (tx) => {
      const reg = await tx.registration.findUnique({
        where: { id: registrationId },
        include: { pokemon: { orderBy: { slot: "asc" } }, tournament: true },
      });
      if (!reg) throw new RegistrationError("Inscrição não encontrada.", 404);
      const tournament = reg.tournament;
      if (input.action === "restore") await lockCapacity(tx, tournament.id);

      // Inscrição rejeitada precisa ser reativada antes de receber novas confirmações
      const confirming =
        (input.action === "setPaid" || input.action === "setTeamVerified" || input.action === "setFormatVerified") &&
        input.value;
      if (confirming && reg.status === "REJECTED") {
        throw new RegistrationError("Reative a inscrição antes de confirmar pagamento ou verificações.", 409);
      }

      const now = new Date();
      const who = admin.displayName;
      const nick = reg.nickname;

      let data: Prisma.RegistrationUpdateInput & Flags;
      let entry: AuditEntry;
      let newEditCode: string | undefined;

      switch (input.action) {
        case "setPaid": {
          data = input.value ? { paid: true, paidAt: now, paidBy: who } : { paid: false, paidAt: null, paidBy: null };
          entry = input.value
            ? { action: "PAYMENT_CONFIRMED", description: `marcou ${nick} como pago.` }
            : { action: "PAYMENT_UNDONE", description: `desfez o pagamento de ${nick}.` };
          break;
        }
        case "setTeamVerified": {
          if (input.value) {
            // O servidor exige a lista dos Pokémon conferidos, garantindo que a
            // confirmação veio da tela de comparação (e não de um clique solto).
            const expected = reg.pokemon.map((p) => p.pokemonId).sort((a, b) => a - b);
            const confirmed = [...(input.confirmedPokemonIds ?? [])].sort((a, b) => a - b);
            if (expected.length !== confirmed.length || expected.some((id, i) => id !== confirmed[i])) {
              throw new RegistrationError("Confirme cada Pokémon individualmente antes de verificar o time.", 422);
            }
          }
          data = input.value
            ? { teamVerified: true, teamVerifiedAt: now, teamVerifiedBy: who }
            : { teamVerified: false, teamVerifiedAt: null, teamVerifiedBy: null };
          entry = input.value
            ? { action: "TEAM_VERIFIED", description: `verificou o time de ${nick}.` }
            : { action: "TEAM_UNVERIFIED", description: `removeu a verificação do time de ${nick}.` };
          break;
        }
        case "setFormatVerified": {
          if (input.value) {
            const errors = validateBattleTeam(rulesOf(tournament), reg.pokemon.map(storedSet));
            if (errors.length) throw new RegistrationError(errors.join("\n"), 422);
          }
          data = input.value
            ? { formatVerified: true, formatVerifiedAt: now, formatVerifiedBy: "Validação automática" }
            : { formatVerified: false, formatVerifiedAt: null, formatVerifiedBy: null };
          entry = input.value
            ? { action: "FORMAT_VERIFIED", description: `confirmou elegibilidade automática de ${nick}.` }
            : { action: "FORMAT_UNVERIFIED", description: `removeu a confirmação de elegibilidade automática de ${nick}.` };
          break;
        }
        case "reject": {
          if (reg.status === "REJECTED") throw new RegistrationError("A inscrição já está rejeitada.", 409);
          if (await isInBracket(tx, reg.id)) throw new RegistrationError(IN_BRACKET, 409);
          data = { status: "REJECTED", rejectionReason: input.reason, rejectedAt: now, rejectedBy: who };
          entry = {
            action: "REJECTED",
            description: `rejeitou a inscrição de ${nick}. Motivo: ${input.reason}`,
            metadata: { reason: input.reason },
          };
          break;
        }
        case "restore": {
          if (reg.status !== "REJECTED") throw new RegistrationError("A inscrição não está rejeitada.", 409);
          const active = await countActiveRegistrations(tournament.id, tx);
          if (tournament.maxParticipants > 0 && active >= tournament.maxParticipants) {
            throw new RegistrationError("Não há vagas disponíveis para reativar esta inscrição.", 409);
          }
          data = { status: "PENDING", rejectionReason: null, rejectedAt: null, rejectedBy: null };
          entry = { action: "RESTORED", description: `reativou a inscrição de ${nick}.` };
          break;
        }
        case "updateNickname": {
          const nicknameNormalized = normalizeNickname(input.nickname);
          if (nicknameNormalized !== reg.nicknameNormalized) {
            const taken = await tx.registration.findUnique({
              where: { tournamentId_nicknameNormalized: { tournamentId: tournament.id, nicknameNormalized } },
              select: { id: true },
            });
            if (taken) throw new RegistrationError("Este nick já está inscrito neste torneio.", 409);
          }
          data = { nickname: input.nickname, nicknameNormalized };
          entry = {
            action: "NICKNAME_CHANGED",
            description: `alterou o nick de ${nick} para ${input.nickname}.`,
            metadata: { from: nick, to: input.nickname },
          };
          break;
        }
        case "updateTeam": {
          const replaced = await replaceTeam(tx, tournament, reg, input.pokemon);
          const team = replaced.team;
          data = replaced.data;
          entry = {
            action: "TEAM_CHANGED",
            description: `alterou o time da inscrição de ${nick}.`,
            metadata: { from: reg.pokemon.map((p) => p.pokemonName), to: team.map((p) => p.name) },
          };
          break;
        }
        case "regenerateEditCode": {
          newEditCode = generateEditCode();
          data = { editCodeHash: hashEditCode(newEditCode), editCodeCreatedAt: now };
          entry = { action: "EDIT_CODE_REGENERATED", description: `gerou um novo código de edição para ${nick}.` };
          break;
        }
        case "setClassification": {
          if (!tournament.monotype) throw new RegistrationError("Este torneio não usa a regra Monotype.", 409);
          const error = validateClassification(
            reg.pokemon.map((p) => ({ slot: p.slot, name: p.pokemonName, types: p.types })),
            input.mainType,
            input.wildcardSlots,
            tournament,
          );
          if (error) throw new RegistrationError(error, 422);
          for (const p of reg.pokemon) {
            await tx.registrationPokemon.update({
              where: { id: p.id },
              data: { isWildcard: input.wildcardSlots.includes(p.slot) },
            });
          }
          const possibleTypes = reg.possibleTypes.includes(input.mainType)
            ? reg.possibleTypes
            : [...reg.possibleTypes, input.mainType];
          data = {
            mainType: input.mainType,
            possibleTypes,
            typeAmbiguous: false,
            typeReviewedAt: now,
            typeReviewedBy: who,
          };
          const wildcardNames = reg.pokemon
            .filter((p) => input.wildcardSlots.includes(p.slot))
            .map((p) => p.pokemonName);
          entry = {
            action: "CLASSIFICATION_CHANGED",
            description: `definiu o tipo de ${nick} como ${typeLabel(input.mainType)} (Coringas: ${wildcardNames.join(", ") || "nenhum"}).`,
            metadata: { mainType: input.mainType, wildcards: wildcardNames },
          };
          break;
        }
      }

      const status = computeStatus({
        status: data.status ?? reg.status,
        paid: data.paid ?? reg.paid,
        teamVerified: data.teamVerified ?? reg.teamVerified,
        formatVerified: data.formatVerified ?? reg.formatVerified,
      });
      if (status === "APPROVED" && reg.status !== "APPROVED") entry.description += " Inscrição APROVADA.";
      if (status === "PENDING" && reg.status === "APPROVED") {
        if (await isInBracket(tx, reg.id)) throw new RegistrationError(IN_BRACKET, 409);
        entry.description += " Inscrição voltou para PENDENTE.";
      }

      const updated = await tx.registration.update({ where: { id: reg.id }, data: { ...data, status } });
      await writeAudit(tx, {
        admin,
        tournamentId: tournament.id,
        registration: { id: reg.id, nickname: updated.nickname },
        ...entry,
      });
      return { id: updated.id, status: updated.status, editCode: newEditCode };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new RegistrationError("Este nick já está inscrito neste torneio.", 409);
    throw error;
  }
}

export async function deleteRegistration(admin: CurrentAdmin, registrationId: string) {
  return prisma.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({
      where: { id: registrationId },
      include: { pokemon: { orderBy: { slot: "asc" } }, tournament: { select: { id: true, name: true } } },
    });
    if (!reg) throw new RegistrationError("Inscrição não encontrada.", 404);
    if (await isInBracket(tx, reg.id)) throw new RegistrationError(IN_BRACKET, 409);
    await writeAudit(tx, {
      admin,
      tournamentId: reg.tournament.id,
      registration: { id: reg.id, nickname: reg.nickname },
      action: "DELETED",
      description: `excluiu a inscrição de ${reg.nickname} (${reg.registrationCode ?? "sem código"}) do torneio ${reg.tournament.name}.`,
      metadata: { code: reg.registrationCode, team: reg.pokemon.map((p) => p.pokemonName) },
    });
    await tx.registration.delete({ where: { id: reg.id } });
    return { tournamentId: reg.tournament.id };
  });
}
