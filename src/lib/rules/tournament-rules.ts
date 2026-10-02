/**
 * Legalidade dos Pokémon em um torneio. Módulo PURO (servidor e painel).
 *
 * Precedência (da mais forte para a mais fraca):
 *   1. allowedPokemonIds → sempre permitido (exceção do torneio)
 *   2. bannedPokemonIds  → sempre proibido
 *   3. categorias desmarcadas (lendário restrito, sub-lendário, mítico, UB, Paradox)
 *   4. banlist do formato do Showdown (tier, Pokémon fora do jogo, regras do formato)
 */
import rawData from "@/data/pokemon.json";
import type { PokemonType } from "@/lib/pokemon/types";
import { formatBanReason, generationTypes, showdownCategories, type ShowdownCategory } from "./showdown";
import type { TeamSet } from "../pokemon/team-set";

export type TournamentRules = {
  formatId: string;
  teamSize: number;
  allowRestricted: boolean;
  allowLegendary: boolean;
  allowMythical: boolean;
  allowUltraBeast: boolean;
  allowParadox: boolean;
  bannedPokemonIds: number[];
  allowedPokemonIds: number[];
  monotype: boolean;
  monotypeMinimum: number;
  maxWildcards: number;
};

export const RULE_KEYS = [
  "formatId",
  "teamSize",
  "allowRestricted",
  "allowLegendary",
  "allowMythical",
  "allowUltraBeast",
  "allowParadox",
  "bannedPokemonIds",
  "allowedPokemonIds",
  "monotype",
  "monotypeMinimum",
  "maxWildcards",
] as const satisfies readonly (keyof TournamentRules)[];

export function pickRules(source: TournamentRules): TournamentRules {
  return Object.fromEntries(RULE_KEYS.map((k) => [k, source[k]])) as TournamentRules;
}

export const CATEGORIES: {
  key: ShowdownCategory;
  field: "allowRestricted" | "allowLegendary" | "allowMythical" | "allowUltraBeast" | "allowParadox";
  label: string;
  plural: string;
  example: string;
}[] = [
  { key: "restricted", field: "allowRestricted", label: "Lendário restrito", plural: "Lendários restritos", example: "Mewtwo, Koraidon, Zacian" },
  { key: "legendary", field: "allowLegendary", label: "Sub-lendário", plural: "Sub-lendários", example: "Zapdos, Landorus, Chien-Pao" },
  { key: "mythical", field: "allowMythical", label: "Mítico", plural: "Míticos", example: "Mew, Magearna, Pecharunt" },
  { key: "ultraBeast", field: "allowUltraBeast", label: "Ultra Beast", plural: "Ultra Beasts", example: "Kartana, Buzzwole" },
  { key: "paradox", field: "allowParadox", label: "Paradox", plural: "Paradox", example: "Great Tusk, Iron Valiant" },
];

export type PokemonRecord = {
  id: number;
  speciesId: number;
  slug: string;
  speciesSlug: string;
  name: string;
  types: PokemonType[];
  legendary: boolean;
  mythical: boolean;
};

/** Pokémon com a legalidade já calculada para um torneio. */
export type PokemonEntry = {
  set?: TeamSet;
  id: number;
  speciesId: number;
  name: string;
  types: PokemonType[];
  categories: ShowdownCategory[];
  banned: boolean;
  banReason: string | null;
};

export const POKEMON_RECORDS = rawData as PokemonRecord[];
const recordById = new Map(POKEMON_RECORDS.map((p) => [p.id, p]));

export function getPokemonRecord(id: number): PokemonRecord | undefined {
  return recordById.get(id);
}

export function banReasonFor(rules: TournamentRules, pokemonId: number): string | null {
  if (rules.allowedPokemonIds.includes(pokemonId)) return null;
  if (rules.bannedPokemonIds.includes(pokemonId)) return "Banido nas regras do torneio";
  const categories = showdownCategories(pokemonId);
  for (const cat of CATEGORIES) {
    if (!rules[cat.field] && categories.includes(cat.key)) return `${cat.label} não permitido`;
  }
  return formatBanReason(rules.formatId, pokemonId);
}

export function entryFor(rules: TournamentRules, record: PokemonRecord): PokemonEntry {
  const banReason = banReasonFor(rules, record.id);
  return {
    id: record.id,
    speciesId: record.speciesId,
    name: record.name,
    types: (generationTypes(rules.formatId, record.id) ?? record.types) as PokemonType[],
    categories: showdownCategories(record.id),
    banned: banReason !== null,
    banReason,
  };
}

export function pokemonEntriesFor(rules: TournamentRules): PokemonEntry[] {
  return POKEMON_RECORDS.map((r) => entryFor(rules, r));
}

export function getPokemonEntry(rules: TournamentRules, id: number): PokemonEntry | undefined {
  const record = recordById.get(id);
  return record ? entryFor(rules, record) : undefined;
}

/** Resumo legível das regras (página pública e confirmações). */
export function describeCategories(rules: TournamentRules): { allowed: string[]; banned: string[] } {
  return {
    allowed: CATEGORIES.filter((c) => rules[c.field]).map((c) => c.plural),
    banned: CATEGORIES.filter((c) => !rules[c.field]).map((c) => c.plural),
  };
}
