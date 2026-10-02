// Gera src/data/pokemon.json a partir da PokeAPI (GraphQL).
//
// O arquivo gerado é versionado no repositório: o site NUNCA depende da PokeAPI
// em tempo de execução para validar inscrições (a validação no servidor usa
// apenas este arquivo + src/config/competitive-rules.ts).
//
// Uso: npm run pokemon:sync
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ENDPOINT = "https://beta.pokeapi.co/graphql/v1beta";
const MAX_SPECIES = 1025; // Gen 1–9

const QUERY = `{
  pokemon_v2_pokemon(order_by: {id: asc}, where: {pokemon_species_id: {_lte: ${MAX_SPECIES}}}) {
    id
    name
    is_default
    pokemon_species_id
    pokemon_v2_pokemonspecy { name is_legendary is_mythical }
    pokemon_v2_pokemontypes(order_by: {slot: asc}) { pokemon_v2_type { name } }
  }
}`;

// Formas alternativas incluídas (formas de batalha, megas, gmax, totem e
// variações apenas cosméticas ficam de fora).
const INCLUDED_FORM_PATTERNS = [
  /-(alola|galar|hisui)$/,
  /^darmanitan-galar-standard$/,
  /^tauros-paldea-(combat|blaze|aqua)-breed$/,
  /^wooper-paldea$/,
  /^rotom-(heat|wash|frost|fan|mow)$/,
  /^wormadam-(sandy|trash)$/,
  /^oricorio-(pom-pom|pau|sensu)$/,
  /^lycanroc-(midnight|dusk)$/,
  /^(meowstic|indeedee|basculegion|oinkologne)-female$/,
  /^basculin-white-striped$/,
  /^toxtricity-low-key$/,
  /^urshifu-rapid-strike$/,
  /^ogerpon-(wellspring|hearthflame|cornerstone)-mask$/,
  /-therian$/,
  /^deoxys-(attack|defense|speed)$/,
  /^shaymin-sky$/,
  /^(giratina|dialga|palkia)-origin$/,
  /^kyurem-(black|white)$/,
  /^hoopa-unbound$/,
  /^necrozma-(dusk|dawn)$/,
  /^calyrex-(ice|shadow)$/,
];
const EXCLUDED_PATTERNS = [/-totem/, /-mega/, /-gmax$/, /-zen$/, /-primal$/];

const SPECIAL_SPECIES_NAMES = {
  "mr-mime": "Mr. Mime",
  "mime-jr": "Mime Jr.",
  "mr-rime": "Mr. Rime",
  farfetchd: "Farfetch'd",
  sirfetchd: "Sirfetch'd",
  "type-null": "Type: Null",
  "ho-oh": "Ho-Oh",
  "porygon-z": "Porygon-Z",
  "jangmo-o": "Jangmo-o",
  "hakamo-o": "Hakamo-o",
  "kommo-o": "Kommo-o",
  "nidoran-f": "Nidoran-F",
  "nidoran-m": "Nidoran-M",
  flabebe: "Flabébé",
  "chien-pao": "Chien-Pao",
  "ting-lu": "Ting-Lu",
  "chi-yu": "Chi-Yu",
  "wo-chien": "Wo-Chien",
};

const SPECIAL_FORM_SUFFIX = {
  "galar-standard": "Galar",
  "paldea-combat-breed": "Paldea-Combat",
  "paldea-blaze-breed": "Paldea-Blaze",
  "paldea-aqua-breed": "Paldea-Aqua",
  female: "F",
  "wellspring-mask": "Wellspring",
  "hearthflame-mask": "Hearthflame",
  "cornerstone-mask": "Cornerstone",
};

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function speciesDisplayName(slug) {
  return SPECIAL_SPECIES_NAMES[slug] ?? slug.split("-").map(title).join(" ");
}

function displayName(pokemonSlug, speciesSlug, isDefault) {
  const base = speciesDisplayName(speciesSlug);
  if (isDefault || !pokemonSlug.startsWith(`${speciesSlug}-`)) return base;
  const suffix = pokemonSlug.slice(speciesSlug.length + 1);
  const pretty = SPECIAL_FORM_SUFFIX[suffix] ?? suffix.split("-").map(title).join("-");
  return `${base}-${pretty}`;
}

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: QUERY }),
});
if (!res.ok) throw new Error(`PokeAPI respondeu ${res.status}`);
const json = await res.json();
if (json.errors) throw new Error(JSON.stringify(json.errors));

const list = json.data.pokemon_v2_pokemon
  .filter((p) => {
    if (EXCLUDED_PATTERNS.some((re) => re.test(p.name))) return false;
    if (p.is_default) return true;
    return INCLUDED_FORM_PATTERNS.some((re) => re.test(p.name));
  })
  .map((p) => ({
    id: p.id,
    speciesId: p.pokemon_species_id,
    slug: p.name,
    speciesSlug: p.pokemon_v2_pokemonspecy.name,
    name: displayName(p.name, p.pokemon_v2_pokemonspecy.name, p.is_default),
    types: p.pokemon_v2_pokemontypes.map((t) => t.pokemon_v2_type.name),
    legendary: p.pokemon_v2_pokemonspecy.is_legendary,
    mythical: p.pokemon_v2_pokemonspecy.is_mythical,
  }))
  .sort((a, b) => a.speciesId - b.speciesId || a.id - b.id);

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, "..", "src", "data", "pokemon.json");
writeFileSync(out, JSON.stringify(list) + "\n");
console.log(`✔ ${list.length} Pokémon salvos em ${path.relative(process.cwd(), out)}`);
