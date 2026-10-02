import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { firstZodError, tournamentSchema } from "@/lib/validation";
import { createTournament } from "@/lib/tournament-admin";
import { TournamentError } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

/** Cria um torneio. */
export async function POST(req: Request) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const parsed = tournamentSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400);
  try {
    const created = await createTournament(admin, parsed.data);
    return jsonOk({ ok: true, id: created.id }, 201);
  } catch (error) {
    if (error instanceof TournamentError) return jsonError(error.message, error.status);
    console.error("[admin/tournaments] erro inesperado", error);
    return jsonError("Erro inesperado.", 500);
  }
}
