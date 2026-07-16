import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/http/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    fileParallelism: false,
    pool: "forks",
    testTimeout: 200_000,
    hookTimeout: 60_000,
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
