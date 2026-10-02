import { z } from "zod";
import { POKEMON_TYPES } from "./pokemon/types";
import { NICKNAME_REGEX } from "./nickname";
import { fromDateTimeLocalInput } from "./format";
import { getFormat, isKnownFormat } from "./rules/showdown";
import { getPokemonRecord } from "./rules/tournament-rules";
import { teamSetsSchema } from "./pokemon/team-set";

export const nicknameSchema = z
  .string({ required_error: "Informe seu nick." })
  .trim()
  .regex(NICKNAME_REGEX, "Nick inválido. Use 3 a 16 caracteres: letras, números ou _.");

/** O tamanho exato é conferido contra o torneio no serviço. */
export const pokemonIdsSchema = z
  .array(z.number().int().positive().max(100000))
  .min(1, "Selecione seus Pokémon.")
  .max(6, "No máximo 6 Pokémon.");

const tournamentSlugSchema = z.string().trim().min(1).max(80);

export const registrationInputSchema = z.object({
  tournament: tournamentSlugSchema,
  nickname: nicknameSchema,
  pokemon: teamSetsSchema,
  /** honeypot: precisa vir vazio */
  website: z.string().max(200).optional(),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const adminActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setPaid"), value: z.boolean() }),
  z.object({
    action: z.literal("setTeamVerified"),
    value: z.boolean(),
    confirmedPokemonIds: z.array(z.number().int()).max(6).optional(),
  }),
  z.object({ action: z.literal("setFormatVerified"), value: z.boolean() }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3, "Informe o motivo.").max(300) }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("updateNickname"), nickname: nicknameSchema }),
  z.object({ action: z.literal("updateTeam"), pokemon: teamSetsSchema }),
  z.object({ action: z.literal("regenerateEditCode") }),
  z.object({
    action: z.literal("setClassification"),
    mainType: z.enum(POKEMON_TYPES),
    wildcardSlots: z.array(z.number().int().min(1).max(6)).max(6),
  }),
]);

export type AdminAction = z.infer<typeof adminActionSchema>;

const money = z.number({ invalid_type_error: "Informe um valor." }).int().min(0).max(1_000_000_000);
const pokemonIdList = z
  .array(z.number().int().positive())
  .max(1200)
  .refine((ids) => ids.every((id) => getPokemonRecord(id)), "Pokémon desconhecido na lista.")
  .transform((ids) => [...new Set(ids)].sort((a, b) => a - b));

/** Caminhos do próprio site que não podem virar endereço de torneio (/<slug>). */
export const RESERVED_SLUGS = ["admin", "api", "registration", "_next", "torneios"];

export const TOURNAMENT_STATUSES = ["DRAFT", "SCHEDULED", "IN_PROGRESS", "FINISHED", "CANCELLED"] as const;
export const MATCH_FORMATS = ["MD1", "MD3", "MD5"] as const;
export const COMPETITION_FORMATS = ["SINGLE_ELIMINATION", "ROUND_ROBIN"] as const;

