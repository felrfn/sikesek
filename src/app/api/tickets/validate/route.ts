import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { validateTicket } from "@/features/tickets/service";

const bodySchema = z.object({ invoiceNumber: z.string().trim().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invoiceNumber is required" }, { status: 400 });
  }

  const result = await validateTicket(parsed.data.invoiceNumber);
  return NextResponse.json(result);
}
