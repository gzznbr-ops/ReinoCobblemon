import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { listRegistrations, resolveAdminTournament, type RegistrationFilter } from "@/lib/admin-queries";
import { typeLabel } from "@/lib/pokemon/types";
import { AmbiguousBadge, Check, StatusBadge } from "@/components/admin/Badges";
import { TournamentPicker } from "@/components/admin/TournamentPicker";
import { TypeBadge } from "@/components/TypeBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inscritos" };

const FILTERS: { value: RegistrationFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "approved", label: "Aprovados" },
  { value: "unpaid", label: "Sem pagamento" },
  { value: "ambiguous", label: "Tipo ambíguo" },
  { value: "rejected", label: "Rejeitados" },
];

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; filter?: string | string[]; torneio?: string | string[] }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const filterParam = typeof sp.filter === "string" ? sp.filter : "all";
  const filter = FILTERS.some((f) => f.value === filterParam) ? (filterParam as RegistrationFilter) : "all";
  const { tournaments, chosen } = await resolveAdminTournament(typeof sp.torneio === "string" ? sp.torneio : undefined);

  if (!chosen) {
    return (
      <div className="card p-10 text-center">
        <p className="heading text-xl text-gold-200">Nenhum torneio criado</p>
        <Link href="/admin/tournaments/new" className="btn-primary mt-4">
          Criar torneio
        </Link>
      </div>
    );
  }

  const rows = await listRegistrations({ tournamentId: chosen.id, q, filter });
  const monotype = rows.some((r) => r.mainType);

  const hrefFor = (value: RegistrationFilter) => {
    const params = new URLSearchParams({ torneio: chosen.id });
    if (q) params.set("q", q);
    if (value !== "all") params.set("filter", value);
    return `/admin/registrations?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="heading text-gold-gradient text-3xl">Inscritos</h1>
          <TournamentPicker tournaments={tournaments} selected={chosen.id} basePath="/admin/registrations" />
          <p className="text-sm text-stone-400">{rows.length} resultado(s)</p>
        </div>
        <form className="flex gap-2" action="/admin/registrations">
          <input type="hidden" name="torneio" value={chosen.id} />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input name="q" defaultValue={q} placeholder="Buscar nick ou código" className="input sm:w-64" maxLength={32} />
          <button className="btn-secondary" type="submit">
            Buscar
          </button>
        </form>
      </div>

      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={hrefFor(f.value)}
            className={`shrink-0 rounded-sm border px-3 py-1.5 font-display text-xs font-bold transition ${
              filter === f.value ? "border-gold-400 bg-gold-400/15 text-gold-100" : "border-gold-600/40 text-stone-400 hover:text-gold-100"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-stone-500">Nenhuma inscrição encontrada.</div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gold-600/40 font-display text-[11px] uppercase tracking-wider text-gold-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Nick</th>
                  <th className="px-4 py-3 font-bold">Inscrição</th>
                  {monotype && <th className="px-4 py-3 font-bold">Tipo</th>}
                  <th className="px-4 py-3 font-bold">Pagamento</th>
                  <th className="px-4 py-3 font-bold">Time</th>
                  <th className="px-4 py-3 font-bold">Formato</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-600/20">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gold-400/[0.03]">
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-gold-100">{r.nickname}</span>
                      <span className="text-xs text-stone-500">{r.registrationCode}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-400">{r.createdAt}</td>
                    {monotype && (
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          {r.mainType ? <TypeBadge type={r.mainType} /> : "—"}
                          {r.typeAmbiguous && <AmbiguousBadge />}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Check ok={r.paid} label={r.paid ? "Pago" : "Não pago"} />
                    </td>
                    <td className="px-4 py-3">
                      <Check ok={r.teamVerified} label={r.teamVerified ? "Verificado" : "Pendente"} />
                    </td>
                    <td className="px-4 py-3">
                      <Check ok={r.formatVerified} label="Elegibilidade" />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/admin/registrations/${r.id}/verify`} className="btn-ghost px-2.5 py-1.5 text-xs">
                          Verificar
                        </Link>
                        <Link href={`/admin/registrations/${r.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <ul className="space-y-2.5 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/registrations/${r.id}`} className="card block p-4 active:bg-gold-400/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gold-100">{r.nickname}</p>
                      <p className="text-xs text-stone-500">
                        {r.registrationCode} · {r.createdAt}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {r.mainType && (
                      <span className="text-xs text-stone-400">
                        Tipo: <span className="text-stone-200">{typeLabel(r.mainType)}</span>
                      </span>
                    )}
                    <Check ok={r.paid} label="Pago" />
                    <Check ok={r.teamVerified} label="Time" />
                    <Check ok={r.formatVerified} label="Elegibilidade" />
                  </div>
                  {r.typeAmbiguous && (
                    <div className="mt-2">
                      <AmbiguousBadge />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
