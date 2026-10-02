import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { listAudit } from "@/lib/admin-queries";
import { AuditList } from "@/components/admin/AuditList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Histórico" };

export default async function AuditPage() {
  await requireAdminPage();
  const items = await listAudit(300);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="heading text-gold-gradient text-3xl">Histórico de ações</h1>
        <p className="text-sm text-stone-400">Últimas {items.length} ações administrativas e dos jogadores.</p>
      </div>
      <section className="card overflow-hidden">
        <AuditList items={items} />
      </section>
    </div>
  );
}
