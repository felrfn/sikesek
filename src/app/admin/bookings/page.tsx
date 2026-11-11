import type { ReactNode } from "react";
import { CalendarCheck, Clock, ListChecks } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { getBookingSchedule, getUnifiedBookings } from "@/features/bookings/service";
import {
  ALL_BOOKING_STATUSES,
  DEFAULT_VISIBLE_STATUSES,
  buildDays,
  isValidDateKey,
  layoutSchedule,
  rangeForView,
  type ScheduleBookingType,
  type ScheduleView,
} from "@/features/bookings/schedule";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { BookingGantt } from "./BookingGantt";
import { BookingsTable } from "./BookingsTable";
import { BookingsToolbar } from "./BookingsToolbar";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const BOOKING_TYPES: ScheduleBookingType[] = ["homestay", "venue", "edutrip"];
const VIEWS: ScheduleView[] = ["day", "week", "month"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const mode = first(params.mode) === "list" ? "list" : "chart";

  const bookingTypeParam = first(params.type);
  const bookingType = BOOKING_TYPES.includes(bookingTypeParam as ScheduleBookingType)
    ? (bookingTypeParam as ScheduleBookingType)
    : "homestay";

  const viewParam = first(params.view);
  const view = VIEWS.includes(viewParam as ScheduleView)
    ? (viewParam as ScheduleView)
    : "week";

  const todayKey = getTodayInJakarta();
  const dateParam = first(params.date);
  const anchorKey = isValidDateKey(dateParam) ? dateParam : todayKey;
  const { from, to } = rangeForView(view, anchorKey);

  const statusParam = first(params.statuses);
  const parsedStatuses = statusParam
    ? statusParam
        .split(",")
        .filter((value): value is (typeof ALL_BOOKING_STATUSES)[number] =>
          (ALL_BOOKING_STATUSES as readonly string[]).includes(value),
        )
    : [];
  const statuses = parsedStatuses.length > 0 ? parsedStatuses : [...DEFAULT_VISIBLE_STATUSES];

  let total: number;
  let confirmed: number;
  let pending: number;
  let content: ReactNode;

  if (mode === "list") {
    const rows = await getUnifiedBookings();

    total = rows.length;
    confirmed = rows.filter((row) => row.bookingStatus === "CONFIRMED").length;
    pending = rows.filter((row) => row.bookingStatus === "PENDING").length;
    content = <BookingsTable rows={rows} />;
  } else {
    const schedule = await getBookingSchedule({
      bookingType,
      fromKey: from,
      toKey: to,
    });
    const days = buildDays(from, to, todayKey, schedule.holidays);
    const statusSet = new Set<string>(statuses);
    const visibleBookings = schedule.bookings.filter((booking) =>
      statusSet.has(booking.bookingStatus),
    );
    const rows = layoutSchedule(schedule.facilities, visibleBookings, days);

    total = schedule.stats.total;
    confirmed = schedule.stats.confirmed;
    pending = schedule.stats.pending;
    content = (
      <BookingGantt
        rows={rows}
        days={days}
        view={view}
        bookingType={bookingType}
      />
    );
  }

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Reservation Management
        </h1>
        <p className="text-sm text-gray-500">
          Monitor and manage facility bookings across all locations.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <ListChecks className="size-5 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">Total Reservations</p>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          </Card>
          <Card className="p-4">
            <CalendarCheck className="size-5 text-green-500" />
            <p className="mt-3 text-sm text-gray-500">Confirmed</p>
            <p className="text-2xl font-bold text-gray-900">{confirmed}</p>
          </Card>
          <Card className="p-4">
            <Clock className="size-5 text-amber-500" />
            <p className="mt-3 text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-gray-900">{pending}</p>
          </Card>
        </div>

        <BookingsToolbar
          mode={mode}
          bookingType={bookingType}
          view={view}
          fromKey={from}
          toKey={to}
          anchorKey={anchorKey}
          todayKey={todayKey}
          statuses={statuses}
        />

        <div className="mt-5">{content}</div>
      </div>
    </div>
  );
}
