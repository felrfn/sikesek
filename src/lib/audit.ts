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
 *
 * Callers always call this *after* the mutation it's auditing has already
 * succeeded, so a failure here (e.g. `actorId` not matching any current
 * `users` row) must never surface as if the mutation itself failed - it's
 * logged and swallowed rather than thrown. This is a best-effort audit
 * trail, not a transactional guarantee; the actor's validity should be
 * enforced upstream (see requireAdmin()), not by blocking the operation.
 */
export async function logAudit(input: {
  actor: AuditActor | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
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
  } catch (error) {
    console.error("Failed to write audit log entry", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actor?.id ?? null,
      error,
    });
  }
}

export function getAuditLog(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
}
