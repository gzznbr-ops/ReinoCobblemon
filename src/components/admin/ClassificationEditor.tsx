"use client";

import { useMemo, useState } from "react";
import { validateClassification, type AnalysisRules } from "@/lib/pokemon/team-analysis";
import { POKEMON_TYPES, typeLabel } from "@/lib/pokemon/types";
import { TypeBadge, TypeList } from "@/components/TypeBadge";
import { registrationUrl, useAdminAction } from "./useAdminAction";

type Mon = { slot: number; name: string; types: string[]; isWildcard: boolean };

export function ClassificationEditor({
  registrationId,
  mainType,
  typeAmbiguous,
  pokemon,
  rules,
}: {
  registrationId: string;
  mainType: string | null;
  typeAmbiguous: boolean;
  pokemon: Mon[];
  rules: AnalysisRules;
}) {
  const [open, setOpen] = useState(typeAmbiguous);
  const [type, setType] = useState(mainType ?? "");
  const [wildcards, setWildcards] = useState<number[]>(pokemon.filter((p) => p.isWildcard).map((p) => p.slot));
  const { confirm, error, dialog } = useAdminAction();

  // Somente tipos que aparecem no mínimo exigido podem ser escolhidos
  const candidates = POKEMON_TYPES.filter((t) => pokemon.filter((p) => p.types.includes(t)).length >= rules.monotypeMinimum);

  const validation = useMemo(
    () => (type ? validateClassification(pokemon, type, wildcards, rules) : "Escolha o tipo principal."),
    [pokemon, type, wildcards, rules],
  );

  function chooseType(t: string) {
    setType(t);
    // Sugere automaticamente os Coringas para o tipo escolhido
    setWildcards(pokemon.filter((p) => !p.types.includes(t)).map((p) => p.slot));
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setOpen(true)}>
        Corrigir tipo principal / Coringas
      </button>
    );
  }

  return (
    <div className="panel-soft p-4">
      <div className="flex items-center justify-between">
        <h3 className="heading text-sm text-gold-100">Tipo principal e Coringas</h3>
        <button type="button" className="text-xs text-stone-400 hover:text-gold-100" onClick={() => setOpen(false)}>
          Fechar
        </button>
      </div>
      {typeAmbiguous && (
        <p className="mt-2 text-xs text-orange-200">
          Este time permite mais de um tipo principal. Escolha qual será considerado e salve para remover o alerta.
        </p>
      )}

      <p className="label mt-4">Tipo</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => chooseType(t)}
            className={`rounded-sm border p-1 transition ${type === t ? "border-gold-100 ring-2 ring-gold-400/50" : "border-transparent opacity-60 hover:opacity-100"}`}
          >
            <TypeBadge type={t} size="md" />
          </button>
        ))}
      </div>

      <p className="label mt-4">Coringas (máx. {rules.maxWildcards})</p>
      <ul className="space-y-1.5">
        {pokemon.map((p) => {
          const checked = wildcards.includes(p.slot);
          return (
            <li key={p.slot}>
              <label className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-gold-400/5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-yellow-500"
                  checked={checked}
                  onChange={() => setWildcards(checked ? wildcards.filter((s) => s !== p.slot) : [...wildcards, p.slot])}
                />
                <span className="flex-1 text-sm text-stone-200">{p.name}</span>
                <TypeList types={p.types} size="xs" />
              </label>
            </li>
          );
        })}
      </ul>

      {validation && <p className="mt-3 text-xs text-gold-200">{validation}</p>}
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      <button
        type="button"
        className="btn-primary mt-4 w-full"
        disabled={Boolean(validation)}
        onClick={() =>
          confirm({
            options: {
              title: "Salvar classificação?",
              message: `Tipo principal: ${typeLabel(type)}. Coringas: ${
                pokemon
                  .filter((p) => wildcards.includes(p.slot))
                  .map((p) => p.name)
                  .join(", ") || "nenhum"
              }.`,
              confirmLabel: "Salvar",
            },
            build: () => ({
              url: registrationUrl(registrationId),
              method: "PATCH",
              body: { action: "setClassification", mainType: type, wildcardSlots: wildcards },
            }),
            onSuccess: () => setOpen(false),
          })
        }
      >
        Salvar classificação
      </button>
      {dialog}
    </div>
  );
}
