import { z } from "zod";

export const cartItemInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("homestay"),
    id: z.string().uuid(),
    date: z.string().date(),
  }),
  z.object({
    type: z.literal("venue"),
    id: z.string().uuid(),
    date: z.string().date(),
    hours: z.number().int().min(1).max(24).default(1),
  }),
  z.object({
    type: z.literal("edutrip"),
    id: z.string().uuid(),
    date: z.string().date(),
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
