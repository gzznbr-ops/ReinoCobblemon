import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { lockRules, releaseState } from "@/lib/rules/release-state";
import { SHOWDOWN_SOURCE } from "@/lib/rules/showdown";
import { TournamentError } from "@/lib/tournaments";
import { z } from "zod";

export const dynamic = "force-dynamic";
const schema = z.object({
  action: z.enum(["begin", "publish", "abort", "confirm"]),
  buildId: z.string().uuid(), revision: z.string().max(80).optional(), version: z.string().max(30).optional(),
}).strict();

export async function POST(req: Request) {
  const secret = process.env.RULES_BUILD_SECRET;
  const supplied = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(supplied);
  if (!secret || secret.length < 32 || actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)) return jsonError("Não autorizado.", 401);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Pedido inválido.", 400);
  const input = parsed.data;
  try {
    const result = await prisma.$transaction(async tx => {
      await lockRules(tx);
      const state = await releaseState(tx);
      if (input.action === "confirm") {
        if (SHOWDOWN_SOURCE.deploymentId !== input.buildId) {
          throw new TournamentError("A nova publicação ainda não está respondendo.", 409);
        }
        return { confirmed: true, version: SHOWDOWN_SOURCE.version };
      }
      if (input.action === "begin") {
        if (state.buildId === input.buildId && !state.publishing) {
          return { version: state.version, revision: state.revision, buildId: state.buildId };
        }
        if (state.buildId) throw new TournamentError("Outro build detém o bloqueio de publicação.", 409);
        const next = await tx.rulesRelease.update({ where: { id: 1 }, data: {
          buildId: input.buildId, publishing: false, lastError: null,
        } });
        return { version: next.version, revision: next.revision, buildId: next.buildId };
      }
      if (state.buildId !== input.buildId ||
          (input.action !== "abort" && (state.revision !== input.revision || state.version !== input.version))) {
        throw new TournamentError("Build obsoleto: a aprovação não corresponde a esta publicação.", 409);
      }
      if (input.action === "abort") {
        if (state.publishing) throw new TournamentError("Publicação iniciada: verifique a Cloudflare antes de liberar o bloqueio.", 409);
        await tx.rulesRelease.update({ where: { id: 1 }, data: {
          buildId: null, lastError: "O build ou os testes falharam. A versão anterior continua no ar; consulte o log da Cloudflare e tente novamente.",
        } });
        return { aborted: true };
      }
      if (state.publishing) throw new TournamentError("Publicação já iniciada.", 409);
      await tx.rulesRelease.update({ where: { id: 1 }, data: { publishing: true } });
      return { authorized: true };
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof TournamentError) return jsonError(error.message, error.status);
    return jsonError("Falha na coordenação do build.", 500);
  }
}
