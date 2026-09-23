import { z } from "zod";

export const detectionIngestSchema = z.object({
  areaId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  imageUrl: z.string().url(),
  detectedAt: z.string().datetime().optional(),
});

export type DetectionIngestInput = z.infer<typeof detectionIngestSchema>;
