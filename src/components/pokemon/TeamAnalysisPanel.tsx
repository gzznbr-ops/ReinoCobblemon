"use client";

import type { PokemonEntry } from "@/lib/rules/tournament-rules";
import { monotypeError, type AnalysisRules, type TeamAnalysis } from "@/lib/pokemon/team-analysis";
import { typeLabel, type PokemonType } from "@/lib/pokemon/types";
import { TypeBadge } from "@/components/TypeBadge";

export function TeamAnalysisPanel({
  team,
  analysis,
  rules,
}: {
  team: PokemonEntry[];
  analysis: TeamAnalysis;
  rules: AnalysisRules;
}) {
  const counts = (Object.entries(analysis.typeCounts) as [PokemonType, number][]).sort((a, b) => b[1] - a[1]);
  const wildcards = team.filter((p) => analysis.wildcardIds.includes(p.id));
  const monoError = monotypeError(rules);
  const noMonotype = rules.monotype && analysis.complete && !analysis.mainType;
  const otherErrors = analysis.errors.filter((e) => e !== monoError && !e.startsWith("Selecione exatamente"));

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="heading text-sm text-gold-300">Análise do time</h3>
        <span className="font-display text-sm font-bold text-stone-400">
          {team.length}/{rules.teamSize}
        </span>
      </div>

      {rules.monotype &&
        (counts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {counts.map(([type, n]) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-1 ${
                  n >= rules.monotypeMinimum ? "border-emerald-500/40 bg-emerald-500/10" : "border-gold-600/30 bg-black/30"
                }`}
              >
                <TypeBadge type={type} size="xs" />
                <span className={`text-xs font-bold ${n >= rules.monotypeMinimum ? "text-emerald-300" : "text-stone-400"}`}>×{n}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">Escolha seus Pokémon para ver a análise Monotype.</p>
        ))}

      {!rules.monotype && team.length === 0 && <p className="text-sm text-stone-500">Escolha seus Pokémon para validar o time.</p>}

      {analysis.mainType && (
        <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/[0.07] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Tipo principal detectado</p>
          <div className="mt-1.5">
            <TypeBadge type={analysis.mainType} size="md" />
          </div>
          {analysis.ambiguous && (
            <p className="mt-2 text-xs text-gold-200">
              Seu time permite mais de um tipo principal ({analysis.possibleTypes.map(typeLabel).join(", ")}). A inscrição será
              aceita e a organização definirá o tipo considerado.
            </p>
          )}
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-stone-400">Coringas</p>
          <p className="mt-1 text-sm text-stone-200">
            {wildcards.length ? wildcards.map((p) => p.name).join(", ") : "Coringas não utilizados"}
          </p>
        </div>
      )}

      {rules.monotype && !analysis.mainType && team.length > 0 && !noMonotype && (
        <p className="text-xs text-stone-400">
          Pelo menos {rules.monotypeMinimum} dos {rules.teamSize} Pokémon precisam compartilhar um mesmo tipo.
        </p>
      )}

      {(noMonotype || otherErrors.length > 0) && (
        <ul className="space-y-1.5 rounded-sm border border-red-500/30 bg-red-500/[0.07] p-3 text-sm text-red-200">
          {noMonotype && <li>{monoError}</li>}
          {otherErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {analysis.valid && (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
          <span aria-hidden>✔</span> Seleção de espécies permitida
        </p>
      )}
    </div>
  );
}
