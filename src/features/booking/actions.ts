"use server";

import { cartItemInputSchema, submitBookingSchema } from "@/lib/validation/booking";
import { createSnapTransaction, isMidtransApiError } from "@/lib/midtrans";
import { prisma } from "@/lib/prisma";
import { paymentDeadlineFrom } from "@/lib/payment";
import { expirePendingPayment } from "@/features/payments/expiryService";
import {
  BookingConflictError,
  checkAvailability,
  createBookingTransaction,
  getTransactionByInvoice,
} from "./service";

/**
 * Advisory pre-check called from the booking selection page (section 4/5 -
 * a conflict must surface before payment, not just at final submit). The
 * real, race-safe check still happens in `submitBooking` ->
 * `createBookingTransaction`.
 */
export async function checkItemAvailability(
  item: unknown,
): Promise<{ available: boolean; message?: string }> {
  const parsed = cartItemInputSchema.safeParse(item);
  if (!parsed.success) {
    return { available: false, message: parsed.error.issues[0]?.message };
  }

  const conflicts = await checkAvailability([parsed.data]);
  if (conflicts.length > 0) {
    return { available: false, message: conflicts[0].message };
  }
  return { available: true };
}

export async function submitBooking(
  input: unknown,
): Promise<{ invoiceNumber?: string; error?: string }> {
  const parsed = submitBookingSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      error: firstIssue?.message ?? "Invalid booking data. Please check your entries.",
    };
  }

  try {
    const transaction = await createBookingTransaction(parsed.data);
    return { invoiceNumber: transaction.invoiceNumber };
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return { error: error.message };
    }
    return {
      error:
        "One or more selected items are no longer available. Please go back and try again.",
    };
  }
}

/**
 * Logs enough to actually debug a failed payment creation without leaking
 * secrets. Never include the Midtrans server key, our AUTH_SECRET, or any
 * request/response header - only the transaction identifiers, amount, and
 * whatever Midtrans itself said was wrong.
 */
function logPaymentCreationFailure(context: {
  bookingId: string;
  invoiceNumber: string;
  amount: number;
  customerEmail: string;
  error: unknown;
}) {
  const base = {
    event: "payment_creation_failed",
    bookingId: context.bookingId,
    invoiceNumber: context.invoiceNumber,
    midtransOrderId: context.invoiceNumber,
    amount: context.amount,
    customerEmail: context.customerEmail,
  };

  if (isMidtransApiError(context.error)) {
    console.error("Payment creation failed", {
      ...base,
      errorMessage: context.error.message,
      httpStatusCode: context.error.httpStatusCode,
      midtransResponse: context.error.ApiResponse,
    });
    return;
  }

  console.error("Payment creation failed", {
    ...base,
    errorMessage: context.error instanceof Error ? context.error.message : String(context.error),
  });
}

export interface PaymentSessionResult {
  invoiceNumber?: string;
  /** Snap.js token - the normal path for the popup. */
  token?: string;
  /** Legacy-only fallback for a transaction created before snapToken existed. */
  redirectUrl?: string;
  /** ISO instant after which the local payment window is closed. */
  expiresAt?: string;
  expired?: boolean;
  error?: string;
}

/**
 * Returns (or creates) the Snap session for a booking. The 5-minute deadline
 * is set at booking creation; this function only reuses it, so reloading the
 * payment page cannot extend the window.
 */
