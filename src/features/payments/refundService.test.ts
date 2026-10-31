import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  transaction: { findUnique: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  refund: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  transactionHomestay: { updateMany: vi.fn() },
  transactionVenue: { updateMany: vi.fn() },
  transactionEdutrip: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/midtrans", () => ({
  isMidtransApiError: vi.fn(),
  refundTransaction: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

const { refundTransaction } = await import("@/lib/midtrans");
const { requestAutomaticLatePaymentRefund } = await import("./refundService");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (operation: unknown) => {
    const tx = {
      refund: prismaMock.refund,
      transaction: {
        ...prismaMock.transaction,
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "tx-1",
          totalAmount: 100000n,
          refundedAmount: 0n,
        }),
      },
      transactionHomestay: prismaMock.transactionHomestay,
      transactionVenue: prismaMock.transactionVenue,
      transactionEdutrip: prismaMock.transactionEdutrip,
    };
    if (typeof operation === "function") return (operation as (tx: unknown) => Promise<unknown>)(tx);
    return Promise.all(operation as unknown[]);
  });
});

describe("automatic late-payment refund", () => {
  it("issues a full refund with a deterministic late refund key", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: "tx-1",
      invoiceNumber: "INV-1",
      totalAmount: 100000n,
      refundedAmount: 0n,
      paymentStatus: "PAID",
      midtransTransactionId: "mt-1",
      refunds: [],
    });
    vi.mocked(refundTransaction).mockResolvedValue({
      status_code: "200",
      status_message: "OK",
      transaction_id: "mt-1",
      order_id: "INV-1",
      gross_amount: "100000",
      transaction_status: "refund",
      refund_chargeback_id: 77,
    });
    vi.mocked(prismaMock.refund.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prismaMock.refund.create).mockResolvedValue({ id: "refund-1" });
    vi.mocked(prismaMock.transaction.update).mockResolvedValue({});

    const result = await requestAutomaticLatePaymentRefund("tx-1");

    expect(result).toEqual({});
    expect(refundTransaction).toHaveBeenCalledWith(
      "INV-1",
      expect.objectContaining({ refundKey: "LATE-tx-1" }),
    );
    expect(prismaMock.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refundKey: "LATE-tx-1",
          amount: 100000,
          automatic: true,
          requestedByUserId: null,
        }),
      }),
    );
    expect(prismaMock.transaction.update).toHaveBeenCalled();
    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-1" },
        data: expect.objectContaining({ paymentStatus: "REFUNDED" }),
      }),
    );
  });
});
