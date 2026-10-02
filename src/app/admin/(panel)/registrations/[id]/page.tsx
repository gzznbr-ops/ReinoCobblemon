import { BattleSetSummary } from "@/components/pokemon/BattleSetSummary";
import { validateBattleTeam } from "@/lib/rules/validate-battle-team";
import { storedSet } from "@/lib/pokemon/team-set";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getRegistrationDetail, type RegistrationDetail } from "@/lib/admin-queries";
import { typeLabel } from "@/lib/pokemon/types";
import { analyzeTeam } from "@/lib/pokemon/team-analysis";
import { getPokemonEntry } from "@/lib/rules/tournament-rules";
import { formatLabel } from "@/lib/rules/showdown";
import { rulesOf } from "@/lib/tournaments";
import { AmbiguousBadge, StatusBadge } from "@/components/admin/Badges";
import { AuditList } from "@/components/admin/AuditList";
import { RegistrationManager } from "@/components/admin/RegistrationManager";
import { ClassificationEditor } from "@/components/admin/ClassificationEditor";
import { TeamEditor } from "@/components/admin/TeamEditor";
import { EditCodeManager } from "@/components/admin/EditCodeManager";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeBadge, TypeList } from "@/components/TypeBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detalhes da inscrição" };

type Mon = RegistrationDetail["pokemon"][number];

function MonCard({ p, mainType, banReason }: { p: Mon; mainType: string | null; banReason: string | null }) {
  return (
    <li className={`panel-soft flex items-center gap-3 p-2.5 ${banReason ? "border-red-500/50" : ""}`}>
      <PokemonSprite pokemonId={p.pokemonId} name={p.name} size={60} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-display text-[10px] font-bold text-gold-600">SLOT {p.slot}</p>
        <p className="truncate font-semibold text-gold-100">{p.name}</p>
        <div className="mt-1">
          <TypeList types={p.types} size="xs" />
        </div>
        <BattleSetSummary pokemonId={p.pokemonId} battleSet={p.battleSet} />
        {banReason && <p className="mt-1 text-[11px] font-semibold text-red-300">Proibido pelas regras atuais: {banReason}</p>}
        {p.isWildcard && mainType && p.types.includes(mainType) && (
          <p className="mt-1 text-[10px] text-stone-500">possui {typeLabel(mainType)}, marcado como Coringa</p>
        )}
      </div>
    </li>
  );
}

