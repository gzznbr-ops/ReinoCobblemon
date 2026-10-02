import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SiteShell } from "@/components/SiteShell";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeList } from "@/components/TypeBadge";
import { EditCodeReveal } from "@/components/EditCodeDisplay";
import { prisma } from "@/lib/db";
import { formatEventDate, formatMoney } from "@/lib/format";
import { REGISTRATION_COOKIE, readRegistrationToken } from "@/lib/registration-cookie";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inscrição recebida", robots: { index: false } };

export default async function RegistrationSuccessPage() {
  const jar = await cookies();
  const registrationId = readRegistrationToken(jar.get(REGISTRATION_COOKIE)?.value);

  // Só mostra a inscrição cujo ID está no cookie assinado deste navegador.
  // Não exibe tipo detectado nem status interno.
  const registration = registrationId
    ? await prisma.registration.findUnique({
        where: { id: registrationId },
        select: {
          nickname: true,
          registrationCode: true,
          tournament: { select: { name: true, slug: true, entryFee: true, startsAt: true } },
          pokemon: { orderBy: { slot: "asc" }, select: { pokemonId: true, pokemonName: true, types: true, slot: true } },
        },
      })
    : null;

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {!registration ? (
          <div className="card p-8 text-center">
            <h1 className="heading text-2xl text-gold-100">Nenhuma inscrição recente</h1>
            <p className="mt-2 text-sm text-stone-400">
              Esta página mostra a confirmação logo após o envio da inscrição, somente neste navegador.
            </p>
            <Link href="/" className="btn-secondary mt-6">
              Ver torneios
            </Link>
          </div>
        ) : (
          <div className="card animate-fade-up overflow-hidden">
            <div className="border-b-2 border-gold-600/60 bg-linear-to-b from-crimson-700/60 to-transparent p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold-400 bg-black/50 text-3xl text-gold-300 shadow-[0_0_14px_#d4af37]">
                ✓
              </div>
              <h1 className="heading text-gold-gradient mt-4 text-3xl sm:text-4xl">Inscrição recebida!</h1>
              <p className="mt-2 font-display text-sm text-gold-300">
                {registration.tournament.name} · <span className="capitalize">{formatEventDate(registration.tournament.startsAt)}</span>
              </p>
              <p className="mt-3 inline-block rounded-sm border border-gold-600 bg-black/60 px-4 py-1.5 font-display text-lg font-bold tracking-wider text-gold-100">
                {registration.registrationCode}
              </p>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <div>
                <p className="label">Nick</p>
                <p className="text-xl font-semibold text-gold-100">{registration.nickname}</p>
              </div>

              <div>
                <p className="label">Equipe registrada</p>
                <ul className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {registration.pokemon.map((p) => (
                    <li key={p.slot} className="panel-soft flex items-center gap-2 p-2">
                      <PokemonSprite pokemonId={p.pokemonId} name={p.pokemonName} size={48} className="shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-gold-100">{p.pokemonName}</span>
                        <TypeList types={p.types} size="xs" />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <EditCodeReveal registrationCode={registration.registrationCode} />

              {registration.tournament.entryFee > 0 && (
                <p className="rounded-sm border border-gold-400/30 bg-gold-400/[0.07] p-4 text-sm text-gold-100">
                  Sua inscrição será confirmada após o pagamento da taxa de {formatMoney(registration.tournament.entryFee)} dentro do
                  servidor.
                </p>
              )}
              <div className="text-center">
                <Link href={`/${registration.tournament.slug}`} className="btn-secondary">
                  Voltar ao torneio
                </Link>
                <p className="mt-3 text-xs text-stone-500">
                  Guarde o código {registration.registrationCode}. Seu time é secreto e só a organização pode vê-lo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
