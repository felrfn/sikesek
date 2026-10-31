import { z } from "zod";

export const detectionIngestSchema = z.object({
  areaId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  // Either a private R2 object key under private/ (see docs/STORAGE.md) or,
  // temporarily, a full URL to evidence the AI pipeline stores itself (e.g.
  // Cloudinary). R2 is recommended but not mandatory - see
  // docs/KTR_INGEST.md.
  evidenceKey: z.string().trim().min(1),
  detectedAt: z.string().datetime().optional(),
});

const STREAM_PROTOCOLS = new Set(["rtsp:", "rtmp:", "http:", "https:"]);

export const monitoredAreaInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  locationDescription: z.string().trim().max(500).optional(),
  // Optional camera stream metadata. The AI pipeline may manage this itself
  // - an empty value means "not registered in SIKESEK".
  streamUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => {
      if (!value) return true;
      try {
        return STREAM_PROTOCOLS.has(new URL(value).protocol);
      } catch {
        return false;
      }
    }, "Stream URL must be a valid rtsp://, rtmp://, http:// or https:// URL")
    .optional(),
  assignedEmployeeId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
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
export type MonitoredAreaInput = z.infer<typeof monitoredAreaInputSchema>;
