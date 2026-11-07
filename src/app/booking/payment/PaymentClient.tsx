"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatLongDate } from "@/lib/utils/format";
import {
  formatPaymentCountdown,
  remainingPaymentSeconds,
} from "@/lib/payment";
import { useCart } from "@/features/booking/CartContext";
import {
  createPaymentSession,
  expirePaymentSession,
  submitBooking,
} from "@/features/booking/actions";
import type { CartItemInput } from "@/lib/validation/booking";

const snapClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
const snapScriptUrl =
  process.env.NODE_ENV === "production"
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

interface ActivePaymentSession {
  invoiceNumber: string;
  token?: string;
  redirectUrl?: string;
  expiresAt: string;
}

interface SnapCallbacks {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks?: SnapCallbacks) => void;
      hide?: () => void;
    };
  }
}

export function PaymentClient({ receiptDate }: { receiptDate: string }) {
  const router = useRouter();
  const cart = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ActivePaymentSession | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [expiredHandled, setExpiredHandled] = useState(false);
  // Prevents the hydration effect from racing the click handler when it
  // has just created a booking and is about to create the same Snap session.
  const creatingSessionRef = useRef(false);
  const autoLoadStartedRef = useRef<string | null>(null);

  const remainingSeconds = session
    ? remainingPaymentSeconds(new Date(session.expiresAt), new Date(nowMs))
    : null;
  const isExpired = remainingSeconds !== null && remainingSeconds <= 0;

  // On a reload of an already-created booking, recover the same Snap token
  // and deadline. The deadline comes from the database, so this cannot
  // restart/extend the 5-minute window.
  useEffect(() => {
    const invoiceNumber = cart.invoiceNumber;
    if (!invoiceNumber) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local UI state when the cart's invoice is removed
      setSession(null);
      autoLoadStartedRef.current = null;
      return;
    }
    if (creatingSessionRef.current || autoLoadStartedRef.current === invoiceNumber) {
      return;
    }
    autoLoadStartedRef.current = invoiceNumber;

    let cancelled = false;
    setIsSubmitting(true);

    createPaymentSession(invoiceNumber)
      .then((result) => {
        if (cancelled) return;
        if (result.error && !result.expired) {
          setSession(null);
          setError(result.error);
          return;
        }
        if (result.expiresAt) {
          setSession({
            invoiceNumber,
            token: result.token,
            redirectUrl: result.redirectUrl,
            expiresAt: result.expiresAt,
          });
          setNowMs(Date.now());
        }
        // An expired session has its own dedicated panel with a retry
        // action; do not also show the backend's raw English error above it.
        if (result.error && !result.expired) setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the payment session.");
      })
      .finally(() => {
        if (!cancelled) setIsSubmitting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cart.invoiceNumber]);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial clock sync for the countdown
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || !isExpired || expiredHandled) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting once to the countdown reaching zero
    setExpiredHandled(true);
    window.snap?.hide?.();
    setError(null);
    void expirePaymentSession(session.invoiceNumber).catch(() => {
      // The cron job will retry; the server deadline already frees the slot.
    });
  }, [session, isExpired, expiredHandled]);

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

  function openSnap(paymentSession: ActivePaymentSession) {
    if (paymentSession.token && window.snap) {
      window.snap.pay(paymentSession.token, {
        onSuccess: () => {
          router.push(`/booking/success?invoice=${paymentSession.invoiceNumber}`);
        },
        onPending: () => {
          router.push(`/booking/success?invoice=${paymentSession.invoiceNumber}`);
        },
        onError: () => {
          setError("Pembayaran gagal diproses. Silakan coba lagi.");
          setIsSubmitting(false);
        },
        onClose: () => {
          setError("Jendela pembayaran ditutup sebelum selesai. Anda dapat melanjutkan selama waktu masih tersedia.");
          setIsSubmitting(false);
        },
      });
      return;
    }

    if (paymentSession.redirectUrl) {
      // Fallback for transactions created before Snap.js popup support.
      window.location.href = paymentSession.redirectUrl;
      return;
    }

    setError(
      snapClientKey
        ? "Pembayaran sedang dimuat. Tunggu sebentar lalu klik Bayar lagi."
        : "Pembayaran belum dikonfigurasi. Hubungi admin.",
    );
    setIsSubmitting(false);
  }

  async function createBookingAndOpenPayment() {
    if (!cart.customer) {
      router.push("/booking/data-entry");
      return;
    }

    const cartInput: CartItemInput[] = cart.items.map((item) =>
      item.type === "homestay"
        ? { type: "homestay", id: item.id, date: item.date }
        : item.type === "venue"
          ? {
              type: "venue",
              id: item.id,
              date: item.date,
              startHour: item.startHour,
              endHour: item.endHour,
            }
          : { type: "edutrip", id: item.id, date: item.date, pax: item.pax },
    );

    const result = await submitBooking({
      items: cartInput,
      customer: cart.customer,
    });

    if (result.error || !result.invoiceNumber) {
      setError(result.error ?? "Booking tidak dapat dibuat. Silakan coba lagi.");
      return;
    }

    const invoiceNumber = result.invoiceNumber;
    cart.setInvoiceNumber(invoiceNumber);

    const payment = await createPaymentSession(invoiceNumber);
    if (!payment.expiresAt || payment.error) {
      setError(payment.error ?? "Pembayaran tidak dapat dimulai. Silakan coba lagi.");
      return;
    }

    const nextSession: ActivePaymentSession = {
      invoiceNumber,
      token: payment.token,
      redirectUrl: payment.redirectUrl,
      expiresAt: payment.expiresAt,
    };
    setSession(nextSession);
    setNowMs(Date.now());
    setExpiredHandled(false);
    openSnap(nextSession);
  }

  async function handlePay() {
    if (isSubmitting) return;
    if (!cart.customer) {
      router.push("/booking/data-entry");
      return;
    }
    if (isExpired) {
      setError("Sesi pembayaran telah berakhir. Silakan coba bayar lagi.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    creatingSessionRef.current = true;

    try {
      if (session?.token || session?.redirectUrl) {
        openSnap(session);
        return;
      }

      if (!cart.invoiceNumber) {
        await createBookingAndOpenPayment();
        return;
      }

      const result = await createPaymentSession(cart.invoiceNumber);
      if (!result.expiresAt || result.error) {
        setError(result.error ?? "Pembayaran tidak dapat dimulai. Silakan coba lagi.");
        return;
      }

      const nextSession: ActivePaymentSession = {
        invoiceNumber: cart.invoiceNumber,
        token: result.token,
        redirectUrl: result.redirectUrl,
        expiresAt: result.expiresAt,
      };
      setSession(nextSession);
      setNowMs(Date.now());
      setExpiredHandled(false);
      openSnap(nextSession);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      creatingSessionRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleRetry() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    creatingSessionRef.current = true;

    try {
      if (session) {
        // Make sure the old booking is cancelled before creating a new one.
        await expirePaymentSession(session.invoiceNumber).catch(() => undefined);
      }
      cart.clearInvoice();
      setSession(null);
      setExpiredHandled(false);
      await createBookingAndOpenPayment();
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      creatingSessionRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleStartOver() {
    setIsSubmitting(true);
    if (session) {
      await expirePaymentSession(session.invoiceNumber).catch(() => undefined);
    }
    cart.clear();
    router.push("/booking");
  }

  return (
    <Card className="mx-auto max-w-sm p-6">
      <Script
        src={snapScriptUrl}
        data-client-key={snapClientKey}
        strategy="afterInteractive"
      />

      <div className="text-center">
        <p className="text-lg font-bold text-brand-700">Pembayaran SIKESEK</p>
        <p className="mt-1 text-sm text-gray-500">{formatLongDate(receiptDate)}</p>
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

      <div
        className={`mt-4 rounded-lg border p-3 text-center text-sm ${
          isExpired
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {session ? (
          isExpired ? (
            <>
              <p className="font-medium">
                Waktu pembayaran habis. Booking lama dibatalkan dan slotnya
                sudah dilepas.
              </p>
              <p className="mt-1 text-xs">
                Invoice lama tidak bisa dilanjutkan. Coba bayar lagi dengan
                pesanan yang sama, atau pilih ulang booking.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Selesaikan pembayaran dalam</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatPaymentCountdown(remainingSeconds ?? 0)}
              </p>
            </>
          )
        ) : (
          <p>
            Pembayaran harus diselesaikan dalam <strong>5 menit</strong> setelah
            tombol Bayar ditekan.
          </p>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {isExpired ? (
        <div className="mt-5 space-y-2">
          <Button
            className="w-full rounded-full"
            onClick={handleRetry}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Memproses..." : "Coba Bayar Lagi"}
          </Button>
          <Button
            className="w-full rounded-full"
            variant="outline"
            onClick={handleStartOver}
            disabled={isSubmitting}
          >
            Pilih Ulang Booking
          </Button>
        </div>
      ) : (
        <Button
          className="mt-5 w-full rounded-full"
          onClick={handlePay}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Memproses..."
            : session
              ? "Lanjutkan Pembayaran"
              : "Bayar"}
        </Button>
      )}

      <p className="mt-3 text-center text-xs text-gray-400">
        Pembayaran aman diproses oleh Midtrans.
      </p>
    </Card>
  );
}
