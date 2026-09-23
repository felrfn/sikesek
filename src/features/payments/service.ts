import { prisma } from "@/lib/prisma";

export function getTransactions() {
  return prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getPaymentStats() {
  const [revenue, refunded, total, paid] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: "PAID" },
    }),
    prisma.transaction.count({ where: { paymentStatus: "REFUNDED" } }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { paymentStatus: "PAID" } }),
  ]);

  return {
    totalRevenue: revenue._sum.totalAmount ?? 0n,
    refundedCount: refunded,
    successRate: total === 0 ? 0 : Math.round((paid / total) * 1000) / 10,
  };
}
