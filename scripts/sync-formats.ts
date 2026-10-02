import { readFileSync, writeFileSync } from "node:fs";
import { Dex, simulatorFor } from "../src/lib/rules/simulator";
import type { PokemonSet } from "@pkmn/sim";

const path = "src/data/showdown.json";
const simulatorVersion = JSON.parse(readFileSync("node_modules/@pkmn/sim/package.json", "utf8")).version as string;
const modsVersion = JSON.parse(readFileSync("node_modules/@pkmn/mods/package.json", "utf8")).version as string;
if (simulatorVersion !== modsVersion) throw new Error("O validador e os mods precisam usar a mesma versão antes de sincronizar.");
const previous = JSON.parse(readFileSync(path, "utf8"));
const pokemon = previous.pokemon as Record<string, { sd: string }>;
// @pkmn/sim 0.10.11 registers extended formats for get(), but not for all().
const candidates = [...Dex.formats.all(), ...["gen9vgc2023regc", "gen9vgc2023regd", "gen9nfe"].map(id => Dex.formats.get(id))];
const formats = [...new Map(candidates.map(f => [f.id, f])).values()].filter(f => /^gen[1-9]$/.test(f.mod) || ["gen9vgc2023regc", "gen9vgc2023regd"].includes(f.id))
  .filter(f => !f.team && ["singles", "doubles"].includes(f.gameType) && !f.id.includes("customgame"))
  .map(f => {
    const v = simulatorFor(f.id);
    const rules = v.ruleTable;
    const groups = new Map<string, number[]>();
    for (const [id, p] of Object.entries(pokemon)) {
      const species = v.dex.species.get(p.sd);
      const reason = !species.exists || species.gen > v.dex.gen ? "Indisponível nesta geração" :
        v.checkSpecies({ species: species.name, name: species.name, ability: species.abilities[0], item: "", moves: [] } as unknown as PokemonSet, species, species, {});
      if (reason) groups.set(reason, [...(groups.get(reason) ?? []), Number(id)]);
    }
    return { id: f.id, name: f.name, shortName: f.name, section: f.gameType === "doubles" ? "Duplas" : "Singles",
      generation: v.dex.gen, speciesClause: rules.has("speciesclause"), minTeamSize: rules.minTeamSize,
      gameType: f.gameType, teamSize: Math.min(6, rules.maxTeamSize), pickedTeamSize: rules.pickedTeamSize || null,
      level: rules.adjustLevel || rules.maxLevel, ruleset: f.ruleset, banlist: f.banlist,
      description: f.desc || null, bans: [...groups].map(([reason, ids]) => ({ reason, ids })) };
  });
const generations = Object.fromEntries(Array.from({ length: 9 }, (_, i) => {
  const dex = Dex.mod(`gen${i + 1}`);
  return [i + 1, Object.fromEntries(Object.entries(pokemon).map(([id, p]) => [id, dex.species.get(p.sd).types.map(t => t.toLowerCase())]))];
}));
writeFileSync(path, JSON.stringify({ ...previous, source: { repository: "https://github.com/pkmn/ps", via: "npm", ref: "@pkmn/sim", commit: null, commitDate: null, version: simulatorVersion, generatedAt: new Date().toISOString() }, formats, generations }));
console.log(`Gerados ${formats.length} formatos das gerações 1 a 9.`);
