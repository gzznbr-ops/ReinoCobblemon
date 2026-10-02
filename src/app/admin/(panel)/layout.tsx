import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Admin Reino Cobblemon" },
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();

  return (
    <div className="min-h-dvh">
      <AdminNav adminName={admin.displayName} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
