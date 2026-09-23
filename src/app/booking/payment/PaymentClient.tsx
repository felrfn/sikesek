"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatLongDate } from "@/lib/utils/format";
import { useCart } from "@/features/booking/CartContext";
import { submitBooking, createPaymentRedirect } from "@/features/booking/actions";
import type { CartItemInput } from "@/lib/validation/booking";

export function PaymentClient() {
  const router = useRouter();
  const cart = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cart.items.length === 0) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <p className="text-gray-600">Your cart is empty.</p>
        <Button className="mt-4" onClick={() => router.push("/booking")}>
          Back to Selection
        </Button>
      </Card>
    );
  }

  async function handlePay() {
    if (!cart.customer) {
      router.push("/booking/data-entry");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let invoiceNumber = cart.invoiceNumber;

      if (!invoiceNumber) {
        const cartInput: CartItemInput[] = cart.items.map((item) =>
          item.type === "homestay"
            ? { type: "homestay", id: item.id, date: item.date }
            : item.type === "venue"
              ? {
                  type: "venue",
                  id: item.id,
                  date: item.date,
                  hours: item.hours,
                }
              : { type: "edutrip", id: item.id, date: item.date, pax: item.pax },
        );

        const result = await submitBooking({
          items: cartInput,
          customer: cart.customer,
        });

        if (result.error || !result.invoiceNumber) {
          setError(result.error ?? "Could not submit booking.");
          setIsSubmitting(false);
          return;
        }

        invoiceNumber = result.invoiceNumber;
        cart.setInvoiceNumber(invoiceNumber);
      }

      const redirect = await createPaymentRedirect(invoiceNumber);
      if (redirect.error || !redirect.url) {
        setError(redirect.error ?? "Could not start payment.");
        setIsSubmitting(false);
        return;
      }

      window.location.href = redirect.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-sm p-6">
      <div className="text-center">
        <p className="text-lg font-bold text-brand-700">SIKESEK</p>
        <p className="mt-1 text-sm text-gray-500">
          {formatLongDate(new Date())}
        </p>
      </div>

      <div className="mt-4 space-y-1 border-y border-dashed border-gray-300 py-4 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Arrival:</span>
          <span className="text-gray-800">
            {formatLongDate(cart.arrivalDate)}
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>name:</span>
          <span className="text-gray-800">{cart.customer?.name}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>phone:</span>
          <span className="text-gray-800">{cart.customer?.phone}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>email:</span>
          <span className="text-gray-800">{cart.customer?.email}</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs font-semibold uppercase text-gray-500">
          <span>Book</span>
          <span>Subtotal</span>
        </div>
        <div className="mt-2 space-y-1 text-sm">
          {cart.items.map((item) => (
            <div key={item.name + item.date} className="flex justify-between">
              <span className="text-gray-700">{item.name}</span>
              <span className="text-gray-900">
                {formatCurrency(item.subtotal)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-between border-t border-gray-300 pt-3 font-semibold text-gray-900">
        <span>Total:</span>
        <span>{formatCurrency(cart.total)}</span>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <Button
        className="mt-5 w-full rounded-full"
        onClick={handlePay}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Memproses..." : "Bayar"}
      </Button>
    </Card>
  );
}
