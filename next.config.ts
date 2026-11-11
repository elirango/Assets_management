import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile in a parent directory isn't picked up.
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  // Meter photos go through server actions (recognition + save). The client scales them to
  // ~1600px JPEG (a few hundred KB); 5mb covers an unscaled fallback up to METER_PHOTO_MAX_BYTES.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
