"use server";

import { cartItemInputSchema, submitBookingSchema } from "@/lib/validation/booking";
import { createSnapTransaction, isMidtransApiError } from "@/lib/midtrans";
import { prisma } from "@/lib/prisma";
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

export async function createPaymentRedirect(
  invoiceNumber: string,
): Promise<{ url?: string; error?: string }> {
  const transaction = await getTransactionByInvoice(invoiceNumber);
  if (!transaction) {
    return { error: "Booking not found." };
  }
  if (transaction.paymentStatus !== "PENDING") {
    return { error: "This booking is no longer pending payment." };
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

  // A Midtrans order_id can only be created once - if we already have a
  // Snap redirect URL for this transaction (a previous "Bayar" click that
  // succeeded), reuse it instead of calling Midtrans again, which would
  // fail with "order_id has already been taken".
  if (transaction.snapUrl) {
    return { url: transaction.snapUrl };
  }

  try {
    const snap = await createSnapTransaction({
      invoiceNumber: transaction.invoiceNumber,
      grossAmount: calculatedTotal,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      itemDetails,
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { snapUrl: snap.redirect_url },
    });

    console.log("[Midtrans] Payment created", {
      orderId: transaction.invoiceNumber,
      bookingId: transaction.id,
      amount: calculatedTotal,
    });

    return { url: snap.redirect_url };
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
