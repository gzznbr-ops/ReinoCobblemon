import test from "node:test";
import assert from "node:assert/strict";
import { validateBattleTeam } from "./validate-battle-team";
import { defaultSet, storedSet, serializeSet } from "../pokemon/team-set";
import { FORMAT_OPTIONS, generationTypes } from "./showdown";
import { simulatorFor } from "./simulator";
import type { TournamentRules } from "./tournament-rules";

const rules = (formatId = "gen9ou", size = 1): TournamentRules => ({ formatId, teamSize: size, allowRestricted: true, allowLegendary: true, allowMythical: true, allowUltraBeast: true, allowParadox: true, bannedPokemonIds: [], allowedPokemonIds: [], monotype: false, monotypeMinimum: 1, maxWildcards: 0 });
const pikachu = () => ({ ...defaultSet(25), moves: ["Thunderbolt"], ability: "Static" });
test("all nine generations have usable formats and legal basic teams", () => {
  for (let gen = 1; gen <= 9; gen++) {
    assert.ok(FORMAT_OPTIONS.some(f => f.id === `gen${gen}ou`));
    assert.deepEqual(validateBattleTeam(rules(`gen${gen}ou`), [{ ...pikachu(), ability: gen < 3 ? "" : "Static" }]), [], `gen ${gen}`);
  }
  for (const f of FORMAT_OPTIONS.filter(f => f.id.startsWith("gen"))) assert.ok(simulatorFor(f.id));
});
test("rejects illegal learnsets, abilities and banned items", () => {
  assert.match(validateBattleTeam(rules(), [{ ...pikachu(), moves: ["Spore"] }]).join(), /learn|Spore/);
  assert.match(validateBattleTeam(rules(), [{ ...pikachu(), ability: "Levitate" }]).join(), /Levitate/);
  assert.ok(validateBattleTeam(rules(), [{ ...pikachu(), heldItem: "King's Rock" }]).length);
});
test("generation availability and species bans cannot be bypassed", () => {
  assert.ok(validateBattleTeam(rules("gen1ou"), [{ ...defaultSet(906), moves: ["Tackle"] }]).length);
  assert.ok(validateBattleTeam(rules("gen1ou"), [{ ...pikachu(), ability: "", moves: ["Volt Tackle"] }]).length);
  assert.ok(validateBattleTeam(rules(), [{ ...defaultSet(150), ability: "Pressure", moves: ["Psychic"] }]).length);
  assert.deepEqual(generationTypes("gen1ou", 35), ["normal"]);
  assert.deepEqual(generationTypes("gen9ou", 35), ["fairy"]);
});
test("team clauses and item clause apply to the whole team", () => {
  assert.ok(validateBattleTeam(rules("gen9ou", 2), [pikachu(), pikachu()]).length);
  const team = [25, 59, 130, 445].map(id => ({ ...defaultSet(id), level: 50, moves: ["Protect"], heldItem: "Leftovers", ability: id === 25 ? "Static" : id === 445 ? "Rough Skin" : "Intimidate" }));
  assert.match(validateBattleTeam(rules("gen9vgc2023regc", 4), team).join(), /item|Leftovers/i);
});
test("freeforall allows duplicates and normally illegal combinations, while respecting explicit tournament rules", () => {
  const p = { ...pikachu(), ability: "Wonder Guard", moves: ["Spore"], heldItem: "King's Rock" };
  assert.deepEqual(validateBattleTeam(rules("cobblemonfreeforall", 2), [p, p]), []);
  assert.ok(validateBattleTeam({ ...rules("cobblemonfreeforall"), bannedPokemonIds: [25] }, [p]).length);
});
test("incomplete legacy sets and fabricated names fail closed; serialization retains changes", () => {
  assert.ok(validateBattleTeam(rules(), [storedSet({ pokemonId: 25, battleSet: null })]).length);
  assert.ok(validateBattleTeam(rules("cobblemonfreeforall"), [{ ...pikachu(), moves: ["made up attack"] }]).length);
  const p = { ...pikachu(), moves: ["Thunderbolt", "", "Protect", ""] };
  assert.deepEqual(serializeSet({ id: 25, set: p }).moves, ["Thunderbolt", "Protect"]);
  assert.deepEqual(storedSet({ pokemonId: 25, battleSet: pikachu() }), pikachu());
});
test("species exceptions do not bypass move legality", () => {
  const custom = { ...rules(), allowedPokemonIds: [150] };
  assert.deepEqual(validateBattleTeam(custom, [{ ...defaultSet(150), moves: ["Psychic"], ability: "Pressure" }]), []);
  assert.ok(validateBattleTeam(custom, [{ ...defaultSet(150), moves: ["Spore"], ability: "Pressure" }]).length);
});
