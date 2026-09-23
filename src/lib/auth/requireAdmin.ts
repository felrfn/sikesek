import { auth } from "@/lib/auth/auth";

/**
 * Server actions run independently of page-level route protection
 * (src/proxy.ts only guards page navigation), so every admin-only mutation
 * re-checks the session itself (RULES.md ยง5 - backend authorization is the
 * source of truth, not frontend routing).
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}
