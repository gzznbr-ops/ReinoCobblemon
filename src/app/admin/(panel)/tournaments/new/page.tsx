import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { toDateTimeLocalInput } from "@/lib/format";
import { TournamentForm, type TournamentFormValues } from "@/components/admin/TournamentForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo torneio" };

export default async function NewTournamentPage() {
  await requireAdminPage();

  // Sugestão: próximo sábado às 19h
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + ((6 - start.getUTCDay() + 7) % 7 || 7));
  start.setUTCHours(22, 0, 0, 0);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

  const initial: TournamentFormValues = {
    name: "",
    slug: "",
    description: "",
    status: "DRAFT",
    startsAt: toDateTimeLocalInput(start),
    endsAt: toDateTimeLocalInput(end),
    competitionFormat: "SINGLE_ELIMINATION",
    roundRobinTurns: 1,
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0,
    allowDraw: false,
    formatId: "gen9ou",
    teamSize: 6,
    matchFormat: "MD1",
    allowRestricted: false,
    allowLegendary: false,
    allowMythical: false,
    allowUltraBeast: false,
    allowParadox: true,
    bannedPokemonIds: [],
    allowedPokemonIds: [],
    monotype: false,
    monotypeMinimum: 4,
    maxWildcards: 2,
    customRules: "",
    entryFee: 0,
    maxParticipants: 16,
    registrationsOpen: true,
    prizeFirst: 0,
    prizeSecond: 0,
    prizeThird: 0,
    rewardDetails: "",
    thirdPlaceMatch: true,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/tournaments" className="text-sm text-stone-400 hover:text-gold-200">
          ← Torneios
        </Link>
        <h1 className="heading text-gold-gradient mt-1 text-3xl">Novo torneio</h1>
        <p className="text-sm text-stone-400">Comece como Rascunho, confira a prévia e publique quando estiver pronto.</p>
      </div>
      <TournamentForm initial={initial} />
    </div>
  );
}
