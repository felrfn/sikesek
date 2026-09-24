import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatLongDate, formatShortDate } from "@/lib/utils/format";
import { getBookingDetail, type BookingType } from "@/features/bookings/service";
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
      detailLabel: `${booking.totalNights} night(s), ${booking.extraBedsCount} extra bed(s)`,
    };
  }
  if (type === "venue") {
    return {
      facilityName: booking.venue.name,
      dateLabel: formatShortDate(booking.bookingDate),
      detailLabel: `${booking.totalHours} hour(s)`,
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

  const booking = await getBookingDetail(type as BookingType, id);
  if (!booking) notFound();

  const { facilityName, dateLabel, detailLabel } = facilityAndTiming(
    type as BookingType,
    booking,
  );

  return (
    <div>
      <AdminTopbar title="Booking Detail" />
      <div className="mx-auto max-w-2xl p-6">
        <Link
          href="/admin/bookings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="size-4" />
          Back to Bookings
        </Link>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase text-gray-400">{type}</p>
              <h1 className="text-lg font-semibold text-gray-900">{facilityName}</h1>
            </div>
            <div className="flex gap-2">
              <Badge tone={booking.transaction.paymentStatus === "PAID" ? "success" : "warning"}>
                {booking.transaction.paymentStatus}
              </Badge>
              <Badge tone="neutral">{booking.bookingStatus.replace("_", " ")}</Badge>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Invoice number">{booking.transaction.invoiceNumber}</Field>
            <Field label="Midtrans transaction ID">
              {booking.transaction.midtransTransactionId ?? "-"}
            </Field>
            <Field label="Customer">{booking.transaction.customerName}</Field>
            <Field label="Email">{booking.transaction.customerEmail}</Field>
            <Field label="Phone">{booking.transaction.customerPhone}</Field>
            <Field label="Payment method">{booking.transaction.paymentMethod ?? "-"}</Field>
            <Field label="Date">{dateLabel}</Field>
            <Field label="Details">{detailLabel}</Field>
            <Field label="Amount">{formatCurrency(booking.subtotal)}</Field>
            <Field label="Total transaction">
              {formatCurrency(booking.transaction.totalAmount)}
            </Field>
            <Field label="Created at">{formatLongDate(booking.createdAt)}</Field>
            <Field label="Paid at">
              {booking.transaction.paidAt ? formatLongDate(booking.transaction.paidAt) : "-"}
            </Field>
            {booking.ticket ? (
              <>
                <Field label="Ticket code">{booking.ticket.code}</Field>
                <Field label="Ticket used">
                  {booking.ticket.usedAt ? formatLongDate(booking.ticket.usedAt) : "Not yet"}
                </Field>
              </>
            ) : null}
          </dl>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <BookingActions
              bookingType={type as BookingType}
              bookingId={id}
              bookingStatus={booking.bookingStatus}
              paymentStatus={booking.transaction.paymentStatus}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-gray-800">{children}</dd>
    </div>
  );
}
