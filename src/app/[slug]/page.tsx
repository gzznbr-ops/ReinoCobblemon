import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { Panel } from "@/components/Panel";
import { Prizes } from "@/components/Prizes";
import { RulesSummary } from "@/components/RulesSummary";
import { BracketView } from "@/components/BracketView";
import { RoundRobinView } from "@/components/RoundRobinView";
import { StandingsTable } from "@/components/StandingsTable";
import { TournamentStatusBadge } from "@/components/TournamentBadges";
import { availability, countActiveRegistrations, getPublicTournament } from "@/lib/tournaments";
import { getBracket } from "@/lib/bracket-queries";
import { formatEventDate, formatMoney } from "@/lib/format";
import { formatLabel } from "@/lib/rules/showdown";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getPublicTournament((await params).slug);
  return { title: t?.name ?? "Torneio" };
}

export default async function TournamentPage({ params }: Props) {
  const { slug } = await params;
  const t = await getPublicTournament(slug);
  if (!t) notFound();

  const [registered, bracket] = await Promise.all([countActiveRegistrations(t.id), getBracket(t.id, { publicView: true })]);
  const a = availability(t, registered);
  const unlimited = t.maxParticipants === 0;
  const progress = unlimited ? 100 : Math.min(100, (registered / t.maxParticipants) * 100);


  const stats = [
    { label: "Tier", value: formatLabel(t.formatId) },
    { label: "Time", value: `${t.teamSize} Pokémon` },
    { label: "Formato", value: t.competitionFormat === "ROUND_ROBIN" ? "Pontos corridos" : "Chaveamento" },
    { label: "Partidas", value: t.matchFormat },
    { label: "Entrada", value: t.entryFee ? formatMoney(t.entryFee) : "Grátis" },
  ];

  const steps = [
    { title: "Inscreva-se", text: "Informe seu nick do Minecraft e escolha seu time dentro das regras." },
    {
      title: t.entryFee ? "Pague a entrada" : "Confirme presença",
      text: t.entryFee ? `Transfira ${formatMoney(t.entryFee)} dentro do servidor.` : "Esteja no servidor no horário do check-in.",
    },
    { title: "Verificação", text: "O site verifica automaticamente se o time atende às regras da tier." },
    { title: "Confrontos", text: t.competitionFormat === "ROUND_ROBIN" ? "Após o sorteio, acompanhe suas rodadas e a classificação aqui." : "Com a inscrição aprovada, você entra na chave e descobre seu adversário aqui." },
  ];

  return (
    <SiteShell>
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-10 text-center sm:px-6 sm:pt-16">
          <Link href="/" className="font-display text-xs uppercase tracking-widest text-stone-400 hover:text-gold-200">
            ← Todos os torneios
          </Link>
          <div className="mt-5 flex justify-center">
            <TournamentStatusBadge status={t.status} open={a.open} />
          </div>
          <h1 className="heading text-gold-gradient mt-4 animate-fade-up text-4xl leading-tight sm:text-6xl">{t.name}</h1>
          <p className="mt-3 font-display text-base capitalize text-gold-300 sm:text-lg">
            {formatEventDate(t.startsAt)}{t.endsAt ? ` — até ${formatEventDate(t.endsAt)}` : ""}
          </p>
          {t.description && <p className="mx-auto mt-4 max-w-2xl whitespace-pre-line text-stone-300">{t.description}</p>}

          <div className="mx-auto mt-9 max-w-md">
            {a.open ? (
              <>
                <div className="flex items-end justify-between text-sm">
                  <span className="font-display text-2xl font-bold text-gold-100">
                    {registered}
                    {!unlimited && <span className="text-stone-500"> / {t.maxParticipants}</span>}
                    <span className="ml-2 font-sans text-sm font-medium text-stone-400">inscritos</span>
                  </span>
                  {a.remaining !== null && (
                    <span className="font-semibold text-gold-300">
                      {a.remaining} {a.remaining === 1 ? "vaga restante" : "vagas restantes"}
                    </span>
                  )}
                </div>
                {!unlimited && (
                  <div className="mt-2 h-3 overflow-hidden rounded-sm border border-gold-600/60 bg-black/50">
                    <div className="h-full bg-linear-to-r from-crimson-600 to-gold-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <Link href={`/${t.slug}/inscricao`} className="btn-primary mt-6 w-full py-3.5 text-base">
                  ♦ Fazer inscrição ♦
                </Link>
                <Link href={`/${t.slug}/alterar-time`} className="btn-ghost mt-2 w-full text-xs">
                  Já inscrito? Alterar meu time
                </Link>
              </>
            ) : (
              <div className="card p-6">
                <p className="heading text-2xl text-crimson-300">
                  {t.status === "SCHEDULED" ? "Inscrições encerradas" : t.status === "CANCELLED" ? "Torneio cancelado" : "Inscrições encerradas"}
                </p>
                <p className="mt-1 text-sm text-stone-400">
                  {unlimited ? `${registered} inscritos` : `${registered} / ${t.maxParticipants} inscritos`}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-14 px-4 pb-20 sm:px-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className="font-display text-[11px] font-bold uppercase tracking-wider text-gold-400">{s.label}</p>
              <p className="heading mt-1 text-xl text-gold-100">{s.value}</p>
            </div>
          ))}
        </section>

        {bracket.matches.length > 0 && (
          <Panel title={t.competitionFormat === "ROUND_ROBIN" ? "Classificação e confrontos" : "Chaves"} id="competicao">
            {t.competitionFormat === "ROUND_ROBIN" ? (
              <div className="space-y-8">
                <div>
                  <p className="mb-2 text-right text-xs text-stone-400">{bracket.progress.completed} de {bracket.progress.total} partidas concluídas</p>
                  <StandingsTable rows={bracket.standings} allowDraw={t.allowDraw} />
                </div>
                <RoundRobinView matches={bracket.matches} participants={bracket.standings} />
              </div>
            ) : (
              <BracketView matches={bracket.matches} />
            )}
          </Panel>
        )}


        <Panel title="Premiação">
          <Prizes
            prizes={{ first: t.prizeFirst, second: t.prizeSecond, third: t.prizeThird }}
            rewardDetails={t.rewardDetails}
            podium={t.status === "FINISHED" ? (t.competitionFormat === "ROUND_ROBIN" ? {
              first: bracket.standings[0]?.nickname ?? null,
              second: bracket.standings[1]?.nickname ?? null,
              third: bracket.standings[2] ? [bracket.standings[2].nickname] : [],
            } : bracket.podium) : undefined}
          />
          {!(t.prizeFirst + t.prizeSecond + t.prizeThird) && !t.rewardDetails && (
            <p className="text-center text-sm text-stone-400">Premiação a definir.</p>
          )}
        </Panel>

        <section className="grid gap-8 lg:grid-cols-2">
          <Panel title="Regras">
            <RulesSummary tournament={t} />
          </Panel>
          <Panel title="Como funciona">
            <ol className="space-y-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gold-400 bg-black/50 font-display font-bold text-gold-300">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-display font-bold text-gold-100">{s.title}</span>
                    <span className="block text-sm text-stone-400">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </section>
      </div>
    </SiteShell>
  );
}
