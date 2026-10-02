import "server-only";
import { prisma } from "./db";

/**
 * Rate limit por janela deslizante, salvo no PostgreSQL (funciona mesmo com
 * várias instâncias do app). Retorna true se a requisição foi permitida.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= limit) return false;
  await prisma.rateLimitHit.create({ data: { key } });

  // Limpeza oportunista de registros antigos (~1% das chamadas)
  if (Math.random() < 0.01) {
    await prisma.rateLimitHit
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }
  return true;
}
