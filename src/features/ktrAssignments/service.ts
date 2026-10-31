import { prisma } from "@/lib/prisma";
import { logAudit, type AuditActor } from "@/lib/audit";
import {
  broadcastToUsers,
  getActiveFieldOfficerIds,
  notifyUsers,
} from "@/features/notifications/pushService";
import {
  claimDetection,
  DetectionWorkflowError,
} from "@/features/violations/service";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { formatShortDate, formatTime } from "@/lib/utils/format";

export interface WorkerWithAvailability {
  id: string;
  name: string;
  email: string;
  availability: "AVAILABLE" | "UNAVAILABLE" | "LEAVE" | "OFF";
}

/**
 * "Eligible" workers for a KTR assignment (section 3) - active field
 * officers only, never every account regardless of status. A worker with no
 * WorkerSchedule row for the given date is treated as AVAILABLE by default
 * (see the WorkerSchedule model's doc comment) so admins only manage
 * exceptions.
 */
export async function getEligibleWorkersWithAvailability(
  date: string = getTodayInJakarta(),
): Promise<WorkerWithAvailability[]> {
  const workers = await prisma.user.findMany({
    where: { role: "FIELD_OFFICER", deletedAt: null, approvedAt: { not: null } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      schedules: { where: { date: new Date(date) }, select: { status: true } },
    },
  });

  return workers.map((w) => ({
    id: w.id,
    name: w.name,
    email: w.email,
    availability: w.schedules[0]?.status ?? "AVAILABLE",
  }));
}

export function getAssignmentsForDetection(detectionId: string) {
  return prisma.ktrAssignment.findMany({
    where: { detectionId },
    include: { assignedTo: { select: { id: true, name: true } }, assignedBy: { select: { name: true } } },
    orderBy: { assignedAt: "desc" },
  });
}

export class AssignmentError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AssignmentError";
  }
}

/**
 * Assigns one, several, or (by passing every eligible worker's id) all
 * eligible workers to a single violation without creating duplicate
 * SmokingDetection rows (section 3) - each worker gets their own
 * KtrAssignment row against the same detection. Unavailable workers are
 * rejected unless the admin explicitly overrides (section 7).
 */
