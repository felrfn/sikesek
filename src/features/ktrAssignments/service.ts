import { prisma } from "@/lib/prisma";
import { logAudit, type AuditActor } from "@/lib/audit";
import { notifyUsers } from "@/features/notifications/pushService";
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

export class AssignmentError extends Error {}

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

  for (const workerId of input.workerIds) {
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

  const assignments = await prisma.$transaction(
    input.workerIds.map((workerId) =>
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
    metadata: { workerIds: input.workerIds, note: input.note ?? null },
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
      },
    })),
  );

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
    throw new AssignmentError("Assignment not found.");
  }

  const updated = await prisma.ktrAssignment.update({
    where: { id: assignmentId },
    data: {
      status,
      acceptedAt: assignment.acceptedAt ?? new Date(),
      completedAt: status === "COMPLETED" ? new Date() : assignment.completedAt,
    },
  });

  if (status === "IN_PROGRESS") {
    await prisma.smokingDetection.updateMany({
      where: { id: assignment.detectionId, status: { in: ["ASSIGNED"] } },
      data: { status: "IN_PROGRESS" },
    });
  }

  return updated;
}
