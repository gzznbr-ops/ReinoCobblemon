import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { ShowdownBanlists } from "@/components/admin/ShowdownBanlists";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Banlists do Showdown" };

export default async function ShowdownPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading text-gold-gradient text-3xl">Banlists do Showdown</h1>
        <p className="text-sm text-stone-400">
          Confira quem está banido em cada tier e verifique se o Pokémon Showdown mudou alguma banlist.
        </p>
      </div>
      <ShowdownBanlists />
    </div>
  );
}
