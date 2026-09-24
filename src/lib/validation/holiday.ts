import { z } from "zod";

export const holidayInputSchema = z.object({
  date: z.string().date(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  isClosed: z.coerce.boolean().default(false),
});

export type HolidayInput = z.infer<typeof holidayInputSchema>;
