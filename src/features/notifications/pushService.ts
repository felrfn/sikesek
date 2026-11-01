import { prisma } from "@/lib/prisma";
import { sendPushToTokens } from "@/lib/fcm";
import type { Prisma } from "@prisma/client";

/**
 * Optional booking reference for non-KTR notifications. Keeping this generic
 * (rather than adding a second notification service) means every push still
 * goes through the same durable-row + FCM + invalid-token cleanup path.
 */
export interface NotificationBookingReference {
  bookingType: "homestay" | "venue";
  bookingId: string;
  invoiceNumber: string;
  /** Display-only context stored on the Notification row (facility name, deadline, etc.). */
  metadata?: Prisma.InputJsonObject;
}

export interface NotifyUserInput {
  userId: string;
  detectionId?: string | null;
  /** Overrides the event type inferred from `data.type`; mostly useful for tests/callers with no data payload. */
  type?: string;
  booking?: NotificationBookingReference;
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
  detectionId?: string | null;
  type?: string;
  booking?: NotificationBookingReference;
  title: string;
  body: string;
  /** Structured FCM data payload; values must be strings. */
  data?: Record<string, string>;
}

/**
 * The durable inbox row for one recipient. `type` falls back to the FCM event
 * type so existing KTR callers need no changes, and legacy rows default to
 * "KTR" at the database level.
 */
function notificationRow(
  input: Pick<NotifyUserInput, "title" | "body" | "type" | "data" | "detectionId" | "booking">,
  recipientId: string,
) {
  return {
    recipientId,
    title: input.title,
    body: input.body,
    type: input.type ?? input.data?.type ?? "KTR",
    detectionId: input.detectionId ?? null,
    bookingType: input.booking?.bookingType ?? null,
    bookingId: input.booking?.bookingId ?? null,
    invoiceNumber: input.booking?.invoiceNumber ?? null,
    ...(input.booking?.metadata ? { metadata: input.booking.metadata } : {}),
  };
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
    data: userIds.map((userId) => notificationRow(input, userId)),
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
      bookingType: input.booking?.bookingType,
      bookingId: input.booking?.bookingId,
      eventType: input.data?.type,
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
    data: notificationRow(input, input.userId),
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
