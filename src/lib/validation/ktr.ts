import { z } from "zod";

export const detectionIngestSchema = z.object({
  areaId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  // The R2 object key under private/ (see docs/STORAGE.md), not a URL -
  // evidence is never publicly accessible. The fog-server/CCTV pipeline is
  // expected to upload directly to the private prefix and report the key.
  evidenceKey: z.string().trim().min(1),
  detectedAt: z.string().datetime().optional(),
});

export const manualDetectionSchema = z.object({
  areaId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  evidenceKey: z.string().trim().min(1),
  detectedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateDetectionSchema = z.object({
  areaId: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1).optional(),
  detectedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type DetectionIngestInput = z.infer<typeof detectionIngestSchema>;
export type ManualDetectionInput = z.infer<typeof manualDetectionSchema>;
export type UpdateDetectionInput = z.infer<typeof updateDetectionSchema>;
