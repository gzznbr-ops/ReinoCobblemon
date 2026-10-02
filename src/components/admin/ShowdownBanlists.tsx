"use client";

import { withBase } from "@/lib/base-path";
import { useDeferredValue, useMemo, useState } from "react";
import { COBBLEMON_FREE_FOR_ALL_FORMAT_ID, FORMAT_OPTIONS, FREE_FORMAT_ID, SHOWDOWN_SOURCE, formatBanGroups, showdownSourceLabel } from "@/lib/rules/showdown";
import { POKEMON_RECORDS, getPokemonRecord } from "@/lib/rules/tournament-rules";
import { formatDateTime } from "@/lib/format";
import { PokemonSprite } from "@/components/PokemonSprite";

type Change = { sha: string; url: string; message: string; date: string };
type CheckResult = {
  latest: Change;
  behindBy: number | null;
  ruleChanges: Change[];
  ruleChangesTotal?: number;
  upToDate: boolean;
  legacyNpm: boolean;
  checkedAt: string;
};

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
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
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

  async function runCheck() {
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch(withBase("/api/admin/showdown/check"));
      if (res.status === 401) {
        window.location.href = withBase("/admin/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setCheckError(data.error ?? "Falha ao verificar.");
      else setCheck(data);
    } catch {
      setCheckError("Falha de conexão.");
    } finally {
      setChecking(false);
    }
  }

  const upToDate = check?.upToDate ?? false;
  const syncedUrl = SHOWDOWN_SOURCE.commit
    ? `${SHOWDOWN_SOURCE.repository}/commit/${SHOWDOWN_SOURCE.commit}`
    : SHOWDOWN_SOURCE.repository;

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="label">Dados em uso no site</p>
            <p className="font-display text-xl font-bold text-gold-100">
              smogon/pokemon-showdown ·{" "}
              <a href={syncedUrl} target="_blank" rel="noopener noreferrer" className="text-gold-300 underline">
                {showdownSourceLabel()}
              </a>
            </p>
            <p className="text-sm text-stone-400">
              {SHOWDOWN_SOURCE.via === "github" ? `Compilado do GitHub (${SHOWDOWN_SOURCE.ref})` : "Pacote do npm (legado)"} ·
              sincronizado em {formatDateTime(SHOWDOWN_SOURCE.generatedAt)} · {FORMATS.length} formatos
            </p>
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={runCheck} disabled={checking}>
            {checking ? "Verificando…" : "♦ Verificar banlists no Showdown ♦"}
          </button>
        </div>

        {checkError && <p className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{checkError}</p>}

        {check && (
          <div
            className={`rounded-sm border p-4 text-sm ${
              upToDate ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : "border-gold-400/50 bg-gold-400/10 text-gold-100"
            }`}
          >
            <p className="font-display text-base font-bold">
              {check.legacyNpm
                ? "Regras fixadas na versão instalada do validador"
                : upToDate
                  ? "✔ Banlists atualizadas com o Showdown oficial"
                  : `⚠ ${check.ruleChangesTotal ?? check.ruleChanges.length} mudança(s) de tier/regras no Showdown desde a sincronização`}
            </p>
            <p className="mt-1">
              Último commit do master:{" "}
              <a href={check.latest.url} target="_blank" rel="noopener noreferrer" className="underline">
                {check.latest.sha}
              </a>{" "}
              ({formatDateTime(check.latest.date)}) — {check.latest.message}
              {check.behindBy !== null && (
                <>
                  {" "}
                  · o site está <strong>{check.behindBy}</strong> commit(s) atrás
                  {check.behindBy > 0 && upToDate ? ", nenhum deles em tiers/regras" : ""}.
                </>
              )}
            </p>
            {check.ruleChanges.length > 0 && (
              <>
                <p className="mt-3 font-semibold">Mudanças em tiers, formatos ou regras ainda não aplicadas:</p>
                <ul className="mt-1 space-y-1">
                  {check.ruleChanges.map((c) => (
                    <li key={c.sha} className="text-xs">
                      <span className="text-stone-400">{formatDateTime(c.date)}</span> ·{" "}
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
                        {c.message}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!upToDate && (
              <p className="mt-3 text-xs text-stone-300">
                Para atualizar o validador, revise primeiro as versões de @pkmn/sim e @pkmn/mods. Depois rode <code className="text-gold-300">npm run showdown:sync</code> e depois{" "}
                <code className="text-gold-300">npm run cf:deploy</code>.
              </p>
            )}
          </div>
        )}
      </section>

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
