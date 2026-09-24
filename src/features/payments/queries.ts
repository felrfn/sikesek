"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getRefundsForTransaction } from "./refundService";
import { prisma } from "@/lib/prisma";

export async function getRefundHistory(invoiceNumber: string) {
  await requireAdmin();
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNumber },
    select: { id: true },
  });
  if (!transaction) return [];
  const refunds = await getRefundsForTransaction(transaction.id);
  return refunds.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    reason: r.reason,
    status: r.status,
    requestedByName: r.requestedBy.name,
    requestedAt: r.requestedAt.toISOString(),
    confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
  }));
}
