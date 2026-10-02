"use client";

import { BattleSetSummary } from "@/components/pokemon/BattleSetSummary";
import { useState } from "react";
import type { RegistrationStatus } from "@prisma/client";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeList } from "@/components/TypeBadge";
import { StatusBadge } from "./Badges";
import { registrationUrl, useAdminAction } from "./useAdminAction";

type Props = {
  reg: {
    id: string;
    nickname: string;
    code: string;
    tournamentName: string;
    status: RegistrationStatus;
    paid: boolean;
    formatVerified: boolean;
    teamVerified: boolean;
    teamVerifiedBy: string | null;
    teamVerifiedAt: string;
    pokemon: { battleSet: unknown; slot: number; pokemonId: number; name: string; types: string[]; isWildcard: boolean }[];
  };
};

export function VerifyTeam({ reg }: Props) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set(reg.teamVerified ? reg.pokemon.map((p) => p.slot) : []));
  const { confirm, error, dialog } = useAdminAction();
  const url = registrationUrl(reg.id);
  const total = reg.pokemon.length;
  const allChecked = checked.size === total;
  const rejected = reg.status === "REJECTED";
  const formatName = "regras do torneio";

  function toggle(slot: number) {
    if (reg.teamVerified) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <header className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-crimson-400">{reg.tournamentName}</p>
          <h1 className="truncate font-display text-3xl font-bold tracking-wide text-gold-100 sm:text-4xl">{reg.nickname}</h1>
          <p className="text-xs text-stone-500">{reg.code}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={reg.status} large />
          <QuickFlag
            label="Pago"
            value={reg.paid}
            disabled={rejected}
            onToggle={() =>
              confirm({
                options: {
                  title: reg.paid ? "Desfazer pagamento?" : "Marcar como pago?",
                  message: reg.paid ? `${reg.nickname} voltará a constar como não pago.` : `Confirme o pagamento de ${reg.nickname}.`,
                  tone: reg.paid ? "danger" : "success",
                },
                build: () => ({ url, method: "PATCH", body: { action: "setPaid", value: !reg.paid } }),
              })
            }
          />
          <QuickFlag
            label="Elegibilidade"
            value={reg.formatVerified}
            disabled={rejected}
            onToggle={() =>
              confirm({
                options: {
                  title: reg.formatVerified ? "Remover verificação do formato?" : "Revalidar elegibilidade?",
                  message: reg.formatVerified
                    ? `A confirmação de ${formatName} será removida.`
                    : `O site vai validar novamente os dados de ${reg.nickname} pelas regras atuais do torneio.`,
                  tone: reg.formatVerified ? "danger" : "success",
                },
                build: () => ({ url, method: "PATCH", body: { action: "setFormatVerified", value: !reg.formatVerified } }),
              })
            }
          />
        </div>
      </header>

      {rejected && <p className="rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">Esta inscrição está rejeitada.</p>}

      {reg.teamVerified ? (
        <p className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm font-semibold text-emerald-200">
          ✅ Time verificado por {reg.teamVerifiedBy} em {reg.teamVerifiedAt}
        </p>
      ) : (
        <p className="text-center text-sm text-stone-400">
          Confira também ataques, habilidade, item e detalhes no Minecraft e toque em cada Pokémon que confere ({checked.size}/{total}).
        </p>
      )}

      <ol className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {reg.pokemon.map((p) => {
          const ok = checked.has(p.slot);
          return (
            <li key={p.slot}>
              <button
                type="button"
                onClick={() => toggle(p.slot)}
                aria-pressed={ok}
                className={`relative flex w-full items-center gap-4 rounded-sm border-2 p-4 text-left transition sm:flex-col sm:gap-2 sm:p-5 sm:text-center ${
                  ok ? "border-emerald-500 bg-emerald-500/10" : "border-gold-600/50 bg-ink-900 hover:border-gold-400"
                }`}
              >
                <span className="absolute left-3 top-2 font-display text-lg font-bold text-gold-600">{p.slot}.</span>
                <PokemonSprite pokemonId={p.pokemonId} name={p.name} size={112} className="shrink-0 max-sm:h-20 max-sm:w-20" />
                <span className="min-w-0 flex-1 sm:flex-none">
                  <span className="block truncate font-display text-xl font-bold text-gold-100 sm:text-2xl">{p.name}</span>
                  <span className="mt-1 block">
                    <TypeList types={p.types} />
                    <BattleSetSummary pokemonId={p.pokemonId} battleSet={p.battleSet} />
                  </span>
                  <span className={`mt-3 flex items-center gap-2 text-sm font-semibold sm:justify-center ${ok ? "text-emerald-300" : "text-stone-400"}`}>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-sm border-2 ${
                        ok ? "border-emerald-400 bg-emerald-500 text-white" : "border-stone-500"
                      }`}
                    >
                      {ok && "✓"}
                    </span>
                    {p.name} confere
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {error && <p className="text-center text-sm text-red-300">{error}</p>}

      {!reg.teamVerified && (
        <div className="sticky bottom-3 z-10">
          <button
            type="button"
            disabled={!allChecked || rejected}
            className="btn-success w-full py-4 text-lg shadow-2xl shadow-black/50"
            onClick={() =>
              confirm({
                options: {
                  title: "Confirmar time?",
                  message: `Os ${total} Pokémon de ${reg.nickname} conferem com o registro.`,
                  tone: "success",
                  confirmLabel: "CONFIRMAR TIME",
                },
                build: () => ({
                  url,
                  method: "PATCH",
                  body: { action: "setTeamVerified", value: true, confirmedPokemonIds: reg.pokemon.map((p) => p.pokemonId) },
                }),
              })
            }
          >
            {allChecked ? "CONFIRMAR TIME" : `Marque os ${total} Pokémon (${checked.size}/${total})`}
          </button>
        </div>
      )}
      {dialog}
    </div>
  );
}

function QuickFlag({ label, value, disabled, onToggle }: { label: string; value: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`btn px-3 py-2 ${value ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border border-gold-600/50 bg-ink-800 text-stone-300"}`}
    >
      {value ? "✅" : "❌"} {label}
    </button>
  );
}
