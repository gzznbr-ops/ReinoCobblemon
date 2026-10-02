"use client";

import { withBase } from "@/lib/base-path";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, slugify } from "@/lib/format";
import { COBBLEMON_FREE_FOR_ALL_FORMAT_ID, FORMAT_OPTIONS, FREE_FORMAT_ID, getFormat, showdownSourceLabel } from "@/lib/rules/showdown";
import {
  CATEGORIES,
  POKEMON_RECORDS,
  banReasonFor,
  getPokemonRecord,
  type TournamentRules,
} from "@/lib/rules/tournament-rules";
import { showdownCategories } from "@/lib/rules/showdown";
import { PokemonSprite } from "@/components/PokemonSprite";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { tournamentUrl } from "./useAdminAction";

export type TournamentFormValues = TournamentRules & {
  name: string;
  slug: string;
  description: string;
  status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  /** valor de <input type="datetime-local"> */
  startsAt: string;
  /** valor calculado a partir da duração escolhida */
  endsAt: string;
  competitionFormat: "SINGLE_ELIMINATION" | "ROUND_ROBIN";
  roundRobinTurns: 1 | 2;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  allowDraw: boolean;
  matchFormat: "MD1" | "MD3" | "MD5";
  customRules: string;
  entryFee: number;
  maxParticipants: number;
  registrationsOpen: boolean;
  prizeFirst: number;
  prizeSecond: number;
  prizeThird: number;
  rewardDetails: string;
  thirdPlaceMatch: boolean;
};

const STATUS_OPTIONS: { value: TournamentFormValues["status"]; label: string; hint: string }[] = [
  { value: "DRAFT", label: "Rascunho", hint: "Invisível no site." },
  { value: "SCHEDULED", label: "Agendado (publicado)", hint: "Aparece no site; inscrições conforme a chave abaixo." },
  { value: "IN_PROGRESS", label: "Em andamento", hint: "Inscrições fechadas, chaves rodando." },
  { value: "FINISHED", label: "Finalizado", hint: "Mostra o pódio." },
  { value: "CANCELLED", label: "Cancelado", hint: "Aparece como cancelado." },
];

const sections = [...new Set(FORMAT_OPTIONS.map((f) => f.section))];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