export default async function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const reg = await getRegistrationDetail(id);
  if (!reg) notFound();

  const t = reg.tournament;
  const rules = rulesOf(t);
  const analysisRules = { formatId: t.formatId, teamSize: t.teamSize, monotype: t.monotype, monotypeMinimum: t.monotypeMinimum, maxWildcards: t.maxWildcards };
  const entries = reg.pokemon.map((p) => getPokemonEntry(rules, p.pokemonId));
  const banOf = new Map(reg.pokemon.map((p, i) => [p.slot, entries[i]?.banReason ?? null]));
  // Regras podem ter mudado depois da inscrição: mostra se o time ainda é válido
  const errors = validateBattleTeam(rules, reg.pokemon.map(storedSet));
  const current = { valid: errors.length === 0, errors };

  const monotype = reg.pokemon.filter((p) => !p.isWildcard);
  const wildcards = reg.pokemon.filter((p) => p.isWildcard);

  return (
    <div className="space-y-6">
      <Link href={`/admin/registrations?torneio=${t.id}`} className="text-sm text-stone-400 hover:text-gold-200">
        ← Inscritos de {t.name}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-display text-3xl font-bold tracking-wide text-gold-100">{reg.nickname}</h1>
            <StatusBadge status={reg.status} large />
          </div>
          <p className="mt-1 text-sm text-stone-400">
            {reg.code} · {t.name} ({formatLabel(t.formatId)}) · inscrito em {reg.createdAt}
          </p>
        </div>
        <Link href={`/admin/registrations/${reg.id}/verify`} className="btn-primary py-3 text-base">
          Verificar time
        </Link>
      </header>

      {!current.valid && (
        <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <p className="font-semibold">Este time não passa nas regras atuais do torneio:</p>
          <ul className="mt-1 list-inside list-disc">
            {current.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-4 sm:p-6">
            {t.monotype ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label">Tipo principal</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {reg.mainType ? <TypeBadge type={reg.mainType} size="md" /> : <span className="text-stone-500">—</span>}
                      {reg.typeAmbiguous && <AmbiguousBadge />}
                    </div>
                  </div>
                  {reg.possibleTypes.length > 1 && (
                    <div className="text-right">
                      <p className="label">Tipos possíveis</p>
                      <TypeList types={reg.possibleTypes} />
                    </div>
                  )}
                </div>
                {reg.typeReviewedBy && (
                  <p className="mt-2 text-xs text-stone-500">
                    Classificação revisada por {reg.typeReviewedBy} em {reg.typeReviewedAt}
                  </p>
                )}

                <h2 className="heading mt-6 text-sm text-gold-300">Monotype</h2>
                <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
                  {monotype.map((p) => (
                    <MonCard key={p.slot} p={p} mainType={reg.mainType} banReason={banOf.get(p.slot) ?? null} />
                  ))}
                </ul>

                <h2 className="heading mt-6 text-sm text-crimson-300">Coringas</h2>
                {wildcards.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-500">Coringas não utilizados</p>
                ) : (
                  <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
                    {wildcards.map((p) => (
                      <MonCard key={p.slot} p={p} mainType={reg.mainType} banReason={banOf.get(p.slot) ?? null} />
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <h2 className="label">Time ({reg.pokemon.length} Pokémon)</h2>
                <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
                  {reg.pokemon.map((p) => (
                    <MonCard key={p.slot} p={p} mainType={null} banReason={banOf.get(p.slot) ?? null} />
                  ))}
                </ul>
              </>
            )}

            <div className="mt-6 space-y-3 border-t border-gold-600/30 pt-5">
              {t.monotype && (
                <ClassificationEditor
                  key={`${reg.mainType}-${reg.pokemon.map((p) => `${p.pokemonId}:${p.isWildcard}`).join(",")}`}
                  registrationId={reg.id}
                  mainType={reg.mainType}
                  typeAmbiguous={reg.typeAmbiguous}
                  pokemon={reg.pokemon.map((p) => ({ slot: p.slot, name: p.name, types: p.types, isWildcard: p.isWildcard }))}
                  rules={analysisRules}
                />
              )}
              <TeamEditor
                registrationId={reg.id}
                tournamentId={t.id}
                currentSets={reg.pokemon.map(storedSet)}
                verified={reg.teamVerified || reg.formatVerified}
                rules={analysisRules}
              />
            </div>
          </section>

          <EditCodeManager registrationId={reg.id} nickname={reg.nickname} createdAt={reg.editCodeCreatedAt} />

          <section className="card overflow-hidden">
            <h2 className="heading border-b border-gold-600/40 px-4 py-3 text-sm text-gold-300">Histórico desta inscrição</h2>
            <AuditList items={reg.audit} linkParticipants={false} />
          </section>
        </div>

        <RegistrationManager
          entryFee={t.entryFee}
          reg={{
            id: reg.id,
            tournamentId: t.id,
            nickname: reg.nickname,
            status: reg.status,
            paid: reg.paid,
            paidBy: reg.paidBy,
            paidAt: reg.paidAt,
            teamVerified: reg.teamVerified,
            teamVerifiedBy: reg.teamVerifiedBy,
            teamVerifiedAt: reg.teamVerifiedAt,
            formatVerified: reg.formatVerified,
            formatVerifiedBy: reg.formatVerifiedBy,
            formatVerifiedAt: reg.formatVerifiedAt,
            rejectionReason: reg.rejectionReason,
            rejectedBy: reg.rejectedBy,
            rejectedAt: reg.rejectedAt,
          }}
        />
      </div>
    </div>
  );
}
