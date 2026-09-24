import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";

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
      title: n.title,
      body: n.body,
      sentAt: n.sentAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
      detection: { id: n.detectionId, areaName: n.detection.area.name },
    })),
  });
}
