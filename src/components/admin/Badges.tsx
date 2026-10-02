import type { RegistrationStatus } from "@prisma/client";

const STATUS: Record<RegistrationStatus, { label: string; cls: string }> = {
  APPROVED: { label: "Aprovado", cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" },
  PENDING: { label: "Pendente", cls: "border-gold-400/50 bg-gold-400/10 text-gold-200" },
  REJECTED: { label: "Rejeitado", cls: "border-red-500/50 bg-red-500/10 text-red-300" },
};

export function StatusBadge({ status, large }: { status: RegistrationStatus; large?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center rounded-sm border font-display font-bold uppercase tracking-wide ${s.cls} ${
        large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      {s.label}
    </span>
  );
}

export function Check({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-sm ${ok ? "text-emerald-300" : "text-stone-500"}`}>
      <span aria-hidden>{ok ? "✅" : "❌"}</span>
      {label && <span>{label}</span>}
      <span className="sr-only">{ok ? "sim" : "não"}</span>
    </span>
  );
}

export function AmbiguousBadge() {
  return (
    <span className="inline-flex items-center rounded-sm border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold uppercase text-orange-300">
      Tipo ambíguo - revisar
    </span>
  );
}
