import { cookies } from "next/headers";
import { getClientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { firstZodError, registrationInputSchema } from "@/lib/validation";
import { RegistrationError, createRegistration } from "@/lib/registrations";
import { env } from "@/lib/env";
import { BASE_PATH } from "@/lib/base-path";
import { REGISTRATION_COOKIE, REGISTRATION_COOKIE_MAX_AGE, createRegistrationToken } from "@/lib/registration-cookie";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError("Origem inválida.", 403);

  const ip = getClientIp(req);
  if (!(await rateLimit(`register:ip:${ip}`, ip === "unknown" ? 60 : 10, 15 * 60 * 1000))) {
    return jsonError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", 429);
  }

  const parsed = registrationInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400);

  // Honeypot anti-spam: bots costumam preencher todos os campos
  if (parsed.data.website) return jsonError("Não foi possível processar a inscrição.", 400);

  // Limite global só conta envios bem formados: lixo não consegue travar as inscrições de todos
  if (!(await rateLimit("register:global", 300, 60 * 60 * 1000))) {
    return jsonError("Muitas inscrições no momento. Aguarde alguns minutos e tente novamente.", 429);
  }

  try {
    const result = await createRegistration({
      tournamentSlug: parsed.data.tournament,
      nickname: parsed.data.nickname,
      pokemonIds: parsed.data.pokemon,
    });

    const jar = await cookies();
    jar.set(REGISTRATION_COOKIE, createRegistrationToken(result.id), {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: BASE_PATH || "/",
      maxAge: REGISTRATION_COOKIE_MAX_AGE,
    });

    // Resposta mínima: nenhum dado interno (tipo detectado, id do banco...)
    return jsonOk({ ok: true, code: result.code, editCode: result.editCode }, 201);
  } catch (error) {
    if (error instanceof RegistrationError) return jsonError(error.message, error.status, { code: error.code });
    console.error("[registrations] erro inesperado", error);
    return jsonError("Erro inesperado. Tente novamente.", 500);
  }
}