export async function createPaymentSession(
  invoiceNumber: string,
): Promise<PaymentSessionResult> {
  const transaction = await getTransactionByInvoice(invoiceNumber);
  if (!transaction) {
    return { error: "Booking not found." };
  }
  if (transaction.paymentStatus !== "PENDING") {
    return {
      invoiceNumber,
      expired: transaction.paymentStatus === "EXPIRED",
      error: "This booking is no longer pending payment.",
    };
  }

  let expiresAt = transaction.paymentExpiresAt;
  if (!expiresAt) {
    // Legacy row: repair it from the time of this request rather than
    // leaving an unenforceable PENDING payment forever.
    expiresAt = paymentDeadlineFrom();
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { paymentExpiresAt: expiresAt },
    });
  }

  if (expiresAt.getTime() <= Date.now()) {
    return {
      invoiceNumber,
      expiresAt: expiresAt.toISOString(),
      expired: true,
      error: "This payment session has expired. Please book again.",
    };
  }

  // A Midtrans order_id can only be created once. Reuse the stored token on
  // every "Bayar" click/reload instead of calling Midtrans again (which
  // would fail with "order_id has already been taken").
  if (transaction.snapToken) {
    return {
      invoiceNumber: transaction.invoiceNumber,
      token: transaction.snapToken,
      redirectUrl: transaction.snapUrl ?? undefined,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // Old rows created before popup support have a redirect URL but no token;
  // there is no way to create a second Snap transaction for the same
  // order_id, so let the client fall back to the redirect page.
  if (transaction.snapUrl) {
    return {
      invoiceNumber: transaction.invoiceNumber,
      redirectUrl: transaction.snapUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  const itemDetails = [
    ...transaction.homestays.map((h) => ({
      id: h.id,
      name: h.homestay.name,
      price: Number(h.subtotal),
    })),
    ...transaction.venues.map((v) => ({
      id: v.id,
      name: v.venue.name,
      price: Number(v.subtotal),
    })),
    ...transaction.edutrips.map((e) => ({
      id: e.id,
      name: e.package.name,
      price: Number(e.subtotal),
    })),
  ];

  // Section 4: never hand Midtrans an amount that doesn't match the sum of
  // the booking's own line items - this is a sanity check against the
  // *current* transaction record, independent of the invoiceNumber-reuse
  // bug (which is prevented earlier, in CartContext/PaymentClient).
  const calculatedTotal = itemDetails.reduce((sum, item) => sum + item.price, 0);
  if (calculatedTotal !== Number(transaction.totalAmount)) {
    console.error("Payment amount inconsistency detected, aborting", {
      event: "payment_amount_mismatch",
      bookingId: transaction.id,
      invoiceNumber: transaction.invoiceNumber,
      storedTotal: Number(transaction.totalAmount),
      calculatedTotal,
    });
    return {
      error: "This booking's total could not be verified. Please contact support.",
    };
  }

  try {
    const snap = await createSnapTransaction({
      invoiceNumber: transaction.invoiceNumber,
      grossAmount: calculatedTotal,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      itemDetails,
      expiresAt,
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { snapToken: snap.token, snapUrl: snap.redirect_url },
    });

    console.log("[Midtrans] Payment created", {
      orderId: transaction.invoiceNumber,
      bookingId: transaction.id,
      amount: calculatedTotal,
      paymentExpiresAt: expiresAt.toISOString(),
    });

    return {
      invoiceNumber: transaction.invoiceNumber,
      token: snap.token,
      redirectUrl: snap.redirect_url,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    logPaymentCreationFailure({
      bookingId: transaction.id,
      invoiceNumber: transaction.invoiceNumber,
      amount: calculatedTotal,
      customerEmail: transaction.customerEmail,
      error,
    });

    const detail =
      process.env.NODE_ENV !== "production" && isMidtransApiError(error)
        ? ` (${error.message})`
        : "";

    return {
      error: `Could not start payment. Please try again in a moment.${detail}`,
    };
  }
}

/**
 * Public safety net for the countdown: once the deadline passes, the
 * payment page can ask the backend to expire the session immediately
 * instead of waiting for the next cron run.
 */
export async function expirePaymentSession(
  invoiceNumber: string,
): Promise<{ expired: boolean; status: string; error?: string }> {
  const result = await expirePendingPayment(invoiceNumber);
  return {
    expired: result.expired,
    status: result.status,
    error:
      result.status === "NOT_FOUND"
        ? "Booking not found."
        : result.due
          ? undefined
          : "The payment window is still open.",
  };
}
