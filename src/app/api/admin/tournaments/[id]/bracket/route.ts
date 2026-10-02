import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { bracketActionSchema, firstZodError } from "@/lib/validation";
import { applyBracketAction } from "@/lib/bracket-service";
import { TournamentError } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

/** Gerar/resetar chaves, lançar/apagar resultado, agendar partida, trocar jogadores. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const parsed = bracketActionSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400);
  try {
    return jsonOk(await applyBracketAction(admin, (await params).id, parsed.data));
  } catch (error) {
    if (error instanceof TournamentError) return jsonError(error.message, error.status);
    console.error("[admin/bracket] erro inesperado", error);
    return jsonError("Erro inesperado.", 500);
  }
}
