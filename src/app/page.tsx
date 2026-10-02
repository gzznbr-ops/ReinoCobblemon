import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { LogoMark } from "@/components/Logo";
import { TournamentStatusBadge } from "@/components/TournamentBadges";
import { listPublicTournaments, type TournamentAvailability } from "@/lib/tournaments";
import { formatEventDate, formatMoney } from "@/lib/format";
import { formatLabel } from "@/lib/rules/showdown";
import type { Tournament } from "@prisma/client";

export const dynamic = "force-dynamic";

function TournamentCard({ tournament: t, availability: a }: { tournament: Tournament; availability: TournamentAvailability }) {
  const prizeTotal = t.prizeFirst + t.prizeSecond + t.prizeThird;
  return (
    <Link
      href={`/${t.slug}`}
      className="card group flex flex-col p-5 transition hover:border-gold-400 hover:shadow-[0_0_24px_rgb(212_175_55/0.25)]"
    >
      <div className="flex items-start justify-between gap-3">
        <TournamentStatusBadge status={t.status} open={a.open} />
        <span className="rounded-sm border border-gold-600/60 bg-black/40 px-2 py-0.5 font-display text-xs font-bold text-gold-300">
          {formatLabel(t.formatId)}
        </span>
      </div>
      <h3 className="heading mt-3 text-xl leading-tight text-gold-100 group-hover:text-white">{t.name}</h3>
      <p className="mt-1 text-sm capitalize text-stone-400">{formatEventDate(t.startsAt)}</p>
      {t.description && <p className="mt-3 line-clamp-2 text-sm text-stone-300">{t.description}</p>}

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-gold-600/30 pt-4 text-center">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Entrada</dt>
          <dd className="font-display text-sm font-bold text-gold-200">{t.entryFee ? formatMoney(t.entryFee) : "Grátis"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Inscritos</dt>
          <dd className="font-display text-sm font-bold text-gold-200">
            {a.registered}
            {t.maxParticipants > 0 && <span className="text-stone-500">/{t.maxParticipants}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Prêmios</dt>
          <dd className="font-display text-sm font-bold text-gold-200">{prizeTotal ? formatMoney(prizeTotal) : t.rewardDetails ? "Itens" : "—"}</dd>
        </div>
      </dl>
      <span className="btn-secondary mt-4 w-full text-xs">{a.open ? "Ver regras e inscrever-se" : "Ver torneio"}</span>
    </Link>
  );
}

function Section({ title, items }: { title: string; items: Awaited<ReturnType<typeof listPublicTournaments>> }) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-8 text-center">
        <span className="ribbon">{title}</span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <TournamentCard key={item.tournament.id} {...item} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const all = await listPublicTournaments();
  const upcoming = all.filter((i) => i.tournament.status === "SCHEDULED");
  const live = all.filter((i) => i.tournament.status === "IN_PROGRESS");
  const past = all
    .filter((i) => i.tournament.status === "FINISHED" || i.tournament.status === "CANCELLED")
    .reverse()
    .slice(0, 9);

  return (
    <SiteShell>
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pt-20">
          <LogoMark size={84} className="mx-auto animate-fade-up drop-shadow-[0_0_28px_rgba(212,175,55,0.45)]" />
          <p className="mt-6 animate-fade-up font-display text-xs font-bold uppercase tracking-[0.35em] text-crimson-400">
            ✦ Arena Reino ✦
          </p>
          <h1 className="heading text-gold-gradient mt-3 animate-fade-up text-5xl leading-none sm:text-7xl">Torneios</h1>
          <p className="mx-auto mt-4 max-w-xl animate-fade-up text-lg text-stone-300">
            Monte seu time, confira as regras de cada torneio e dispute a glória do Reino Cobblemon.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 pb-20 sm:px-6">
        {all.length === 0 && (
          <div className="card mx-auto max-w-lg p-8 text-center">
            <p className="heading text-2xl text-gold-200">Nenhum torneio anunciado</p>
            <p className="mt-2 text-sm text-stone-400">Os próximos torneios aparecem aqui assim que a organização publicar.</p>
          </div>
        )}
        <Section title="Em andamento" items={live} />
        <Section title="Próximos torneios" items={upcoming} />
        <Section title="Torneios anteriores" items={past} />
      </div>
    </SiteShell>
  );
}
