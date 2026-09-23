import { z } from "zod";

export const homestayInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  minCapacity: z.coerce.number().int().min(1),
  maxCapacity: z.coerce.number().int().min(1),
  weekdayPrice: z.coerce.number().int().min(0),
  weekendPrice: z.coerce.number().int().min(0),
  holidayPrice: z.coerce.number().int().min(0),
  extraBedPrice: z.coerce.number().int().min(0).default(0),
});

export const venueInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  minCapacity: z.coerce.number().int().min(1),
  maxCapacity: z.coerce.number().int().min(1),
  pricePerHour: z.coerce.number().int().min(0),
});

export const edutripInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  pricePerPax: z.coerce.number().int().min(0),
  isPopular: z.coerce.boolean().default(false),
});
