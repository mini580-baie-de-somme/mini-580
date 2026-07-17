import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/local/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    fileParallelism: false,
    pool: "forks",
    testTimeout: 180_000,
    hookTimeout: 120_000,
    env: {
      // Loaded fully in setup.ts from .env.test
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
