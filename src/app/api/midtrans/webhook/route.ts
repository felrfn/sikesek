import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMidtransSignature } from "@/lib/midtrans";

interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
}

export async function POST(request: Request) {
  let body: MidtransNotification;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const isValid = verifyMidtransSignature({
    orderId: body.order_id,
    statusCode: body.status_code,
    grossAmount: body.gross_amount,
    signatureKey: body.signature_key,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNumber: body.order_id },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Idempotent: a transaction that already reached a terminal state is not
  // reprocessed, so duplicate/delayed webhook deliveries are safe
  // (TESTING.md ยง8).
  if (transaction.paymentStatus !== "PENDING") {
    return NextResponse.json({ ok: true });
  }

  const status = body.transaction_status;
  const isPaid =
    status === "settlement" ||
    (status === "capture" && body.fraud_status === "accept");
  const isCancelled = ["deny", "cancel", "expire"].includes(status);
  const isRefunded = status === "refund" || status === "partial_refund";

  if (isPaid) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          paymentMethod: body.payment_type,
          midtransTransactionId: body.transaction_id,
        },
      }),
      prisma.transactionHomestay.updateMany({
        where: { transactionId: transaction.id },
        data: { bookingStatus: "CONFIRMED" },
      }),
      prisma.transactionVenue.updateMany({
        where: { transactionId: transaction.id },
        data: { bookingStatus: "CONFIRMED" },
      }),
      prisma.transactionEdutrip.updateMany({
        where: { transactionId: transaction.id },
        data: { bookingStatus: "CONFIRMED" },
      }),
    ]);
  } else if (isCancelled) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: { paymentStatus: "CANCELLED" },
      }),
      prisma.transactionHomestay.updateMany({
        where: { transactionId: transaction.id },
        data: { bookingStatus: "CANCELLED" },
      }),
      prisma.transactionVenue.updateMany({
        where: { transactionId: transaction.id },
        data: { bookingStatus: "CANCELLED" },
      }),
      prisma.transactionEdutrip.updateMany({
        where: { transactionId: transaction.id },
        data: { bookingStatus: "CANCELLED" },
      }),
    ]);
  } else if (isRefunded) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { paymentStatus: "REFUNDED" },
    });
  }

  return NextResponse.json({ ok: true });
}
