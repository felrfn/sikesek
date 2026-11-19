import Link from "next/link";
import { after } from "next/server";
import { CalendarCheck, Clock, ListChecks } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
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
import { BOOKING_TYPES } from "@/features/bookings/display";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { sweepOverduePaymentsThrottled } from "@/features/payments/expiryService";
import { BookingGanttSection, type ChartQuery } from "./BookingGanttSection";
import { BookingsChartFilter } from "./BookingsChartFilter";
import { BookingsTable } from "./BookingsTable";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const VIEWS: ScheduleView[] = ["day", "week", "month"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseView(value: string | string[] | undefined, fallback: ScheduleView): ScheduleView {
  const candidate = first(value) as ScheduleView;
  return VIEWS.includes(candidate) ? candidate : fallback;
}

function parseDateKey(value: string | string[] | undefined, fallback: string) {
  const candidate = first(value);
  return isValidDateKey(candidate) ? candidate : fallback;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const mode = first(params.mode) === "list" ? "list" : "chart";
  const todayKey = getTodayInJakarta();

  // Let the database catch up with overdue payments without delaying this
  // render. The UI already uses the effective status, so this only matters
  // for the stored rows and the next request.
  after(() => {
    sweepOverduePaymentsThrottled().catch((error) => {
      console.error("[Payment] Background expiry sweep failed", error);
    });
  });

  const typeParam = first(params.types);
  const visibleTypes = (
    typeParam
      ? typeParam.split(",").filter((value): value is ScheduleBookingType =>
          (BOOKING_TYPES as readonly string[]).includes(value),
        )
      : [...BOOKING_TYPES]
  );
  const types = visibleTypes.length > 0 ? visibleTypes : [...BOOKING_TYPES];

  const statusParam = first(params.statuses);
  const parsedStatuses = statusParam
    ? statusParam
        .split(",")
        .filter((value): value is (typeof ALL_BOOKING_STATUSES)[number] =>
          (ALL_BOOKING_STATUSES as readonly string[]).includes(value),
        )
    : [];
  const statuses = parsedStatuses.length > 0 ? parsedStatuses : [...DEFAULT_VISIBLE_STATUSES];

  if (mode === "list") {
    const rows = await getUnifiedBookings();
    const confirmed = rows.filter((row) => row.bookingStatus === "CONFIRMED").length;
    const pending = rows.filter((row) => row.bookingStatus === "PENDING").length;

    return (
      <div>
        <AdminTopbar />
        <div className="p-6">
          <PageHeader total={rows.length} confirmed={confirmed} pending={pending} />
          <ModeTabs mode={mode} />
          <div className="mt-5">
            <BookingsTable rows={rows} />
          </div>
        </div>
      </div>
    );
  }

  const query: ChartQuery = {
    types: typeParam ?? "",
    statuses: statusParam ?? "",
    hDate: parseDateKey(params.hDate, todayKey),
    hView: parseView(params.hView, "month"),
    vDate: parseDateKey(params.vDate, todayKey),
    vView: parseView(params.vView, "day"),
    eDate: parseDateKey(params.eDate, todayKey),
    eView: parseView(params.eView, "month"),
  };

  const ranges = {
    homestay: rangeForView(query.hView, query.hDate),
    venue: rangeForView(query.vView, query.vDate),
    edutrip: rangeForView(query.eView, query.eDate),
  };

  const [homestay, venue, edutrip] = await Promise.all([
    getBookingSchedule({
      bookingType: "homestay",
      fromKey: ranges.homestay.from,
      toKey: ranges.homestay.to,
    }),
    getBookingSchedule({
      bookingType: "venue",
      fromKey: ranges.venue.from,
      toKey: ranges.venue.to,
    }),
    getBookingSchedule({
      bookingType: "edutrip",
      fromKey: ranges.edutrip.from,
      toKey: ranges.edutrip.to,
    }),
  ]);

  const statusSet = new Set<string>(statuses);
  const sections = [
    { bookingType: "homestay" as const, schedule: homestay, view: query.hView },
    { bookingType: "venue" as const, schedule: venue, view: query.vView },
    { bookingType: "edutrip" as const, schedule: edutrip, view: query.eView },
  ]
    .filter((section) => types.includes(section.bookingType))
    .map((section) => {
      const range =
        section.bookingType === "homestay"
          ? ranges.homestay
          : section.bookingType === "venue"
            ? ranges.venue
            : ranges.edutrip;
      const anchorKey =
        section.bookingType === "homestay"
          ? query.hDate
          : section.bookingType === "venue"
            ? query.vDate
            : query.eDate;
      const days = buildDays(range.from, range.to, todayKey, section.schedule.holidays);
      const visibleBookings = section.schedule.bookings.filter((booking) =>
        statusSet.has(booking.bookingStatus),
      );
      return {
        ...section,
        fromKey: range.from,
        toKey: range.to,
        anchorKey,
        days,
        rows: layoutSchedule(section.schedule.facilities, visibleBookings, days),
      };
    });

  const total = sections.reduce((sum, s) => sum + s.schedule.stats.total, 0);
  const confirmed = sections.reduce((sum, s) => sum + s.schedule.stats.confirmed, 0);
  const pending = sections.reduce((sum, s) => sum + s.schedule.stats.pending, 0);

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <PageHeader total={total} confirmed={confirmed} pending={pending} />
        <ModeTabs mode={mode} />

        <div className="mt-5 flex justify-start">
          <BookingsChartFilter visibleTypes={types} statuses={statuses} />
        </div>

        <div className="mt-5 space-y-8">
          {sections.map((section) => (
            <BookingGanttSection
              key={section.bookingType}
              bookingType={section.bookingType}
              view={section.view}
              fromKey={section.fromKey}
              toKey={section.toKey}
              todayKey={todayKey}
              days={section.days}
              rows={section.rows}
              query={query}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  total,
  confirmed,
  pending,
}: {
  total: number;
  confirmed: number;
  pending: number;
}) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Manajemen Reservasi
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pantau dan kelola reservasi fasilitas di semua lokasi.
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Card className="bg-brand-50 p-4">
          <ListChecks className="size-5 text-brand-700" />
          <p className="mt-3 text-sm text-gray-500">Total Reservasi</p>
          <p className="text-2xl font-bold text-brand-800">{total}</p>
        </Card>
        <Card className="bg-green-50 p-4">
          <CalendarCheck className="size-5 text-green-600" />
          <p className="mt-3 text-sm text-gray-500">Dikonfirmasi</p>
          <p className="text-2xl font-bold text-green-700">{confirmed}</p>
        </Card>
        <Card className="bg-amber-50 p-4">
          <Clock className="size-5 text-amber-600" />
          <p className="mt-3 text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-amber-700">{pending}</p>
        </Card>
      </div>
    </>
  );
}

function ModeTabs({ mode }: { mode: "chart" | "list" }) {
  return (
    <div className="mt-5 flex flex-wrap gap-1 rounded-full bg-gray-100 p-1 text-sm sm:w-fit">
      <Link
        href="/admin/bookings?mode=chart"
        aria-current={mode === "chart" ? "page" : undefined}
        className={cn(
          "flex-1 rounded-full px-4 py-1.5 text-center transition-colors sm:flex-none",
          mode === "chart"
            ? "bg-brand-700 font-medium text-white"
            : "text-gray-500 hover:text-gray-700",
        )}
      >
        Chart
      </Link>
      <Link
        href="/admin/bookings?mode=list"
        aria-current={mode === "list" ? "page" : undefined}
        className={cn(
          "flex-1 rounded-full px-4 py-1.5 text-center transition-colors sm:flex-none",
          mode === "list"
            ? "bg-brand-700 font-medium text-white"
            : "text-gray-500 hover:text-gray-700",
        )}
      >
        List
      </Link>
    </div>
  );
}
