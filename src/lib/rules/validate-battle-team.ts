import { type PokemonSet } from "@pkmn/sim";
import { Dex, simulatorFor, TeamValidator } from "./simulator";
import { getFormat, showdownSpecies, FREE_FORMAT_ID, COBBLEMON_FREE_FOR_ALL_FORMAT_ID } from "./showdown";
import { getPokemonEntry, type TournamentRules } from "./tournament-rules";
import { analyzeTeam } from "../pokemon/team-analysis";
import { teamSetsSchema, type TeamSet } from "../pokemon/team-set";

/** Pure authoritative validator: uses IDs and tournament rules, never client legality flags. */
export function validateBattleTeam(rules: TournamentRules, input: unknown): string[] {
  const parsed = teamSetsSchema.safeParse(input);
  if (!parsed.success) return [parsed.error.issues[0]?.message ?? "Complete os dados do time."];
  const team = parsed.data;
  const entries = team.map(p => getPokemonEntry(rules, p.id));
  if (entries.some(p => !p)) return ["Pokémon desconhecido."];
  const errors = analyzeTeam(entries.filter(p => !!p), rules).errors;
  const format = getFormat(rules.formatId);
  if (!format) return ["Formato desconhecido."];
  const unrestricted = [FREE_FORMAT_ID, COBBLEMON_FREE_FOR_ALL_FORMAT_ID].includes(rules.formatId);
  const dex = unrestricted ? Dex : simulatorFor(rules.formatId).dex;
  for (const p of team) {
    const label = getPokemonEntry(rules, p.id)!.name;
    if (p.moves.some(m => !dex.moves.get(m).exists)) errors.push(`${label}: ataque desconhecido.`);
    if (p.heldItem && !dex.items.get(p.heldItem).exists) errors.push(`${label}: item desconhecido.`);
    if (p.ability && !dex.abilities.get(p.ability).exists) errors.push(`${label}: habilidade desconhecida.`);
    if (!unrestricted && format.generation >= 3 && !p.ability) errors.push(`${label}: informe a habilidade.`);
    if (format.generation < 3 && p.ability) errors.push(`${label}: esta geração não possui habilidades.`);
    if (format.generation < 2 && p.heldItem) errors.push(`${label}: esta geração não possui itens segurados.`);
    if (p.nature && !dex.natures.get(p.nature).exists) errors.push(`${label}: natureza desconhecida.`);
    if (p.teraType && !Dex.types.get(p.teraType).exists) errors.push(`${label}: tipo Tera desconhecido.`);
  }
  if (errors.length || unrestricted) return errors;
  const sets = team.map(p => toSimulatorSet(p));
  // Explicit species exceptions lift species bans, while moves/items/abilities retain their rules.
  const extra = rules.allowedPokemonIds.map(id => showdownSpecies(id)).filter(Boolean).map(s => `+${s}`);
  const validator = extra.length ? new TeamValidator(`${rules.formatId}@@@${extra.join(",")}`, dex) : simulatorFor(rules.formatId);
  return (validator.validateTeam(sets) ?? []).filter(e => !e.includes("has exactly 0 EVs - did you forget") && !e.includes("EVs, but this format does not restrict you to 510 EVs"));
}

function toSimulatorSet(p: TeamSet): PokemonSet {
  return { name: "", species: showdownSpecies(p.id) ?? "", item: p.heldItem, ability: p.ability,
    moves: [...p.moves], nature: p.nature, level: p.level, gender: p.gender, shiny: p.shiny,
    teraType: p.teraType || undefined, evs: { ...p.evs }, ivs: { ...p.ivs } } as PokemonSet;
}

export function battleOptions(formatId: string, pokemonId: number) {
  const format = getFormat(formatId);
  if (!format) return null;
  const dex = [FREE_FORMAT_ID, COBBLEMON_FREE_FOR_ALL_FORMAT_ID].includes(formatId) ? Dex : simulatorFor(formatId).dex;
  const species = dex.species.get(showdownSpecies(pokemonId) ?? "");
  if (!species.exists) return null;
  return { generation: format.generation, level: format.level, gender: species.gender ?? "", requiredItem: species.requiredItems?.[0] ?? "",
    abilities: format.generation >= 3 ? Object.values(species.abilities) : [],
    moves: dex.moves.all().filter(m => m.gen <= format.generation && m.exists).map(m => m.name).sort(),
    items: format.generation >= 2 ? dex.items.all().filter(i => i.gen <= format.generation && i.exists).map(i => i.name).sort() : [],
    allAbilities: format.generation >= 3 ? dex.abilities.all().filter(a => a.gen <= format.generation && a.exists).map(a => a.name).sort() : [],
    natures: dex.natures.all().map(n => n.name), types: Dex.types.all().filter(t => t.name !== "???").map(t => t.name),
  };
}
