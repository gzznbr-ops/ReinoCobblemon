"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RegistrationStatus } from "@prisma/client";
import { Check, StatusBadge } from "./Badges";

type Row = {
  id: string;
  nickname: string;
  registrationCode: string | null;
  paid: boolean;
  teamVerified: boolean;
  formatVerified: boolean;
  status: RegistrationStatus;
  typeAmbiguous: boolean;
};

export function CheckinList({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => r.status !== "REJECTED")
      .filter((r) => !onlyPending || r.status !== "APPROVED")
      .filter((r) => !q || r.nickname.toLowerCase().includes(q) || r.registrationCode?.toLowerCase().includes(q));
  }, [rows, query, onlyPending]);

  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-2 bg-ink-950/90 px-4 py-2 backdrop-blur sm:mx-0 sm:flex-row sm:px-0">
        <input type="search" className="input text-base" placeholder="Buscar nick…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="panel-soft flex shrink-0 cursor-pointer items-center gap-2 px-3 py-2 text-sm text-stone-300">
          <input type="checkbox" className="h-4 w-4 accent-yellow-500" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          Só pendentes
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="card p-6 text-center text-sm text-stone-500">Nenhum jogador encontrado.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/registrations/${r.id}/verify`}
                className={`card flex flex-col gap-2 p-3.5 transition hover:border-gold-400 active:scale-[0.99] sm:flex-row sm:items-center sm:gap-4 ${
                  r.status === "APPROVED" ? "border-emerald-600/60" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold text-gold-100">{r.nickname}</span>
                  <span className="text-xs text-stone-500">{r.registrationCode}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Check ok={r.paid} label="Pago" />
                  <Check ok={r.teamVerified} label="Time" />
                  <Check ok={r.formatVerified} label="Elegibilidade" />
                  <StatusBadge status={r.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
