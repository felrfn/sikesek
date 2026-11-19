"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { NumericInput } from "@/components/ui/NumericInput";
import { formatCurrency, formatShortDate } from "@/lib/utils/format";
import {
  refundStatusLabel,
  refundStatusTone,
} from "@/lib/utils/paymentStatus";
import { refundPayment } from "@/features/payments/actions";
import { getRefundHistory } from "@/features/payments/queries";

export function RefundModal({
  open,
  onClose,
  invoiceNumber,
  paidAmount,
  refundedAmount,
}: {
  open: boolean;
  onClose: () => void;
  invoiceNumber: string;
  paidAmount: number;
  refundedAmount: number;
}) {
  const router = useRouter();
  const refundable = paidAmount - refundedAmount;
  const [amount, setAmount] = useState(() => String(refundable));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getRefundHistory>> | null>(null);

  useEffect(() => {
    if (!open) return;
    // One-time reset of this modal's local form state when it (re)opens for
    // a new transaction - not a sync from props/state that would loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount(String(refundable));
    setReason("");
    setError(null);
    getRefundHistory(invoiceNumber).then(setHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when the modal (re)opens for this invoice
  }, [open, invoiceNumber]);

  function handleSubmit() {
    setError(null);
    const value = Number(amount || "0");
    if (!Number.isInteger(value) || value <= 0 || value > refundable) {
      setError(
        `Jumlah refund harus antara Rp1 dan ${formatCurrency(refundable)}.`,
      );
      return;
    }
    startTransition(async () => {
      const result = await refundPayment({
        invoiceNumber,
        amount: value,
        reason: reason.trim() || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Refund Transaksi">
      <div className="space-y-3 text-sm">
        <div className="flex justify-between gap-3 text-gray-500">
          <span>Invoice</span>
          <span className="font-medium text-gray-900">{invoiceNumber}</span>
        </div>
        <div className="flex justify-between gap-3 text-gray-500">
          <span>Dibayar</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(paidAmount)}
          </span>
        </div>
        {refundedAmount > 0 ? (
          <div className="flex justify-between gap-3 text-gray-500">
            <span>Sudah direfund</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(refundedAmount)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-gray-500">
          <span>Sisa yang dapat direfund</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(refundable)}
          </span>
        </div>

        <label className="block font-medium text-gray-700">
          Jumlah refund
          <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
            <span className="pl-3 text-sm text-gray-400">Rp</span>
            <NumericInput
              value={amount}
              onValueChange={setAmount}
              placeholder="0"
              className="h-10 w-full bg-transparent pr-3 pl-2 text-sm text-gray-900"
            />
          </div>
          <span className="mt-1 block text-xs font-normal text-gray-400">
            Maksimal {formatCurrency(refundable)}
          </span>
        </label>

        <label className="block font-medium text-gray-700">
          Alasan
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Opsional"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" disabled={isPending || refundable <= 0} onClick={handleSubmit}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Memproses…
              </>
            ) : (
              "Proses Refund"
            )}
          </Button>
        </div>

        {history && history.length > 0 ? (
          <div className="border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-medium tracking-wide text-gray-400 uppercase">
              Riwayat refund
            </p>
            <ul className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-gray-100 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-700">
                      {formatCurrency(r.amount)}
                    </span>
                    <Badge tone={refundStatusTone(r.status)}>
                      {refundStatusLabel(r.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-gray-500">
                    {formatShortDate(r.requestedAt)} ·{" "}
                    {r.automatic ? "Sistem (pembayaran terlambat)" : r.requestedByName}
                  </p>
                  {r.failureReason ? (
                    <p className="mt-1 text-red-500">{r.failureReason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
