import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 text-white p-4">
        <h2 className="text-xl font-bold mb-4">SIKESEK Admin</h2>
        <nav className="flex flex-col gap-2">
          <a href="/admin">Dashboard</a>
          <a href="/admin/facilities">Facilities</a>
          <a href="/admin/reservations">Reservations</a>
          <a href="/admin/payments">Payments</a>
          <a href="/admin/violations">Violations</a>
          <a href="/admin/employees">Employees</a>
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-slate-50">{children}</main>
    </div>
  );
}
