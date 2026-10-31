import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  transaction: { findUnique: vi.fn(), updateMany: vi.fn() },
  transactionHomestay: { updateMany: vi.fn() },
  transactionVenue: { updateMany: vi.fn() },
  transactionEdutrip: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/midtrans", () => ({
  expireSnapTransaction: vi.fn(),
  isMidtransApiError: vi.fn(),
}));
vi.mock("@/features/booking/paymentReconciliation", () => ({
  reconcileFromMidtransGetStatus: vi.fn(),
}));

const { expireSnapTransaction } = await import("@/lib/midtrans");
const { reconcileFromMidtransGetStatus } = await import("@/features/booking/paymentReconciliation");
const { expirePendingPayment } = await import("./expiryService");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (operations: unknown[]) =>
    Promise.all(operations),
  );
});

describe("payment expiry", () => {
  it("expires an overdue pending payment after reconciliation and cancels its bookings", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: "tx-1",
      paymentStatus: "PENDING",
      paymentExpiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(Date.now() - 300_000),
    });
    vi.mocked(reconcileFromMidtransGetStatus).mockResolvedValue({
      ok: true,
      status: "PENDING",
      changed: false,
    });
    vi.mocked(expireSnapTransaction).mockResolvedValue({ status_code: "200" } as never);
    vi.mocked(prismaMock.transaction.updateMany).mockResolvedValue({ count: 1 });

    const result = await expirePendingPayment("INV-1");

    expect(reconcileFromMidtransGetStatus).toHaveBeenCalledWith("INV-1");
    expect(expireSnapTransaction).toHaveBeenCalledWith("INV-1");
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: "tx-1", paymentStatus: "PENDING" },
      data: { paymentStatus: "EXPIRED" },
    });
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(result.status).toBe("EXPIRED");
    expect(result.expired).toBe(true);
  });
});
