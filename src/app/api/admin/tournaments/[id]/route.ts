import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { firstZodError, tournamentDeleteSchema, tournamentQuickSchema, tournamentSchema } from "@/lib/validation";
import { deleteTournament, updateTournament } from "@/lib/tournament-admin";
import { TournamentError } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function handleError(error: unknown) {
  if (error instanceof TournamentError) return jsonError(error.message, error.status);
  console.error("[admin/tournaments/:id] erro inesperado", error);
  return jsonError("Erro inesperado.", 500);
}

/** Salva o formulário completo do torneio. */
export async function PUT(req: Request, { params }: Params) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const parsed = tournamentSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400);
  try {
    await updateTournament(admin, (await params).id, parsed.data);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

/** Ações rápidas: abrir/encerrar inscrições e mudar status. */
export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const parsed = tournamentQuickSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400);
  try {
    await updateTournament(admin, (await params).id, parsed.data);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

/** Exclui o torneio e tudo dele. Corpo: { confirmName: "<nome exato>" }. */
export async function DELETE(req: Request, { params }: Params) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const parsed = tournamentDeleteSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Digite o nome exato do torneio para confirmar a exclusão.", 400);
  try {
    await deleteTournament(admin, (await params).id, parsed.data.confirmName);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
