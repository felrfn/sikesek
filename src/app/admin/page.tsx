import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  RefreshCw,
  ScanEye,
  Wallet,
} from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { BarChart } from "@/components/admin/BarChart";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/format";
import {
  paymentStatusLabel,
  paymentStatusTone,
} from "@/lib/utils/paymentStatus";
import { getDashboardStats } from "@/features/dashboard/service";

export const dynamic = "force-dynamic";

const detectionMeta: Record<
  string,
  { label: string; tone: "danger" | "warning" | "info" | "success" | "neutral" }
> = {
  DETECTED: { label: "Terdeteksi", tone: "danger" },
  NOTIFIED: { label: "Diberitahu", tone: "warning" },
  ASSIGNED: { label: "Ditugaskan", tone: "info" },
  IN_PROGRESS: { label: "Diproses", tone: "warning" },
  RESOLVED: { label: "Selesai", tone: "success" },
  FALSE_POSITIVE: { label: "False positive", tone: "neutral" },
  DISMISSED: { label: "Diabaikan", tone: "neutral" },
};

function trendHint(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? "Baru dalam 7 hari terakhir" : "Belum ada data pembanding";
  }
  const delta = Math.round(((current - previous) / previous) * 100);
  if (delta === 0) return "Sama dengan 7 hari sebelumnya";
  return `${delta > 0 ? "+" : ""}${delta}% vs 7 hari sebelumnya`;
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const attention = [
    {
      label: "Pembayaran kedaluwarsa",
      description: "Melewati batas 5 menit dan perlu ditindaklanjuti",
      count: stats.overduePayments,
      href: "/admin/payments?statuses=EXPIRED",
      tone: "red" as const,
    },
    {
      label: "Pembayaran menunggu",
      description: "Masih dalam jendela pembayaran",
      count: stats.pendingPayments,
      href: "/admin/payments?statuses=PENDING",
      tone: "amber" as const,
    },
    {
      label: "Booking menunggu konfirmasi",
      description: "Sudah dibayar, belum dikonfirmasi admin",
      count: stats.awaitingConfirmation,
      href: "/admin/bookings?mode=list",
      tone: "amber" as const,
    },
    {
      label: "Pelanggaran KTR belum ditangani",
      description: "Terdeteksi atau sedang diproses petugas",
      count: stats.unresolvedDetections,
      href: "/admin/ktr-monitoring",
      tone: "red" as const,
    },
    {
      label: "Refund otomatis gagal",
      description: "Perlu percobaan ulang dari halaman Payments",
      count: stats.failedAutomaticRefunds,
      href: "/admin/payments",
      tone: "red" as const,
    },
  ].filter((item) => item.count > 0);

  return (
    <div>
      <AdminTopbar />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Ringkasan Operasional
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {stats.todayLabel} · Diperbarui {stats.updatedAtLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/facilities"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Fasilitas aktif
                <span className="font-semibold text-gray-900">
                  {stats.activeFacilities}
                </span>
                /{stats.totalFacilities}
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Perbarui
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              href="/admin/payments"
              label="Pendapatan 7 hari"
              value={formatCurrency(stats.revenue.current)}
              hint={trendHint(stats.revenue.current, stats.revenue.previous)}
              icon={Wallet}
              tone="brand"
            />
            <StatCard
              href="/admin/bookings"
              label="Booking baru 7 hari"
              value={stats.bookings.current.toLocaleString("id-ID")}
              hint={trendHint(stats.bookings.current, stats.bookings.previous)}
              icon={CalendarDays}
              tone="blue"
            />
            <StatCard
              href="/admin/payments"
              label="Pembayaran bermasalah"
              value={(stats.pendingPayments + stats.overduePayments).toLocaleString(
                "id-ID",
              )}
              hint={
                stats.pendingPayments + stats.overduePayments === 0
                  ? "Tidak ada pembayaran tertunda"
                  : stats.overduePayments > 0
                    ? `${stats.overduePayments} kedaluwarsa · ${stats.pendingPayments} masih menunggu`
                    : `${stats.pendingPayments} masih dalam batas waktu`
              }
              icon={CreditCard}
              tone={stats.overduePayments > 0 ? "red" : "amber"}
            />
            <StatCard
              href="/admin/ktr-monitoring"
              label="Pelanggaran KTR hari ini"
              value={stats.ktrViolationsToday.toLocaleString("id-ID")}
              hint={
                stats.unresolvedDetections > 0
                  ? `${stats.unresolvedDetections} belum ditangani`
                  : "Semua pelanggaran sudah ditangani"
              }
              icon={ScanEye}
              tone={stats.unresolvedDetections > 0 ? "red" : "green"}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    Booking 7 hari terakhir
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Booking yang dibuat per tanggal (WIB)
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.bookings.current.toLocaleString("id-ID")} total
                </span>
              </div>
              <BarChart data={stats.bookingsByDay} />
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
                <h2 className="font-semibold text-gray-900">Perlu Perhatian</h2>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Item yang butuh tindakan admin hari ini.
              </p>

              {attention.length === 0 ? (
                <div className="mt-5 flex items-start gap-2 rounded-lg border border-green-100 bg-green-50/60 p-3 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>Tidak ada tindakan mendesak saat ini.</p>
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {attention.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="group flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:border-gray-200 hover:bg-gray-50"
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                            item.tone === "red"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {item.count}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-800">
                            {item.label}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {item.description}
                          </span>
                        </span>
                        <ChevronRight
                          className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold text-gray-900">Pembayaran terbaru</h2>
                <Link
                  href="/admin/payments"
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Lihat semua
                </Link>
              </div>

              {stats.recentPayments.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">Belum ada transaksi.</p>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100">
                  {stats.recentPayments.map((payment) => (
                    <li key={payment.id}>
                      <Link
                        href={`/admin/payments?q=${encodeURIComponent(payment.invoiceNumber)}`}
                        className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-gray-50/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {payment.invoiceNumber}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {payment.customerName} · {payment.timeLabel}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(payment.totalAmount)}
                          </span>
                          {payment.late ? <Badge tone="danger">LATE</Badge> : null}
                          <Badge tone={paymentStatusTone(payment.paymentStatus)}>
                            {paymentStatusLabel(payment.paymentStatus)}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold text-gray-900">
                  Pelanggaran KTR terbaru
                </h2>
                <Link
                  href="/admin/ktr-monitoring"
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Lihat semua
                </Link>
              </div>

              {stats.recentDetections.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">
                  Belum ada pelanggaran terdeteksi.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100">
                  {stats.recentDetections.map((detection) => {
                    const meta = detectionMeta[detection.status] ?? {
                      label: detection.status,
                      tone: "neutral" as const,
                    };
                    return (
                      <li key={detection.id}>
                        <Link
                          href="/admin/ktr-monitoring"
                          className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-gray-50/60"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">
                              {detection.areaName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {detection.timeLabel}
                            </p>
                          </div>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
