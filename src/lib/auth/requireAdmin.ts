import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/**
 * Server actions run independently of page-level route protection
 * (src/proxy.ts only guards page navigation), so every admin-only mutation
 * re-checks the session itself (RULES.md ยง5 - backend authorization is the
 * source of truth, not frontend routing).
 *
 * Re-fetches the user from the database rather than trusting the session
 * JWT's id/role as-is: NextAuth's JWT strategy is stateless, so a token
 * issued before the account was deleted, demoted, or recreated with a new
 * id (e.g. a dev database reset/reseed) would otherwise still pass this
 * check. Its stale id would then violate the audit_logs foreign key the
 * first time a mutation tried to attribute an action to it - the update
 * itself would succeed, but logAudit() would throw, turning a successful
 * operation into a 500 from the caller's perspective.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.deletedAt || !user.approvedAt || user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  return user;
}
