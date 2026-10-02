import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { closedReason, getPublicTournament } from "@/lib/tournaments";
import { EditTeamFlow } from "./EditTeamFlow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alterar meu time", robots: { index: false } };

export default async function EditTeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getPublicTournament(slug);
  if (!t) notFound();

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-10">
          <Link href={`/${t.slug}`} className="font-display text-xs uppercase tracking-widest text-stone-400 hover:text-gold-200">
            ← {t.name}
          </Link>
          <h1 className="heading text-gold-gradient mt-2 text-3xl sm:text-4xl">Alterar meu time</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-400">
            Use o nick da inscrição e o código de edição que apareceu na confirmação. Alterações só são aceitas enquanto as
            inscrições estiverem abertas, e o time precisará ser verificado novamente pela organização.
          </p>
        </div>
        <EditTeamFlow
          slug={t.slug}
          rules={{ formatId: t.formatId, teamSize: t.teamSize, monotype: t.monotype, monotypeMinimum: t.monotypeMinimum, maxWildcards: t.maxWildcards }}
          closedReason={closedReason(t)}
        />
      </div>
    </SiteShell>
  );
}
