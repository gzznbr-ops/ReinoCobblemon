import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { getDashboardData } from "@/lib/admin-queries";
import { formatDateTime } from "@/lib/format";
import { formatLabel } from "@/lib/rules/showdown";
import { typeLabel } from "@/lib/pokemon/types";
import { AuditList } from "@/components/admin/AuditList";
import { TournamentStatusBadge } from "@/components/TournamentBadges";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const data = await getDashboardData();
  const active = data.tournaments
    .filter((t) => t.status === "SCHEDULED" || t.status === "IN_PROGRESS" || t.status === "DRAFT")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const cards = [
    { label: "Torneios ativos", value: active.filter((t) => t.status !== "DRAFT").length, tone: "text-gold-100" },
    { label: "Rascunhos", value: active.filter((t) => t.status === "DRAFT").length, tone: "text-stone-300" },
    { label: "Inscrições pendentes", value: data.pendingTotal, tone: "text-gold-300" },
    { label: "Finalizados", value: data.tournaments.filter((t) => t.status === "FINISHED").length, tone: "text-emerald-300" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="heading text-gold-gradient text-3xl">Dashboard</h1>
          <p className="text-sm text-stone-400">Visão geral dos torneios Reino.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/tournaments/new" className="btn-primary">
            ♦ Novo torneio ♦
          </Link>
          <Link href="/admin/showdown" className="btn-secondary">
            Verificar banlists
          </Link>
          <Link href="/admin/checkin" className="btn-secondary">
            Modo Check-in
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4 sm:p-5">
            <p className="font-display text-[11px] font-bold uppercase tracking-wider text-gold-400">{c.label}</p>
            <p className={`heading mt-1 text-3xl ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gold-600/40 px-4 py-3">
          <h2 className="heading text-sm text-gold-300">Próximos e em andamento</h2>
          <Link href="/admin/tournaments" className="text-xs text-gold-300 hover:underline">
            Todos os torneios
          </Link>
        </div>
        {active.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">
            Nenhum torneio ativo.{" "}
            <Link href="/admin/tournaments/new" className="text-gold-300 underline">
              Criar torneio
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-gold-600/20">
            {active.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/tournaments/${t.id}`} className="truncate font-display font-bold text-gold-100 hover:text-white">
                      {t.name}
                    </Link>
                    <TournamentStatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-stone-400">
                    {formatDateTime(t.startsAt)} · {formatLabel(t.formatId)} · {t.active}
                    {t.maxParticipants > 0 ? `/${t.maxParticipants}` : ""} inscritos · {t.approved} aprovados
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Link href={`/admin/registrations?torneio=${t.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                    Inscritos
                  </Link>
                  <Link href={`/admin/tournaments/${t.id}/bracket`} className="btn-primary px-3 py-1.5 text-xs">
                    {t.competitionFormat === "ROUND_ROBIN" ? "Tabela" : "Chaves"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.ambiguous.length > 0 && (
        <section className="card border-orange-500/40 p-4 sm:p-5">
          <h2 className="heading text-sm text-orange-300">Tipo ambíguo — revisar ({data.ambiguous.length})</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.ambiguous.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/registrations/${r.id}`}
                  className="inline-flex items-center gap-2 rounded-sm border border-gold-600/40 bg-black/30 px-3 py-1.5 text-sm hover:bg-gold-400/10"
                >
                  <span className="font-semibold text-gold-100">{r.nickname}</span>
                  <span className="text-xs text-stone-400">
                    {r.possibleTypes.map(typeLabel).join(" / ")} · {r.tournament.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gold-600/40 px-4 py-3">
          <h2 className="heading text-sm text-gold-300">Últimas ações</h2>
          <Link href="/admin/audit" className="text-xs text-gold-300 hover:underline">
            Ver tudo
          </Link>
        </div>
        <AuditList items={data.audit} />
      </section>
    </div>
  );
}
