import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toDateTimeLocalInput } from "@/lib/format";
import { availability, countActiveRegistrations } from "@/lib/tournaments";
import { listAudit } from "@/lib/admin-queries";
import { TournamentForm } from "@/components/admin/TournamentForm";
import { TournamentActions } from "@/components/admin/TournamentActions";
import { DeleteTournamentButton } from "@/components/admin/DeleteTournamentButton";
import { TournamentStatusBadge } from "@/components/TournamentBadges";
import { AuditList } from "@/components/admin/AuditList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar torneio" };

export default async function EditTournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t) notFound();
  const [registered, audit, sp, totalRegistrations, matches] = await Promise.all([
    countActiveRegistrations(t.id),
    listAudit(15, t.id),
    searchParams,
    prisma.registration.count({ where: { tournamentId: t.id } }),
    prisma.match.count({ where: { tournamentId: t.id } }),
  ]);
  const a = availability(t, registered);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <Link href="/admin/tournaments" className="text-sm text-stone-400 hover:text-gold-200">
          ← Torneios
        </Link>
        {sp.criado && (
          <p className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            ✔ Torneio criado{t.status === "DRAFT" ? " como rascunho. Publique quando estiver pronto." : "."}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TournamentStatusBadge status={t.status} />
              {t.status === "SCHEDULED" && (
                <span className={`text-xs font-semibold ${a.open ? "text-emerald-300" : "text-crimson-300"}`}>
                  {a.open ? "Inscrições abertas" : a.full ? "Lotado" : "Inscrições fechadas"}
                </span>
              )}
            </div>
            <h1 className="heading text-gold-gradient mt-2 text-3xl">{t.name}</h1>
            <p className="text-sm text-stone-400">
              {registered}
              {t.maxParticipants > 0 ? `/${t.maxParticipants}` : ""} inscritos
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/registrations?torneio=${t.id}`} className="btn-secondary">
              Inscritos
            </Link>
            <Link href={`/admin/tournaments/${t.id}/bracket`} className="btn-primary">
              {t.competitionFormat === "ROUND_ROBIN" ? "Tabela e confrontos" : "Chaves"}
            </Link>
            {t.status !== "DRAFT" && (
              <Link href={`/${t.slug}`} target="_blank" className="btn-ghost">
                Página ↗
              </Link>
            )}
          </div>
        </div>
        <TournamentActions
          id={t.id}
          name={t.name}
          status={t.status}
          registrationsOpen={t.registrationsOpen}
          full={a.full}
        />
      </div>

      <TournamentForm
        key={t.updatedAt.toISOString()}
        tournamentId={t.id}
        initial={{
          name: t.name,
          slug: t.slug,
          description: t.description,
          status: t.status,
          startsAt: toDateTimeLocalInput(t.startsAt),
          endsAt: toDateTimeLocalInput(t.endsAt ?? new Date(t.startsAt.getTime() + 4 * 60 * 60 * 1000)),
          competitionFormat: t.competitionFormat,
          roundRobinTurns: t.roundRobinTurns as 1 | 2,
          pointsForWin: t.pointsForWin,
          pointsForDraw: t.pointsForDraw,
          pointsForLoss: t.pointsForLoss,
          allowDraw: t.allowDraw,
          formatId: t.formatId,
          teamSize: t.teamSize,
          matchFormat: t.matchFormat as "MD1" | "MD3" | "MD5",
          allowRestricted: t.allowRestricted,
          allowLegendary: t.allowLegendary,
          allowMythical: t.allowMythical,
          allowUltraBeast: t.allowUltraBeast,
          allowParadox: t.allowParadox,
          bannedPokemonIds: t.bannedPokemonIds,
          allowedPokemonIds: t.allowedPokemonIds,
          monotype: t.monotype,
          monotypeMinimum: t.monotypeMinimum,
          maxWildcards: t.maxWildcards,
          customRules: t.customRules,
          entryFee: t.entryFee,
          maxParticipants: t.maxParticipants,
          registrationsOpen: t.registrationsOpen,
          prizeFirst: t.prizeFirst,
          prizeSecond: t.prizeSecond,
          prizeThird: t.prizeThird,
          rewardDetails: t.rewardDetails,
          thirdPlaceMatch: t.thirdPlaceMatch,
        }}
      />

      <DeleteTournamentButton id={t.id} name={t.name} registrations={totalRegistrations} hasBracket={matches > 0} />

      <section className="card overflow-hidden">
        <h2 className="heading border-b border-gold-600/40 px-4 py-3 text-sm text-gold-300">Histórico deste torneio</h2>
        <AuditList items={audit} />
      </section>
    </div>
  );
}
