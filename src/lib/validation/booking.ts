import { z } from "zod";
import { getTodayInJakarta } from "@/lib/siteConfig";

/**
 * Rejects any date before today (WIB) - mirrors the frontend calendar's
 * disabled-past-dates behavior, but this is the check that actually
 * matters: the frontend one is only a UX convenience (RULES.md ยง2 - never
 * rely on client-side validation alone).
 */
function notInThePast(date: string) {
  return date >= getTodayInJakarta();
}

const dateField = z.string().date().refine(notInThePast, {
  message: "Date must be today or in the future",
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
