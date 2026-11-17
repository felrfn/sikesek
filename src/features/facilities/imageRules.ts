/**
 * Shared photo-upload rules for facility images (homestay & venue).
 *
 * There is deliberately no explicit size check anywhere else yet - Next.js
 * caps every Server Action body at 1 MB by default, so 1 MB is adopted as
 * the official photo limit and enforced both client-side (instant feedback)
 * and server-side (never trust the browser). `next.config.ts` raises the
 * raw action body limit slightly above that to leave room for
 * multipart/form-data overhead.
 */

/** Official maximum photo size: 1 MB. */
export const MAX_FACILITY_IMAGE_BYTES = 1 * 1024 * 1024;

/** Display label for the limit, shared by the UI hint and error messages. */
export const MAX_FACILITY_IMAGE_LABEL = "1 MB";

/**
 * Returns an Indonesian error message when the file is not an acceptable
 * photo, or null when it passes. Pure function so both the form (via the
 * client preview) and the server action use the exact same rules.
 */
export function validateFacilityImage(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "File harus berupa gambar (PNG atau JPG).";
  }
  if (file.size > MAX_FACILITY_IMAGE_BYTES) {
    return `Ukuran foto maksimal ${MAX_FACILITY_IMAGE_LABEL}.`;
  }
  return null;
}
