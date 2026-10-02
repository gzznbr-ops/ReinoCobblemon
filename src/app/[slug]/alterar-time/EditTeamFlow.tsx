"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PokemonEntry } from "@/lib/rules/tournament-rules";
import { analyzeTeam, type AnalysisRules } from "@/lib/pokemon/team-analysis";
import { allowsDuplicates } from "@/lib/rules/showdown";
import { NICKNAME_REGEX } from "@/lib/nickname";
import { PokemonPicker, emptySlots, type TeamSlots } from "@/components/pokemon/PokemonPicker";
import { TeamSetEditor } from "@/components/pokemon/TeamSetEditor";
import { useTeamValidation } from "@/components/pokemon/useTeamValidation";
import { serializeSet, type TeamSet } from "@/lib/pokemon/team-set";
import { TeamAnalysisPanel } from "@/components/pokemon/TeamAnalysisPanel";
import { publicPokemonUrl, usePokemonList } from "@/components/pokemon/usePokemonList";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Session = {
  nickname: string;
  code: string;
  registrationCode: string | null;
  pokemonIds: number[];
  pokemon: TeamSet[];
  blockedReason: string | null;
};

async function post(url: string, body: unknown) {
  const res = await fetch(withBase(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function EditTeamFlow({
  slug,
  rules,
  closedReason,
}: {
  slug: string;
  rules: AnalysisRules;
  closedReason: string | null;
}) {
  const { list, error: loadError } = usePokemonList(publicPokemonUrl(slug));
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [slots, setSlots] = useState<TeamSlots>(emptySlots(rules.teamSize));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState<string[] | null>(null);

  // Preenche o seletor com o time atual assim que a lista de Pokémon carregar
  useEffect(() => {
    if (!session || !list) return;
    const byId = new Map(list.map((p) => [p.id, p]));
    const current = session.pokemon.map((set) => byId.has(set.id) ? { ...byId.get(set.id)!, set } : null);
    // Se o tamanho do time mudou nas regras, completa/corta os slots
    setSlots(Array.from({ length: rules.teamSize }, (_, i) => current[i] ?? null));
  }, [session, list, rules.teamSize]);

  const team = useMemo(() => slots.filter((s): s is PokemonEntry => s !== null), [slots]);
  const analysis = useMemo(() => analyzeTeam(team, rules), [team, rules]);
  const eligibility = useTeamValidation(team, { tournament: slug }, analysis.complete);
  const changed = session ? JSON.stringify(team.map(serializeSet)) !== JSON.stringify(session.pokemon) : false;

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/registrations/edit/lookup", { tournament: slug, nickname: nickname.trim(), code });
      if (!ok) return setError(data.error ?? "Não foi possível abrir sua inscrição.");
      setSession({ ...data, code });
    } catch {
      setError("Falha de conexão.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/registrations/edit", {
        tournament: slug,
        nickname: session.nickname,
        code: session.code,
        pokemon: team.map(serializeSet),
      });
      setConfirmOpen(false);
      if (!ok) return setError(data.error ?? "Não foi possível salvar o time.");
      setDone(data.team);
    } catch {
      setError("Falha de conexão.");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-xl animate-fade-up p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-500/20 text-3xl text-emerald-300">
          ✓
        </div>
        <h2 className="heading text-gold-gradient mt-4 text-2xl">Time atualizado!</h2>
        <p className="mt-3 text-sm text-stone-300">{done.join(" · ")}</p>
        <p className="mt-4 rounded-sm border border-gold-400/30 bg-gold-400/[0.07] p-3 text-sm text-gold-100">
          A organização vai conferir seu time novamente no check-in.
        </p>
        <Link href={`/${slug}`} className="btn-secondary mt-6">
          Voltar ao torneio
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <form onSubmit={lookup} className="card mx-auto max-w-md space-y-4 p-6">
        {closedReason && (
          <p className="rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {closedReason} Não é mais possível alterar times.
          </p>
        )}
        <div>
          <label htmlFor="edit-nick" className="label">
            Nick no Minecraft
          </label>
          <input
            id="edit-nick"
            className="input"
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
            value={nickname}
            onChange={(e) => setNickname(e.target.value.replace(/\s/g, ""))}
          />
        </div>
        <div>
          <label htmlFor="edit-code" className="label">
            Código de edição
          </label>
          <input
            id="edit-code"
            className="input font-mono uppercase tracking-widest"
            placeholder="XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <p className="mt-1.5 text-xs text-stone-500">Perdeu o código? Peça um novo para a organização dentro do servidor.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-sm border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={busy || !NICKNAME_REGEX.test(nickname.trim()) || code.replace(/[^A-Z0-9]/gi, "").length < 8}
        >
          {busy ? "Verificando…" : "Abrir minha inscrição"}
        </button>
      </form>
    );
  }

  if (session.blockedReason) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h2 className="heading text-xl text-gold-100">{session.nickname}</h2>
        <p className="mt-3 text-sm text-red-200">{session.blockedReason}</p>
        <Link href={`/${slug}`} className="btn-secondary mt-6">
          Voltar ao torneio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card min-w-0 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-gold-100">
              Time de <span className="text-crimson-400">{session.nickname}</span>
            </h2>
            <span className="text-xs text-stone-500">{session.registrationCode}</span>
          </div>
          <div><PokemonPicker slots={slots} onChange={setSlots} list={list} loadError={loadError} formatId={rules.formatId} allowDuplicateSpecies={allowsDuplicates(rules.formatId)} />
          <TeamSetEditor slots={slots} onChange={setSlots} formatId={rules.formatId} /></div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <TeamAnalysisPanel team={team} analysis={analysis} rules={rules} />
          {eligibility.panel}
          {error && (
            <p role="alert" className="rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn-primary w-full py-3.5 text-base"
            disabled={!analysis.valid || !eligibility.valid || !changed || busy}
            onClick={() => setConfirmOpen(true)}
          >
            Salvar novo time
          </button>
          {!changed && <p className="text-center text-xs text-stone-500">Altere um Pokémon, ataque, habilidade, item ou detalhe para salvar.</p>}
        </aside>
      </div>

      <ConfirmDialog
        options={
          confirmOpen
            ? {
                title: "Salvar novo time?",
                confirmLabel: "Salvar",
                message: (
                  <div className="space-y-2">
                    <p>{team.map((p) => p.name).join(", ")}</p>
                    <p className="text-gold-200">A verificação do seu time será refeita pela organização.</p>
                  </div>
                ),
              }
            : null
        }
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={save}
      />
    </div>
  );
}
