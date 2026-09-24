import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditActor {
  id: string;
  name: string;
}

/**
 * The persisted audit trail (section 47) - before this, the only precedent
 * anywhere in the codebase was a single ad-hoc `console.info` line in
 * `deleteDetection`. Every admin/worker mutation that this task's spec
 * calls out as auditable (KTR lifecycle, worker availability, refunds,
 * facility changes) should call this instead of a raw console line.
 *
 * `actor: null` records a system-generated action (e.g. an automated status
 * change) - kept structurally distinct from a human action rather than
 * attributing it to nobody or to a fake "system user" row, per the explicit
 * requirement that automated actions must be distinguishable from human
 * ones.
 */
export async function logAudit(input: {
  actor: AuditActor | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorName: input.actor?.name ?? "System",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}

export function getAuditLog(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
}
