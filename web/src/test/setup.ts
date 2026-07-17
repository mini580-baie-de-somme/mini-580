import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

function loadEnvFile(file: string, { override = true }: { override?: boolean } = {}) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!override && process.env[key]) continue;
    process.env[key] = val;
  }
}

// Base IT DB / auth
loadEnvFile(resolve(process.cwd(), ".env.test"));
// Cursor key for real IA translation (never commit — .env.* gitignored except .env.test)
loadEnvFile(resolve(process.cwd(), ".env.cursor.local"));
loadEnvFile("/tmp/mini580-cursor.env");

process.env.MEDIA_ROOT =
  process.env.MEDIA_ROOT || resolve(process.cwd(), "data/media-it");
