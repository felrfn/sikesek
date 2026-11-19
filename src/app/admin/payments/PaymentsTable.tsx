"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Download,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/admin/Pagination";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatShortDate, formatTime } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/utils/csv";
import {
  paymentStatusLabel,
  paymentStatusTone,
  refundStatusLabel,
  refundStatusTone,
} from "@/lib/utils/paymentStatus";
import type { PaginationMeta } from "@/lib/utils/adminQuery";
import type { PaymentSortField } from "@/features/payments/service";
import { retryLatePaymentRefund, syncPaymentStatus } from "@/features/payments/actions";
import { RefundModal } from "./RefundModal";
import type { Transaction, RefundStatus } from "@prisma/client";

// `totalAmount`/`refundedAmount` are serialized to plain numbers before
// reaching this client component - Prisma's BigInt values aren't valid RSC
// payloads.
type SerializedTransaction = Omit<Transaction, "totalAmount" | "refundedAmount"> & {
  totalAmount: number;
  refundedAmount: number;
  /** PENDING in the database but past its deadline: effective status is EXPIRED. */
  paymentOverdue: boolean;
  refunds: Array<{
    id: string;
    status: RefundStatus;
    automatic: boolean;
    failureReason: string | null;
  }>;
};

function refundWhatsAppMessage(t: SerializedTransaction) {
  return (
    `Halo Kak ${t.customerName},\n\n` +
    `Kami ingin menginformasikan bahwa pembayaran untuk invoice ${t.invoiceNumber} sebesar ${formatCurrency(t.refundedAmount)} telah diproses untuk refund.\n\n` +
    `Proses pengembalian dana selanjutnya mengikuti proses dari pihak bank/payment provider, sehingga waktu dana masuk kembali dapat berbeda tergantung metode pembayaran.\n\n` +
    `Mohon ditunggu dan terima kasih atas pengertiannya.\n\nArenan Kalikesek`
  );
}

const outlineLinkClasses =
  "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50";

