import { prisma } from "@/lib/prisma";
import {
  getHomestayRentalWindow,
  getVenueRentalWindow,
} from "@/lib/bookingWindow";
import {
  broadcastToUsers,
  getActiveFieldOfficerIds,
} from "@/features/notifications/pushService";
import {
  BOOKING_CHECKIN_OVERDUE,
  BOOKING_ENDING_SOON,
  getCheckInDeadline,
  rentalEndingSoonAt,
  type BookingReminderEventType,
} from "@/lib/bookingNotificationPolicy";
import { formatLongDate, formatTime } from "@/lib/utils/format";

export type BookingReminderBookingType = "homestay" | "venue";

export interface BookingReminderEvent {
  eventType: BookingReminderEventType;
  bookingType: BookingReminderBookingType;
  bookingId: string;
  invoiceNumber: string;
  facilityName: string;
  customerName: string;
  bookingStatus: string;
  validFrom: Date;
  validUntil: Date;
  /** The instant that made this event due: rental end for ending-soon, check-in deadline for overdue. */
  eventAt: Date;
}

export interface BookingReminderSummary {
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
}

const ACTIVE_BOOKING_STATUSES = ["CONFIRMED", "CHECKED_IN"] as const;
const PAID_STATUSES = ["PAID", "PARTIALLY_REFUNDED"] as const;

/**
 * All currently relevant venue/homestay bookings. The status + payment
 * filters keep this small: only bookings that can still produce a reminder
 * are loaded, not the full history.
 */
async function loadHomestayCandidates() {
  return prisma.transactionHomestay.findMany({
    where: {
      bookingStatus: { in: [...ACTIVE_BOOKING_STATUSES] },
      transaction: { paymentStatus: { in: [...PAID_STATUSES] } },
    },
    select: {
      id: true,
      bookingStatus: true,
      checkInDate: true,
      checkOutDate: true,
      homestay: { select: { name: true } },
      transaction: {
        select: { invoiceNumber: true, customerName: true },
      },
    },
  });
}

async function loadVenueCandidates() {
  return prisma.transactionVenue.findMany({
    where: {
      bookingStatus: { in: [...ACTIVE_BOOKING_STATUSES] },
      transaction: { paymentStatus: { in: [...PAID_STATUSES] } },
    },
    select: {
      id: true,
      bookingStatus: true,
      bookingDate: true,
      startTime: true,
      endTime: true,
      venue: { select: { name: true } },
      transaction: {
        select: { invoiceNumber: true, customerName: true },
      },
    },
  });
}

function baseEvent(
  event: Omit<
    BookingReminderEvent,
    "eventType" | "eventAt" | "validFrom" | "validUntil"
  >,
  eventType: BookingReminderEventType,
  eventAt: Date,
  validFrom: Date,
  validUntil: Date,
): BookingReminderEvent {
  return { ...event, eventType, eventAt, validFrom, validUntil };
}

/**
 * Pure-ish candidate -> events step, separated from sending so it can be
 * tested without mocking FCM. "Ending soon" is deliberately CHECKED_IN only:
 * a CONFIRMED booking that never arrived is covered by the no-show event
 * instead, not by a "rental is ending" reminder for a rental that never
 * started.
 */
