"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import type { PokemonEntry } from "@/lib/rules/tournament-rules";
import { POKEMON_TYPES, TYPE_COLORS, TYPE_LABELS, type PokemonType } from "@/lib/pokemon/types";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeList } from "@/components/TypeBadge";
import { newSet } from "./TeamSetEditor";

export type TeamSlots = (PokemonEntry | null)[];

export const emptySlots = (size = 6): TeamSlots => Array.from({ length: size }, () => null);

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export function PokemonPicker({
  slots,
  onChange,
  list,
  loadError,
  allowDuplicateSpecies = false,
  formatId = "free",
}: {
  slots: TeamSlots;
  onChange: (slots: TeamSlots) => void;
  list: PokemonEntry[] | null;
  loadError?: string | null;
  allowDuplicateSpecies?: boolean;
  formatId?: string;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PokemonType | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);
  const size = slots.length;

  const targetSlot = activeSlot ?? slots.findIndex((s) => s === null);
  const teamFull = targetSlot === -1;
  const speciesInTeam = new Set(
    slots.filter((s, i): s is PokemonEntry => s !== null && i !== targetSlot).map((s) => s.speciesId),
  );

  // Somente Pokémon permitidos pelas regras do torneio
  const allowed = useMemo(() => (list ?? []).filter((p) => !p.banned), [list]);

  const visible = useMemo(() => {
    const q = normalize(deferredQuery);
    return allowed.filter((p) => (!typeFilter || p.types.includes(typeFilter)) && (!q || normalize(p.name).includes(q)));
  }, [allowed, deferredQuery, typeFilter]);

  function pick(p: PokemonEntry) {
    if (teamFull || (!allowDuplicateSpecies && speciesInTeam.has(p.speciesId))) return;
    const next = [...slots];
    next[targetSlot] = { ...p, set: newSet(p.id, formatId) };
    onChange(next);
    setActiveSlot(null);
  }

  function remove(index: number) {
    const next = [...slots];
    next[index] = null;
    onChange(next);
    setActiveSlot(index);
  }

  function selectSlot(index: number) {
    setActiveSlot(activeSlot === index ? null : index);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const filled = slots.filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Slots */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {slots.map((p, index) => {
          const isTarget = index === targetSlot;
          return (
            <div
              key={index}
              className={`group relative flex min-h-[92px] items-center gap-3 rounded-sm border p-2.5 transition ${
                isTarget
                  ? "border-gold-400 bg-gold-400/10 ring-2 ring-gold-400/25"
                  : p
                    ? "border-gold-600/50 bg-ink-850"
                    : "border-dashed border-gold-600/40 bg-black/30"
              }`}
            >
              <button
                type="button"
                onClick={() => selectSlot(index)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                aria-label={p ? `Substituir ${p.name} (slot ${index + 1})` : `Escolher Pokémon para o slot ${index + 1}`}
              >
                <span className="absolute left-2 top-1.5 font-display text-[10px] font-bold text-gold-600">{index + 1}</span>
                {p ? (
                  <>
                    <PokemonSprite pokemonId={p.id} name={p.name} size={56} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gold-100">{p.name}</span>
                      <span className="mt-1 block">
                        <TypeList types={p.types} size="xs" />
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="flex w-full flex-col items-center justify-center py-2 text-xs text-stone-500">
                    <span className="text-2xl leading-none text-gold-600">+</span>
                    {isTarget ? "Escolha na lista" : "Vazio"}
                  </span>
                )}
              </button>
              {p && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-sm text-stone-400 hover:bg-red-500/20 hover:text-red-300"
                  aria-label={`Remover ${p.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Lista de Pokémon permitidos */}
      <div ref={listRef} className="rounded-sm border border-gold-600/40 bg-black/30">
        <div className="space-y-3 border-b border-gold-600/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={`font-display text-xs font-bold uppercase tracking-wider ${teamFull ? "text-emerald-300" : "text-gold-300"}`}
              aria-live="polite"
            >
              {teamFull
                ? "Time completo — toque em um slot para trocar"
                : activeSlot !== null && slots[activeSlot]
                  ? `Trocando ${slots[activeSlot]!.name} (slot ${activeSlot + 1})`
                  : `Escolha o Pokémon do slot ${targetSlot + 1} · ${filled}/${size}`}
            </p>
            {list && <span className="text-xs text-stone-500">{visible.length} Pokémon permitidos</span>}
          </div>

          <input
            type="search"
            className="input py-2"
            placeholder="Filtrar pelo nome (opcional)"
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!list}
          />

          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" role="group" aria-label="Filtrar por tipo">
            <button
              type="button"
              onClick={() => setTypeFilter(null)}
              aria-pressed={typeFilter === null}
              className={`shrink-0 rounded-sm border px-2.5 py-1 text-[11px] font-bold uppercase ${
                typeFilter === null ? "border-gold-300 bg-gold-400/15 text-gold-100" : "border-gold-600/40 text-stone-400 hover:text-gold-100"
              }`}
            >
              Todos
            </button>
            {POKEMON_TYPES.map((t) => {
              const active = typeFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(active ? null : t)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-sm border-2 px-2 py-0.5 text-[11px] font-bold uppercase text-white transition ${
                    active ? "border-gold-100" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: TYPE_COLORS[t] }}
                >
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>

        {loadError && <p className="p-4 text-sm text-red-300">{loadError}</p>}
        {!list && !loadError && <p className="p-6 text-center text-sm text-stone-500">Carregando Pokémon…</p>}

        {list && (
          <div className="max-h-[26rem] overflow-y-auto overscroll-contain p-2">
            {visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-stone-500">Nenhum Pokémon encontrado.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {visible.map((p) => {
                  const inTeam = !allowDuplicateSpecies && speciesInTeam.has(p.speciesId);
                  const selected = targetSlot >= 0 && slots[targetSlot]?.id === p.id;
                  const disabled = inTeam || teamFull;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => pick(p)}
                        disabled={disabled}
                        className={`flex w-full items-center gap-2 rounded-sm border px-1.5 py-1 text-left transition ${
                          selected ? "border-gold-400 bg-gold-400/15" : "border-transparent hover:border-gold-600 hover:bg-gold-400/10"
                        } ${disabled && !selected ? "cursor-not-allowed opacity-35 hover:border-transparent hover:bg-transparent" : ""}`}
                      >
                        <PokemonSprite pokemonId={p.id} name={p.name} size={44} className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-gold-100">{p.name}</span>
                          {inTeam ? (
                            <span className="text-[10px] font-semibold text-stone-400">Já no time</span>
                          ) : (
                            <TypeList types={p.types} size="xs" />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
