import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { writeAudit } from "@/lib/audit";
import { checkRelease } from "@/lib/rules/releases";
import { lockRules, releaseState } from "@/lib/rules/release-state";
import { SHOWDOWN_SOURCE } from "@/lib/rules/showdown";
import { TournamentError } from "@/lib/tournaments";
import { z } from "zod";

export const dynamic = "force-dynamic";
const inputSchema = z.union([
  z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) }).strict(),
  z.object({ retry: z.literal(true) }).strict(),
]);

function configured() {
  return Boolean(process.env.RULES_DEPLOY_HOOK && process.env.RULES_BUILD_SECRET);
}

export async function GET(req: Request) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  const result = await prisma.$transaction(async tx => {
    await lockRules(tx);
    const state = await releaseState(tx);
    const unfinished = await tx.tournament.count({ where: { status: { notIn: ["FINISHED", "CANCELLED"] } } });
    return { ...state, unfinished };
  });
  return jsonOk({ ...result, configured: configured(), currentVersion: SHOWDOWN_SOURCE.version });
}

export async function POST(req: Request) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;
  if (!configured()) return jsonError("A conexão de atualização com a Cloudflare ainda não foi configurada.", 503);
  const input = inputSchema.safeParse(await readJson(req));
  if (!input.success) return jsonError("Pedido de atualização inválido.", 400);
  // Never accept a destination or command from the client.
  const hook = process.env.RULES_DEPLOY_HOOK!;
  if (!/^https:\/\/api\.cloudflare\.com\/client\/v4\/workers\/builds\/deploy_hooks\/[a-zA-Z0-9_-]+$/.test(hook)) {
    return jsonError("Conexão de atualização inválida.", 503);
  }
  try {
    const requested = "version" in input.data ? input.data.version : null;
    if (requested && (await checkRelease()).availableVersion !== requested) {
      return jsonError("A versão disponível mudou. Verifique as atualizações novamente.", 409);
    }
    const state = await prisma.$transaction(async tx => {
      await lockRules(tx);
      const current = await releaseState(tx);
      if (current.buildId || current.publishing) throw new TournamentError("Já existe um build em andamento. Aguarde sua conclusão.", 409);
      if (current.lastAttemptAt && Date.now() - current.lastAttemptAt.getTime() < 120_000) {
        throw new TournamentError("Aguarde dois minutos antes de tentar novamente.", 429);
      }
      if (requested && current.pending) throw new TournamentError("Conclua a atualização pendente antes de iniciar outra.", 409);
      if (!requested && !current.pending) throw new TournamentError("Não há atualização pendente.", 409);
      const unfinished = await tx.tournament.count({ where: { status: { notIn: ["FINISHED", "CANCELLED"] } } });
      if (unfinished) throw new TournamentError(`Encerre ou cancele os ${unfinished} torneio(s) não finalizado(s) antes de atualizar as regras.`, 409);
      const next = await tx.rulesRelease.update({ where: { id: 1 }, data: {
        ...(requested ? { version: requested, revision: crypto.randomUUID(), pending: true } : {}),
        lastAttemptAt: new Date(), lastError: null,
      } });
      await writeAudit(tx, { admin, action: "RULES_UPDATE_REQUESTED",
        description: `solicitou a atualização do validador para ${next.version}.`, metadata: { revision: next.revision } });
      return next;
    });
    // The durable request remains pending even when Cloudflare's response is lost.
    // Retrying the same release is safe; builds acquire an exclusive database lock.
    try {
      const response = await fetch(hook, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("hook failed");
      const body = await response.json() as { success?: boolean };
      if (!body.success) throw new Error("hook failed");
    } catch {
      await prisma.rulesRelease.updateMany({ where: { id: 1, revision: state.revision }, data: {
        lastError: "Não foi possível confirmar o início na Cloudflare. Confira o build antes de tentar novamente.",
      } });
      return jsonError("Solicitação salva, mas a Cloudflare não confirmou o início. Acompanhe o status ou tente novamente em dois minutos.", 502);
    }
    return jsonOk({ accepted: true, version: state.version }, 202);
  } catch (error) {
    if (error instanceof TournamentError) return jsonError(error.message, error.status);
    return jsonError("Não foi possível iniciar a atualização. Verifique novamente.", 502);
  }
}