export async function createAssignments(input: {
  detectionId: string;
  workerIds: string[];
  note?: string;
  assignedBy: AuditActor;
  overrideUnavailable?: boolean;
}) {
  if (input.workerIds.length === 0) {
    throw new AssignmentError("Select at least one worker.");
  }
  const workerIds = [...new Set(input.workerIds)];

  const detection = await prisma.smokingDetection.findUnique({
    where: { id: input.detectionId },
    include: { area: true },
  });
  if (!detection) throw new AssignmentError("Detection not found.");
  if (["RESOLVED", "FALSE_POSITIVE", "DISMISSED"].includes(detection.status)) {
    throw new AssignmentError(
      "This case is already closed and can no longer be assigned.",
    );
  }

  const today = getTodayInJakarta();
  const eligible = await getEligibleWorkersWithAvailability(today);
  const eligibleById = new Map(eligible.map((w) => [w.id, w]));

  for (const workerId of workerIds) {
    const worker = eligibleById.get(workerId);
    if (!worker) {
      throw new AssignmentError("One of the selected workers is not an active field officer.");
    }
    if (
      !input.overrideUnavailable &&
      (worker.availability === "UNAVAILABLE" || worker.availability === "LEAVE")
    ) {
      throw new AssignmentError(
        `${worker.name} is marked ${worker.availability.toLowerCase()} today. Override to assign anyway.`,
      );
    }
  }

  // Avoid duplicate task rows (and duplicate "assigned" pushes) when an
  // admin double-submits or re-assigns the same worker to an open case.
  const existingAssignments = await prisma.ktrAssignment.findMany({
    where: {
      detectionId: input.detectionId,
      assignedToId: { in: workerIds },
      // Completed/cancelled rows are history; a reopened case may be
      // re-assigned to the same officer. Only live rows block a duplicate.
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    },
    select: { assignedToId: true },
  });
  if (existingAssignments.length > 0) {
    const names = existingAssignments.map(
      (row) => eligibleById.get(row.assignedToId)?.name ?? "a worker",
    );
    throw new AssignmentError(
      `Already assigned to this case: ${names.join(", ")}.`,
      "CONFLICT",
    );
  }

  const assignments = await prisma.$transaction(
    workerIds.map((workerId) =>
      prisma.ktrAssignment.create({
        data: {
          detectionId: input.detectionId,
          assignedToId: workerId,
          assignedById: input.assignedBy.id,
          note: input.note || undefined,
        },
      }),
    ),
  );

  if (detection.status === "DETECTED" || detection.status === "NOTIFIED") {
    await prisma.smokingDetection.update({
      where: { id: input.detectionId },
      data: { status: "ASSIGNED" },
    });
  }

  await logAudit({
    actor: input.assignedBy,
    action: "ktr.assigned",
    entityType: "SmokingDetection",
    entityId: input.detectionId,
    metadata: { workerIds, note: input.note ?? null },
  });

  const title = "New KTR Task";
  const body = `You have been assigned to resolve a KTR violation. Location: ${detection.area.name} | Time: ${formatTime(detection.detectedAt)} on ${formatShortDate(detection.detectedAt)}`;

  await notifyUsers(
    assignments.map((assignment) => ({
      userId: assignment.assignedToId,
      detectionId: input.detectionId,
      title,
      body,
      data: {
        type: "KTR_ASSIGNMENT",
        assignmentId: assignment.id,
        violationId: input.detectionId,
        assignedBy: input.assignedBy.name,
      },
    })),
  );

  // Every other officer also needs to know about the assignment so two
  // people do not start working the same case independently. Assignees
  // already got the actionable KTR_ASSIGNMENT above; this is informational.
  const assignedNames = assignments.map(
    (assignment) => eligibleById.get(assignment.assignedToId)?.name ?? "a worker",
  );
  const allOfficerIds = await getActiveFieldOfficerIds();
  const otherOfficerIds = allOfficerIds.filter(
    (id) => !workerIds.includes(id),
  );

  if (otherOfficerIds.length > 0) {
    await broadcastToUsers({
      userIds: otherOfficerIds,
      detectionId: input.detectionId,
      title: "KTR case assigned",
      body: `A KTR violation at ${detection.area.name} has been assigned to ${assignedNames.join(", ")}.`,
      data: {
        type: "KTR_VIOLATION_ASSIGNED",
        violationId: input.detectionId,
        assignedTo: assignedNames.join(", "),
        assignedBy: input.assignedBy.name,
      },
    });
  }

  return assignments;
}

export async function cancelAssignment(assignmentId: string, actor: AuditActor) {
  const assignment = await prisma.ktrAssignment.update({
    where: { id: assignmentId },
    data: { status: "CANCELLED" },
  });

  await logAudit({
    actor,
    action: "ktr.assignment_cancelled",
    entityType: "KtrAssignment",
    entityId: assignmentId,
    metadata: { detectionId: assignment.detectionId },
  });

  return assignment;
}

/**
 * Worker-side status update (mobile app) - moves the assignment itself, and
 * bubbles the detection into ASSIGNED/IN_PROGRESS state without ever
 * downgrading a case that's already further along (e.g. a second worker's
 * update never un-does another worker having already resolved the case).
 */
export async function updateAssignmentStatusByWorker(
  assignmentId: string,
  workerId: string,
  status: "IN_PROGRESS" | "COMPLETED",
) {
  const assignment = await prisma.ktrAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.assignedToId !== workerId) {
    throw new AssignmentError("Assignment not found.", "NOT_FOUND");
  }

  if (status === "IN_PROGRESS") {
    // Starting an assigned task is the same signal as pressing "Ambil
    // Tindakan": claim the detection (soft lock + broadcast to other
    // officers) before touching the assignment row. If someone else is
    // already handling it, conflict rather than silently duplicating work.
    try {
      await claimDetection(assignment.detectionId, workerId);
    } catch (error) {
      if (error instanceof DetectionWorkflowError) {
        if (error.code === "NOT_FOUND") {
          throw new AssignmentError("Detection not found.", "NOT_FOUND");
        }
        throw new AssignmentError(error.message, "CONFLICT");
      }
      throw error;
    }

    return prisma.ktrAssignment.update({
      where: { id: assignmentId },
      data: {
        status,
        acceptedAt: assignment.acceptedAt ?? new Date(),
      },
    });
  }

  const updated = await prisma.ktrAssignment.update({
    where: { id: assignmentId },
    data: {
      status,
      acceptedAt: assignment.acceptedAt ?? new Date(),
      completedAt: status === "COMPLETED" ? new Date() : assignment.completedAt,
    },
  });

  return updated;
}
