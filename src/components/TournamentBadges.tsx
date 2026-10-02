import type { TournamentStatus } from "@prisma/client";

const STATUS: Record<TournamentStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Rascunho", cls: "border-stone-500/50 bg-stone-500/10 text-stone-300" },
  SCHEDULED: { label: "Agendado", cls: "border-gold-400/60 bg-gold-400/10 text-gold-200" },
  IN_PROGRESS: { label: "Em andamento", cls: "border-crimson-400/60 bg-crimson-600/30 text-crimson-300" },
  FINISHED: { label: "Finalizado", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" },
  CANCELLED: { label: "Cancelado", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
};

export function TournamentStatusBadge({ status, open }: { status: TournamentStatus; open?: boolean }) {
  const s = open ? { label: "Inscrições abertas", cls: "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" } : STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}
