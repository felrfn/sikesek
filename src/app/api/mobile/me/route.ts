import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";

export async function GET(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role: user.role,
    hasProfileImage: Boolean(user.profileImageKey),
  });
}
