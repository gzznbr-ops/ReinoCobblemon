import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { checkRelease } from "@/lib/rules/releases";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  if (!await rateLimit(`rules-check:${admin.id}`, 10, 60_000)) return jsonError("Aguarde um minuto antes de verificar novamente.", 429);
  try { return jsonOk(await checkRelease()); }
  catch { return jsonError("Não foi possível consultar as versões do validador. Tente novamente.", 502); }
}
