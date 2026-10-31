import { NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import {
  DetectionWorkflowError,
  resolveDetectionForUser,
} from "@/features/violations/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const notes =
    typeof body?.notes === "string" ? body.notes.slice(0, 1000) : undefined;

  try {
    const result = await resolveDetectionForUser({
      detectionId: id,
      resolver: { id: auth.user.id, name: auth.user.name },
      notes,
    });

    return NextResponse.json({
      id: result.detection.id,
      status: result.detection.status,
      alreadyResolved: result.alreadyResolved,
      resolvedBy: result.detection.resolvedByUser?.name ?? null,
      resolvedAt: result.detection.resolvedAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof DetectionWorkflowError) {
      if (error.code === "NOT_FOUND") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    throw error;
  }
}
