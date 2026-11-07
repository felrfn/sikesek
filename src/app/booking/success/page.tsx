import type { ReactNode } from "react";
import { CheckCircle2, Clock, Download, Home, RefreshCw, XCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatLongDate } from "@/lib/utils/format";
import { getTransactionByInvoice } from "@/features/booking/service";
import { reconcileFromMidtransGetStatus } from "@/features/booking/paymentReconciliation";
import { expirePendingPayment } from "@/features/payments/expiryService";
import { PaymentStatusAutoRefresh } from "./PaymentStatusAutoRefresh";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  // The URL's own query params (order_id, status_code, transaction_status
  // from Midtrans's browser redirect) are NEVER trusted for anything -
  // `invoice` is used only to look up which booking to show; the actual
  // payment state always comes from the backend below. If the local record
  // is still PENDING, this actively reconciles against Midtrans's Get
  // Status API first (section 11/12/20) - this is what makes the flow work
  // even when the webhook hasn't arrived yet (e.g. no public HTTPS tunnel
  // in local development), rather than showing a stale "pending" forever.
  const { invoice } = await searchParams;
  if (invoice) {
    await reconcileFromMidtransGetStatus(invoice);
    // A PENDING booking whose 5-minute deadline has passed should not keep
    // showing "waiting" until the next cron run. `expirePendingPayment` is
    // a no-op for non-PENDING / not-yet-due rows, so this is safe after
    // every reconciliation attempt.
    await expirePendingPayment(invoice);
  }
  const transaction = invoice ? await getTransactionByInvoice(invoice) : null;

  if (!transaction) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Booking not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            We could not find a booking for this invoice.
          </p>
          <LinkButton href="/" className="mt-4" variant="primary">
            Back to Home
          </LinkButton>
        </div>
      </Shell>
    );
  }

  const items = [
    ...transaction.homestays.map((h) => ({
      name: h.homestay.name,
      detail: `${formatLongDate(h.checkInDate)} - ${h.totalNights} malam`,
      amount: h.subtotal,
    })),
    ...transaction.venues.map((v) => ({
      name: v.venue.name,
      detail: `${formatLongDate(v.bookingDate)} - ${v.totalHours} jam`,
      amount: v.subtotal,
    })),
    ...transaction.edutrips.map((e) => ({
      name: e.package.name,
      detail: `${formatLongDate(e.visitDate)} - ${e.paxCount} pax`,
      amount: e.subtotal,
    })),
  ];

  const summaryCard = (
    <Card className="mt-6 w-full max-w-sm p-5 text-left text-sm">
      <div className="flex justify-between text-gray-500">
        <span>Invoice</span>
        <span className="font-medium text-gray-900">{transaction.invoiceNumber}</span>
      </div>
      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
        {items.map((item) => (
          <div key={item.name} className="flex justify-between">
            <div>
              <p className="text-gray-800">{item.name}</p>
              <p className="text-xs text-gray-400">{item.detail}</p>
            </div>
            <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between border-t border-gray-100 pt-4 font-semibold text-gray-900">
        <span>Total</span>
        <span>{formatCurrency(transaction.totalAmount)}</span>
      </div>
    </Card>
  );

  if (transaction.paymentStatus === "PENDING") {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="size-8 text-amber-600" />
          </div>
          <PaymentStatusAutoRefresh />
          <h1 className="mt-6 text-xl font-semibold text-gray-900">
            Menunggu konfirmasi pembayaran
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
            Invoice {transaction.invoiceNumber} masih menunggu pembayaran. Pembayaran harus
            selesai dalam 5 menit; setelah itu booking dibatalkan otomatis dan slotnya
            dilepas. E-ticket diterbitkan otomatis setelah Midtrans mengonfirmasi pembayaran
            tepat waktu.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Status diperbarui otomatis. Halaman ini mengikuti data backend, bukan hanya
            browser Anda.
          </p>
          {summaryCard}
          <div className="mt-6 flex justify-center gap-3">
            <LinkButton href={`/booking/success?invoice=${transaction.invoiceNumber}`} variant="primary">
              <RefreshCw className="size-4" />
              Cek Lagi
            </LinkButton>
            <LinkButton href="/" variant="outline">
              <Home className="size-4" />
              Kembali ke Beranda
            </LinkButton>
          </div>
        </div>
      </Shell>
    );
  }

  if (transaction.paymentStatus === "FAILED" || transaction.paymentStatus === "EXPIRED") {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="size-8 text-red-600" />
          </div>
          <h1 className="mt-6 text-xl font-semibold text-gray-900">
            {transaction.paymentStatus === "EXPIRED"
              ? "Pembayaran kedaluwarsa"
              : "Pembayaran gagal"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
            Invoice {transaction.invoiceNumber} tidak dapat diselesaikan. Booking sudah
            dibatalkan dan slotnya dilepas. Silakan buat booking baru, atau hubungi kami jika
            Anda yakin ini sebuah kesalahan.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <LinkButton href="/booking" variant="primary">
              <RefreshCw className="size-4" />
              Booking Lagi
            </LinkButton>
            <LinkButton href="/" variant="outline">
              <Home className="size-4" />
              Kembali ke Beranda
            </LinkButton>
          </div>
        </div>
      </Shell>
    );
  }

  if (transaction.latePaymentAt) {
    const refunded =
      transaction.paymentStatus === "REFUNDED" ||
      transaction.paymentStatus === "PARTIALLY_REFUNDED";
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="size-8 text-amber-600" />
          </div>
          <h1 className="mt-6 text-xl font-semibold text-gray-900">
            Pembayaran diterima setelah batas waktu
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
            Invoice {transaction.invoiceNumber} dibayar setelah jendela pembayaran 5 menit
            berakhir. Booking tidak diaktifkan dan e-ticket tidak diterbitkan.{" "}
            {refunded
              ? "Pembayaran telah dikembalikan secara otomatis."
              : "Pengembalian dana otomatis sedang diproses oleh admin."}
          </p>
          {summaryCard}
          <div className="mt-6 flex justify-center gap-3">
            <LinkButton href="/booking" variant="primary">
              <RefreshCw className="size-4" />
              Book Again
            </LinkButton>
            <LinkButton href="/" variant="outline">
              <Home className="size-4" />
              Back to Home
            </LinkButton>
          </div>
        </div>
      </Shell>
    );
  }

  if (transaction.paymentStatus !== "PAID") {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">
            Payment {transaction.paymentStatus.toLowerCase()}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Invoice {transaction.invoiceNumber}.
          </p>
          <LinkButton href="/" className="mt-4" variant="primary">
            Back to Home
          </LinkButton>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="size-8 text-green-700" />
        </div>
        <h1 className="mt-6 text-xl font-semibold text-brand-800">Booking Successful!</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          Your invoice and e-ticket(s) have been generated. A copy has also been sent to{" "}
          {transaction.customerEmail}.
        </p>

        <div className="mx-auto mt-3 flex w-fit items-center gap-2">
          <Badge tone="success">PAID</Badge>
          {transaction.paymentMethod ? (
            <Badge tone="neutral">{transaction.paymentMethod}</Badge>
          ) : null}
        </div>

        {summaryCard}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={`/api/invoices/${transaction.invoiceNumber}/pdf`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Download className="size-4" />
            Download Invoice (PDF)
          </a>
          <a
            href={`/api/tickets/${transaction.invoiceNumber}/pdf`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Download className="size-4" />
            Download QR Ticket (PDF)
          </a>
          <LinkButton href="/" variant="outline">
            <Home className="size-4" />
            Back to Home
          </LinkButton>
        </div>
      </div>
    </Shell>
  );
}
