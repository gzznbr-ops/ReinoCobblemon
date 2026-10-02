import Link from "next/link";
import type { AuditItem } from "@/lib/admin-queries";

export function AuditList({ items, linkParticipants = true }: { items: AuditItem[]; linkParticipants?: boolean }) {
  if (items.length === 0) return <p className="p-4 text-sm text-stone-500">Nenhuma ação registrada ainda.</p>;
  return (
    <ul className="divide-y divide-gold-600/20">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
          <time className="shrink-0 font-mono text-xs text-stone-500 sm:w-32 sm:pt-0.5">{item.createdAt}</time>
          <p className="text-sm text-stone-300">
            {item.byPlayer ? (
              <span className="font-semibold text-sky-300">Jogador {item.adminName}</span>
            ) : (
              <span className="font-semibold text-gold-300">Admin {item.adminName}</span>
            )}{" "}
            {item.description}
            {linkParticipants && item.registrationId && (
              <Link href={`/admin/registrations/${item.registrationId}`} className="ml-2 text-xs text-stone-500 underline hover:text-gold-200">
                ver
              </Link>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
