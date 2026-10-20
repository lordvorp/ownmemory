import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "@xenova/transformers",
    "onnxruntime-node",
  ],
  // Keep Turbopack rooted on this repo (parent /home/rob/work has its own lockfile).
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