export async function getBookingReminderEvents(
  now: Date = new Date(),
): Promise<BookingReminderEvent[]> {
  const [homestays, venues] = await Promise.all([
    loadHomestayCandidates(),
    loadVenueCandidates(),
  ]);

  const events: BookingReminderEvent[] = [];

  for (const booking of homestays) {
    const { validFrom, validUntil } = getHomestayRentalWindow(
      booking.checkInDate,
      booking.checkOutDate,
    );
    const base = {
      bookingType: "homestay" as const,
      bookingId: booking.id,
      invoiceNumber: booking.transaction.invoiceNumber,
      facilityName: booking.homestay.name,
      customerName: booking.transaction.customerName,
      bookingStatus: booking.bookingStatus,
    };

    if (booking.bookingStatus === "CHECKED_IN") {
      if (now >= rentalEndingSoonAt(validUntil) && now < validUntil) {
        events.push(
          baseEvent(
            base,
            BOOKING_ENDING_SOON,
            validUntil,
            validFrom,
            validUntil,
          ),
        );
      }
      continue;
    }

    const deadline = getCheckInDeadline("homestay", validFrom);
    if (now >= deadline && now < validUntil) {
      events.push(
        baseEvent(
          base,
          BOOKING_CHECKIN_OVERDUE,
          deadline,
          validFrom,
          validUntil,
        ),
      );
    }
  }

  for (const booking of venues) {
    const { validFrom, validUntil } = getVenueRentalWindow(
      booking.bookingDate,
      booking.startTime,
      booking.endTime,
    );
    const base = {
      bookingType: "venue" as const,
      bookingId: booking.id,
      invoiceNumber: booking.transaction.invoiceNumber,
      facilityName: booking.venue.name,
      customerName: booking.transaction.customerName,
      bookingStatus: booking.bookingStatus,
    };

    if (booking.bookingStatus === "CHECKED_IN") {
      if (now >= rentalEndingSoonAt(validUntil) && now < validUntil) {
        events.push(
          baseEvent(
            base,
            BOOKING_ENDING_SOON,
            validUntil,
            validFrom,
            validUntil,
          ),
        );
      }
      continue;
    }

    const deadline = getCheckInDeadline("venue", validFrom);
    if (now >= deadline && now < validUntil) {
      events.push(
        baseEvent(
          base,
          BOOKING_CHECKIN_OVERDUE,
          deadline,
          validFrom,
          validUntil,
        ),
      );
    }
  }

  return events.sort(
    (a, b) => a.eventAt.getTime() - b.eventAt.getTime(),
  );
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Claim the logical event before broadcasting. This is the cron's idempotency
 * guard: the unique key is (bookingType, bookingId, eventType), so two
 * overlapping runs can never both notify for the same event. If the durable
 * notification rows fail to write, the claim is removed so the next run can
 * retry.
 */
async function claimEvent(event: BookingReminderEvent) {
  try {
    await prisma.bookingNotificationEvent.create({
      data: {
        bookingType: event.bookingType,
        bookingId: event.bookingId,
        eventType: event.eventType,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
}

async function releaseEvent(event: BookingReminderEvent) {
  await prisma.bookingNotificationEvent.deleteMany({
    where: {
      bookingType: event.bookingType,
      bookingId: event.bookingId,
      eventType: event.eventType,
    },
  });
}

interface ReminderContent {
  title: string;
  body: string;
  data: Record<string, string>;
  metadata: Record<string, string>;
}

function reminderContent(event: BookingReminderEvent): ReminderContent {
  const when = formatLongDate(event.eventAt);
  const time = formatTime(event.eventAt);

  if (event.eventType === BOOKING_ENDING_SOON) {
    return {
      title: "Sewa fasilitas hampir berakhir",
      body: `Sewa ${event.facilityName} untuk ${event.customerName} berakhir dalam 15 menit, pukul ${time} WIB (${when}).`,
      data: {
        type: BOOKING_ENDING_SOON,
        bookingType: event.bookingType,
        bookingId: event.bookingId,
        invoiceNumber: event.invoiceNumber,
        facilityName: event.facilityName,
        validUntil: event.validUntil.toISOString(),
      },
      metadata: {
        eventType: BOOKING_ENDING_SOON,
        facilityName: event.facilityName,
        customerName: event.customerName,
        validUntil: event.validUntil.toISOString(),
      },
    };
  }

  return {
    title: "Belum check-in",
    body: `${event.customerName} belum check-in di ${event.facilityName}. Batas check-in ${time} WIB (${when}) telah terlewati.`,
    data: {
      type: BOOKING_CHECKIN_OVERDUE,
      bookingType: event.bookingType,
      bookingId: event.bookingId,
      invoiceNumber: event.invoiceNumber,
      facilityName: event.facilityName,
      checkInDeadline: event.eventAt.toISOString(),
    },
    metadata: {
      eventType: BOOKING_CHECKIN_OVERDUE,
      facilityName: event.facilityName,
      customerName: event.customerName,
      checkInDeadline: event.eventAt.toISOString(),
    },
  };
}

/**
 * Cron entry point. Broadcasts to every active field officer, matching the
 * existing KTR notification rule. No booking status is changed here - this
 * is an operational alert, not an automatic cancellation/checkout.
 */
export async function sendBookingReminders(
  now: Date = new Date(),
): Promise<BookingReminderSummary> {
  const events = await getBookingReminderEvents(now);
  const summary: BookingReminderSummary = {
    candidates: events.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (events.length === 0) return summary;

  const officerIds = await getActiveFieldOfficerIds();
  if (officerIds.length === 0) {
    summary.skipped = events.length;
    return summary;
  }

  for (const event of events) {
    if (!(await claimEvent(event))) {
      summary.skipped += 1;
      continue;
    }

    const content = reminderContent(event);

    try {
      const result = await broadcastToUsers({
        userIds: officerIds,
        booking: {
          bookingType: event.bookingType,
          bookingId: event.bookingId,
          invoiceNumber: event.invoiceNumber,
          metadata: content.metadata,
        },
        title: content.title,
        body: content.body,
        data: content.data,
      });

      if (result.status === "sent") summary.sent += 1;
      else if (result.status === "failed") summary.failed += 1;
      else summary.skipped += 1;
    } catch (error) {
      // The notification rows themselves failed to write; release the claim
      // so the next minute's run can retry the same event.
      await releaseEvent(event).catch(() => undefined);
      throw error;
    }
  }

  return summary;
}
