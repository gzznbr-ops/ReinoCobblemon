import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { adminActionSchema, firstZodError } from "@/lib/validation";
import { applyAdminAction, deleteRegistration } from "@/lib/admin-actions";
import { RegistrationError } from "@/lib/registrations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function handleError(error: unknown) {
  if (error instanceof RegistrationError) return jsonError(error.message, error.status);
  console.error("[admin/registrations] erro inesperado", error);
  return jsonError("Erro inesperado.", 500);
}

export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const { id } = await params;

  const parsed = adminActionSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400);

  try {
    return jsonOk(await applyAdminAction(admin, id, parsed.data));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const { id } = await params;

  try {
    return jsonOk({ ok: true, ...(await deleteRegistration(admin, id)) });
  } catch (error) {
    return handleError(error);
  }
}
