import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  Home,
  RefreshCw,
  SearchX,
  XCircle,
} from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  formatCurrency,
  formatLongDate,
  formatTime,
} from "@/lib/utils/format";
import { getTransactionByInvoice } from "@/features/booking/service";
import { reconcileFromMidtransGetStatus } from "@/features/booking/paymentReconciliation";
import { expirePendingPayment } from "@/features/payments/expiryService";
import { BookingShell } from "../BookingShell";
import { PaymentStatusAutoRefresh } from "./PaymentStatusAutoRefresh";

export const dynamic = "force-dynamic";

type Transaction = NonNullable<
  Awaited<ReturnType<typeof getTransactionByInvoice>>
>;

type Tone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, { circle: string; icon: string }> = {
  success: { circle: "bg-green-100", icon: "text-green-700" },
  warning: { circle: "bg-amber-100", icon: "text-amber-600" },
  danger: { circle: "bg-red-100", icon: "text-red-600" },
  neutral: { circle: "bg-gray-100", icon: "text-gray-500" },
};

const STATUS_META: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  PAID: { label: "Lunas", tone: "success" },
  PENDING: { label: "Menunggu pembayaran", tone: "warning" },
  FAILED: { label: "Gagal", tone: "danger" },
  EXPIRED: { label: "Kedaluwarsa", tone: "danger" },
  PARTIALLY_REFUNDED: { label: "Refund sebagian", tone: "neutral" },
  REFUNDED: { label: "Dana dikembalikan", tone: "neutral" },
};

function Shell({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <BookingShell showSteps={false} contentClassName="px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        {aside ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>{children}</div>
            <div className="space-y-4">{aside}</div>
          </div>
        ) : (
          <div className="mx-auto max-w-xl">{children}</div>
        )}
      </div>
    </BookingShell>
  );
}

function StatusPanel({
  tone,
  icon,
  title,
  description,
  children,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="p-6 sm:p-8">
      <div
        className={`flex size-14 items-center justify-center rounded-full ${toneStyles[tone].circle}`}
      >
        <span className={toneStyles[tone].icon}>{icon}</span>
      </div>
      <h1 className="mt-5 text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </Card>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {children}
    </div>
  );
}

