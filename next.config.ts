import type { NextConfig } from "next";

// R2_PUBLIC_URL is optional in dev (see docs/STORAGE.md) - next/image blocks
// any remote hostname that isn't explicitly allow-listed, so this derives
// the pattern from the configured bucket URL instead of hardcoding one.
function r2RemotePattern() {
  if (!process.env.R2_PUBLIC_URL) return undefined;
  try {
    return new URL(`${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/public/**`);
  } catch {
    return undefined;
  }
}

const r2Pattern = r2RemotePattern();

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: r2Pattern ? [r2Pattern] : [],
  },
};

export default nextConfig;
