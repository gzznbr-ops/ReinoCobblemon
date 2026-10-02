"use client";
import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { serializeSet } from "@/lib/pokemon/team-set";
import type { PokemonEntry } from "@/lib/rules/tournament-rules";

export function useTeamValidation(team: PokemonEntry[], target: { tournament?: string; tournamentId?: string }, complete: boolean) {
  const key = JSON.stringify({ ...target, pokemon: team.map(serializeSet) });
  const [result, setResult] = useState<{ key: string; valid: boolean; errors: string[] } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!complete) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(withBase("/api/teams/validate"), { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted) setResult({ key, valid: response.ok && data.valid === true, errors: data.errors ?? [data.error ?? "Falha ao validar o time."] });
      } catch { if (!controller.signal.aborted) setResult({ key, valid: false, errors: ["Falha de conexão ao validar. Tente novamente."] }); }
    }, 650);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, complete, retry]);
  const current = complete && result?.key === key ? result : null;
  return { valid: current?.valid === true, panel: <section className="panel-soft p-4" aria-live="polite">
    <h3 className="label">Elegibilidade do time</h3>
    {!complete ? <p className="text-xs text-stone-400">Complete os Pokémon para conferir a tier.</p> : !current ? <p className="text-xs text-gold-200">Conferindo ataques, habilidade, item e regras…</p> : current.valid ? <p className="text-sm text-emerald-300">✓ Time elegível para as regras deste torneio.</p> : <><p className="mb-2 text-xs text-red-200">Corrija os problemas abaixo. Os detalhes do Showdown podem aparecer em inglês.</p><ul className="list-disc space-y-1 pl-4 text-xs text-red-200">{current.errors.map((e, i) => <li key={i}>{e}</li>)}</ul><button type="button" className="mt-3 text-xs text-gold-200 underline" onClick={() => { setResult(null); setRetry(n => n + 1); }}>Verificar novamente</button></>}
  </section> };
}
