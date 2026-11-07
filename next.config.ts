import type { NextConfig } from "next";

// The public storage URL is optional in dev (see docs/STORAGE.md) - next/image
// blocks any remote hostname that isn't explicitly allow-listed, so this
// derives the pattern from the configured S3-compatible bucket instead of
// hardcoding a provider hostname. R2_PUBLIC_URL remains a migration fallback.
function storagePublicUrl() {
  return process.env.S3_PUBLIC_URL ?? process.env.R2_PUBLIC_URL;
}

function storageRemotePattern() {
  const publicUrl = storagePublicUrl();
  if (!publicUrl) return undefined;
  try {
    return new URL(`${publicUrl.replace(/\/$/, "")}/public/**`);
  } catch {
    return undefined;
  }
}

const storagePattern = storageRemotePattern();

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: storagePattern ? [storagePattern] : [],
  },
};

export default nextConfig;
