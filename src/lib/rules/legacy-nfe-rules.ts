// Pokémon Showdown MIT-licensed rules, commit b1156ff.
// Source: https://raw.githubusercontent.com/smogon/pokemon-showdown/b1156ff/data/rulesets.ts
import type { Dex } from "@pkmn/sim";
export const nfeRules: Parameters<typeof Dex.formats.extend>[0] = [{
		effectType: 'ValidatorRule',
		name: 'Standard OMs',
		desc: "The standard ruleset for all Smogon OMs (Almost Any Ability, STABmons, etc.)",
		ruleset: [
			'Standard AG',
			'Species Clause', 'Nickname Clause', 'OHKO Clause', 'Evasion Moves Clause', 'Overflow Stat Mod',
		],
	},
{
		effectType: 'ValidatorRule',
		name: 'Not Fully Evolved',
		desc: "Bans Pok&eacute;mon that are fully evolved or can't evolve",
		onValidateSet(set) {
			const species = this.dex.species.get(set.species);
			if (!species.nfe) {
				return [set.species + " cannot evolve."];
			}
		},
	}];
