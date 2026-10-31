import { NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import {
  claimDetection,
  DetectionWorkflowError,
} from "@/features/violations/service";

/**
 * "Ambil Tindakan" - a field officer explicitly starts handling a case
 * without waiting for an admin assignment. The claim is announced to every
 * other active field officer so they do not unknowingly duplicate the work.
 * It is a soft claim: another officer may still resolve the case (assignment,
 * handling and resolution are separate concepts).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const result = await claimDetection(id, auth.user.id);
    const handlingBy = result.detection.handlingByUser?.name ?? auth.user.name;

    return NextResponse.json({
      id: result.detection.id,
      status: result.detection.status,
      alreadyClaimed: result.alreadyClaimed,
      handlingBy,
      handlingStartedAt:
        result.detection.handlingStartedAt?.toISOString() ?? null,
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
        {
          error: {
            code: error.code,
            message: error.message,
            ...error.details,
          },
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
