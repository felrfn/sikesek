import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  transaction: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  transactionHomestay: {
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  transactionVenue: {
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  transactionEdutrip: {
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

vi.mock("@/features/tickets/service", () => ({
  createTicketsForTransaction: vi.fn(),
}));

vi.mock("@/features/booking/confirmationEmail", () => ({
  sendBookingConfirmationEmail: vi.fn(),
}));

vi.mock("@/features/payments/refundService", () => ({
  requestAutomaticLatePaymentRefund: vi.fn(),
}));

const { requestAutomaticLatePaymentRefund } = await import(
  "@/features/payments/refundService"
);
const { reconcileTransactionStatus } = await import("./paymentReconciliation");
const { createTicketsForTransaction } = await import("@/features/tickets/service");
const { sendBookingConfirmationEmail } = await import("@/features/booking/confirmationEmail");

const amount = 125000n;
const expiresAt = new Date("2026-10-30T02:00:00.000Z");

const lateTransaction = {
  id: "transaction-1",
  invoiceNumber: "INV-1",
  totalAmount: amount,
  refundedAmount: 0n,
  paymentStatus: "EXPIRED" as const,
  paymentExpiresAt: expiresAt,
  latePaymentAt: null,
  createdAt: new Date("2026-10-30T01:55:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (operations: unknown[]) =>
    Promise.all(operations),
  );
});

describe("late payment reconciliation", () => {
  it("refunds a settlement that arrived after the payment window and keeps tickets unissued", async () => {
    prismaMock.transaction.findUnique
      .mockResolvedValueOnce(lateTransaction)
      .mockResolvedValueOnce({ paymentStatus: "REFUNDED" });
    vi.mocked(requestAutomaticLatePaymentRefund).mockResolvedValue({});

    const result = await reconcileTransactionStatus(
      "INV-1",
      {
        transaction_status: "settlement",
        gross_amount: "125000",
        transaction_id: "midtrans-1",
        payment_type: "credit_card",
      },
      "webhook",
    );

    expect(result).toEqual({
      ok: true,
      status: "REFUNDED",
      changed: true,
      latePayment: true,
    });
    expect(requestAutomaticLatePaymentRefund).toHaveBeenCalledWith("transaction-1");
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: "transaction-1" },
      data: expect.objectContaining({ paymentStatus: "PAID", latePaymentAt: expect.any(Date) }),
    });
    expect(
      prismaMock.transactionHomestay.updateMany,
    ).toHaveBeenCalledWith({
      where: { transactionId: "transaction-1", bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { bookingStatus: "CANCELLED" },
    });
    expect(
      prismaMock.transactionVenue.updateMany,
    ).toHaveBeenCalledWith({
      where: { transactionId: "transaction-1", bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { bookingStatus: "CANCELLED" },
    });
    expect(
      prismaMock.transactionEdutrip.updateMany,
    ).toHaveBeenCalledWith({
      where: { transactionId: "transaction-1", bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { bookingStatus: "CANCELLED" },
    });
    expect(createTicketsForTransaction).not.toHaveBeenCalled();
    expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });
});
