import { GraduationCap, House, MapPin } from "lucide-react";
import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/Badge";

/**
 * Shared Indonesian labels and badge tones for booking/payment statuses and
 * booking types. Used by the list table, the Gantt chart, and the detail
 * page so all three always agree on wording and color.
 */

type BadgeTone = ComponentProps<typeof Badge>["tone"];

export const BOOKING_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Menunggu", tone: "warning" },
  CONFIRMED: { label: "Dikonfirmasi", tone: "success" },
  CHECKED_IN: { label: "Check-in", tone: "success" },
  COMPLETED: { label: "Selesai", tone: "info" },
  CANCELLED: { label: "Dibatalkan", tone: "danger" },
  REJECTED: { label: "Ditolak", tone: "danger" },
};

export function bookingStatusLabel(status: string) {
  return BOOKING_STATUS_META[status]?.label ?? status.replaceAll("_", " ");
}

export function bookingStatusTone(status: string): BadgeTone {
  return BOOKING_STATUS_META[status]?.tone ?? "neutral";
}

export {
  PAYMENT_STATUS_META,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/lib/utils/paymentStatus";

export const BOOKING_TYPE_META = {
  homestay: {
    label: "Homestay",
    badge: "bg-brand-50 text-brand-700",
    icon: House,
  },
  venue: {
    label: "Meeting Point",
    badge: "bg-blue-50 text-blue-700",
    icon: MapPin,
  },
  edutrip: {
    label: "Edutrip",
    badge: "bg-amber-50 text-amber-700",
    icon: GraduationCap,
  },
} as const;

export type BookingTypeKey = keyof typeof BOOKING_TYPE_META;

export const BOOKING_TYPES = ["homestay", "venue", "edutrip"] as const;
