import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) used for Azure deployment.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: { unoptimized: true },
};

export default nextConfig;
