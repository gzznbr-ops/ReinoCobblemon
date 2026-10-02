import { storedSet } from "@/lib/pokemon/team-set";
export function BattleSetSummary({ pokemonId, battleSet }: { pokemonId: number; battleSet: unknown }) {
  const p = storedSet({ pokemonId, battleSet });
  if (!p.moves.length) return <span className="mt-2 block text-xs text-amber-300">Cadastro antigo: complete ataques, habilidade e item para validar.</span>;
  return <span className="mt-2 block space-y-1 text-xs text-stone-300">
    <span className="block">{p.moves.join(" · ")}</span>
    <span className="block">Habilidade: {p.ability || "Sem habilidade"} · Item: {p.heldItem || "Sem item"}</span>
    <span className="block">Nível {p.level} · {p.nature}{p.gender ? ` · ${p.gender}` : ""}{p.shiny ? " · Shiny" : ""}{p.teraType ? ` · Tera ${p.teraType}` : ""}</span>
    <span className="block">EVs: {Object.values(p.evs).join(" / ")} · IVs: {Object.values(p.ivs).join(" / ")}</span>
  </span>;
}
