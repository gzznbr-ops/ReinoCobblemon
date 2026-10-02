import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getRegistrationDetail } from "@/lib/admin-queries";
import { VerifyTeam } from "@/components/admin/VerifyTeam";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificar time" };

export default async function VerifyTeamPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const reg = await getRegistrationDetail(id);
  if (!reg) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`/admin/checkin?torneio=${reg.tournament.id}`} className="text-stone-400 hover:text-gold-200">
          ← Modo Check-in
        </Link>
        <Link href={`/admin/registrations/${reg.id}`} className="text-stone-400 hover:text-gold-200">
          Detalhes da inscrição →
        </Link>
      </div>
      <VerifyTeam
        key={JSON.stringify(reg.pokemon)}
        reg={{
          id: reg.id,
          nickname: reg.nickname,
          code: reg.code,
          tournamentName: reg.tournament.name,
          status: reg.status,
          paid: reg.paid,
          formatVerified: reg.formatVerified,
          teamVerified: reg.teamVerified,
          teamVerifiedBy: reg.teamVerifiedBy,
          teamVerifiedAt: reg.teamVerifiedAt,
          pokemon: reg.pokemon.map((p) => ({
            slot: p.slot,
            battleSet: p.battleSet,
            pokemonId: p.pokemonId,
            name: p.name,
            types: p.types,
            isWildcard: p.isWildcard,
          })),
        }}
      />
    </div>
  );
}
