/**
 * WIB date helpers shared by the dashboard service. Kept in their own module
 * (no Prisma import) so the timezone/bucketing rules can be unit tested
 * without a database connection.
 */

const jakartaDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayLabelFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
});

const fullDayLabelFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const todayLabelFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

/** `YYYY-MM-DD` keys are WIB calendar dates; date maths runs on UTC midnights. */
export function addDaysKey(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Midnight WIB for a `YYYY-MM-DD` key, as an absolute instant. */
export function jakartaDayStart(key: string) {
  return new Date(`${key}T00:00:00+07:00`);
}

export function dateKeyInJakarta(date: Date) {
  return jakartaDateKeyFormatter.format(date);
}

export function dayLabel(key: string) {
  return dayLabelFormatter.format(jakartaDayStart(key));
}

export function fullDayLabel(key: string) {
  return fullDayLabelFormatter.format(jakartaDayStart(key));
}

export function relativeTime(date: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export function dashboardDateLabels(now: Date) {
  return {
    todayLabel: todayLabelFormatter.format(now),
    updatedAtLabel: `${timeFormatter.format(now)} WIB`,
  };
}
