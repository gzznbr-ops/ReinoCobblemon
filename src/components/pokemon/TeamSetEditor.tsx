"use client";
import { useEffect, useId, useState } from "react";
import { withBase } from "@/lib/base-path";
import { defaultSet, serializeSet, STATS, type TeamSet } from "@/lib/pokemon/team-set";
import { getFormat } from "@/lib/rules/showdown";
import type { TeamSlots } from "./PokemonPicker";

type Options = { moves: string[]; items: string[]; abilities: string[]; allAbilities: string[]; natures: string[]; types: string[] };
export function TeamSetEditor({ slots, onChange, formatId }: { slots: TeamSlots; onChange: (slots: TeamSlots) => void; formatId: string }) {
  return <section className="mt-6 space-y-3"><h3 className="label">Ataques, habilidade e item</h3>
    <p className="text-xs text-stone-400">Informe os dados do Pokémon que você usará no torneio. Use os nomes em inglês das sugestões. As combinações serão verificadas automaticamente.</p>
    {slots.map((p, i) => p && <SetCard key={`${i}-${p.id}`} index={i} name={p.name} formatId={formatId} set={p.set ?? defaultSet(p.id)}
      onChange={set => onChange(slots.map((slot, n) => n === i ? { ...p, set } : slot))} />)}
  </section>;
}
function SetCard({ index, name, formatId, set, onChange }: { index: number; name: string; formatId: string; set: TeamSet; onChange: (set: TeamSet) => void }) {
  const id = useId();
  const [options, setOptions] = useState<Options | null>(null);
  const [failed, setFailed] = useState(false);
  const generation = getFormat(formatId)?.generation ?? 9;
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch(withBase(`/api/teams/options?format=${encodeURIComponent(formatId)}&pokemon=${set.id}`), { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(setOptions).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [formatId, set.id]);
  function field(key: "ability" | "heldItem" | "nature" | "teraType", label: string, values: string[]) {
    return <label className="block text-xs text-stone-300">{label}<input className="input mt-1" value={set[key]} maxLength={80} list={`${id}-${key}`} autoComplete="off"
      onChange={e => onChange({ ...set, [key]: e.target.value })} /><datalist id={`${id}-${key}`}>{values.map(v => <option key={v} value={v} />)}</datalist></label>;
  }
  return <div className="panel-soft space-y-3 p-4">
    <h4 className="font-semibold text-gold-100">{index + 1}. {name}</h4>
    {failed && <p className="text-xs text-gold-200">Sugestões indisponíveis. Você pode digitar os nomes; a validação será feita ao conferir o time.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {generation >= 3 && field("ability", "Habilidade", [...new Set([...(options?.abilities ?? []), ...(options?.allAbilities ?? [])])])}
      {generation >= 2 && field("heldItem", "Held item (vazio = sem item)", options?.items ?? [])}
      {Array.from({ length: 4 }, (_, n) => <label key={n} className="text-xs text-stone-300">Ataque {n + 1}{n ? " (opcional)" : " *"}
        <input className="input mt-1" maxLength={80} value={set.moves[n] ?? ""} list={`${id}-moves`} autoComplete="off"
          onChange={e => { const moves = Array.from({ length: 4 }, (_, x) => set.moves[x] ?? ""); moves[n] = e.target.value; onChange({ ...set, moves }); }} />
      </label>)}
      <datalist id={`${id}-moves`}>{options?.moves.map(v => <option key={v} value={v} />)}</datalist>
    </div>
    <details><summary className="cursor-pointer text-xs text-gold-200">Nível, natureza, EVs, IVs e outros detalhes</summary>
      <p className="my-2 text-xs text-stone-400">Esses valores também fazem parte da validação. Nas gerações 1 e 2, os IVs são informados na escala do Showdown (0–31).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">Nível<input className="input mt-1" type="number" min={1} max={100} value={set.level} onChange={e => onChange({ ...set, level: Number(e.target.value) })} /></label>
        {generation >= 3 && field("nature", "Natureza", options?.natures ?? [])}
        {generation >= 9 && field("teraType", "Tipo Tera (opcional)", options?.types ?? [])}
        {generation >= 2 && <label className="text-xs">Sexo<select className="input mt-1" value={set.gender} onChange={e => onChange({ ...set, gender: e.target.value as TeamSet["gender"] })}>
          <option value="">Automático / indiferente</option><option value="M">Macho</option><option value="F">Fêmea</option><option value="N">Sem sexo</option></select></label>}
        {generation >= 2 && <label className="text-xs"><input type="checkbox" checked={set.shiny} onChange={e => onChange({ ...set, shiny: e.target.checked })} /> Shiny</label>}
      </div>
      {(["evs", "ivs"] as const).map(kind => <fieldset key={kind} className="mt-3"><legend className="text-xs uppercase">{kind}</legend><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{STATS.map(stat => <label key={stat} className="text-xs uppercase">{stat}<input className="input mt-1 px-2" type="number" min={0} max={kind === "evs" ? 252 : 31} value={set[kind][stat]}
        onChange={e => onChange({ ...set, [kind]: { ...set[kind], [stat]: Number(e.target.value) } })} /></label>)}</div></fieldset>)}
    </details>
  </div>;
}

export function newSet(id: number, formatId: string): TeamSet { return { ...defaultSet(id), level: getFormat(formatId)?.level ?? 100 }; }
