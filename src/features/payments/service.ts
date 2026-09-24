import { prisma } from "@/lib/prisma";
import type { Prisma, PaymentStatus } from "@prisma/client";

export interface PaymentsListParams {
  status?: PaymentStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  skip: number;
  take: number;
}

/**
 * Server-side filtered/paginated transaction list (sections 15/44/45) -
 * replaces the old flat `findMany` that loaded every transaction into the
 * browser. `search` matches invoice number, Midtrans order id (the same
 * value), or customer name/phone/email.
 */
export async function getTransactionsPage(params: PaymentsListParams) {
  const where: Prisma.TransactionWhereInput = {};

  if (params.status) where.paymentStatus = params.status;

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {
      ...(params.dateFrom ? { gte: params.dateFrom } : {}),
      ...(params.dateTo ? { lt: params.dateTo } : {}),
    };
  }

  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total };
}

export async function getPaymentStats() {
  const [revenue, refunded, total, paid] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: "PAID" },
    }),
    prisma.transaction.count({
      where: { paymentStatus: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] } },
    }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { paymentStatus: "PAID" } }),
  ]);

  return {
    totalRevenue: revenue._sum.totalAmount ?? 0n,
    refundedCount: refunded,
    successRate: total === 0 ? 0 : Math.round((paid / total) * 1000) / 10,
  };
}
