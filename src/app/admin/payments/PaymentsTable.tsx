"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download, MessageCircle, RefreshCw, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatShortDate, formatTime } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/utils/csv";
import { syncPaymentStatus } from "@/features/payments/actions";
import { RefundModal } from "./RefundModal";
import type { Transaction, PaymentStatus } from "@prisma/client";

// `totalAmount`/`refundedAmount` are serialized to plain numbers before
// reaching this client component - Prisma's BigInt values aren't valid RSC
// payloads.
type SerializedTransaction = Omit<Transaction, "totalAmount" | "refundedAmount"> & {
  totalAmount: number;
  refundedAmount: number;
};

const statusTone: Record<PaymentStatus, "warning" | "success" | "danger" | "neutral" | "info"> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  EXPIRED: "neutral",
  PARTIALLY_REFUNDED: "info",
  REFUNDED: "info",
};

const STATUS_OPTIONS: PaymentStatus[] = [
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

function refundWhatsAppMessage(t: SerializedTransaction) {
  return (
    `Halo Kak ${t.customerName},\n\n` +
    `Kami ingin menginformasikan bahwa pembayaran untuk invoice ${t.invoiceNumber} sebesar ${formatCurrency(t.refundedAmount)} telah diproses untuk refund.\n\n` +
    `Proses pengembalian dana selanjutnya mengikuti proses dari pihak bank/payment provider, sehingga waktu dana masuk kembali dapat berbeda tergantung metode pembayaran.\n\n` +
    `Mohon ditunggu dan terima kasih atas pengertiannya.\n\nSIKESEK`
  );
}

export function PaymentsTable({
  transactions,
}: {
  transactions: SerializedTransaction[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<SerializedTransaction | null>(null);
  const [isPending, startTransition] = useTransition();

  function setStatusFilter(status: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (status) next.set("status", status);
    else next.delete("status");
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

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
    startTransition(async () => {
      const result = await syncPaymentStatus(invoiceNumber);
      setSyncingId(null);
      if (result.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
        <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
        <div className="flex items-center gap-2">
          <select
            defaultValue={searchParams.get("status") ?? ""}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="size-4" />
            Export CSV (this page)
          </Button>
        </div>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-4 py-3">Transaction ID</th>
            <th className="px-4 py-3">Date &amp; Time</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3 font-medium text-brand-700">
                {t.invoiceNumber}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {formatShortDate(t.createdAt)}
                <br />
                <span className="text-xs">{formatTime(t.createdAt)} WIB</span>
              </td>
              <td className="px-4 py-3 text-gray-700">{t.customerName}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {formatCurrency(t.totalAmount)}
                {t.refundedAmount > 0 ? (
                  <div className="text-xs font-normal text-gray-400">
                    -{formatCurrency(t.refundedAmount)} refunded
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone[t.paymentStatus]}>
                  {t.paymentStatus.replace("_", " ")}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  {t.paymentStatus === "PENDING" ? (
                    <button
                      type="button"
                      disabled={isPending && syncingId === t.invoiceNumber}
                      onClick={() => handleSync(t.invoiceNumber)}
                      title="Check the current status with Midtrans"
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RefreshCw className="size-3.5" />
                      {syncingId === t.invoiceNumber ? "Syncing..." : "Sync"}
                    </button>
                  ) : null}
                  {(t.paymentStatus === "PAID" || t.paymentStatus === "PARTIALLY_REFUNDED") &&
                  t.totalAmount - t.refundedAmount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setRefundTarget(t)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <RotateCcw className="size-3.5" />
                      Refund
                    </button>
                  ) : null}
                  {t.refundedAmount > 0 ? (
                    <a
                      href={`https://wa.me/${t.customerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(refundWhatsAppMessage(t))}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Send refund confirmation via WhatsApp"
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <MessageCircle className="size-3.5" />
                      Refund WA
                    </a>
                  ) : null}
                  <a
                    href={`https://wa.me/${t.customerPhone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-800"
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
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                No transactions match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

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