export function PaymentsTable({
  transactions,
  meta,
  sort,
  dir,
}: {
  transactions: SerializedTransaction[];
  meta: PaginationMeta;
  sort: PaymentSortField | null;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [retryingRefundId, setRetryingRefundId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<SerializedTransaction | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    downloadCsv(
      "payments.csv",
      transactions.map((t) => ({
        invoice: t.invoiceNumber,
        customer: t.customerName,
        phone: t.customerPhone,
        amount: t.totalAmount,
        refunded: t.refundedAmount,
        status: t.paymentStatus,
        createdAt: t.createdAt.toISOString(),
      })),
    );
  }

  function handleSync(invoiceNumber: string) {
    setSyncingId(invoiceNumber);
    setSyncNotice(null);
    startTransition(async () => {
      const result = await syncPaymentStatus(invoiceNumber);
      setSyncingId(null);
      if (result.error) {
        setSyncNotice(result.error);
      } else {
        setSyncNotice(
          result.status
            ? `Invoice ${invoiceNumber}: status sekarang ${paymentStatusLabel(result.status)}.`
            : `Invoice ${invoiceNumber}: status tidak berubah.`,
        );
      }
      router.refresh();
    });
  }

  function handleRetryLateRefund(invoiceNumber: string) {
    setRetryingRefundId(invoiceNumber);
    startTransition(async () => {
      const result = await retryLatePaymentRefund(invoiceNumber);
      setRetryingRefundId(null);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  function selectSort(field: PaymentSortField) {
    const next = new URLSearchParams(searchParams.toString());
    if (sort === field) {
      next.set("dir", dir === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", field);
      next.set("dir", field === "createdAt" ? "desc" : "asc");
    }
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  function sortableHeader(label: string, field: PaymentSortField) {
    const active = sort === field;
    return (
      <button
        type="button"
        onClick={() => selectSort(field)}
        title={`Urutkan berdasarkan ${label.toLowerCase()}`}
        className="inline-flex items-center gap-1 transition-colors hover:text-gray-700"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3.5 text-brand-700" aria-label="Menaik" />
          ) : (
            <ArrowDown className="size-3.5 text-brand-700" aria-label="Menurun" />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 text-gray-300" aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
        <h2 className="font-semibold text-gray-900">Transaksi Terbaru</h2>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="size-4" />
          Ekspor CSV (halaman ini)
        </Button>
      </div>

      {syncNotice ? (
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          {syncNotice}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-gray-50 text-xs tracking-wide text-gray-400 uppercase">
            <tr>
              <th className="px-4 py-3">
                {sortableHeader("Invoice", "invoiceNumber")}
              </th>
              <th className="hidden px-4 py-3 xl:table-cell">
                {sortableHeader("Tanggal & Waktu", "createdAt")}
              </th>
              <th className="px-4 py-3">
                {sortableHeader("Pelanggan", "customerName")}
              </th>
              <th className="px-4 py-3 text-right">
                <span className="flex justify-end">
                  {sortableHeader("Nominal", "totalAmount")}
                </span>
              </th>
              <th className="px-4 py-3">
                {sortableHeader("Status", "paymentStatus")}
              </th>
              <th className="w-28 px-4 py-3">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-gray-50/70">
                <td className="px-4 py-3 font-medium whitespace-nowrap text-brand-700">
                  {t.invoiceNumber}
                  <p className="mt-0.5 text-xs font-normal text-gray-400 xl:hidden">
                    {formatShortDate(t.createdAt)} · {formatTime(t.createdAt)} WIB
                  </p>
                </td>
                <td className="hidden px-4 py-3 whitespace-nowrap text-gray-500 xl:table-cell">
                  {formatShortDate(t.createdAt)}
                  <br />
                  <span className="text-xs">{formatTime(t.createdAt)} WIB</span>
                </td>
                <td className="px-4 py-3 text-gray-700">{t.customerName}</td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-gray-900">
                  {formatCurrency(t.totalAmount)}
                  {t.refundedAmount > 0 ? (
                    <div className="text-xs font-normal text-gray-400">
                      Refund: &minus;{formatCurrency(t.refundedAmount)}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={paymentStatusTone(t.paymentStatus)}>
                      {paymentStatusLabel(t.paymentStatus)}
                    </Badge>
                    {t.latePaymentAt ? (
                      <Badge tone="danger">LATE</Badge>
                    ) : null}
                  </div>
                  {t.refunds[0]?.automatic ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                      Refund otomatis:
                      <Badge tone={refundStatusTone(t.refunds[0].status)}>
                        {refundStatusLabel(t.refunds[0].status)}
                      </Badge>
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {t.refunds[0]?.automatic && t.refunds[0].status === "FAILED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending && retryingRefundId === t.invoiceNumber}
                        onClick={() => handleRetryLateRefund(t.invoiceNumber)}
                        title={t.refunds[0].failureReason ?? "Coba lagi refund otomatis"}
                        className="whitespace-nowrap text-red-700 hover:bg-red-50"
                      >
                        <RotateCcw className="size-3.5" />
                        {retryingRefundId === t.invoiceNumber
                          ? "Memproses…"
                          : "Coba lagi refund"}
                      </Button>
                    ) : null}
                    {t.paymentStatus === "PENDING" || t.paymentOverdue ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending && syncingId === t.invoiceNumber}
                        onClick={() => handleSync(t.invoiceNumber)}
                        title={
                          t.paymentOverdue
                            ? "Periksa ke Midtrans lalu kedaluwarsakan pembayaran ini"
                            : "Periksa status terbaru ke Midtrans"
                        }
                        className="whitespace-nowrap"
                      >
                        <RefreshCw className="size-3.5" />
                        {syncingId === t.invoiceNumber ? "Syncing…" : "Sync"}
                      </Button>
                    ) : null}
                    {!t.refunds[0]?.automatic &&
                    (t.paymentStatus === "PAID" ||
                      t.paymentStatus === "PARTIALLY_REFUNDED") &&
                    t.totalAmount - t.refundedAmount > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRefundTarget(t)}
                        className="whitespace-nowrap"
                      >
                        <RotateCcw className="size-3.5" />
                        Refund
                      </Button>
                    ) : null}
                    {t.refundedAmount > 0 ? (
                      <a
                        href={`https://wa.me/${t.customerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(refundWhatsAppMessage(t))}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Kirim konfirmasi refund via WhatsApp"
                        className={cn(outlineLinkClasses, "whitespace-nowrap")}
                      >
                        <MessageCircle className="size-3.5" />
                        WA Refund
                      </a>
                    ) : null}
                    <a
                      href={`https://wa.me/${t.customerPhone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Hubungi pelanggan via WhatsApp"
                      className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white transition-colors hover:bg-brand-800"
                    >
                      <MessageCircle className="size-3.5" />
                      WA
                    </a>
                  </div>
                </td>
              </tr>
            ))}

            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <SearchX className="mx-auto size-8 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-700">
                    Tidak ada transaksi yang cocok
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Coba ubah kata kunci, status, atau rentang tanggal.
                  </p>
                  <a
                    href="/admin/payments"
                    className="mt-4 inline-block text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
                  >
                    Bersihkan semua filter
                  </a>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} />

      {refundTarget ? (
        <RefundModal
          open={refundTarget !== null}
          onClose={() => setRefundTarget(null)}
          invoiceNumber={refundTarget.invoiceNumber}
          paidAmount={refundTarget.totalAmount}
          refundedAmount={refundTarget.refundedAmount}
        />
      ) : null}
    </Card>
  );
}
