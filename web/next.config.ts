import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@cursor/sdk", "sharp", "node-edge-tts"],
  outputFileTracingIncludes: {
    "/api/telegram/webhook": [
      "./node_modules/node-edge-tts/**/*",
      "./node_modules/ws/**/*",
      "./node_modules/https-proxy-agent/**/*",
      "./node_modules/agent-base/**/*",
      "./node_modules/yargs/**/*",
      "./node_modules/yargs-parser/**/*",
      "./node_modules/cliui/**/*",
      "./node_modules/escalade/**/*",
      "./node_modules/get-caller-file/**/*",
      "./node_modules/require-directory/**/*",
      "./node_modules/string-width/**/*",
      "./node_modules/strip-ansi/**/*",
      "./node_modules/wrap-ansi/**/*",
    ],
  },
};

export default nextConfig;
