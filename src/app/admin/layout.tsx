import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    // Fixed to exactly one viewport height (not min-h-screen, which grows
    // with content and let the sidebar scroll away with it - the reported
    // "sidebar gets cut off" bug). Sidebar and main content each scroll
    // independently within that fixed frame.
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
