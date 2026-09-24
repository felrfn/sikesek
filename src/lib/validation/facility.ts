import { z } from "zod";

export const homestayInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  minCapacity: z.coerce.number().int().min(1),
  maxCapacity: z.coerce.number().int().min(1),
  roomCount: z.coerce.number().int().min(1).default(1),
  bedCount: z.coerce.number().int().min(1).default(1),
  weekdayPrice: z.coerce.number().int().min(0),
  weekendPrice: z.coerce.number().int().min(0),
  holidayPrice: z.coerce.number().int().min(0),
  extraBedPrice: z.coerce.number().int().min(0).default(0),
});

export const venueInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  minCapacity: z.coerce.number().int().min(1),
  maxCapacity: z.coerce.number().int().min(1),
  pricePerHour: z.coerce.number().int().min(0),
});

export const edutripInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  pricePerPax: z.coerce.number().int().min(0),
  isPopular: z.coerce.boolean().default(false),
});

/** The amenity catalog (Facility model) itself - section 25's dedicated CRUD. */
export const amenityFacilitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  iconName: z.string().trim().max(60).optional(),
  isActive: z.coerce.boolean().default(true),
});

const facilitySelectionSchema = z.object({
  facilityId: z.string().uuid(),
  descriptionOverride: z.string().trim().max(1000).optional(),
});

export const homestayFacilitiesInputSchema = z.object({
  selections: z.array(facilitySelectionSchema),
});

const includedItemSchema = z.object({
  activityId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  descriptionOverride: z.string().trim().max(1000).optional(),
});

export const edutripIncludedItemsInputSchema = z.object({
  items: z.array(includedItemSchema),
});
