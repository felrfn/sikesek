import { prisma } from "@/lib/prisma";
import { sendPushToTokens } from "@/lib/fcm";

export interface NotifyUserInput {
  userId: string;
  detectionId: string;
  title: string;
  body: string;
  /** Structured, stable data contract (section 37) - e.g. { type: "KTR_ASSIGNMENT", assignmentId, violationId }. */
  data?: Record<string, string>;
}

export interface NotifyResult {
  /** "sent" only means handed to FCM successfully - never "delivered to device" (section 40). */
  status: "sent" | "skipped" | "failed";
  sentCount: number;
}

export interface BroadcastNotifyInput {
  userIds: string[];
  detectionId: string;
  title: string;
  body: string;
  /** Structured FCM data payload; values must be strings. */
  data?: Record<string, string>;
}

/**
 * Active field officers are approved accounts that have not been deleted.
 * Unapproved accounts cannot log in yet, so pushing to them would only waste
 * FCM calls and leave unread notifications nobody can act on.
 */
export async function getActiveFieldOfficerIds(): Promise<string[]> {
  const officers = await prisma.user.findMany({
    where: {
      role: "FIELD_OFFICER",
      deletedAt: null,
      approvedAt: { not: null },
    },
    select: { id: true },
  });
  return officers.map((officer) => officer.id);
}

/**
 * Fan-out variant of `notifyUser`: writes one durable Notification row per
 * recipient, then sends a single multicast push to all of their active
 * tokens. Used for events every field officer must know about (new
 * violation, case claimed, case resolved, assignment broadcast).
 *
 * Like `notifyUser`, FCM is best-effort: a push failure is logged and never
 * thrown, so it can never roll back the business action that triggered it.
 * Database errors while writing the durable rows are still allowed to
 * propagate - those rows are the fallback the mobile app polls.
 */
export async function broadcastToUsers(
  input: BroadcastNotifyInput,
): Promise<NotifyResult> {
  const userIds = [...new Set(input.userIds)];
  if (userIds.length === 0) return { status: "skipped", sentCount: 0 };

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      detectionId: input.detectionId,
      recipientId: userId,
      title: input.title,
      body: input.body,
    })),
  });

  try {
    const tokens = await prisma.userFcmToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true },
    });

    const result = await sendPushToTokens(
      tokens.map((token) => token.token),
      { title: input.title, body: input.body },
      input.data,
    );

    if (result.invalidTokens.length > 0) {
      await prisma.userFcmToken.updateMany({
        where: { token: { in: result.invalidTokens } },
        data: { isActive: false },
      });
    }

    if (result.skipped) return { status: "skipped", sentCount: 0 };
    return { status: "sent", sentCount: result.sent };
  } catch (error) {
    console.error("[Push] Failed to broadcast notification", {
      detectionId: input.detectionId,
      recipientCount: userIds.length,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { status: "failed", sentCount: 0 };
  }
}

/**
 * The single centralized push-notification entry point (section 35) - both
 * KTR ingestion (features/violations/service.ts) and KTR assignment
 * (features/ktrAssignments/service.ts) call this instead of re-implementing
 * "load tokens, call Firebase, record a Notification row, deactivate dead
 * tokens" independently.
 *
 * Always records the Notification row first so the recipient has something
 * to see in-app even if the push itself is skipped/fails (best-effort push,
 * durable notification) - a push failure is logged and never thrown, so it
 * can never break the caller's core business transaction.
 */
export async function notifyUser(input: NotifyUserInput): Promise<NotifyResult> {
  await prisma.notification.create({
    data: {
      detectionId: input.detectionId,
      recipientId: input.userId,
      title: input.title,
      body: input.body,
    },
  });

  try {
    const tokens = await prisma.userFcmToken.findMany({
      where: { userId: input.userId, isActive: true },
      select: { token: true },
    });

    const result = await sendPushToTokens(
      tokens.map((t) => t.token),
      { title: input.title, body: input.body },
      input.data,
    );

    if (result.invalidTokens.length > 0) {
      await prisma.userFcmToken.updateMany({
        where: { token: { in: result.invalidTokens } },
        data: { isActive: false },
      });
    }

    if (result.skipped) return { status: "skipped", sentCount: 0 };
    return { status: "sent", sentCount: result.sent };
  } catch (error) {
    console.error("[Push] Failed to send notification", {
      userId: input.userId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { status: "failed", sentCount: 0 };
  }
}

export async function notifyUsers(
  inputs: NotifyUserInput[],
): Promise<NotifyResult[]> {
  return Promise.all(inputs.map(notifyUser));
}
