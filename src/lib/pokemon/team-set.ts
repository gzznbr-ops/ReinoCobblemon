import { z } from "zod";

const name = z.string().trim().max(80);
const stats = (max: number, value: number) => z.object({
  hp: z.number().int().min(0).max(max).default(value), atk: z.number().int().min(0).max(max).default(value),
  def: z.number().int().min(0).max(max).default(value), spa: z.number().int().min(0).max(max).default(value),
  spd: z.number().int().min(0).max(max).default(value), spe: z.number().int().min(0).max(max).default(value),
});
export const teamSetSchema = z.object({
  id: z.number().int().positive().max(100000),
  moves: z.array(name.min(1)).min(1, "Informe pelo menos um ataque por Pokémon.").max(4),
  ability: name, heldItem: name,
  level: z.number().int().min(1).max(100),
  nature: name, gender: z.enum(["", "M", "F", "N"]), shiny: z.boolean(), teraType: name,
  evs: stats(252, 0), ivs: stats(31, 31),
});
export const teamSetsSchema = z.array(teamSetSchema).min(1).max(6);
export type TeamSet = z.infer<typeof teamSetSchema>;
export const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export function defaultSet(id: number): TeamSet {
  return { id, moves: [], ability: "", heldItem: "", level: 100, nature: "Serious", gender: "", shiny: false, teraType: "",
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } };
}
export function serializeSet(p: { id: number; set?: TeamSet }): TeamSet {
  const set = p.set ?? defaultSet(p.id);
  return { ...set, id: p.id, moves: set.moves.map(m => m.trim()).filter(Boolean) };
}
export function storedSet(p: { pokemonId: number; battleSet: unknown }): TeamSet {
  const parsed = teamSetSchema.safeParse(p.battleSet);
  return parsed.success ? { ...parsed.data, id: p.pokemonId } : defaultSet(p.pokemonId);
}
