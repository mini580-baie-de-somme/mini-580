import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@cursor/sdk", "sharp"],
};

export default nextConfig;
