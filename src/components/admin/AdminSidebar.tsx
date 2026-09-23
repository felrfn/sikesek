"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutGrid,
  Building2,
  CalendarDays,
  CreditCard,
  ScanEye,
  Users,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/admin/facilities", label: "Facilities", icon: Building2 },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/ktr-monitoring", label: "KTR Monitoring", icon: ScanEye },
  { href: "/admin/users", label: "User Management", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-brand-900 text-brand-50">
      <div className="px-5 py-5">
        <p className="text-lg font-bold text-white">SIKESEK</p>
        <p className="text-xs text-brand-100">Management System</p>
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
                  ? "bg-white text-brand-800"
                  : "text-brand-100 hover:bg-white/10",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-100 hover:bg-white/10"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
