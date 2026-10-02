export const POKEMON_TYPES = [
  "normal",
  "fire",
  "water",
  "grass",
  "electric",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export const TYPE_LABELS: Record<PokemonType, string> = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  grass: "Planta",
  electric: "Elétrico",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Venenoso",
  ground: "Terra",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  fairy: "Fada",
};

export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: "#9fa19f",
  fire: "#e62829",
  water: "#2980ef",
  grass: "#3fa129",
  electric: "#e0b000",
  ice: "#3dcef3",
  fighting: "#ff8000",
  poison: "#9141cb",
  ground: "#915121",
  flying: "#81b9ef",
  psychic: "#ef4179",
  bug: "#91a119",
  rock: "#afa981",
  ghost: "#704170",
  dragon: "#5060e1",
  dark: "#624d4e",
  steel: "#60a1b8",
  fairy: "#ef70ef",
};

export function isPokemonType(value: string): value is PokemonType {
  return (POKEMON_TYPES as readonly string[]).includes(value);
}

export function typeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return isPokemonType(type) ? TYPE_LABELS[type] : type;
}

export function spriteUrl(pokemonId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}
