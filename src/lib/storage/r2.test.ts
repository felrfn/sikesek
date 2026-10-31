import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  isExternalEvidenceUrl,
  resolveEvidenceUrl,
} from "./r2";

const mockedGetSignedUrl = vi.mocked(getSignedUrl);

describe("KTR evidence URL resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_ACCOUNT_ID = "r2-account";
    process.env.R2_ACCESS_KEY_ID = "r2-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "r2-secret-key";
    process.env.R2_BUCKET_NAME = "r2-bucket";
    process.env.R2_PUBLIC_URL = "https://public.example";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
  });

  it("recognizes full external evidence URLs", () => {
    expect(isExternalEvidenceUrl("https://res.cloudinary.com/account/image.jpg")).toBe(true);
    expect(isExternalEvidenceUrl("http://cdn.example/evidence.jpg")).toBe(true);
  });

  it("recognizes relative R2 keys as internal", () => {
    expect(isExternalEvidenceUrl("private/ktr/evidence/area/frame.jpg")).toBe(false);
  });

  it("returns an external evidence URL as-is without signing it", async () => {
    const externalUrl =
      "https://res.cloudinary.com/account/image/upload/v1793458053/sikesek_bukti/frame.jpg";

    await expect(resolveEvidenceUrl(externalUrl)).resolves.toBe(externalUrl);
    expect(mockedGetSignedUrl).not.toHaveBeenCalled();
  });

  it("resolves an internal R2 key through the signed URL", async () => {
    mockedGetSignedUrl.mockResolvedValue("https://signed.example/private/ktr/evidence/frame.jpg");

    await expect(resolveEvidenceUrl("private/ktr/evidence/area/frame.jpg")).resolves.toBe(
      "https://signed.example/private/ktr/evidence/frame.jpg",
    );
    expect(mockedGetSignedUrl).toHaveBeenCalled();
  });
});
