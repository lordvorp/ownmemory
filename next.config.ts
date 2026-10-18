import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "@xenova/transformers",
    "onnxruntime-node",
  ],
};

export default nextConfig;
