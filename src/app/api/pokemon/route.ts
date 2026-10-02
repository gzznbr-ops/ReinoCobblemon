import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getPublicTournament, rulesOf } from "@/lib/tournaments";
import { pokemonEntriesFor } from "@/lib/rules/tournament-rules";

export const dynamic = "force-dynamic";

/** Lista pública de Pokémon com a legalidade calculada para um torneio (?torneio=<slug>). */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("torneio");
  if (!slug) return jsonError("Informe o torneio.", 400);
  const tournament = await getPublicTournament(slug.slice(0, 80));
  if (!tournament) return jsonError("Torneio não encontrado.", 404);
  return NextResponse.json(pokemonEntriesFor(rulesOf(tournament)), {
    // Curto: o admin pode alterar as regras a qualquer momento
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
  });
}
