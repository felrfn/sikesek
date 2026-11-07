import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, s3ClientMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  s3ClientMock: vi.fn(() => ({ send: sendMock })),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: s3ClientMock,
  PutObjectCommand: vi.fn((input: unknown) => ({ input })),
  GetObjectCommand: vi.fn((input: unknown) => ({ input })),
  DeleteObjectCommand: vi.fn((input: unknown) => ({ input })),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  isExternalEvidenceUrl,
  isStorageConfigured,
  keyFromPublicUrl,
  putPublicObject,
  resolveEvidenceUrl,
} from "./objectStorage";

const mockedGetSignedUrl = vi.mocked(getSignedUrl);

const STORAGE_ENV_KEYS = [
  "S3_ENDPOINT",
  "S3_PUBLIC_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET_NAME",
  "S3_PUBLIC_URL",
  "S3_FORCE_PATH_STYLE",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
];

function clearStorageEnv() {
  for (const key of STORAGE_ENV_KEYS) delete process.env[key];
}

describe("object storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStorageEnv();
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_REGION = "ap-southeast-1";
    process.env.S3_ACCESS_KEY_ID = "s3-access-key";
    process.env.S3_SECRET_ACCESS_KEY = "s3-secret-key";
    process.env.S3_BUCKET_NAME = "s3-bucket";
    process.env.S3_PUBLIC_URL = "https://public.example";
    process.env.S3_FORCE_PATH_STYLE = "true";
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearStorageEnv();
  });

  it("recognizes full external evidence URLs", () => {
    expect(isExternalEvidenceUrl("https://res.cloudinary.com/account/image.jpg")).toBe(true);
    expect(isExternalEvidenceUrl("http://cdn.example/evidence.jpg")).toBe(true);
  });

  it("recognizes relative keys as internal", () => {
    expect(isExternalEvidenceUrl("private/ktr/evidence/area/frame.jpg")).toBe(false);
  });

  it("returns an external evidence URL as-is without signing it", async () => {
    const externalUrl =
      "https://res.cloudinary.com/account/image/upload/v1793458053/sikesek_bukti/frame.jpg";

    await expect(resolveEvidenceUrl(externalUrl)).resolves.toBe(externalUrl);
    expect(mockedGetSignedUrl).not.toHaveBeenCalled();
  });

  it("resolves an internal key through the signed URL", async () => {
    mockedGetSignedUrl.mockResolvedValue("https://signed.example/private/ktr/evidence/frame.jpg");

    await expect(resolveEvidenceUrl("private/ktr/evidence/area/frame.jpg")).resolves.toBe(
      "https://signed.example/private/ktr/evidence/frame.jpg",
    );
    expect(mockedGetSignedUrl).toHaveBeenCalled();
  });

  it("derives keys from the configured public base URL", () => {
    expect(keyFromPublicUrl("https://public.example/public/facilities/x.jpg")).toBe(
      "public/facilities/x.jpg",
    );
    expect(keyFromPublicUrl("https://other.example/public/facilities/x.jpg")).toBeNull();
  });

  it("reports configured when generic S3 env is present", () => {
    expect(isStorageConfigured()).toBe(true);
  });

  it("uploads with the generic S3 configuration", async () => {
    await expect(
      putPublicObject("facilities/x.jpg", Buffer.from("x"), "image/jpeg"),
    ).resolves.toBe("https://public.example/public/facilities/x.jpg");

    expect(s3ClientMock).toHaveBeenCalledWith({
      region: "ap-southeast-1",
      endpoint: "https://s3.example.com",
      forcePathStyle: true,
      credentials: {
        accessKeyId: "s3-access-key",
        secretAccessKey: "s3-secret-key",
      },
    });
    expect(sendMock).toHaveBeenCalled();
  });

  it("falls back to legacy R2 env when S3 env is absent", async () => {
    clearStorageEnv();
    process.env.R2_ACCOUNT_ID = "r2-account";
    process.env.R2_ACCESS_KEY_ID = "r2-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "r2-secret-key";
    process.env.R2_BUCKET_NAME = "r2-bucket";
    process.env.R2_PUBLIC_URL = "https://r2-public.example";

    mockedGetSignedUrl.mockResolvedValue("https://signed.example/private/x.jpg");

    await expect(resolveEvidenceUrl("private/x.jpg")).resolves.toBe(
      "https://signed.example/private/x.jpg",
    );

    expect(s3ClientMock).toHaveBeenCalledWith({
      region: "auto",
      endpoint: "https://r2-account.r2.cloudflarestorage.com",
      forcePathStyle: false,
      credentials: {
        accessKeyId: "r2-access-key",
        secretAccessKey: "r2-secret-key",
      },
    });
  });
});