export const tournamentSchema = z
  .object({
    name: z.string().trim().min(3, "Nome muito curto.").max(80),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Endereço inválido: use letras minúsculas, números e hífens.")
      .max(60)
      .refine((s) => !RESERVED_SLUGS.includes(s), "Este endereço é reservado pelo site. Escolha outro."),
    description: z.string().trim().max(1000),
    status: z.enum(TOURNAMENT_STATUSES),
    startsAt: z
      .string()
      .transform((value, ctx) => {
        const date = fromDateTimeLocalInput(value);
        if (!date) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe dia e horário válidos." });
          return z.NEVER;
        }
        return date;
      }),
    endsAt: z
      .string()
      .transform((value, ctx) => {
        const date = fromDateTimeLocalInput(value);
        if (!date) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe uma duração válida para o torneio." });
          return z.NEVER;
        }
        return date;
      }),
    competitionFormat: z.enum(COMPETITION_FORMATS),
    roundRobinTurns: z.number().int().min(1).max(2),
    pointsForWin: z.number().int().min(0).max(20),
    pointsForDraw: z.number().int().min(0).max(20),
    pointsForLoss: z.number().int().min(0).max(20),
    allowDraw: z.boolean(),
    formatId: z.string().refine(isKnownFormat, "Tier/formato desconhecido."),
    teamSize: z.number().int().min(1, "Time mínimo de 1 Pokémon.").max(6, "Time máximo de 6 Pokémon."),
    matchFormat: z.enum(MATCH_FORMATS),
    allowRestricted: z.boolean(),
    allowLegendary: z.boolean(),
    allowMythical: z.boolean(),
    allowUltraBeast: z.boolean(),
    allowParadox: z.boolean(),
    bannedPokemonIds: pokemonIdList,
    allowedPokemonIds: pokemonIdList,
    monotype: z.boolean(),
    monotypeMinimum: z.number().int().min(1).max(6),
    maxWildcards: z.number().int().min(0).max(5),
    customRules: z.string().trim().max(3000),
    entryFee: money,
    maxParticipants: z.number().int().min(0).max(1024),
    registrationsOpen: z.boolean(),
    prizeFirst: money,
    prizeSecond: money,
    prizeThird: money,
    rewardDetails: z.string().trim().max(1000),
    thirdPlaceMatch: z.boolean(),
  })
  .superRefine((t, ctx) => {
    const format = getFormat(t.formatId);
    if (format && (t.teamSize < format.minTeamSize || t.teamSize > format.teamSize)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["teamSize"], message: `Esta tier aceita de ${format.minTeamSize} a ${format.teamSize} Pokémon por time.` });
    }
    if (t.endsAt <= t.startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "A duração precisa terminar depois do início." });
    }
    if (t.endsAt.getTime() - t.startsAt.getTime() > 90 * 24 * 60 * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "A duração máxima é de 90 dias." });
    }
    if (t.monotype && t.monotypeMinimum > t.teamSize) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O mínimo do Monotype não pode ser maior que o time." });
    }
    const both = t.bannedPokemonIds.filter((id) => t.allowedPokemonIds.includes(id));
    if (both.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Um Pokémon não pode estar em banidos e exceções ao mesmo tempo." });
    }
  });

export type TournamentInput = z.infer<typeof tournamentSchema>;

export const tournamentQuickSchema = z
  .object({ registrationsOpen: z.boolean(), status: z.enum(TOURNAMENT_STATUSES) })
  .partial()
  .strict();

export const tournamentDeleteSchema = z.object({ confirmName: z.string().max(100) }).strict();

export const bracketActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), seeding: z.enum(["random", "registration"]) }),
  z.object({ action: z.literal("reset") }),
  z.object({
    action: z.literal("report"),
    matchId: z.string().min(1).max(40),
    winnerId: z.string().min(1).max(40).nullable(),
    resultType: z.enum(["NORMAL", "DRAW", "WALKOVER", "DISQUALIFICATION"]).default("NORMAL"),
    score: z.string().trim().max(20).optional(),
  }),
  z.object({ action: z.literal("clear"), matchId: z.string().min(1).max(40) }),
  z.object({
    action: z.literal("schedule"),
    matchId: z.string().min(1).max(40),
    scheduledAt: z.string().max(20).nullable(),
  }),
  z.object({
    action: z.literal("swap"),
    registrationA: z.string().min(1).max(40),
    registrationB: z.string().min(1).max(40),
  }),
]);

export type BracketAction = z.infer<typeof bracketActionSchema>;

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export const editLookupSchema = z.object({
  tournament: tournamentSlugSchema,
  nickname: nicknameSchema,
  code: z.string({ required_error: "Informe o código de edição." }).trim().min(8, "Código de edição inválido.").max(20),
});

export const editTeamSchema = editLookupSchema.extend({ pokemon: teamSetsSchema });
