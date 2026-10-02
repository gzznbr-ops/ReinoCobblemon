import Link from "next/link";
import { Logo } from "./Logo";

const SERVER_URL = "https://reinocobblemon.com";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-gold-600/70 bg-[#160b06]/95 shadow-[0_4px_20px_rgb(0_0_0/0.6)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="rounded-sm focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Início">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 font-display text-xs uppercase tracking-[0.1em] sm:gap-2 sm:text-sm">
            <Link href="/" className="px-2 py-2 text-gold-100 transition hover:text-white hover:[text-shadow:0_0_10px_#d4af37]">
              Torneios
            </Link>
            <span className="hidden text-gold-400 sm:inline" aria-hidden>
              ✦
            </span>
            <a
              href={SERVER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden px-2 py-2 text-gold-100 transition hover:text-white hover:[text-shadow:0_0_10px_#d4af37] sm:inline"
            >
              Servidor
            </a>
            <a href={SERVER_URL} target="_blank" rel="noopener noreferrer" className="btn-primary ml-1 px-3 py-2 text-xs sm:px-5">
              ♦ Jogar ♦
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gold-600/50 bg-[#160b06]/80 py-7 text-center text-xs text-stone-400">
        <p className="font-display text-sm tracking-wider text-gold-300">Reino Cobblemon</p>
        <p className="mt-2">Torneios comunitários de Cobblemon. Não afiliado à Nintendo, Game Freak, The Pokémon Company ou Cobblemon.</p>
        <p className="mt-1">Tiers e banlists: Pokémon Showdown (smogon/pokemon-showdown). Sprites via PokeAPI.</p>
      </footer>
    </div>
  );
}
