import { prisma } from "@/lib/prisma";
import { PUBLIC_CONTACT_FALLBACK } from "@/lib/siteConfig";

export interface PublicContact {
  phone: string;
  email: string;
}

/**
 * Public contact details come from the built-in `admin` account so both the
 * phone number and the email address can be updated from `/admin/account`
 * without a deploy. Each field falls back independently when it is not set,
 * so a partially filled profile never leaves the public footer blank.
 */
export async function getPublicContact(): Promise<PublicContact> {
  try {
    const admin = await prisma.user.findFirst({
      where: { username: "admin", role: "ADMIN", deletedAt: null },
      select: { phone: true, email: true },
    });

    return {
      phone: admin?.phone?.trim() || PUBLIC_CONTACT_FALLBACK.phone,
      email: admin?.email?.trim() || PUBLIC_CONTACT_FALLBACK.email,
    };
  } catch {
    return { ...PUBLIC_CONTACT_FALLBACK };
  }
}
