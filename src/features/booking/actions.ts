"use server";

import { submitBookingSchema } from "@/lib/validation/booking";
import { createSnapTransaction } from "@/lib/midtrans";
import {
  BookingConflictError,
  createBookingTransaction,
  getTransactionByInvoice,
} from "./service";

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

  try {
    const snap = await createSnapTransaction({
      invoiceNumber: transaction.invoiceNumber,
      grossAmount: Number(transaction.totalAmount),
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      itemDetails,
    });

    return { url: snap.redirect_url };
  } catch {
    return {
      error: "Could not start payment. Please try again in a moment.",
    };
  }
}
