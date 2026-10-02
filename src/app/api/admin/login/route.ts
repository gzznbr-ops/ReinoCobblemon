import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { getClientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INVALID = "Usuário ou senha inválidos.";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError("Origem inválida.", 403);

  const ip = getClientIp(req);
  if (!(await rateLimit(`login:ip:${ip}`, ip === "unknown" ? 50 : 10, 15 * 60 * 1000))) {
    return jsonError("Muitas tentativas de login. Aguarde 15 minutos.", 429);
  }

  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(INVALID, 400);
  const { username, password } = parsed.data;

  const admin = await prisma.admin.findUnique({ where: { username: username.toLowerCase() } });
  if (!admin) {
    await burnPasswordCheck(password);
    return jsonError(INVALID, 401);
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    return jsonError(`Conta bloqueada temporariamente por excesso de tentativas. Tente em ${LOCK_MINUTES} minutos.`, 429);
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    const attempts = admin.failedLoginAttempts + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
      },
    });
    return jsonError(INVALID, 401);
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(admin.id);
  return jsonOk({ ok: true });
}
