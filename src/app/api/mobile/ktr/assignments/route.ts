import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";

/** A field officer's own KTR assignments (docs/MOBILE_API.md). */
export async function GET(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const assignments = await prisma.ktrAssignment.findMany({
    where: { assignedToId: auth.user.id },
    orderBy: { assignedAt: "desc" },
    include: {
      detection: {
        select: {
          id: true,
          status: true,
          detectedAt: true,
          notes: true,
          area: { select: { id: true, name: true, locationDescription: true } },
        },
      },
    },
  });

  return NextResponse.json({
    assignments: assignments.map((a) => ({
      id: a.id,
      status: a.status,
      note: a.note,
      assignedAt: a.assignedAt,
      acceptedAt: a.acceptedAt,
      completedAt: a.completedAt,
      violation: {
        id: a.detection.id,
        status: a.detection.status,
        detectedAt: a.detection.detectedAt,
        notes: a.detection.notes,
        area: a.detection.area,
      },
    })),
  });
}
