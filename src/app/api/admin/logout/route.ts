import { destroySession } from "@/lib/auth";
import { isSameOrigin, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError("Origem inválida.", 403);
  await destroySession();
  return jsonOk({ ok: true });
}
