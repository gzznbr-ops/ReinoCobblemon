"use client";

import { withBase } from "@/lib/base-path";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/tournaments", label: "Torneios", highlight: true },
  { href: "/admin/registrations", label: "Inscritos" },
  { href: "/admin/checkin", label: "Check-in" },
  { href: "/admin/showdown", label: "Banlists" },
  { href: "/admin/audit", label: "Histórico" },
];

export function AdminNav({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch(withBase("/api/admin/logout"), { method: "POST" }).catch(() => undefined);
    window.location.href = withBase("/admin/login");
  }

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-gold-600/70 bg-[#160b06]/95 shadow-[0_4px_20px_rgb(0_0_0/0.6)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/admin" className="flex shrink-0 items-center gap-2">
          <LogoMark size={30} />
          <span className="text-gold-gradient hidden font-display text-sm font-black tracking-wider sm:inline">REINO COBBLEMON</span>
          <span className="rounded-sm border border-gold-400/60 bg-crimson-600 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase text-gold-100">
            Admin
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-sm px-3 py-1.5 font-display text-sm tracking-wide transition ${
                isActive(l.href, l.exact)
                  ? "bg-gold-400/15 text-gold-100"
                  : l.highlight
                    ? "text-gold-300 hover:bg-gold-400/10"
                    : "text-stone-400 hover:bg-gold-400/5 hover:text-gold-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/" target="_blank" className="btn-ghost hidden px-3 py-1.5 text-xs md:inline-flex">
            Ver site ↗
          </Link>
          <span className="hidden text-xs text-stone-500 sm:inline">{adminName}</span>
          <button type="button" onClick={logout} className="btn-ghost hidden px-3 py-1.5 text-xs lg:inline-flex">
            Sair
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            Menu
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-gold-600/40 px-4 py-2 lg:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`block rounded-sm px-3 py-2.5 font-display text-sm ${
                isActive(l.href, l.exact) ? "bg-gold-400/15 text-gold-100" : "text-stone-300"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <button type="button" onClick={logout} className="block w-full rounded-sm px-3 py-2.5 text-left text-sm text-red-300">
            Sair ({adminName})
          </button>
        </nav>
      )}
    </header>
  );
}
