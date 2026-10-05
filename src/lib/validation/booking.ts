import { z } from "zod";
import { getMaxBookableDate, getTodayInJakarta } from "@/lib/siteConfig";

/**
 * Rejects any date before today, or more than MAX_BOOKING_DAYS_AHEAD days
 * out (WIB) - mirrors the frontend calendar's disabled-dates behavior, but
 * this is the check that actually matters: the frontend one is only a UX
 * convenience (RULES.md ยง2 - never rely on client-side validation alone).
 */
function withinBookingWindow(date: string) {
  const today = getTodayInJakarta();
  return date >= today && date <= getMaxBookableDate(today);
}

export const dateField = z.string().date().refine(withinBookingWindow, {
  message: "Date must be today or within the next 90 days",
});

export const cartItemInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("homestay"),
    id: z.string().uuid(),
    date: dateField,
  }),
  z
    .object({
      type: z.literal("venue"),
      id: z.string().uuid(),
      date: dateField,
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(1).max(24),
    })
    .refine((v) => v.endHour > v.startHour, {
      message: "endHour must be after startHour",
      path: ["endHour"],
    }),
  z.object({
    type: z.literal("edutrip"),
    id: z.string().uuid(),
    date: dateField,
    pax: z.number().int().min(1).max(500).default(1),
  }),
]);

export const submitBookingSchema = z.object({
  items: z.array(cartItemInputSchema).min(1, "Cart is empty"),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: z
      .string()
      .trim()
      .min(8)
      .max(20)
      .regex(/^[0-9+ -]+$/, "Invalid phone number"),
    note: z.string().trim().max(500).optional(),
  }),
});

export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type SubmitBookingInput = z.infer<typeof submitBookingSchema>;

/**
 * Mobile availability check (docs/MOBILE_API.md). Exactly one of `date`
 * (single day) or `startDate`+`endDate` (inclusive range) must be given -
 * never both, never neither. Both ends of a range go through the same
 * `dateField` as a single date, so a range can never reach further into the
 * future than a single-date query already could (today..+90 days) - no
 * separate "max range length" rule was needed. `startHour`/`endHour` only
 * apply to venues, and only to the venue's own hour range on *every* day in
 * the query - they're optional, but must be given together, mirroring the
 * venue branch of `cartItemInputSchema` above.
 */
export const facilityAvailabilityQuerySchema = z
  .object({
    date: dateField.optional(),
    startDate: dateField.optional(),
    endDate: dateField.optional(),
    category: z.enum(["homestay", "venue", "edutrip"]).optional(),
    startHour: z.number().int().min(0).max(23).optional(),
    endHour: z.number().int().min(1).max(24).optional(),
  })
  .superRefine((v, ctx) => {
    const hasDate = v.date !== undefined;
    const hasRangeStart = v.startDate !== undefined;
    const hasRangeEnd = v.endDate !== undefined;

    if (hasDate && (hasRangeStart || hasRangeEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either `date` or `startDate`/`endDate`, not both",
        path: ["date"],
      });
    } else if (!hasDate && !hasRangeStart && !hasRangeEnd) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either `date` or `startDate`/`endDate`",
        path: ["date"],
      });
    } else if (!hasDate && hasRangeStart !== hasRangeEnd) {
      ctx.addIssue({
        code: "custom",
        message: "startDate and endDate must be provided together",
        path: ["endDate"],
      });
    } else if (hasRangeStart && hasRangeEnd && v.endDate! < v.startDate!) {
      ctx.addIssue({
        code: "custom",
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      });
    }
  })
  .refine((v) => (v.startHour === undefined) === (v.endHour === undefined), {
    message: "startHour and endHour must be provided together",
    path: ["endHour"],
  })
  .refine((v) => v.startHour === undefined || v.endHour === undefined || v.endHour > v.startHour, {
    message: "endHour must be after startHour",
    path: ["endHour"],
  });

export type FacilityAvailabilityQuery = z.infer<typeof facilityAvailabilityQuerySchema>;
