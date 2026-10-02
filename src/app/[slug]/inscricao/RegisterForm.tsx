"use client";

import { withBase } from "@/lib/base-path";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PokemonEntry } from "@/lib/rules/tournament-rules";
import { analyzeTeam, type AnalysisRules } from "@/lib/pokemon/team-analysis";
import { allowsDuplicates } from "@/lib/rules/showdown";
import { NICKNAME_REGEX } from "@/lib/nickname";
import { formatMoney } from "@/lib/format";
import { PokemonPicker, emptySlots, type TeamSlots } from "@/components/pokemon/PokemonPicker";
import { TeamSetEditor } from "@/components/pokemon/TeamSetEditor";
import { useTeamValidation } from "@/components/pokemon/useTeamValidation";
import { serializeSet, type TeamSet } from "@/lib/pokemon/team-set";
import { TeamAnalysisPanel } from "@/components/pokemon/TeamAnalysisPanel";
import { publicPokemonUrl, usePokemonList } from "@/components/pokemon/usePokemonList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EDIT_CODE_STORAGE_KEY } from "@/components/EditCodeDisplay";

export function RegisterForm({ slug, entryFee, rules }: { slug: string; entryFee: number; rules: AnalysisRules }) {
  const router = useRouter();
  const { list, error: loadError } = usePokemonList(publicPokemonUrl(slug));
  const [nickname, setNickname] = useState("");
  const [website, setWebsite] = useState("");
  const [slots, setSlots] = useState<TeamSlots>(emptySlots(rules.teamSize));
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const team = useMemo(() => slots.filter((s): s is PokemonEntry => s !== null), [slots]);
  const analysis = useMemo(() => analyzeTeam(team, rules), [team, rules]);
  const eligibility = useTeamValidation(team, { tournament: slug }, analysis.complete);
  const nickValid = NICKNAME_REGEX.test(nickname.trim());
  const canSubmit = nickValid && analysis.valid && eligibility.valid && !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/registrations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament: slug, nickname: nickname.trim(), pokemon: team.map(serializeSet), website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível concluir a inscrição.");
        setConfirmOpen(false);
        if (data.code === "closed" || data.code === "rules_changed") router.refresh();
        return;
      }
      try {
        sessionStorage.setItem(EDIT_CODE_STORAGE_KEY, JSON.stringify({ registrationCode: data.code, editCode: data.editCode }));
      } catch {
        // sem sessionStorage: o jogador pede um novo código à organização
      }
      router.push("/registration/success");
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) setConfirmOpen(true);
      }}
      noValidate
    >
      <div className="min-w-0 space-y-6">
        <section className="card p-4 sm:p-6">
          <label htmlFor="nickname" className="label">
            1. Nick no Minecraft
          </label>
          <input
            id="nickname"
            name="nickname"
            className="input font-medium"
            placeholder="Ex.: Steve123"
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
            value={nickname}
            onChange={(e) => setNickname(e.target.value.replace(/\s/g, ""))}
            aria-invalid={nickname.length > 0 && !nickValid}
          />
          <p className={`mt-1.5 text-xs ${nickname && !nickValid ? "text-red-300" : "text-stone-500"}`}>
            3 a 16 caracteres: letras, números ou _. Use exatamente o nick do servidor.
          </p>

          {/* Honeypot anti-spam (invisível para pessoas) */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
        </section>

        <section className="card p-4 sm:p-6">
          <h2 className="label">2. Seus {rules.teamSize} Pokémon</h2>
          <p className="mb-4 text-xs text-stone-500">
            A lista mostra somente Pokémon permitidos neste torneio. Toque em um slot para escolher ou substituir.
          </p>
          <div><PokemonPicker slots={slots} onChange={setSlots} list={list} loadError={loadError} formatId={rules.formatId} allowDuplicateSpecies={allowsDuplicates(rules.formatId)} />
          <TeamSetEditor slots={slots} onChange={setSlots} formatId={rules.formatId} /></div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <TeamAnalysisPanel team={team} analysis={analysis} rules={rules} />
          {eligibility.panel}

        {error && (
          <p role="alert" className="rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={!canSubmit}>
          ♦ Confirmar inscrição ♦
        </button>
        {!nickValid && team.length === rules.teamSize && <p className="text-center text-xs text-stone-500">Informe um nick válido.</p>}
        <p className="text-center text-xs text-stone-500">
          {entryFee ? `Taxa de ${formatMoney(entryFee)} paga dentro do servidor. ` : ""}Seu time só será visível para a organização.
        </p>
      </aside>

      <ConfirmDialog
        options={
          confirmOpen
            ? {
                title: "Confirmar inscrição?",
                confirmLabel: "Enviar inscrição",
                message: (
                  <div className="space-y-2">
                    <p>
                      Nick: <strong className="text-gold-100">{nickname.trim()}</strong>
                    </p>
                    <p>Time: {team.map((p) => p.name).join(", ")}</p>
                    <p className="text-gold-200">Guarde o código de edição que aparecerá na próxima tela.</p>
                  </div>
                ),
              }
            : null
        }
        busy={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submit}
      />
    </form>
  );
}
