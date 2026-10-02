import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { env } from "./env";
import { isSameOrigin, jsonError } from "./http";
import { BASE_PATH } from "./base-path";

export const ADMIN_COOKIE = "reino_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

export type CurrentAdmin = { id: string; username: string; displayName: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(adminId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.adminSession.create({ data: { tokenHash: hashToken(token), adminId, expiresAt } });
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    // Restrito ao caminho do site (ex.: /torneios) quando ele divide o domínio com outro site
    path: BASE_PATH || "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete({ name: ADMIN_COOKIE, path: BASE_PATH || "/" });
}

/** Admin logado (sessão validada no banco) ou null. Memoizado por requisição. */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: { select: { id: true, username: true, displayName: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.admin;
});

/** Páginas do painel: redireciona para o login se não autenticado. */
export async function requireAdminPage(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/**
 * Rotas /api/admin: exige sessão válida e, em métodos que alteram dados,
 * mesma origem (proteção CSRF). Retorna o admin ou uma Response de erro.
 */
export async function requireAdminApi(req: Request): Promise<CurrentAdmin | Response> {
  if (req.method !== "GET" && req.method !== "HEAD" && !isSameOrigin(req)) {
    return jsonError("Origem inválida.", 403);
  }
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError("Não autenticado.", 401);
  return admin;
}
