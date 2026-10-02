import "server-only";
import { getClientIp, isSameOrigin, jsonError } from "./http";
import { rateLimit } from "./rate-limit";
import { normalizeNickname, RegistrationError } from "./registrations";

/**
 * Proteções comuns das rotas de edição pelo jogador: mesma origem e limite de
 * tentativas por IP e por nick (impede adivinhar o código de um jogador).
 */
export async function guardEditRequest(req: Request, nickname: string): Promise<Response | null> {
  if (!isSameOrigin(req)) return jsonError("Origem inválida.", 403);
  const ip = getClientIp(req);
  const [perIp, perNick] = await Promise.all([
    rateLimit(`edit:ip:${ip}`, ip === "unknown" ? 60 : 20, 15 * 60 * 1000),
    rateLimit(`edit:nick:${normalizeNickname(nickname)}`, 10, 15 * 60 * 1000),
  ]);
  if (!perIp || !perNick) return jsonError("Muitas tentativas. Aguarde 15 minutos e tente novamente.", 429);
  return null;
}

export function editErrorResponse(error: unknown, route: string) {
  if (error instanceof RegistrationError) return jsonError(error.message, error.status);
  console.error(`[${route}] erro inesperado`, error);
  return jsonError("Erro inesperado. Tente novamente.", 500);
}
