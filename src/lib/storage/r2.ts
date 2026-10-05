import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Single R2 bucket, split by key prefix (see docs/STORAGE.md):
 *   public/...   - safe to expose directly, served via R2_PUBLIC_URL
 *   private/...  - never given out as a direct URL; always a short-lived
 *                  signed GET URL generated on demand for an authorized
 *                  request.
 */
export const STORAGE_PREFIX = {
  public: "public",
  private: "private",
} as const;

function getClient() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new StorageNotConfiguredError(
      `${name} is not configured - object storage is unavailable`,
    );
  }
  return value;
}

export class StorageNotConfiguredError extends Error {}

function getBucket() {
  return requireEnv("R2_BUCKET_NAME");
}

/** Uploads a public asset and returns its permanent public URL. */
export async function putPublicObject(
  key: string,
  body: Buffer,
  contentType: string,
) {
  const fullKey = `${STORAGE_PREFIX.public}/${key}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: fullKey,
      Body: body,
      ContentType: contentType,
    }),
  );
  return publicUrlFor(fullKey);
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

function publicUrlFor(fullKey: string) {
  const base = requireEnv("R2_PUBLIC_URL").replace(/\/$/, "");
  return `${base}/${fullKey}`;
}

/**
 * Short-lived signed URL for a private object. Callers must authorize the
 * request themselves before calling this - the signature only proves the
 * URL was minted by our server, not that the caller is allowed to see it.
 */
export async function getSignedPrivateUrl(key: string, expiresInSeconds = 300) {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(key: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/**
 * Recovers the R2 object key (e.g. `public/facilities/homestay/...`) from a
 * URL previously returned by `putPublicObject`, so callers that only stored
 * the public URL on a record can still delete the underlying object. Returns
 * null if the URL doesn't match the configured `R2_PUBLIC_URL` base.
 */
export function keyFromPublicUrl(url: string): string | null {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
}

export function isStorageConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}
