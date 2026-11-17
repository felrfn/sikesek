"use client";

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
  CreditCard,
  ScanEye,
  Users,
  HardHat,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { assets } from "@/lib/assets";

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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    // h-full (not h-screen) - the parent AdminLayout is the one pinned to
    // exactly one viewport height; this just fills it and scrolls its own
    // content independently of the main content pane.
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white">
      <div className="flex shrink-0 items-center justify-center px-5 py-5">
        <Link
          href="/admin"
          aria-label="SIKESEK dashboard"
          className="inline-flex items-center gap-2"
        >
          <Image
            src={assets.logoInternal}
            alt="SIKESEK"
            width={455}
            height={546}
            className="h-10 w-auto"
            priority
          />
          <span className="text-lg font-bold tracking-wide text-brand-800">
            SIKESEK
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-brand-700",
              )}
            >
              <Icon
                className={cn("size-4", active ? "text-brand-700" : "text-gray-400")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
