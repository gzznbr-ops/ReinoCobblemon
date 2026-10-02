/** Brasão original do Reino Cobblemon: coroa dourada com gema carmesim. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="rc-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3d6" />
          <stop offset="0.45" stopColor="#e5c55a" />
          <stop offset="1" stopColor="#8f6a13" />
        </linearGradient>
        <linearGradient id="rc-gem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5a5a" />
          <stop offset="1" stopColor="#8b0000" />
        </linearGradient>
      </defs>
      {/* coroa */}
      <path
        d="M6 16 15 25 24 9l9 16 9-9-4 22H10z"
        fill="url(#rc-gold)"
        stroke="#1a0f08"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="9" y="37" width="30" height="5" rx="1" fill="url(#rc-gold)" stroke="#1a0f08" strokeWidth="2" />
      {/* gema/pokébola central */}
      <circle cx="24" cy="29" r="5.5" fill="url(#rc-gem)" stroke="#1a0f08" strokeWidth="2" />
      <path d="M18.5 29h11" stroke="#1a0f08" strokeWidth="1.6" />
      <circle cx="24" cy="29" r="1.8" fill="#fff3d6" stroke="#1a0f08" strokeWidth="1.2" />
      <circle cx="6" cy="15" r="2.5" fill="#d4af37" stroke="#1a0f08" strokeWidth="1.5" />
      <circle cx="24" cy="8" r="2.5" fill="#d4af37" stroke="#1a0f08" strokeWidth="1.5" />
      <circle cx="42" cy="15" r="2.5" fill="#d4af37" stroke="#1a0f08" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={compact ? 30 : 38} className="drop-shadow-[0_0_8px_rgba(212,175,55,0.35)]" />
      <span className="flex flex-col leading-none">
        <span className="text-gold-gradient font-display text-lg font-black tracking-wider">REINO</span>
        <span className="font-display text-[11px] font-bold tracking-[0.2em] text-crimson-400">COBBLEMON</span>
      </span>
    </span>
  );
}
