import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBracket } from "@/lib/bracket-queries";
import { toDateTimeLocalInput } from "@/lib/format";
import { BracketManager } from "@/components/admin/BracketManager";
import { TournamentStatusBadge } from "@/components/TournamentBadges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Competição" };

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t) notFound();

  const [bracket, approved, pending] = await Promise.all([
    getBracket(t.id),
    prisma.registration.findMany({
      where: { tournamentId: t.id, status: "APPROVED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, nickname: true },
    }),
    prisma.registration.count({ where: { tournamentId: t.id, status: "PENDING" } }),
  ]);

  let blocked: string | null = null;
  if (t.status === "DRAFT" || t.status === "CANCELLED") blocked = "Publique o torneio antes de gerar as chaves.";
  else if (approved.length < 2) blocked = "São necessários pelo menos 2 inscritos aprovados.";
  else if (t.competitionFormat === "ROUND_ROBIN" && approved.length > 32) blocked = "Pontos corridos aceita no máximo 32 participantes.";
  else if (pending > 0) blocked = `Atenção: ${pending} inscrição(ões) ainda PENDENTE(S) ficarão de fora.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/admin/tournaments/${t.id}`} className="text-sm text-stone-400 hover:text-gold-200">
            ← {t.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="heading text-gold-gradient text-3xl">{t.competitionFormat === "ROUND_ROBIN" ? "Pontos corridos" : "Chaves"}</h1>
            <TournamentStatusBadge status={t.status} />
          </div>
          <p className="text-sm text-stone-400">
            {t.matchFormat} · {t.competitionFormat === "ROUND_ROBIN" ? `${t.roundRobinTurns} turno${t.roundRobinTurns === 2 ? "s" : ""} · ${t.pointsForWin}/${t.pointsForDraw}/${t.pointsForLoss} pontos` : `eliminação simples${t.thirdPlaceMatch ? " + disputa de 3º" : ""}`}
          </p>
        </div>
        {t.status !== "DRAFT" && (
          <Link href={`/${t.slug}#competicao`} target="_blank" className="btn-ghost">
            Ver no site ↗
          </Link>
        )}
      </div>

      <BracketManager
        tournamentId={t.id}
        competitionFormat={t.competitionFormat}
        roundRobinTurns={t.roundRobinTurns}
        allowDraw={t.allowDraw}
        thirdPlaceMatch={t.thirdPlaceMatch}
        matches={bracket.matches}
        scheduledInputs={Object.fromEntries(
          Object.entries(bracket.rawScheduled)
            .filter(([, d]) => d)
            .map(([matchId, d]) => [matchId, toDateTimeLocalInput(d!)]),
        )}
        approved={approved}
        podium={bracket.podium}
        standings={bracket.standings}
        progress={bracket.progress}
        canGenerate={t.status !== "DRAFT" && t.status !== "CANCELLED" && approved.length >= 2 && !(t.competitionFormat === "ROUND_ROBIN" && approved.length > 32)}
        generateBlockedReason={blocked}
      />
    </div>
  );
}
