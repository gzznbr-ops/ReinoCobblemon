import "server-only";
// Build WASM do Prisma (engineType "client"): funciona no runtime workerd da Cloudflare
import { PrismaClient } from "@prisma/client/wasm";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Nos Cloudflare Workers uma conexão não pode ser reaproveitada entre
 * requisições. Por isso é criado um PrismaClient por requisição (guardado no
 * ExecutionContext) usando a connection string do Hyperdrive.
 *
 * Fora da Cloudflare (next dev, node) usa DATABASE_URL com um cliente global.
 */
type CfEnv = { HYPERDRIVE?: { connectionString: string } };

const perRequest = new WeakMap<object, PrismaClient>();
const globalForPrisma = globalThis as unknown as { prismaNode?: PrismaClient };

function resolveClient(): PrismaClient {
  let context: { env: CfEnv; ctx: object } | null = null;
  try {
    context = getCloudflareContext() as unknown as { env: CfEnv; ctx: object };
  } catch {
    context = null;
  }

  const hyperdrive = context?.env.HYPERDRIVE?.connectionString;
  if (context && hyperdrive && context.ctx) {
    let client = perRequest.get(context.ctx);
    if (!client) {
      client = new PrismaClient({ adapter: new PrismaPg({ connectionString: hyperdrive, maxUses: 1 }) });
      perRequest.set(context.ctx, client);
    }
    return client;
  }

  globalForPrisma.prismaNode ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  return globalForPrisma.prismaNode;
}

/** Mesmo uso de sempre (`prisma.registration.findMany(...)`), resolvido por requisição. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = resolveClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
