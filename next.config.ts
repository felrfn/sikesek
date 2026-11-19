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

// next/image refuses to optimize images whose hostname resolves to a private
// IP (SSRF protection). That is the normal case for a local MinIO/AIStor
// bucket, so only relax it when the configured public storage URL really is a
// local address - production buckets behind a public hostname stay protected.
function isPrivateStorageHost() {
  const publicUrl = storagePublicUrl();
  if (!publicUrl) return false;
  let hostname: string;
  try {
    hostname = new URL(publicUrl).hostname;
  } catch {
    return false;
  }
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

const storagePattern = storageRemotePattern();

const nextConfig: NextConfig = {
  // Self-contained server output for the VPS Docker image. Vercel keeps its
  // normal build output because the deploy workflow is the only place that
  // sets BUILD_TARGET=docker.
  ...(process.env.BUILD_TARGET === "docker"
    ? { output: "standalone" as const }
    : {}),
  turbopack: {
    root: __dirname,
  },
  // Facility photos cap at 1 MB (see features/facilities/imageRules.ts) -
  // the action body limit counts the whole multipart payload, so it sits a
  // notch above the file limit to leave room for encoding overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    remotePatterns: storagePattern ? [storagePattern] : [],
    ...(isPrivateStorageHost() ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
