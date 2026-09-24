"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatShortDate } from "@/lib/utils/format";
import { refundPayment } from "@/features/payments/actions";
import { getRefundHistory } from "@/features/payments/queries";

const statusTone = {
  PENDING: "neutral",
  PROCESSING: "warning",
  SUCCESS: "success",
  FAILED: "danger",
} as const;

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
  const [amount, setAmount] = useState(refundable);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getRefundHistory>> | null>(null);

  useEffect(() => {
    if (!open) return;
    // One-time reset of this modal's local form state when it (re)opens for
    // a new transaction - not a sync from props/state that would loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount(refundable);
    setReason("");
    setError(null);
    getRefundHistory(invoiceNumber).then(setHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when the modal (re)opens for this invoice
  }, [open, invoiceNumber]);

  function handleSubmit() {
    setError(null);
    if (amount <= 0 || amount > refundable) {
      setError(`Refund amount must be between 1 and ${refundable}.`);
      return;
    }
    startTransition(async () => {
      const result = await refundPayment({ invoiceNumber, amount, reason: reason.trim() || undefined });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Refund Transaction">
      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Invoice</span>
          <span className="font-medium text-gray-900">{invoiceNumber}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Paid</span>
          <span className="font-medium text-gray-900">{formatCurrency(paidAmount)}</span>
        </div>
        {refundedAmount > 0 ? (
          <div className="flex justify-between text-gray-500">
            <span>Already refunded</span>
            <span className="font-medium text-gray-900">{formatCurrency(refundedAmount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-gray-500">
          <span>Refundable amount</span>
          <span className="font-medium text-gray-900">{formatCurrency(refundable)}</span>
        </div>

        <label className="block font-medium text-gray-700">
          Refund amount
          <input
            type="number"
            min={1}
            max={refundable}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block font-medium text-gray-700">
          Reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        {error ? <p className="text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={isPending || refundable <= 0} onClick={handleSubmit}>
            {isPending ? "Processing..." : "Process Refund"}
          </Button>
        </div>

        {history && history.length > 0 ? (
          <div className="border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-medium uppercase text-gray-400">Refund history</p>
            <ul className="space-y-1.5">
              {history.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span className="text-gray-600">
                    {formatCurrency(r.amount)} Β· {formatShortDate(r.requestedAt)} Β· {r.requestedByName}
                  </span>
                  <Badge tone={statusTone[r.status as keyof typeof statusTone]}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
