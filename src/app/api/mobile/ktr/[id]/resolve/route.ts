import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const notes = typeof body?.notes === "string" ? body.notes.slice(0, 1000) : undefined;

  const detection = await prisma.smokingDetection.findUnique({ where: { id } });
  if (!detection) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Detection not found" } },
      { status: 404 },
    );
  }

  const updated = await prisma.smokingDetection.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedBy: auth.user.id,
      resolvedAt: new Date(),
      notes: notes ?? detection.notes,
    },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
