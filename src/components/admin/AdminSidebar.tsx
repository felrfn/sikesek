'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Calendar, CreditCard, Activity, Users, LogOut } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Facilities', href: '/admin/facilities', icon: Building2 },
  { name: 'Bookings', href: '/admin/bookings', icon: Calendar },
  { name: 'Payments', href: '/admin/payments', icon: CreditCard },
  { name: 'KTR Monitoring', href: '/admin/ktr-monitoring', icon: Activity },
  { name: 'User Management', href: '/admin/users', icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0a4226] min-h-screen text-white flex flex-col fixed left-0 top-0 bottom-0 z-50">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight">SIKESEK</h1>
        <p className="text-[10px] text-green-200 uppercase tracking-wider">Management System</p>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive 
                  ? 'bg-[#f4f7f5] text-[#0a4226] font-semibold' 
                  : 'text-green-100 hover:bg-[#125734] hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <button className="flex items-center gap-3 px-4 py-3 text-green-100 hover:text-white w-full transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