function addDuration(start: string, amount: number, unit: "hours" | "days"): string {
  const date = new Date(start);
  if (!start || Number.isNaN(date.getTime()) || !Number.isFinite(amount)) return "";
  date.setMinutes(date.getMinutes() + amount * (unit === "days" ? 1440 : 60));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initialDuration(start: string, end: string): { amount: number; unit: "hours" | "days" } {
  const minutes = Math.max(60, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  return minutes >= 1440 && minutes % 1440 === 0
    ? { amount: minutes / 1440, unit: "days" }
    : { amount: Math.max(1, Math.round(minutes / 60)), unit: "hours" };
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card relative mt-4 space-y-5 px-4 pb-6 pt-9 sm:px-6">
      <div className="absolute -top-4 left-1/2 max-w-[90%] -translate-x-1/2">
        <h2 className="ribbon">{title}</h2>
      </div>
      {subtitle && <p className="text-center text-sm text-stone-400">{subtitle}</p>}
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <label className="panel-soft flex cursor-pointer items-center justify-between gap-4 p-3.5 hover:border-gold-400/60">
      <span className="min-w-0">
        <span className="block font-semibold text-gold-100">{title}</span>
        {description && <span className="block text-xs text-stone-400">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full border border-gold-600/60 bg-stone-800 transition peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-gold-100 transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
  min = 0,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Math.trunc(Number(e.target.value)))}
      />
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

/** Busca de Pokémon para banimentos extras e exceções. */
function PokemonListEditor({
  title,
  description,
  ids,
  onChange,
  tone,
  exclude,
}: {
  title: string;
  description: string;
  ids: number[];
  onChange: (ids: number[]) => void;
  tone: "ban" | "allow";
  exclude: number[];
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => {
    const q = normalize(deferred);
    if (q.length < 2) return [];
    return POKEMON_RECORDS.filter((p) => normalize(p.name).includes(q) && !ids.includes(p.id) && !exclude.includes(p.id)).slice(0, 8);
  }, [deferred, ids, exclude]);

  return (
    <div className="panel-soft space-y-3 p-3.5">
      <div>
        <p className={`font-display text-sm font-bold ${tone === "ban" ? "text-crimson-300" : "text-emerald-300"}`}>{title}</p>
        <p className="text-xs text-stone-400">{description}</p>
      </div>
      <div className="relative">
        <input
          type="search"
          className="input py-2"
          placeholder="Digite o nome do Pokémon…"
          value={query}
          maxLength={40}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-sm border border-gold-600 bg-ink-900 shadow-2xl">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-gold-100 hover:bg-gold-400/10"
                  onClick={() => {
                    onChange([...ids, p.id].sort((a, b) => a - b));
                    setQuery("");
                  }}
                >
                  <PokemonSprite pokemonId={p.id} name={p.name} size={32} />
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {ids.length === 0 ? (
        <p className="text-xs text-stone-500">Nenhum.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(ids.filter((x) => x !== id))}
                className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs ${
                  tone === "ban"
                    ? "border-crimson-500/50 bg-crimson-600/20 text-crimson-300 hover:bg-crimson-600/40"
                    : "border-emerald-500/50 bg-emerald-600/15 text-emerald-200 hover:bg-emerald-600/30"
                }`}
                aria-label={`Remover ${getPokemonRecord(id)?.name}`}
              >
                {getPokemonRecord(id)?.name ?? id} <span aria-hidden>✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TournamentForm({ initial, tournamentId }: { initial: TournamentFormValues; tournamentId?: string }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(tournamentId));
  const [lookup, setLookup] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const initialDurationValue = initialDuration(initial.startsAt, initial.endsAt);
  const [durationAmount, setDurationAmount] = useState(initialDurationValue.amount);
  const [durationUnit, setDurationUnit] = useState<"hours" | "days">(initialDurationValue.unit);

  const deferredValues = useDeferredValue(values);
  const format = getFormat(values.formatId);
  const generation = format?.generation ?? 9;
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  function set<K extends keyof TournamentFormValues>(key: K, value: TournamentFormValues[K]) {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  }

  function updateDuration(amount: number, unit: "hours" | "days", start = values.startsAt) {
    setDurationAmount(amount);
    setDurationUnit(unit);
    setSaved(false);
    setValues((v) => ({ ...v, startsAt: start, endsAt: addDuration(start, amount, unit) }));
  }

  // Prévia ao vivo das regras (mesma função usada pelo servidor)
  const preview = useMemo(() => {
    const rules = deferredValues;
    const reasons = new Map<string, number>();
    let allowed = 0;
    for (const p of POKEMON_RECORDS) {
      const reason = banReasonFor(rules, p.id);
      if (reason === null) allowed++;
      else reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    const categories = CATEGORIES.map((c) => {
      const members = POKEMON_RECORDS.filter((p) => showdownCategories(p.id).includes(c.key));
      const tierAllows = members.filter((p) => banReasonFor({ ...rules, [c.field]: true, bannedPokemonIds: [], allowedPokemonIds: [] }, p.id) === null);
      return { ...c, total: members.length, tierAllows: tierAllows.length };
    });
    return { allowed, reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]), categories };
  }, [deferredValues]);

  const lookupResults = useMemo(() => {
    const q = normalize(lookup);
    if (q.length < 2) return [];
    return POKEMON_RECORDS.filter((p) => normalize(p.name).includes(q))
      .slice(0, 6)
      .map((p) => ({ ...p, reason: banReasonFor(deferredValues, p.id) }));
  }, [lookup, deferredValues]);

  const numbersInvalid = (["entryFee", "maxParticipants", "prizeFirst", "prizeSecond", "prizeThird", "teamSize", "monotypeMinimum", "maxWildcards", "pointsForWin", "pointsForDraw", "pointsForLoss"] as const).some(
    (k) => !Number.isFinite(values[k]) || values[k] < 0,
  );
  const invalid = values.name.trim().length < 3 || !values.slug || !values.startsAt || !values.endsAt || durationAmount < 1 || numbersInvalid;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(tournamentId ? tournamentUrl(tournamentId) : withBase("/api/admin/tournaments"), {
        method: tournamentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.status === 401) {
        window.location.href = withBase("/admin/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o torneio.");
        return;
      }
      if (!tournamentId && data.id) {
        router.push(`/admin/tournaments/${data.id}?criado=1`);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Falha de conexão.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  return (
    <form
      className="space-y-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) setConfirmOpen(true);
      }}
    >
      {/* 1. Informações */}
      <Section title="Informações">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              Nome do torneio
            </label>
            <input
              id="name"
              className="input"
              maxLength={80}
              value={values.name}
              placeholder="Ex.: Copa Reino — Gen 9 OU"
              onChange={(e) => {
                const name = e.target.value;
                setSaved(false);
                setValues((v) => ({ ...v, name, slug: slugTouched ? v.slug : slugify(name) }));
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="slug">
              Endereço público
            </label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-stone-500">/torneios/</span>
              <input
                id="slug"
                className="input font-mono"
                maxLength={60}
                value={values.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">
              Descrição
            </label>
            <textarea
              id="description"
              className="input min-h-20 resize-y"
              maxLength={1000}
              value={values.description}
              placeholder="Texto de apresentação exibido na página do torneio."
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="startsAt">
              Dia e horário
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              className="input [color-scheme:dark]"
              value={values.startsAt}
              onChange={(e) => updateDuration(durationAmount, durationUnit, e.target.value)}
            />
            <p className="mt-1 text-xs text-stone-500">Horário de Brasília.</p>
          </div>
          <div>
            <label className="label" htmlFor="durationAmount">
              Duração prevista
            </label>
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <input
                id="durationAmount"
                className="input"
                type="number"
                min={1}
                max={durationUnit === "days" ? 90 : 2160}
                value={durationAmount}
                onChange={(e) => updateDuration(Math.max(1, Math.trunc(Number(e.target.value) || 1)), durationUnit)}
              />
              <select className="input" value={durationUnit} onChange={(e) => updateDuration(durationAmount, e.target.value as "hours" | "days")}>
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-stone-500">Término previsto: {values.endsAt ? values.endsAt.replace("T", " às ") : "—"}.</p>
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select id="status" className="input" value={values.status} onChange={(e) => set("status", e.target.value as TournamentFormValues["status"])}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">{STATUS_OPTIONS.find((s) => s.value === values.status)?.hint}</p>
          </div>
          <NumberField
            id="maxParticipants"
            label="Vagas"
            value={values.maxParticipants}
            onChange={(v) => set("maxParticipants", v)}
            hint="0 = sem limite. Fecha sozinho ao lotar."
            max={1024}
          />
          <NumberField
            id="entryFee"
            label="Valor da inscrição"
            value={values.entryFee}
            onChange={(v) => set("entryFee", v)}
            hint={Number.isFinite(values.entryFee) ? (values.entryFee ? formatMoney(values.entryFee) : "Grátis") : undefined}
          />
        </div>
        <Toggle
          checked={values.registrationsOpen}
          onChange={(v) => set("registrationsOpen", v)}
          title="Inscrições abertas"
          description={
            values.status === "SCHEDULED"
              ? "O formulário público aceita inscrições enquanto houver vagas."
              : "Só vale com o status Agendado (publicado)."
          }
        />
      </Section>

      <Section title="Formato da competição" subtitle="O sistema de inscrições e aprovação é o mesmo para os dois formatos.">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["SINGLE_ELIMINATION", "Chaveamento", "Eliminação simples: perdeu, sai; vencedores avançam até a final."],
              ["ROUND_ROBIN", "Pontos corridos", "Todos se enfrentam e a classificação é calculada automaticamente."],
            ] as const
          ).map(([value, title, description]) => (
            <label key={value} className={`cursor-pointer rounded-sm border-2 p-4 transition ${values.competitionFormat === value ? "border-gold-400 bg-gold-400/10" : "border-gold-600/40 bg-black/20"}`}>
              <input
                type="radio"
                name="competitionFormat"
                className="sr-only"
                checked={values.competitionFormat === value}
                onChange={() => {
                  setSaved(false);
                  setValues((v) => ({ ...v, competitionFormat: value, thirdPlaceMatch: value === "SINGLE_ELIMINATION" ? v.thirdPlaceMatch : false }));
                }}
              />
              <span className="block font-display text-lg font-bold text-gold-100">{title}</span>
              <span className="mt-1 block text-sm text-stone-400">{description}</span>
            </label>
          ))}
        </div>

        {values.competitionFormat === "SINGLE_ELIMINATION" ? (
          <Toggle
            checked={values.thirdPlaceMatch}
            onChange={(v) => set("thirdPlaceMatch", v)}
            title="Disputa de 3º lugar"
            description="Os perdedores das semifinais jogam pelo 3º lugar."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="roundRobinTurns">Turnos</label>
                <select id="roundRobinTurns" className="input" value={values.roundRobinTurns} onChange={(e) => set("roundRobinTurns", Number(e.target.value) as 1 | 2)}>
                  <option value={1}>1 turno — todos se enfrentam uma vez</option>
                  <option value={2}>2 turnos — ida e volta</option>
                </select>
              </div>
              <Toggle checked={values.allowDraw} onChange={(v) => set("allowDraw", v)} title="Permitir empate" description="Adiciona a opção Empate ao lançar um resultado." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberField id="pointsForWin" label="Vitória" value={values.pointsForWin} onChange={(v) => set("pointsForWin", v)} max={20} />
              <NumberField id="pointsForDraw" label="Empate" value={values.pointsForDraw} onChange={(v) => set("pointsForDraw", v)} max={20} />
              <NumberField id="pointsForLoss" label="Derrota" value={values.pointsForLoss} onChange={(v) => set("pointsForLoss", v)} max={20} />
            </div>
            {values.maxParticipants > 1 && (
              <p className="rounded-sm border border-gold-600/40 bg-black/30 p-3 text-sm text-stone-300">
                Com {values.maxParticipants} jogadores: <strong className="text-gold-200">{(values.maxParticipants * (values.maxParticipants - 1) / 2) * values.roundRobinTurns} partidas</strong>. Acima de 32 aprovados, o sorteio será bloqueado para evitar uma tabela impraticável.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Tier e regras */}
      <Section title="Tier e regras" subtitle="Escolha um formato do Showdown ou do servidor Cobblemon. As caixas abaixo podem adicionar restrições ao torneio.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="generation">Geração</label>
              <select id="generation" className="input mb-4" value={generation} onChange={e => {
                const next = getFormat(`gen${e.target.value}ou`)!;
                setSaved(false);
                setValues(v => ({ ...v, formatId: next.id, teamSize: next.teamSize }));
              }}>
                {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>Geração {i + 1}</option>)}
              </select>
              <label className="label" htmlFor="formatId">
                Tier / formato
              </label>
              <select
                id="formatId"
                className="input"
                value={values.formatId}
                onChange={(e) => {
                  const next = getFormat(e.target.value);
                  setSaved(false);
                  setValues((v) =>
                    e.target.value === COBBLEMON_FREE_FOR_ALL_FORMAT_ID
                      ? {
                          ...v,
                          formatId: e.target.value,
                          teamSize: next?.teamSize ?? v.teamSize,
                          allowRestricted: true,
                          allowLegendary: true,
                          allowMythical: true,
                          allowUltraBeast: true,
                          allowParadox: true,
                          bannedPokemonIds: [],
                          monotype: false,
                        }
                      : { ...v, formatId: e.target.value, teamSize: next?.teamSize ?? v.teamSize },
                  );
                }}
              >
                {sections.map((section) => (
                  <optgroup key={section} label={section}>
                    {FORMAT_OPTIONS.filter((f) => f.section === section && f.generation === generation).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumberField id="teamSize" label="Pokémon por time" value={values.teamSize} onChange={(v) => set("teamSize", v)} min={format?.minTeamSize ?? 1} max={format?.teamSize ?? 6} />
              <div>
                <label className="label" htmlFor="matchFormat">
                  Partidas
                </label>
                <select
                  id="matchFormat"
                  className="input"
                  value={values.matchFormat}
                  onChange={(e) => set("matchFormat", e.target.value as TournamentFormValues["matchFormat"])}
                >
                  <option value="MD1">MD1 (melhor de 1)</option>
                  <option value="MD3">MD3 (melhor de 3)</option>
                  <option value="MD5">MD5 (melhor de 5)</option>
                </select>
              </div>
            </div>
          </div>

          {format && (
            <div className="panel-soft space-y-2 p-3.5 text-sm">
              <p className="font-display font-bold text-gold-200">{format.name}</p>
              <p className="text-xs text-stone-400">
                {format.section} · {format.gameType === "doubles" ? "Duplas" : "Individual"}
                {format.id !== COBBLEMON_FREE_FOR_ALL_FORMAT_ID ? ` · nível ${format.level}` : ""}
                {format.pickedTeamSize ? ` · leva ${format.teamSize}, escolhe ${format.pickedTeamSize}` : ""}
              </p>
              {format.id === FREE_FORMAT_ID || format.id === COBBLEMON_FREE_FOR_ALL_FORMAT_ID ? (
                <>
                  <p className="text-xs text-stone-300">{format.description}</p>
                  {format.id === COBBLEMON_FREE_FOR_ALL_FORMAT_ID && (
                    <p className="text-xs text-stone-500">
                      Validação automática pelo site
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-stone-300">
                    <span className="text-stone-500">Regras: </span>
                    {format.ruleset.join(", ") || "—"}
                  </p>
                  {format.banlist.length > 0 && (
                    <p className="text-xs text-stone-300">
                      <span className="text-stone-500">Banlist: </span>
                      {format.banlist.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-stone-500">
                    Validação automática pelo site ·{" "}
                    <a href={withBase("/admin/showdown")} target="_blank" className="text-gold-300 underline">
                      ver banlist completa
                    </a>
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="label">Categorias permitidas</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {preview.categories.map((c) => {
              const checked = values[c.field];
              const blockedByTier = checked && c.tierAllows < c.total;
              return (
                <label
                  key={c.key}
                  className={`flex cursor-pointer gap-3 rounded-sm border p-3 transition ${
                    checked ? "border-emerald-500/50 bg-emerald-500/[0.07]" : "border-crimson-500/40 bg-crimson-600/[0.08]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
                    checked={checked}
                    onChange={(e) => set(c.field, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-gold-100">Permitir {c.plural.toLowerCase()}</span>
                    <span className="block text-xs text-stone-400">{c.example}…</span>
                    <span className={`mt-1 block text-xs ${checked ? "text-emerald-300" : "text-crimson-300"}`}>
                      {checked
                        ? blockedByTier
                          ? `${c.tierAllows} de ${c.total} liberados pelo tier`
                          : `Todos os ${c.total} liberados`
                        : `${c.total} proibidos`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Marcar uma categoria não libera Pokémon banidos pelo tier. Para liberar um específico, use <strong>Exceções</strong>{" "}
            (ou escolha o formato Livre).
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PokemonListEditor
            title="Banimentos extras"
            description="Proibidos neste torneio, mesmo que o tier permita."
            tone="ban"
            ids={values.bannedPokemonIds}
            exclude={values.allowedPokemonIds}
            onChange={(ids) => set("bannedPokemonIds", ids)}
          />
          <PokemonListEditor
            title="Exceções (sempre permitidos)"
            description="Liberados mesmo que o tier ou uma categoria proíba."
            tone="allow"
            ids={values.allowedPokemonIds}
            exclude={values.bannedPokemonIds}
            onChange={(ids) => set("allowedPokemonIds", ids)}
          />
        </div>

        <div className="space-y-3">
          <Toggle
            checked={values.monotype}
            onChange={(v) => set("monotype", v)}
            title="Regra Monotype"
            description="Os Pokémon do time precisam compartilhar um tipo, com Coringas opcionais."
          />
          {values.monotype && (
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                id="monotypeMinimum"
                label="Mínimo com o mesmo tipo"
                value={values.monotypeMinimum}
                onChange={(v) => set("monotypeMinimum", v)}
                min={1}
                max={6}
              />
              <NumberField
                id="maxWildcards"
                label="Máximo de Coringas"
                value={values.maxWildcards}
                onChange={(v) => set("maxWildcards", v)}
                max={5}
              />
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="customRules">
            Regras específicas
          </label>
          <textarea
            id="customRules"
            className="input min-h-28 resize-y"
            maxLength={3000}
            value={values.customRules}
            placeholder={"Uma regra por linha. Ex.:\nProibido Baton Pass\nTera Type livre\nCheck-in 15 minutos antes"}
            onChange={(e) => set("customRules", e.target.value)}
          />
        </div>

        {/* Prévia */}
        <div className="rounded-sm border border-gold-400/50 bg-gold-400/[0.05] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display font-bold text-gold-200">Prévia das regras</p>
            <p className="font-display text-2xl font-bold text-emerald-300">
              {preview.allowed} <span className="text-sm text-stone-400">de {POKEMON_RECORDS.length} Pokémon permitidos</span>
            </p>
          </div>
          {preview.reasons.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {preview.reasons.map(([reason, count]) => (
                <li key={reason} className="rounded-sm border border-gold-600/30 bg-black/40 px-2 py-1 text-xs text-stone-300">
                  {reason}: <strong className="text-crimson-300">{count}</strong>
                </li>
              ))}
            </ul>
          )}
          <div className="relative mt-4">
            <input
              type="search"
              className="input py-2"
              placeholder="Consultar um Pokémon (ex.: Garchomp)"
              value={lookup}
              maxLength={40}
              onChange={(e) => setLookup(e.target.value)}
            />
            {lookupResults.length > 0 && (
              <ul className="mt-2 space-y-1">
                {lookupResults.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-sm bg-black/30 px-2 py-1 text-sm">
                    <PokemonSprite pokemonId={p.id} name={p.name} size={32} />
                    <span className="flex-1 text-gold-100">{p.name}</span>
                    {p.reason ? (
                      <span className="text-xs font-semibold text-crimson-300">✕ {p.reason}</span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-300">✔ Permitido</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-3 text-[11px] text-stone-500">
            {values.formatId === COBBLEMON_FREE_FOR_ALL_FORMAT_ID
              ? "Cobblemon Free For All não possui banlist de tier; a prévia considera as restrições configuradas neste torneio."
              : <>Dados de smogon/pokemon-showdown ({showdownSourceLabel()}). Atualize com <code>npm run showdown:sync</code>.</>}
          </p>
        </div>
      </Section>

      {/* 3. Premiação */}
      <Section title="Premiação">
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["prizeFirst", "1º lugar"],
              ["prizeSecond", "2º lugar"],
              ["prizeThird", "3º lugar"],
            ] as const
          ).map(([key, label]) => (
            <NumberField
              key={key}
              id={key}
              label={label}
              value={values[key]}
              onChange={(v) => set(key, v)}
              hint={Number.isFinite(values[key]) ? formatMoney(values[key]) : undefined}
            />
          ))}
        </div>
        <div>
          <label className="label" htmlFor="rewardDetails">
            Recompensas extras
          </label>
          <textarea
            id="rewardDetails"
            className="input min-h-20 resize-y"
            maxLength={1000}
            value={values.rewardDetails}
            placeholder={"Ex.:\n1º: Tag [Campeão] + Shiny à escolha\nTodos os participantes: 5 Rare Candy"}
            onChange={(e) => set("rewardDetails", e.target.value)}
          />
        </div>
      </Section>

      <div className="sticky bottom-3 z-10 space-y-2">
        {error && (
          <p role="alert" className="rounded-sm border border-red-500/40 bg-red-950/90 p-3 text-sm text-red-200">
            {error}
          </p>
        )}
        {saved && !dirty && <p className="rounded-sm border border-emerald-500/40 bg-emerald-950/90 p-3 text-sm text-emerald-200">✔ Torneio salvo.</p>}
        <button type="submit" className="btn-primary w-full py-3.5 text-base shadow-2xl shadow-black" disabled={invalid || busy || (!dirty && Boolean(tournamentId))}>
          {tournamentId ? "♦ Salvar alterações ♦" : "♦ Criar torneio ♦"}
        </button>
      </div>

      <ConfirmDialog
        options={
          confirmOpen
            ? {
                title: tournamentId ? "Salvar alterações?" : "Criar torneio?",
                confirmLabel: tournamentId ? "Salvar" : "Criar",
                message: (
                  <div className="space-y-1.5">
                    <p>
                      <strong className="text-gold-100">{values.name}</strong> · {getFormat(values.formatId)?.shortName} ·{" "}
                      {preview.allowed} Pokémon permitidos
                    </p>
                    {tournamentId && (
                      <p className="text-gold-200">Mudanças nas regras removem a elegibilidade anterior. Os times inscritos precisarão ser validados novamente.</p>
                    )}
                  </div>
                ),
              }
            : null
        }
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={save}
      />
    </form>
  );
}
