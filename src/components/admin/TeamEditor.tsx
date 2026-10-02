"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useMemo, useState } from "react";
import type { PokemonEntry } from "@/lib/rules/tournament-rules";
import { analyzeTeam, type AnalysisRules } from "@/lib/pokemon/team-analysis";
import { allowsDuplicates } from "@/lib/rules/showdown";
import { PokemonPicker, emptySlots, type TeamSlots } from "@/components/pokemon/PokemonPicker";
import { TeamSetEditor } from "@/components/pokemon/TeamSetEditor";
import { useTeamValidation } from "@/components/pokemon/useTeamValidation";
import { serializeSet, type TeamSet } from "@/lib/pokemon/team-set";
import { TeamAnalysisPanel } from "@/components/pokemon/TeamAnalysisPanel";
import { usePokemonList } from "@/components/pokemon/usePokemonList";
import { registrationUrl, useAdminAction } from "./useAdminAction";

export function TeamEditor({
  registrationId,
  tournamentId,
  currentSets,
  verified,
  rules,
}: {
  registrationId: string;
  tournamentId: string;
  currentSets: TeamSet[];
  verified: boolean;
  rules: AnalysisRules;
}) {
  const [open, setOpen] = useState(false);
  const { list, error: loadError } = usePokemonList(withBase(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/pokemon`));
  const [slots, setSlots] = useState<TeamSlots>(emptySlots(rules.teamSize));
  const { confirm, error, dialog } = useAdminAction();

  const currentKey = JSON.stringify(currentSets);
  useEffect(() => {
    if (!list || !open) return;
    const byId = new Map(list.map((p) => [p.id, p]));
    const current = (JSON.parse(currentKey) as TeamSet[]).map((set) => byId.has(set.id) ? { ...byId.get(set.id)!, set } : null);
    setSlots(Array.from({ length: rules.teamSize }, (_, i) => current[i] ?? null));
  }, [list, open, currentKey, rules.teamSize]);

  const team = useMemo(() => slots.filter((s): s is PokemonEntry => s !== null), [slots]);
  const analysis = useMemo(() => analyzeTeam(team, rules), [team, rules]);
  const eligibility = useTeamValidation(team, { tournamentId }, analysis.complete);
  const changed = JSON.stringify(team.map(serializeSet)) !== currentKey;

  if (!open) {
    return (
      <button type="button" className="btn-secondary w-full sm:ml-2 sm:w-auto" onClick={() => setOpen(true)}>
        Trocar Pokémon
      </button>
    );
  }

  return (
    <div className="panel-soft p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="heading text-sm text-gold-100">Editar time</h3>
        <button type="button" className="text-xs text-stone-400 hover:text-gold-100" onClick={() => setOpen(false)}>
          Fechar
        </button>
      </div>
      <p className="mb-4 text-xs text-gold-200">Alterar o time revalida as regras atuais do torneio e refaz a elegibilidade automaticamente e exige nova conferência no jogo.</p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div><PokemonPicker slots={slots} onChange={setSlots} list={list} loadError={loadError} formatId={rules.formatId} allowDuplicateSpecies={allowsDuplicates(rules.formatId)} />
          <TeamSetEditor slots={slots} onChange={setSlots} formatId={rules.formatId} /></div>
        <div className="space-y-3">
          <TeamAnalysisPanel team={team} analysis={analysis} rules={rules} />
          {eligibility.panel}
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!analysis.valid || !eligibility.valid || !changed}
            onClick={() =>
              confirm({
                options: {
                  title: "Salvar novo time?",
                  message: (
                    <div className="space-y-2">
                      <p>{team.map((p) => p.name).join(", ")}</p>
                      {verified && <p className="text-gold-200">O time precisará ser conferido novamente no jogo.</p>}
                    </div>
                  ),
                  confirmLabel: "Salvar time",
                },
                build: () => ({
                  url: registrationUrl(registrationId),
                  method: "PATCH",
                  body: { action: "updateTeam", pokemon: team.map(serializeSet) },
                }),
                onSuccess: () => setOpen(false),
              })
            }
          >
            Salvar time
          </button>
        </div>
      </div>
      {dialog}
    </div>
  );
}
