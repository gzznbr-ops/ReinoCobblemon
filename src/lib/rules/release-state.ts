import "server-only";
import type { Prisma } from "@prisma/client";
import { SHOWDOWN_SOURCE } from "./showdown";
import { deploymentMatches } from "./release-policy";
import { TournamentError } from "../tournaments";

export async function lockRules(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(728194602)`;
}

/** Caller holds lockRules until transaction commit. Never expires a deploy lock. */
export async function releaseState(tx: Prisma.TransactionClient) {
  let state = await tx.rulesRelease.upsert({ where: { id: 1 }, update: {}, create: {
    id: 1, version: SHOWDOWN_SOURCE.version, revision: SHOWDOWN_SOURCE.rulesRevision ?? "initial",
  } });
  if (deploymentMatches(state, SHOWDOWN_SOURCE)) {
    state = await tx.rulesRelease.update({ where: { id: 1 }, data: {
      pending: false, buildId: null, publishing: false, lastError: null,
    } });
    await tx.auditLog.create({ data: {
      adminName: "Cloudflare Builds", action: "RULES_PUBLISHED",
      description: `confirmou a publicação do validador ${state.version}.`,
      metadata: { revision: state.revision, deploymentId: SHOWDOWN_SOURCE.deploymentId! },
    } });
  }
  return state;
}

export async function assertRulesAvailable(tx: Prisma.TransactionClient) {
  await lockRules(tx);
  const state = await releaseState(tx);
  if (state.pending) throw new TournamentError("As regras estão sendo atualizadas. Aguarde a publicação antes de alterar torneios.", 409);
}
