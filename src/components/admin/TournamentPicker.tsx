"use client";

import { useRouter } from "next/navigation";

type Option = { id: string; name: string; status: string };

/** Seleciona o torneio exibido em Inscritos / Check-in (?torneio=<id>). */
export function TournamentPicker({ tournaments, selected, basePath }: { tournaments: Option[]; selected: string; basePath: string }) {
  const router = useRouter();
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="label mb-0 shrink-0">Torneio</span>
      <select
        className="input min-w-0 py-2"
        value={selected}
        onChange={(e) => router.push(`${basePath}?torneio=${encodeURIComponent(e.target.value)}`)}
      >
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.status === "DRAFT" ? " (rascunho)" : t.status === "FINISHED" ? " (finalizado)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
