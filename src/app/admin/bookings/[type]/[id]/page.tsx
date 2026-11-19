import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatLongDate, formatShortDate } from "@/lib/utils/format";
import { getBookingDetail, type BookingType } from "@/features/bookings/service";
import { expirePendingPayment } from "@/features/payments/expiryService";
import { isPaymentExpired } from "@/lib/payment";
import {
  BOOKING_TYPE_META,
  bookingStatusLabel,
  bookingStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/features/bookings/display";
import { BookingActions } from "./BookingActions";

const VALID_TYPES: BookingType[] = ["homestay", "venue", "edutrip"];

function facilityAndTiming(
  type: BookingType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- three distinct Prisma payload shapes, narrowed by `type`
  booking: any,
) {
  if (type === "homestay") {
    return {
      facilityName: booking.homestay.name,
      dateLabel: `${formatShortDate(booking.checkInDate)} - ${formatShortDate(booking.checkOutDate)}`,
      detailLabel: `${booking.totalNights} malam, ${booking.extraBedsCount} bed tambahan`,
    };
  }
  if (type === "venue") {
    return {
      facilityName: booking.venue.name,
      dateLabel: formatShortDate(booking.bookingDate),
      detailLabel: `${booking.totalHours} jam`,
    };
  }
  return {
    facilityName: booking.package.name,
    dateLabel: formatShortDate(booking.visitDate),
    detailLabel: `${booking.paxCount} pax`,
  };
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  if (!VALID_TYPES.includes(type as BookingType)) notFound();

  let booking = await getBookingDetail(type as BookingType, id);
  if (!booking) notFound();

  // Opening an overdue booking is also an expiry trigger. This mirrors
  // /booking/success: reconcile with Midtrans first (a settlement that just
  // made it must win), then write EXPIRED + cancel the lines. Anything the
  // cron job hasn't caught up with is therefore correct by the time the
  // admin sees the detail page.
  if (
    booking.transaction.paymentStatus === "PENDING" &&
    isPaymentExpired(booking.transaction.paymentExpiresAt)
  ) {
    await expirePendingPayment(booking.transaction.invoiceNumber);
    booking = await getBookingDetail(type as BookingType, id);
    if (!booking) notFound();
  }

  const bookingType = type as BookingType;
  const typeMeta = BOOKING_TYPE_META[bookingType];
  const { facilityName, dateLabel, detailLabel } = facilityAndTiming(
    bookingType,
    booking,
  );
  const telHref = `tel:${booking.transaction.customerPhone.replace(/[^+\d]/g, "")}`;

  return (
    <div>
      <AdminTopbar title="Detail Reservasi" />
      <div className="p-6">
        <Link
          href="/admin/bookings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Reservasi
        </Link>

        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs tracking-wide text-gray-400 uppercase">
                    {typeMeta.label}
                  </p>
                  <h1 className="mt-1 text-xl font-semibold text-gray-900">
                    {facilityName}
                  </h1>
                </div>
                <div className="flex gap-2">
                  <Badge tone={paymentStatusTone(booking.transaction.paymentStatus)}>
                    {paymentStatusLabel(booking.transaction.paymentStatus)}
                  </Badge>
                  {booking.transaction.latePaymentAt ? (
                    <Badge tone="danger">LATE</Badge>
                  ) : null}
                  <Badge tone={bookingStatusTone(booking.bookingStatus)}>
                    {bookingStatusLabel(booking.bookingStatus)}
                  </Badge>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                <Field label="Nomor invoice">{booking.transaction.invoiceNumber}</Field>
                <Field label="ID transaksi Midtrans">
                  <span className="break-all">
                    {booking.transaction.midtransTransactionId ?? "-"}
                  </span>
                </Field>
                <Field label="Tanggal">{dateLabel}</Field>
                <Field label="Rincian">{detailLabel}</Field>
                <Field label="Subtotal">{formatCurrency(booking.subtotal)}</Field>
                <Field label="Total transaksi">
                  {formatCurrency(booking.transaction.totalAmount)}
                </Field>
                <Field label="Dibuat pada">
                  {formatLongDate(booking.createdAt)}
                </Field>
                <Field label="Dibayar pada">
                  {booking.transaction.paidAt
                    ? formatLongDate(booking.transaction.paidAt)
                    : "-"}
                </Field>
                {booking.ticket ? (
                  <>
                    <Field label="Kode tiket">{booking.ticket.code}</Field>
                    <Field label="Tiket digunakan">
                      {booking.ticket.usedAt
                        ? formatLongDate(booking.ticket.usedAt)
                        : "Belum digunakan"}
                    </Field>
                  </>
                ) : null}
              </dl>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold text-gray-900">
                Data Pelanggan
              </h2>
              <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                <Field label="Nama">{booking.transaction.customerName}</Field>
                <Field label="Email">
                  <Link
                    href={`mailto:${booking.transaction.customerEmail}`}
                    className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {booking.transaction.customerEmail}
                  </Link>
                </Field>
                <Field label="Telepon">
                  <Link
                    href={telHref}
                    className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {booking.transaction.customerPhone}
                  </Link>
                </Field>
                <Field label="Metode pembayaran">
                  {booking.transaction.paymentMethod ?? "-"}
                </Field>
              </dl>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-6">
            <Card className="p-4">
              <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                Status
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={paymentStatusTone(booking.transaction.paymentStatus)}>
                  {paymentStatusLabel(booking.transaction.paymentStatus)}
                </Badge>
                {booking.transaction.latePaymentAt ? (
                  <Badge tone="danger">LATE</Badge>
                ) : null}
                <Badge tone={bookingStatusTone(booking.bookingStatus)}>
                  {bookingStatusLabel(booking.bookingStatus)}
                </Badge>
              </div>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                  Aksi
                </p>
                <div className="mt-2">
                  <BookingActions
                    bookingType={bookingType}
                    bookingId={id}
                    bookingStatus={booking.bookingStatus}
                    paymentStatus={booking.transaction.paymentStatus}
                  />
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-gray-800">{children}</dd>
    </div>
  );
}
