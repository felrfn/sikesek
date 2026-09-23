import { Snap } from "midtrans-client";
import crypto from "node:crypto";

function getServerKey() {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error("MIDTRANS_SERVER_KEY is not configured");
  return key;
}

function getSnapClient() {
  return new Snap({
    isProduction: process.env.NODE_ENV === "production",
    serverKey: getServerKey(),
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
  });
}

export interface CreateSnapTransactionInput {
  invoiceNumber: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemDetails: Array<{ id: string; name: string; price: number }>;
}

export async function createSnapTransaction(
  input: CreateSnapTransactionInput,
) {
  const snap = getSnapClient();

  return snap.createTransaction({
    transaction_details: {
      order_id: input.invoiceNumber,
      gross_amount: input.grossAmount,
    },
    customer_details: {
      first_name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone,
    },
    item_details: input.itemDetails.map((item) => ({
      id: item.id,
      name: item.name.slice(0, 50),
      price: item.price,
      quantity: 1,
    })),
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/booking/success?invoice=${input.invoiceNumber}`,
    },
  });
}

/**
 * Midtrans notification signature: sha512(order_id + status_code +
 * gross_amount + server_key). See PATTERNS.md ยง12 - payment confirmation
 * must be verified server-side, never trusted from the client.
 */
export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}) {
  const expected = crypto
    .createHash("sha512")
    .update(
      `${input.orderId}${input.statusCode}${input.grossAmount}${getServerKey()}`,
    )
    .digest("hex");

  return expected === input.signatureKey;
}
