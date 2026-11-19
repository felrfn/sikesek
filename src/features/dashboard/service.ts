import { prisma } from "@/lib/prisma";
import { effectivePaymentStatus } from "@/lib/payment";
import { getTodayInJakarta } from "@/lib/siteConfig";
import {
  addDaysKey,
  dashboardDateLabels,
  dateKeyInJakarta,
  dayLabel,
  fullDayLabel,
  jakartaDayStart,
  relativeTime,
} from "./dates";

const OPEN_DETECTION_STATUSES = [
  "DETECTED",
  "NOTIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
] as const;

/**
 * One round-trip of dashboard data. Everything date-sensitive is computed in
 * WIB (`Asia/Jakarta`) - never the server's local timezone - and booking
 * series are bucketed by actual calendar date, not weekday name.
 */
export async function getDashboardStats() {
  const now = new Date();
  const todayKey = getTodayInJakarta();
  const tomorrowKey = addDaysKey(todayKey, 1);
  const currentFromKey = addDaysKey(todayKey, -6);
  const previousFromKey = addDaysKey(todayKey, -13);

  const todayStart = jakartaDayStart(todayKey);
  const tomorrowStart = jakartaDayStart(tomorrowKey);
  const currentFrom = jakartaDayStart(currentFromKey);
  const previousFrom = jakartaDayStart(previousFromKey);

  const seriesKeys = Array.from({ length: 14 }, (_, index) =>
    addDaysKey(previousFromKey, index),
  );

  const [
    homestayRows,
    venueRows,
    edutripRows,
    currentRevenue,
    previousRevenue,
    totalHomestays,
    totalVenues,
    totalEdutrips,
    activeHomestays,
    activeVenues,
    activeEdutrips,
    ktrViolationsToday,
    unresolvedDetections,
    pendingPayments,
    overduePayments,
    awaitingHomestays,
    awaitingVenues,
    awaitingEdutrips,
    failedAutomaticRefunds,
    recentDetections,
    recentPayments,
  ] = await Promise.all([
    prisma.transactionHomestay.findMany({
      where: { createdAt: { gte: previousFrom, lt: tomorrowStart } },
      select: { createdAt: true },
    }),
    prisma.transactionVenue.findMany({
      where: { createdAt: { gte: previousFrom, lt: tomorrowStart } },
      select: { createdAt: true },
    }),
    prisma.transactionEdutrip.findMany({
      where: { createdAt: { gte: previousFrom, lt: tomorrowStart } },
      select: { createdAt: true },
    }),
    prisma.transaction.aggregate({
      _sum: { totalAmount: true },
      where: {
        paymentStatus: "PAID",
        OR: [
          { paidAt: { gte: currentFrom, lt: tomorrowStart } },
          { paidAt: null, createdAt: { gte: currentFrom, lt: tomorrowStart } },
        ],
      },
    }),
    prisma.transaction.aggregate({
      _sum: { totalAmount: true },
      where: {
        paymentStatus: "PAID",
        OR: [
          { paidAt: { gte: previousFrom, lt: currentFrom } },
          { paidAt: null, createdAt: { gte: previousFrom, lt: currentFrom } },
        ],
      },
    }),
    prisma.homestay.count({ where: { deletedAt: null } }),
    prisma.venue.count({ where: { deletedAt: null } }),
    prisma.edutripPackage.count({ where: { deletedAt: null } }),
    prisma.homestay.count({ where: { deletedAt: null, isActive: true } }),
    prisma.venue.count({ where: { deletedAt: null, isActive: true } }),
    prisma.edutripPackage.count({ where: { deletedAt: null, isActive: true } }),
    prisma.smokingDetection.count({
      where: { detectedAt: { gte: todayStart, lt: tomorrowStart } },
    }),
    prisma.smokingDetection.count({
      where: { status: { in: [...OPEN_DETECTION_STATUSES] } },
    }),
    prisma.transaction.count({
      where: {
        paymentStatus: "PENDING",
        OR: [{ paymentExpiresAt: { gt: now } }, { paymentExpiresAt: null }],
      },
    }),
    prisma.transaction.count({
      where: { paymentStatus: "PENDING", paymentExpiresAt: { lte: now } },
    }),
    prisma.transactionHomestay.count({
      where: { bookingStatus: "PENDING", transaction: { paymentStatus: "PAID" } },
    }),
    prisma.transactionVenue.count({
      where: { bookingStatus: "PENDING", transaction: { paymentStatus: "PAID" } },
    }),
    prisma.transactionEdutrip.count({
      where: { bookingStatus: "PENDING", transaction: { paymentStatus: "PAID" } },
    }),
    prisma.refund.count({ where: { automatic: true, status: "FAILED" } }),
    prisma.smokingDetection.findMany({
      orderBy: { detectedAt: "desc" },
      take: 4,
      select: {
        id: true,
        status: true,
        detectedAt: true,
        area: { select: { name: true } },
      },
    }),
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        totalAmount: true,
        paymentStatus: true,
        paymentExpiresAt: true,
        createdAt: true,
        latePaymentAt: true,
      },
    }),
  ]);

  // Bucket booking lines by the WIB date they were created. Counting booking
  // lines (not transactions) keeps a multi-item cart from collapsing into 1.
  const countsByDay = new Map(seriesKeys.map((key) => [key, 0]));
  for (const row of [...homestayRows, ...venueRows, ...edutripRows]) {
    const key = dateKeyInJakarta(row.createdAt);
    const current = countsByDay.get(key);
    if (current !== undefined) countsByDay.set(key, current + 1);
  }

  const currentKeys = seriesKeys.slice(7);
  const previousKeys = seriesKeys.slice(0, 7);
  const sumKeys = (keys: string[]) =>
    keys.reduce((total, key) => total + (countsByDay.get(key) ?? 0), 0);

  const { todayLabel, updatedAtLabel } = dashboardDateLabels(now);

  return {
    todayLabel,
    updatedAtLabel,
    totalFacilities: totalHomestays + totalVenues + totalEdutrips,
    activeFacilities: activeHomestays + activeVenues + activeEdutrips,
    revenue: {
      current: Number(currentRevenue._sum.totalAmount ?? 0),
      previous: Number(previousRevenue._sum.totalAmount ?? 0),
    },
    bookings: {
      current: sumKeys(currentKeys),
      previous: sumKeys(previousKeys),
    },
    bookingsByDay: currentKeys.map((key) => ({
      key,
      label: dayLabel(key),
      fullLabel: fullDayLabel(key),
      count: countsByDay.get(key) ?? 0,
    })),
    pendingPayments,
    overduePayments,
    awaitingConfirmation: awaitingHomestays + awaitingVenues + awaitingEdutrips,
    ktrViolationsToday,
    unresolvedDetections,
    failedAutomaticRefunds,
    recentDetections: recentDetections.map((detection) => ({
      id: detection.id,
      areaName: detection.area.name,
      status: detection.status,
      timeLabel: relativeTime(detection.detectedAt, now),
    })),
    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      invoiceNumber: payment.invoiceNumber,
      customerName: payment.customerName,
      totalAmount: Number(payment.totalAmount),
      paymentStatus: effectivePaymentStatus(
        payment.paymentStatus,
        payment.paymentExpiresAt,
        now,
      ),
      late: payment.latePaymentAt !== null,
      timeLabel: relativeTime(payment.createdAt, now),
    })),
  };
}
