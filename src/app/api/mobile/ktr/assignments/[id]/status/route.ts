import { NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import { AssignmentError, updateAssignmentStatusByWorker } from "@/features/ktrAssignments/service";

/**
 * Worker-side assignment status update (docs/MOBILE_API.md) - a field
 * officer moves their own KtrAssignment to IN_PROGRESS when they start
 * working the case, or COMPLETED when done. Resolving the underlying
 * SmokingDetection itself (marking it RESOLVED with resolver attribution)
 * still goes through POST /api/mobile/ktr/{id}/resolve - this endpoint only
 * tracks the task/assignment side of the workflow (section 3's explicit
 * distinction between "the violation", "the assignment/task", and "the
 * resolver").
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body?.status;

  if (status !== "IN_PROGRESS" && status !== "COMPLETED") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "status must be IN_PROGRESS or COMPLETED",
        },
      },
      { status: 400 },
    );
  }

  try {
    const assignment = await updateAssignmentStatusByWorker(id, auth.user.id, status);
    return NextResponse.json({ id: assignment.id, status: assignment.status });
  } catch (error) {
    if (error instanceof AssignmentError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    throw error;
  }
}
