import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { listCheckin, resolveAdminTournament } from "@/lib/admin-queries";
import { CheckinList } from "@/components/admin/CheckinList";
import { TournamentPicker } from "@/components/admin/TournamentPicker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo Check-in" };

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ torneio?: string | string[] }> }) {
  await requireAdminPage();
  const sp = await searchParams;
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

  const rows = await listCheckin(chosen.id);
  const active = rows.filter((r) => r.status !== "REJECTED");
  const approved = active.filter((r) => r.status === "APPROVED").length;


  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2">
        <h1 className="heading text-gold-gradient text-3xl">Modo Check-in</h1>
        <TournamentPicker tournaments={tournaments} selected={chosen.id} basePath="/admin/checkin" />
        <p className="text-sm text-stone-400">
          {approved} / {active.length} aprovados. Toque em um jogador para abrir a comparação do time
          .
        </p>
      </div>
      <CheckinList rows={rows} />
    </div>
  );
}
