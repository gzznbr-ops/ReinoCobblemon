"use client";

import { RulesUpdater } from "./RulesUpdater";
import { useDeferredValue, useMemo, useState } from "react";
import { COBBLEMON_FREE_FOR_ALL_FORMAT_ID, FORMAT_OPTIONS, FREE_FORMAT_ID, formatBanGroups } from "@/lib/rules/showdown";
import { POKEMON_RECORDS, getPokemonRecord } from "@/lib/rules/tournament-rules";
import { PokemonSprite } from "@/components/PokemonSprite";

const FORMATS = FORMAT_OPTIONS.filter((f) => f.id !== FREE_FORMAT_ID && f.id !== COBBLEMON_FREE_FOR_ALL_FORMAT_ID);
const sections = [...new Set(FORMATS.map((f) => f.section))];
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export function ShowdownBanlists() {
  const [formatId, setFormatId] = useState("gen9ou");
  const [query, setQuery] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const format = FORMATS.find((f) => f.id === formatId)!;
  const groups = useMemo(() => {
    const q = normalize(deferredQuery);
    return formatBanGroups(formatId)
      .filter((g) => showUnavailable || !g.reason.startsWith("Indisponível"))
      .map((g) => ({
        reason: g.reason,
        pokemon: g.ids
          .map((id) => getPokemonRecord(id)!)
          .filter((p) => p && (!q || normalize(p.name).includes(q))),
      }))
      .filter((g) => g.pokemon.length > 0)
      .sort((a, b) => a.pokemon.length - b.pokemon.length);
  }, [formatId, deferredQuery, showUnavailable]);
  const hiddenUnavailable = formatBanGroups(formatId).find((g) => g.reason.startsWith("Indisponível"))?.ids.length ?? 0;

  return (
    <div className="space-y-6">
      <RulesUpdater />

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <label className="label" htmlFor="format">
              Tier / formato
            </label>
            <select id="format" className="input" value={formatId} onChange={(e) => setFormatId(e.target.value)}>
              {sections.map((s) => (
                <optgroup key={s} label={s}>
                  {FORMATS.filter((f) => f.section === s).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="search">
              Buscar Pokémon banido
            </label>
            <input id="search" type="search" className="input" placeholder="Ex.: Kingambit" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        <div className="panel-soft space-y-1 p-3 text-xs text-stone-300">
          <p>
            <span className="text-stone-500">Regras: </span>
            {format.ruleset.join(", ") || "—"}
          </p>
          <p>
            <span className="text-stone-500">Banlist oficial (tiers, golpes, itens, habilidades): </span>
            {format.banlist.join(", ") || "—"}
          </p>
          <p>
            <span className="text-stone-500">Resumo: </span>
            <strong className="text-emerald-300">{POKEMON_RECORDS.length - format.bannedCount} permitidos</strong> ·{" "}
            <strong className="text-crimson-300">{format.bannedCount} banidos</strong>
          </p>
        </div>

        {hiddenUnavailable > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-300">
            <input type="checkbox" className="h-4 w-4 accent-yellow-500" checked={showUnavailable} onChange={(e) => setShowUnavailable(e.target.checked)} />
            Mostrar também os {hiddenUnavailable} indisponíveis no formato (Pokémon fora do jogo)
          </label>
        )}

        {groups.length === 0 ? (
          <p className="p-4 text-center text-sm text-stone-500">Nenhum Pokémon banido {query ? "com esse nome" : "neste formato"}.</p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.reason}>
                <p className="mb-2 font-display text-sm font-bold text-crimson-300">
                  {g.reason} <span className="text-stone-500">({g.pokemon.length})</span>
                </p>
                <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
                  {g.pokemon.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 rounded-sm border border-gold-600/30 bg-black/30 px-1.5 py-1">
                      <PokemonSprite pokemonId={p.id} name={p.name} size={36} className="shrink-0" />
                      <span className="truncate text-sm text-gold-100">{p.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
