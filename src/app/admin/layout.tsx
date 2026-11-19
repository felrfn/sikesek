import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import {
  SIDEBAR_COOKIE,
  isSidebarCollapsed,
} from "@/lib/adminSidebarPreference";

// Internal area: SIKESEK branding, not the public Arenan Kalikesek site.
export const metadata: Metadata = {
  title: {
    default: "SIKESEK",
    template: "%s · SIKESEK",
  },
  description: "Panel admin internal SIKESEK.",
  icons: {
    icon: [{ url: "/assets/logo_sikesek.png", type: "image/png" }],
    shortcut: "/assets/logo_sikesek.png",
    apple: "/assets/logo_sikesek.png",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const sidebarCollapsed = isSidebarCollapsed(
    cookieStore.get(SIDEBAR_COOKIE)?.value,
  );

  return (
    // Fixed to exactly one viewport height (not min-h-screen, which grows
    // with content and let the sidebar scroll away with it - the reported
    // "sidebar gets cut off" bug). Sidebar and main content each scroll
    // independently within that fixed frame.
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AdminSidebar defaultCollapsed={sidebarCollapsed} />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
