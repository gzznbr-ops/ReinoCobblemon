import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { rulesOf } from "@/lib/tournaments";
import { pokemonEntriesFor } from "@/lib/rules/tournament-rules";

export const dynamic = "force-dynamic";

/** Legalidade dos Pokémon para o admin (funciona também com torneios em rascunho). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const tournament = await prisma.tournament.findUnique({ where: { id: (await params).id } });
  if (!tournament) return jsonError("Torneio não encontrado.", 404);
  return jsonOk(pokemonEntriesFor(rulesOf(tournament)));
}
