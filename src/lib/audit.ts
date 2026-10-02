import "server-only";
import type { Prisma } from "@prisma/client";
import type { CurrentAdmin } from "./auth";

/** A descrição é gravada sem o nome do admin: exibida como "Admin X <descrição>". */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  params: {
    admin: CurrentAdmin;
    action: string;
    description: string;
    tournamentId?: string | null;
    registration?: { id: string; nickname: string } | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.auditLog.create({
    data: {
      adminId: params.admin.id,
      adminName: params.admin.displayName,
      tournamentId: params.tournamentId ?? null,
      registrationId: params.registration?.id ?? null,
      participantNickname: params.registration?.nickname ?? null,
      action: params.action,
      description: params.description,
      metadata: params.metadata,
    },
  });
}
