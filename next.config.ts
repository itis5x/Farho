import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: { unoptimized: true },
};

export default nextConfig;
