/**
 * Dados gerados do repositório oficial do Pokémon Showdown
 * (npm run showdown:sync → src/data/showdown.json). Módulo puro: roda no
 * servidor e no painel (prévia das regras) sem chamar o Showdown em tempo real.
 */
import data from "@/data/showdown.json";

export type ShowdownCategory = "restricted" | "legendary" | "mythical" | "ultraBeast" | "paradox";

type RawFormat = {
  generation: number;
  speciesClause: boolean;
  minTeamSize: number;
  id: string;
  name: string;
  shortName: string;
  section: string;
  gameType: string;
  teamSize: number;
  pickedTeamSize: number | null;
  level: number;
  ruleset: string[];
  banlist: string[];
  description: string | null;
  bans: { reason: string; ids: number[] }[];
};

export type ShowdownSource = {
  repository: string;
  /** "github" (compilado de um commit) ou "npm" (legado) */
  via: "github" | "npm";
  ref: string;
  commit: string | null;
  commitDate: string | null;
  version: string;
  rulesRevision?: string;
  deploymentId?: string;
  generatedAt: string;
};

type RawPokemon = { sd: string; tier: string; natDexTier: string; tags: ShowdownCategory[]; past: boolean };

const raw = data as unknown as {
  source: ShowdownSource;
  pokemon: Record<string, RawPokemon>;
  formats: RawFormat[];
};

/** Formato sem banlist de tier: só valem as caixas de categoria, banimentos e exceções. */
export const FREE_FORMAT_ID = "free";
/** Tier própria do servidor: sem banlist nem Species Clause. */
export const COBBLEMON_FREE_FOR_ALL_FORMAT_ID = "cobblemonfreeforall";

export type FormatOption = Omit<RawFormat, "bans"> & { bannedCount: number };

export const SHOWDOWN_SOURCE = raw.source;

/** "commit b1156ff (14/09/2026)" ou "npm 0.11.11" */
export function showdownSourceLabel(): string {
  const s = SHOWDOWN_SOURCE;
  if (!s.commit) return `npm ${s.version}`;
  const date = s.commitDate ? new Date(s.commitDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
  return `commit ${s.commit.slice(0, 7)}${date ? ` (${date})` : ""}`;
}

export const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: FREE_FORMAT_ID,
    generation: 9, speciesClause: true, minTeamSize: 1,
    name: "Livre (sem tier)",
    shortName: "Livre",
    section: "Personalizado",
    gameType: "singles",
    teamSize: 6,
    pickedTeamSize: null,
    level: 100,
    ruleset: [],
    banlist: [],
    description: "Nenhuma banlist do Showdown. Use as categorias, banimentos e exceções para montar as regras.",
    bannedCount: 0,
  },
  {
    id: COBBLEMON_FREE_FOR_ALL_FORMAT_ID,
    generation: 9, speciesClause: false, minTeamSize: 1,
    name: "Cobblemon Free For All",
    shortName: "Cobblemon Free For All",
    section: "Personalizado",
    gameType: "singles",
    teamSize: 6,
    pickedTeamSize: null,
    level: 100,
    ruleset: [],
    banlist: [],
    description: "Tier do servidor sem banlist nem Species Clause. Todos os Pokémon e espécies repetidas são permitidos.",
    bannedCount: 0,
  },
  ...raw.formats.map(({ bans, ...rest }) => ({ ...rest, bannedCount: bans.reduce((n, b) => n + b.ids.length, 0) })),
];

const formatById = new Map(FORMAT_OPTIONS.map((f) => [f.id, f]));
const banMaps = new Map<string, Map<number, string>>(
  raw.formats.map((f) => [f.id, new Map(f.bans.flatMap((b) => b.ids.map((id) => [id, b.reason] as const)))]),
);

export function isKnownFormat(id: string): boolean {
  return formatById.has(id);
}

export function getFormat(id: string): FormatOption | undefined {
  return formatById.get(id);
}

export function allowsDuplicates(id: string): boolean { return getFormat(id)?.speciesClause === false; }
export function showdownSpecies(id: number): string | undefined { return raw.pokemon[id]?.sd; }
export function generationTypes(formatId: string, id: number): string[] | undefined {
  const generations = (data as unknown as { generations: Record<string, Record<string, string[]>> }).generations;
  return generations[String(getFormat(formatId)?.generation ?? 9)]?.[id];
}

/** Banidos do formato agrupados por motivo (tela de banlists do painel). */
export function formatBanGroups(formatId: string): { reason: string; ids: number[] }[] {
  return raw.formats.find((f) => f.id === formatId)?.bans ?? [];
}

export function formatLabel(id: string): string {
  return formatById.get(id)?.shortName ?? id;
}

/** Motivo do banimento de um Pokémon no formato (null = permitido pelo tier). */
export function formatBanReason(formatId: string, pokemonId: number): string | null {
  if (formatId === FREE_FORMAT_ID || formatId === COBBLEMON_FREE_FOR_ALL_FORMAT_ID) return null;
  const map = banMaps.get(formatId);
  if (!map) return "Formato desconhecido";
  // Pokémon sem correspondência no Showdown não aparece em "pokemon" e é tratado como indisponível
  if (!raw.pokemon[pokemonId]) return "Sem dados no Showdown";
  return map.get(pokemonId) ?? null;
}

export function showdownCategories(pokemonId: number): ShowdownCategory[] {
  return raw.pokemon[pokemonId]?.tags ?? [];
}

export function showdownTier(pokemonId: number): string | null {
  return raw.pokemon[pokemonId]?.tier ?? null;
}

