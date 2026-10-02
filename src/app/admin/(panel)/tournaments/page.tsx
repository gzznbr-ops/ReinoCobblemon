import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { listAdminTournaments } from "@/lib/admin-queries";
import { formatDateTime } from "@/lib/format";
import { formatLabel } from "@/lib/rules/showdown";
import { TournamentStatusBadge } from "@/components/TournamentBadges";
import { DeleteTournamentButton } from "@/components/admin/DeleteTournamentButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Torneios" };

export default async function AdminTournamentsPage() {
  await requireAdminPage();
  const rows = await listAdminTournaments();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="heading text-gold-gradient text-3xl">Torneios</h1>
          <p className="text-sm text-stone-400">Crie torneios com dia, horário, tier, regras e premiação próprios.</p>
        </div>
        <Link href="/admin/tournaments/new" className="btn-primary">
          ♦ Novo torneio ♦
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="heading text-xl text-gold-200">Nenhum torneio ainda</p>
          <p className="mt-2 text-sm text-stone-400">Crie o primeiro torneio Reino.</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((t) => (
            <li key={t.id} className="card flex flex-col p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TournamentStatusBadge status={t.status} />
                <span className="rounded-sm border border-gold-600/60 bg-black/40 px-2 py-0.5 font-display text-xs font-bold text-gold-300">
                  {formatLabel(t.formatId)}
                </span>
              </div>
              <Link href={`/admin/tournaments/${t.id}`} className="heading mt-3 text-xl text-gold-100 hover:text-white">
                {t.name}
              </Link>
              <p className="text-sm text-stone-400">{formatDateTime(t.startsAt)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold-300/80">
                {t.competitionFormat === "ROUND_ROBIN" ? "Pontos corridos" : "Eliminação simples"}
              </p>
              <p className="mt-2 text-sm text-stone-300">
                {t.active}
                {t.maxParticipants > 0 ? `/${t.maxParticipants}` : ""} inscritos · {t.approved} aprovados
                {t.status === "SCHEDULED" && (
                  <span className={t.registrationsOpen ? "text-emerald-300" : "text-crimson-300"}>
                    {" "}
                    · inscrições {t.registrationsOpen ? "abertas" : "fechadas"}
                  </span>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gold-600/30 pt-4">
                <Link href={`/admin/tournaments/${t.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                  Editar
                </Link>
                <Link href={`/admin/registrations?torneio=${t.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                  Inscritos
                </Link>
                <Link href={`/admin/checkin?torneio=${t.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                  Check-in
                </Link>
                <Link href={`/admin/tournaments/${t.id}/bracket`} className="btn-primary px-3 py-1.5 text-xs">
                  {t.competitionFormat === "ROUND_ROBIN" ? "Tabela" : "Chaves"}{t.hasBracket ? "" : " (gerar)"}
                </Link>
                {t.status !== "DRAFT" && (
                  <Link href={`/${t.slug}`} target="_blank" className="btn-ghost px-3 py-1.5 text-xs">
                    Página ↗
                  </Link>
                )}
                <span className="ml-auto">
                  <DeleteTournamentButton id={t.id} name={t.name} registrations={t.totalRegistrations} hasBracket={t.hasBracket} variant="compact" />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
