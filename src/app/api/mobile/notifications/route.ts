import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";

function metadataOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * The authenticated officer's durable inbox. KTR notifications carry a
 * detection reference; booking reminders carry a booking reference plus
 * display metadata. Both live in the same table so mobile has one polling
 * endpoint (docs/MOBILE_API.md).
 */
export async function GET(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const notifications = await prisma.notification.findMany({
    where: { recipientId: auth.user.id },
    orderBy: { sentAt: "desc" },
    take: 50,
    include: { detection: { include: { area: true } } },
  });

  return NextResponse.json({
    items: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      sentAt: n.sentAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
      detection:
        n.detection && n.detectionId
          ? { id: n.detectionId, areaName: n.detection.area.name }
          : null,
      booking:
        n.bookingType && n.bookingId
          ? {
              bookingType: n.bookingType,
              bookingId: n.bookingId,
              invoiceNumber: n.invoiceNumber,
              ...(metadataOf(n.metadata) ?? {}),
            }
          : null,
    })),
  });
}
