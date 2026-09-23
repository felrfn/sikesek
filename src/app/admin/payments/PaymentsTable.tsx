"use client";

import { useMemo, useState } from "react";
import { Download, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatShortDate, formatTime } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/utils/csv";
import type { Transaction } from "@prisma/client";

// `totalAmount` is serialized to a plain number before reaching this client
// component - Prisma's BigInt values aren't valid RSC payloads.
type SerializedTransaction = Omit<Transaction, "totalAmount"> & {
  totalAmount: number;
};

const statusTone = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "danger",
  REFUNDED: "info",
} as const;

export function PaymentsTable({
  transactions,
}: {
  transactions: SerializedTransaction[];
}) {
  const [status, setStatus] = useState<"ALL" | keyof typeof statusTone>("ALL");

  const filtered = useMemo(
    () =>
      status === "ALL"
        ? transactions
        : transactions.filter((t) => t.paymentStatus === status),
    [transactions, status],
  );

  function handleExport() {
    downloadCsv(
      "payments.csv",
      filtered.map((t) => ({
        invoice: t.invoiceNumber,
        customer: t.customerName,
        phone: t.customerPhone,
        amount: Number(t.totalAmount),
        status: t.paymentStatus,
        createdAt: t.createdAt.toISOString(),
      })),
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
        <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="size-4" />
            Export CSV
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
          {filtered.map((t) => (
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
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone[t.paymentStatus]}>
                  {t.paymentStatus}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <a
                  href={`https://wa.me/${t.customerPhone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-800"
                >
                  <MessageCircle className="size-3.5" />
                  WA
                </a>
              </td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                No transactions match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
