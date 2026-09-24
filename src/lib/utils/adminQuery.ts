/**
 * Reusable server-side pagination and date-range parsing for admin list
 * pages (payments, bookings, KTR, workers, refunds, ...) - built once here
 * instead of re-implemented per page, per CLAUDE.md's "avoid unnecessary
 * abstractions" balanced against "don't duplicate existing functionality"
 * once a second page needs the exact same thing.
 *
 * All date-range boundaries are computed in the site's single operating
 * timezone (WIB / Asia/Jakarta - see getTodayInJakarta in siteConfig.ts) and
 * converted to UTC Date instances before being used in a Prisma `gte`/`lt`
 * filter, so "today" never silently means UTC-today on a server running in
 * a different timezone (the exact hydration/timezone bug class this project
 * has hit before).
 */

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function parsePagination(
  searchParams: Record<string, string | string[] | undefined>,
  defaultPageSize: number = DEFAULT_PAGE_SIZE,
): PaginationParams {
  const rawPage = Number(firstValue(searchParams.page));
  const rawPageSize = Number(firstValue(searchParams.pageSize));

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && PAGE_SIZE_OPTIONS.includes(rawPageSize as 20 | 50 | 100)
      ? rawPageSize
      : defaultPageSize;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  pageSize: number,
): PaginationMeta {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const jakartaOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  timeZoneName: "shortOffset",
});

/** WIB is a fixed UTC+7 offset (no DST) - resolved once, not hardcoded. */
function jakartaOffsetHours() {
  const part = jakartaOffsetFormatter
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value;
  const match = part?.match(/GMT([+-]\d+)/);
  return match ? Number(match[1]) : 7;
}

/**
 * Given a `YYYY-MM-DD` calendar date, returns the UTC instants
 * corresponding to that day's 00:00:00-23:59:59.999 window in WIB. `end` is
 * an exclusive upper bound (start of the next day) so callers use
 * `{ gte: start, lt: end }` rather than an inclusive-but-truncated range.
 */
export function jakartaDayBoundsUtc(dateStr: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const offset = jakartaOffsetHours();
  const start = new Date(Date.UTC(year, month - 1, day) - offset * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

/**
 * Parses `?from=YYYY-MM-DD&to=YYYY-MM-DD` into a Prisma-ready
 * `{ gte, lt }`-shaped range in UTC, computed against WIB day boundaries.
 * Either side may be omitted for an open-ended range.
 */
export function parseDateRangeParams(
  searchParams: Record<string, string | string[] | undefined>,
  fromKey = "from",
  toKey = "to",
): DateRangeFilter {
  const fromStr = firstValue(searchParams[fromKey]);
  const toStr = firstValue(searchParams[toKey]);

  const result: DateRangeFilter = {};
  if (fromStr) result.from = jakartaDayBoundsUtc(fromStr).start;
  if (toStr) result.to = jakartaDayBoundsUtc(toStr).end;
  return result;
}

/** Prisma `gte`/`lt` filter object for a field, or `undefined` if both ends are open. */
export function dateRangeWhere(range: DateRangeFilter) {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lt: range.to } : {}),
  };
}
