"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutGrid,
  Building2,
  Camera,
  CalendarDays,
  CalendarOff,
  ChevronRight,
  CreditCard,
  ScanEye,
  Users,
  HardHat,
  LogOut,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { assets } from "@/lib/assets";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
} from "@/lib/adminSidebarPreference";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/admin/facilities", label: "Facilities", icon: Building2 },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/holidays", label: "Holidays", icon: CalendarOff },
  { href: "/admin/ktr-monitoring", label: "KTR Monitoring", icon: ScanEye },
  { href: "/admin/ktr-areas", label: "KTR Areas", icon: Camera },
  { href: "/admin/workers", label: "Workers", icon: HardHat },
  { href: "/admin/users", label: "User Management", icon: Users },
];

// Items keep their icon-only link while collapsed; `title` is the only label
// affordance there. Native tooltips are used instead of CSS ones because the
// aside scrolls vertically, and `overflow-y-auto` clips anything that tries
// to escape the rail horizontally.
//
// Everything vertical is state-independent on purpose: the header has a fixed
// height with a constant-size, left-anchored logo, and menu rows are always
// h-10. Toggling therefore only animates the width and the wordmark clipping -
// nothing above or below the toggle jumps.
export function AdminSidebar({
  defaultCollapsed = false,
}: {
  defaultCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${
      next ? "collapsed" : "expanded"
    }; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
  }

  return (
    // h-full (not h-screen) - the parent AdminLayout is the one pinned to
    // exactly one viewport height; this just fills it and scrolls its own
    // content independently of the main content pane.
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-gray-200 bg-white transition-[width] duration-200 ease-out",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div className="h-16 shrink-0 px-1">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="admin-sidebar-nav"
          aria-label={collapsed ? "Perbesar sidebar" : "Perkecil sidebar"}
          title={collapsed ? "Perbesar sidebar" : "Perkecil sidebar"}
          className="flex h-full w-full items-center gap-2 rounded-lg px-1 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {/* Logo keeps a constant size and stays pinned left in both states,
              so nothing in the header ever shifts vertically. */}
          <Image
            src={assets.logoInternal}
            alt="SIKESEK"
            width={455}
            height={546}
            className="h-8 w-auto shrink-0"
            priority
          />
          {/* The wordmark is always rendered: it shrinks to zero and fades as
              the rail narrows, which keeps the logo pinned left and the
              chevron pinned right throughout the transition. */}
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <span
              className={cn(
                "min-w-0 overflow-hidden whitespace-nowrap text-lg font-bold tracking-wide text-brand-800 transition-opacity duration-150",
                collapsed ? "opacity-0" : "opacity-100",
              )}
            >
              SIKESEK
            </span>
            <ChevronRight
              className={cn(
                "ml-auto size-3.5 shrink-0 text-gray-400 transition-transform duration-200",
                collapsed ? "rotate-0" : "rotate-180",
              )}
              aria-hidden="true"
            />
          </span>
        </button>
      </div>

      <nav
        id="admin-sidebar-nav"
        aria-label="Navigasi admin"
        className="flex-1 space-y-1 px-2"
      >
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex h-10 items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center" : "gap-3 px-3",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-brand-700",
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  active ? "text-brand-700" : "text-gray-400",
                )}
              />
              {collapsed ? null : item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-gray-100 p-3">
        <Link
          href="/admin/account"
          aria-label="Akun Saya"
          aria-current={pathname === "/admin/account" ? "page" : undefined}
          title={collapsed ? "Akun Saya" : undefined}
          className={cn(
            "flex h-10 items-center rounded-lg text-sm font-medium transition-colors",
            collapsed ? "justify-center" : "gap-3 px-3",
            pathname === "/admin/account"
              ? "bg-brand-50 text-brand-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-brand-700",
          )}
        >
          <UserRound
            className={cn(
              "size-5 shrink-0",
              pathname === "/admin/account" ? "text-brand-700" : "text-gray-400",
            )}
          />
          {collapsed ? null : "Akun Saya"}
        </Link>
        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/login" })}
          aria-label="Logout"
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex h-10 w-full items-center rounded-lg text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700",
            collapsed ? "justify-center" : "gap-3 px-3",
          )}
        >
          <LogOut className="size-5 shrink-0" />
          {collapsed ? null : "Logout"}
        </button>
      </div>
    </aside>
  );
}