function SummaryCard({
  transaction,
  items,
}: {
  transaction: Transaction;
  items: Array<{ name: string; detail: string; amount: bigint }>;
}) {
  const status = STATUS_META[transaction.paymentStatus] ?? {
    label: transaction.paymentStatus.toLowerCase(),
    tone: "neutral" as const,
  };
  const paid = transaction.paymentStatus === "PAID";

  return (
    <Card className="p-5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Ringkasan Pemesanan</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-gray-500">Invoice</dt>
          <dd className="min-w-0 break-all text-right font-medium text-gray-900">
            {transaction.invoiceNumber}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-gray-500">Dibuat</dt>
          <dd className="text-right text-gray-800">
            {formatLongDate(transaction.createdAt)}
          </dd>
        </div>
        {transaction.paidAt ? (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-gray-500">Dibayar</dt>
            <dd className="text-right text-gray-800">
              {formatLongDate(transaction.paidAt)}{" "}
              {formatTime(transaction.paidAt)}
            </dd>
          </div>
        ) : null}
        {transaction.paymentMethod ? (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-gray-500">Metode</dt>
            <dd className="text-right text-gray-800">
              {transaction.paymentMethod}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
        {items.map((item) => (
          <div key={item.name} className="flex justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-gray-800">{item.name}</p>
              <p className="text-xs text-gray-400">{item.detail}</p>
            </div>
            <span className="shrink-0 font-medium text-gray-900">
              {formatCurrency(item.amount)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="font-semibold text-gray-900">Total</span>
        <span className="text-lg font-bold text-gray-900">
          {formatCurrency(transaction.totalAmount)}
        </span>
      </div>

      {paid ? (
        <div className="mt-4 space-y-2">
          <LinkButton
            href={`/api/invoices/${transaction.invoiceNumber}/pdf`}
            variant="primary"
            className="w-full"
          >
            <Download className="size-4" />
            Unduh Invoice (PDF)
          </LinkButton>
          <LinkButton
            href={`/api/tickets/${transaction.invoiceNumber}/pdf`}
            variant="outline"
            className="w-full"
          >
            <Download className="size-4" />
            Unduh E-Tiket QR (PDF)
          </LinkButton>
        </div>
      ) : null}
    </Card>
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
        <StatusPanel
          tone="neutral"
          icon={<SearchX className="size-7" />}
          title="Pemesanan tidak ditemukan"
          description="Kami tidak menemukan pemesanan untuk invoice ini. Periksa kembali tautan dari email konfirmasi Anda, atau mulai pemesanan baru."
        >
          <Actions>
            <LinkButton href="/" variant="primary" className="w-full sm:w-auto">
              <Home className="size-4" />
              Kembali ke Beranda
            </LinkButton>
            <LinkButton href="/booking" variant="outline" className="w-full sm:w-auto">
              Pesan Lagi
            </LinkButton>
          </Actions>
        </StatusPanel>
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

  const summary = <SummaryCard transaction={transaction} items={items} />;

  if (transaction.paymentStatus === "PENDING") {
    return (
      <Shell aside={summary}>
        <StatusPanel
          tone="warning"
          icon={<Clock className="size-7" />}
          title="Menunggu pembayaran"
          description={
            <>
              Invoice <strong>{transaction.invoiceNumber}</strong> masih menunggu
              pembayaran. Selesaikan dalam 5 menit agar e-tiket diterbitkan
              otomatis.
            </>
          }
        >
          <PaymentStatusAutoRefresh />
          <p className="mb-4 text-xs text-gray-400">
            Status diperbarui otomatis dari server, bukan hanya dari browser
            Anda.
          </p>
          <Actions>
            <LinkButton
              href={`/booking/success?invoice=${transaction.invoiceNumber}`}
              variant="primary"
              className="w-full sm:w-auto"
            >
              <RefreshCw className="size-4" />
              Cek Lagi
            </LinkButton>
            <LinkButton href="/" variant="outline" className="w-full sm:w-auto">
              <Home className="size-4" />
              Kembali ke Beranda
            </LinkButton>
          </Actions>
        </StatusPanel>
      </Shell>
    );
  }

  if (
    transaction.paymentStatus === "FAILED" ||
    transaction.paymentStatus === "EXPIRED"
  ) {
    const expired = transaction.paymentStatus === "EXPIRED";
    return (
      <Shell aside={summary}>
        <StatusPanel
          tone="danger"
          icon={<XCircle className="size-7" />}
          title={expired ? "Pembayaran kedaluwarsa" : "Pembayaran gagal"}
          description={
            <>
              Invoice <strong>{transaction.invoiceNumber}</strong> tidak dapat
              diselesaikan. Silakan buat pemesanan baru, atau hubungi kami jika
              Anda yakin ini sebuah kesalahan.
            </>
          }
        >
          <Actions>
            <LinkButton href="/booking" variant="primary" className="w-full sm:w-auto">
              <RefreshCw className="size-4" />
              Pesan Lagi
            </LinkButton>
            <LinkButton href="/" variant="outline" className="w-full sm:w-auto">
              <Home className="size-4" />
              Kembali ke Beranda
            </LinkButton>
          </Actions>
        </StatusPanel>
      </Shell>
    );
  }

  if (transaction.latePaymentAt) {
    const refunded =
      transaction.paymentStatus === "REFUNDED" ||
      transaction.paymentStatus === "PARTIALLY_REFUNDED";
    return (
      <Shell aside={summary}>
        <StatusPanel
          tone="warning"
          icon={<Clock className="size-7" />}
          title="Pembayaran diterima setelah batas waktu"
          description={
            <>
              Invoice <strong>{transaction.invoiceNumber}</strong> dibayar
              setelah jendela pembayaran 5 menit berakhir, sehingga pemesanan
              tidak diaktifkan dan e-tiket tidak diterbitkan.{" "}
              {refunded
                ? "Pembayaran telah dikembalikan secara otomatis."
                : "Pengembalian dana otomatis sedang diproses oleh admin."}
            </>
          }
        >
          <Actions>
            <LinkButton href="/booking" variant="primary" className="w-full sm:w-auto">
              <RefreshCw className="size-4" />
              Pesan Lagi
            </LinkButton>
            <LinkButton href="/" variant="outline" className="w-full sm:w-auto">
              <Home className="size-4" />
              Kembali ke Beranda
            </LinkButton>
          </Actions>
        </StatusPanel>
      </Shell>
    );
  }

  if (transaction.paymentStatus !== "PAID") {
    return (
      <Shell aside={summary}>
        <StatusPanel
          tone="neutral"
          icon={<Clock className="size-7" />}
          title={`Status pembayaran: ${transaction.paymentStatus.toLowerCase()}`}
          description={
            <>
              Invoice <strong>{transaction.invoiceNumber}</strong>. Hubungi kami
              jika Anda memerlukan bantuan lebih lanjut.
            </>
          }
        >
          <Actions>
            <LinkButton href="/" variant="primary" className="w-full sm:w-auto">
              <Home className="size-4" />
              Kembali ke Beranda
            </LinkButton>
          </Actions>
        </StatusPanel>
      </Shell>
    );
  }

  return (
    <Shell aside={summary}>
      <StatusPanel
        tone="success"
        icon={<CheckCircle2 className="size-7" />}
        title="Pemesanan Berhasil!"
        description={
          <>
            Invoice dan e-tiket Anda telah dibuat. Salinan konfirmasi juga
            dikirim ke <strong>{transaction.customerEmail}</strong>.
          </>
        }
      >
        <div className="rounded-lg bg-cream-50 p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-800">Langkah selanjutnya</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Tunjukkan e-tiket QR saat check-in di lokasi.</li>
            <li>Simpan invoice sebagai bukti pemesanan.</li>
            <li>Datang sesuai tanggal yang tertera di tiket.</li>
          </ul>
        </div>
        <div className="mt-5">
          <Actions>
            <LinkButton href="/booking" variant="outline" className="w-full sm:w-auto">
              <RefreshCw className="size-4" />
              Pesan Lagi
            </LinkButton>
            <LinkButton href="/" variant="primary" className="w-full sm:w-auto">
              <Home className="size-4" />
              Kembali ke Beranda
            </LinkButton>
          </Actions>
        </div>
      </StatusPanel>
    </Shell>
  );
}
