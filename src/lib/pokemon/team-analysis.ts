/**
 * Análise de time — módulo PURO (sem banco, sem Node), usado tanto no
 * navegador (feedback instantâneo) quanto no servidor (validação que vale).
 * Recebe as regras do torneio; a legalidade de cada Pokémon já vem calculada
 * em `banned`/`banReason` (ver src/lib/rules/tournament-rules.ts).
 */
import { POKEMON_TYPES, type PokemonType } from "./types";
import { allowsDuplicates } from "../rules/showdown";

/** Somente o que a análise precisa das regras do torneio. */
export type AnalysisRules = {
  formatId: string;
  teamSize: number;
  monotype: boolean;
  monotypeMinimum: number;
  maxWildcards: number;
};

export function monotypeError(rules: AnalysisRules): string {
  return `Seu time não atende à regra Monotype. Pelo menos ${rules.monotypeMinimum} dos ${rules.teamSize} Pokémon precisam compartilhar um mesmo tipo.`;
}

export type AnalyzablePokemon = {
  id: number;
  speciesId: number;
  name: string;
  types: PokemonType[];
  banned: boolean;
  banReason: string | null;
};

export type TeamAnalysis = {
  complete: boolean;
  valid: boolean;
  errors: string[];
  duplicateSpeciesIds: number[];
  banned: { id: number; name: string; reason: string }[];
  typeCounts: Partial<Record<PokemonType, number>>;
  /** Tipos presentes em pelo menos `monotypeMinimum` Pokémon (só com Monotype). */
  possibleTypes: PokemonType[];
  /** Tipo sugerido (o mais frequente; empate → ordem oficial dos tipos). */
  mainType: PokemonType | null;
  ambiguous: boolean;
  /** IDs dos Pokémon que não possuem o tipo principal. */
  wildcardIds: number[];
};

export function analyzeTeam(team: AnalyzablePokemon[], rules: AnalysisRules): TeamAnalysis {
  const { teamSize } = rules;
  const errors: string[] = [];
  const complete = team.length === teamSize;

  if (team.length !== teamSize) {
    errors.push(`Selecione exatamente ${teamSize} Pokémon (${team.length}/${teamSize}).`);
  }

  // Species Clause (formas da mesma espécie contam como a mesma espécie)
  const seen = new Map<number, number>();
  for (const p of team) seen.set(p.speciesId, (seen.get(p.speciesId) ?? 0) + 1);
  const duplicateSpeciesIds = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (duplicateSpeciesIds.length > 0 && !allowsDuplicates(rules.formatId)) {
    const names = team.filter((p) => duplicateSpeciesIds.includes(p.speciesId)).map((p) => p.name);
    errors.push(`Species Clause: não é permitido repetir a mesma espécie (${[...new Set(names)].join(", ")}).`);
  }

  const banned = team
    .filter((p) => p.banned)
    .map((p) => ({ id: p.id, name: p.name, reason: p.banReason ?? "Proibido" }));
  for (const b of banned) errors.push(`${b.name} é proibido (${b.reason}).`);

  const typeCounts: Partial<Record<PokemonType, number>> = {};
  for (const p of team) {
    for (const t of new Set(p.types)) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }

  let possibleTypes: PokemonType[] = [];
  let mainType: PokemonType | null = null;
  let wildcardIds: number[] = [];

  if (rules.monotype) {
    possibleTypes = POKEMON_TYPES.filter((t) => (typeCounts[t] ?? 0) >= rules.monotypeMinimum).sort(
      (a, b) => (typeCounts[b] ?? 0) - (typeCounts[a] ?? 0) || POKEMON_TYPES.indexOf(a) - POKEMON_TYPES.indexOf(b),
    );
    mainType = possibleTypes[0] ?? null;
    wildcardIds = mainType ? team.filter((p) => !p.types.includes(mainType!)).map((p) => p.id) : [];
    if (complete && !mainType) errors.push(monotypeError(rules));
    else if (complete && wildcardIds.length > rules.maxWildcards) {
      errors.push(`No máximo ${rules.maxWildcards} Coringa(s) fora do tipo principal.`);
    }
  }

  return {
    complete,
    valid: complete && errors.length === 0,
    errors,
    duplicateSpeciesIds,
    banned,
    typeCounts,
    possibleTypes,
    mainType,
    ambiguous: possibleTypes.length > 1,
    wildcardIds,
  };
}

/**
 * Valida uma classificação manual (tipo principal + Coringas) feita pelo admin.
 * Regras: o tipo precisa atingir o mínimo, todo Pokémon que NÃO é Coringa
 * precisa ter o tipo principal e o número de Coringas não pode passar do limite.
 */
export function validateClassification(
  team: { slot: number; name: string; types: string[] }[],
  mainType: string,
  wildcardSlots: number[],
  rules: AnalysisRules,
): string | null {
  const count = team.filter((p) => p.types.includes(mainType)).length;
  if (count < rules.monotypeMinimum) {
    return `Apenas ${count} Pokémon possuem esse tipo (mínimo ${rules.monotypeMinimum}).`;
  }
  if (wildcardSlots.length > rules.maxWildcards) {
    return `No máximo ${rules.maxWildcards} Coringas são permitidos.`;
  }
  const slots = new Set(team.map((p) => p.slot));
  if (wildcardSlots.some((s) => !slots.has(s))) return "Slot de Coringa inválido.";
  for (const p of team) {
    if (!wildcardSlots.includes(p.slot) && !p.types.includes(mainType)) {
      return `${p.name} não possui o tipo escolhido e precisa ser marcado como Coringa.`;
    }
  }
  return null;
}
