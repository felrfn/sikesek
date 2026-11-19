import { prisma } from "@/lib/prisma";
import type { Prisma, PaymentStatus } from "@prisma/client";

export type PaymentSortField =
  | "createdAt"
  | "invoiceNumber"
  | "totalAmount"
  | "customerName"
  | "paymentStatus";

export const PAYMENT_SORT_FIELDS: PaymentSortField[] = [
  "createdAt",
  "invoiceNumber",
  "totalAmount",
  "customerName",
  "paymentStatus",
];

export interface PaymentsListParams {
  /** Preferred: multi-select status filter. */
  statuses?: PaymentStatus[];
  /** Legacy single-status param, still accepted. */
  status?: PaymentStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  skip: number;
  take: number;
  sort?: PaymentSortField;
  dir?: "asc" | "desc";
}

/**
 * Server-side filtered/paginated transaction list (sections 15/44/45) -
 * replaces the old flat `findMany` that loaded every transaction into the
 * browser. `search` matches invoice number, Midtrans order id (the same
 * value), or customer name/phone/email.
 */
export async function getTransactionsPage(params: PaymentsListParams) {
  const where: Prisma.TransactionWhereInput = {};

  const statuses = params.statuses?.length
    ? params.statuses
    : params.status
      ? [params.status]
      : [];
  if (statuses.length > 0) where.paymentStatus = { in: statuses };

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

  const sort =
    params.sort && PAYMENT_SORT_FIELDS.includes(params.sort) ? params.sort : "createdAt";
  const orderBy = {
    [sort]: params.dir === "asc" ? "asc" : "desc",
  } as Prisma.TransactionOrderByWithRelationInput;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy,
      skip: params.skip,
      take: params.take,
      include: {
        refunds: {
          orderBy: { requestedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            automatic: true,
            failureReason: true,
          },
        },
      },
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
