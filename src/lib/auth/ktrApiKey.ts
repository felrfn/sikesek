import { timingSafeEqual } from "node:crypto";

/**
 * Machine-to-machine auth for the KTR ingest endpoints (`/api/ktr/*`),
 * called by the YOLOv8 fog-server component, not by a browser or the mobile
 * app. A missing/empty `KTR_INGEST_API_KEY` always fails closed rather than
 * matching an empty header.
 *
 * Comparison is constant-time to avoid leaking the key through response
 * timing. Length is compared first because `timingSafeEqual` throws on
 * buffers of different sizes.
 */
export function isValidKtrApiKey(
  provided: string | null | undefined,
  expected: string | null | undefined = process.env.KTR_INGEST_API_KEY,
): boolean {
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
