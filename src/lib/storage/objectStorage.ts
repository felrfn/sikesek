import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Provider-neutral S3-compatible object storage.
 *
 * Works with Cloudflare R2, AWS S3, MinIO, and any other S3-compatible
 * service. The storage layout is intentionally provider-agnostic:
 *
 *   public/...   - safe to expose directly, served via S3_PUBLIC_URL
 *   private/...  - never given out as a direct URL; always a short-lived
 *                  signed GET URL generated on demand for an authorized
 *                  request.
 *
 * Configuration is resolved from S3_* variables first, with the legacy R2_*
 * names accepted as fallbacks so existing deployments keep working during a
 * migration.
 */
export const STORAGE_PREFIX = {
  public: "public",
  private: "private",
} as const;

export class StorageNotConfiguredError extends Error {}

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

function requireEnv(label: string, value: string | undefined) {
  if (!value) {
    throw new StorageNotConfiguredError(
      `${label} is not configured - object storage is unavailable`,
    );
  }
  return value;
}

function normalizeEndpoint(endpoint: string | undefined) {
  return endpoint?.replace(/\/$/, "");
}

function storageEndpoint() {
  const explicit = readEnv("S3_ENDPOINT");
  if (explicit) return normalizeEndpoint(explicit);

  // Legacy R2 fallback: R2_ACCOUNT_ID is enough to derive the S3 endpoint.
  const r2AccountId = readEnv("R2_ACCOUNT_ID");
  return r2AccountId
    ? `https://${r2AccountId}.r2.cloudflarestorage.com`
    : undefined;
}

function storagePublicEndpoint() {
  return normalizeEndpoint(readEnv("S3_PUBLIC_ENDPOINT")) ?? storageEndpoint();
}

function storageRegion() {
  return (
    readEnv("S3_REGION", "AWS_REGION") ??
    (storageEndpoint()?.includes(".r2.cloudflarestorage.com") ? "auto" : "us-east-1")
  );
}

function storageForcePathStyle() {
  const value = readEnv("S3_FORCE_PATH_STYLE");
  return value === "true" || value === "1";
}

function storageCredentials() {
  return {
    accessKeyId: requireEnv(
      "S3_ACCESS_KEY_ID (or R2_ACCESS_KEY_ID)",
      readEnv("S3_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"),
    ),
    secretAccessKey: requireEnv(
      "S3_SECRET_ACCESS_KEY (or R2_SECRET_ACCESS_KEY)",
      readEnv("S3_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"),
    ),
  };
}

function getBucket() {
  return requireEnv(
    "S3_BUCKET_NAME (or R2_BUCKET_NAME)",
    readEnv("S3_BUCKET_NAME", "R2_BUCKET_NAME"),
  );
}

function getPublicBaseUrl() {
  return requireEnv(
    "S3_PUBLIC_URL (or R2_PUBLIC_URL)",
    readEnv("S3_PUBLIC_URL", "R2_PUBLIC_URL"),
  ).replace(/\/$/, "");
}

function createClient(endpoint: string | undefined) {
  return new S3Client({
    region: storageRegion(),
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: storageForcePathStyle(),
    credentials: storageCredentials(),
  });
}

function getClient() {
  return createClient(storageEndpoint());
}

/**
 * Presigned URLs are signed for a specific host. For split deployments (for
 * example, the app reaches MinIO over an internal Docker hostname while the
 * fog-server must upload through a public hostname), set S3_PUBLIC_ENDPOINT.
 */
function getPresignClient() {
  return createClient(storagePublicEndpoint());
}

/** Uploads a public asset and returns its permanent public URL. */
export async function putPublicObject(
  key: string,
  body: Buffer,
  contentType: string,
) {
  const fullKey = `${STORAGE_PREFIX.public}/${key}`;
  // Resolve the public URL before uploading so a missing S3_PUBLIC_URL fails
  // fast instead of leaving an orphaned object that no record can reference.
  const publicUrl = publicUrlFor(fullKey);
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: fullKey,
      Body: body,
      ContentType: contentType,
    }),
  );
  return publicUrl;
}

/** Uploads a private asset and returns its storage key (not a URL). */
export async function putPrivateObject(
  key: string,
  body: Buffer,
  contentType: string,
) {
  const fullKey = `${STORAGE_PREFIX.private}/${key}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: fullKey,
      Body: body,
      ContentType: contentType,
    }),
  );
  return fullKey;
}

/**
 * Short-lived presigned PUT URL for a private object, used by the external
 * YOLOv8 fog-server to upload KTR evidence without ever holding our storage
 * credentials. The returned `key` is the full storage key (with the
 * `private/` prefix), which is exactly what `SmokingDetection.evidenceKey`
 * stores and what `getSignedPrivateUrl()` later signs for viewing.
 *
 * The caller must send the same `Content-Type` it requested when PUTting
 * the file - that header is part of the signature.
 */
export async function getSignedPrivateUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
) {
  const fullKey = `${STORAGE_PREFIX.private}/${key}`;
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: fullKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getPresignClient(), command, {
    expiresIn: expiresInSeconds,
  });
  return { uploadUrl, key: fullKey, expiresIn: expiresInSeconds };
}

function publicUrlFor(fullKey: string) {
  return `${getPublicBaseUrl()}/${fullKey}`;
}

/**
 * Short-lived signed URL for a private object. Callers must authorize the
 * request themselves before calling this - the signature only proves the
 * URL was minted by our server, not that the caller is allowed to see it.
 */
export async function getSignedPrivateUrl(key: string, expiresInSeconds = 300) {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(getPresignClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Evidence can be stored either as an object key (the target convention)
 * or, transitionally, as a full external URL (e.g. Cloudinary) supplied by
 * the AI pipeline. External URLs must be returned as-is; signing them as if
 * they were storage keys would produce a broken URL. Storage keys still get
 * a short-lived signed GET URL.
 */
export function isExternalEvidenceUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function resolveEvidenceUrl(key: string, expiresInSeconds = 300) {
  if (isExternalEvidenceUrl(key)) return key;
  return getSignedPrivateUrl(key, expiresInSeconds);
}

export async function deleteObject(key: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/**
 * Recovers the object key (e.g. `public/facilities/homestay/...`) from a
 * URL previously returned by `putPublicObject`, so callers that only stored
 * the public URL on a record can still delete the underlying object. Returns
 * null if the URL doesn't match the configured public base URL.
 */
export function keyFromPublicUrl(url: string): string | null {
  const base = readEnv("S3_PUBLIC_URL", "R2_PUBLIC_URL")?.replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
}

export function isStorageConfigured() {
  return Boolean(
    readEnv("S3_BUCKET_NAME", "R2_BUCKET_NAME") &&
      readEnv("S3_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID") &&
      readEnv("S3_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"),
  );
}
