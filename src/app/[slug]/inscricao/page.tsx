import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { RegisterForm } from "./RegisterForm";
import { availability, countActiveRegistrations, getPublicTournament } from "@/lib/tournaments";
import { formatEventDate, formatMoney } from "@/lib/format";
import { formatLabel } from "@/lib/rules/showdown";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inscrição" };

export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getPublicTournament(slug);
  if (!t) notFound();
  const a = availability(t, await countActiveRegistrations(t.id));


  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-10">
          <Link href={`/${t.slug}`} className="font-display text-xs uppercase tracking-widest text-stone-400 hover:text-gold-200">
            ← {t.name}
          </Link>
          <h1 className="heading text-gold-gradient mt-2 text-3xl sm:text-4xl">Inscrição</h1>
          <p className="mt-2 text-sm text-stone-400">
            <span className="capitalize">{formatEventDate(t.startsAt)}</span> · {formatLabel(t.formatId)} · {t.teamSize} Pokémon ·{" "}
            {t.matchFormat}
            {t.entryFee ? ` · Entrada ${formatMoney(t.entryFee)}` : ""}
          </p>
        </div>


        {a.open ? (
          <RegisterForm
            slug={t.slug}
            entryFee={t.entryFee}
            rules={{ formatId: t.formatId, teamSize: t.teamSize, monotype: t.monotype, monotypeMinimum: t.monotypeMinimum, maxWildcards: t.maxWildcards }}
          />
        ) : (
          <div className="card mx-auto max-w-lg p-8 text-center">
            <p className="heading text-3xl text-crimson-300">Inscrições encerradas</p>
            <p className="mt-2 text-sm text-stone-400">As vagas foram preenchidas ou as inscrições deste torneio foram fechadas.</p>
            <Link href={`/${t.slug}`} className="btn-secondary mt-6">
              Voltar ao torneio
            </Link>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
