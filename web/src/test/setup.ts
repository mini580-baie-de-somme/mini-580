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
// Cursor: prefer env already set (GitHub Actions secrets / shell export).
// Fallback local files only — never commit these.
if (!process.env.CURSOR_API_KEY?.trim()) {
  loadEnvFile(resolve(process.cwd(), ".env.cursor.local"));
  loadEnvFile("/tmp/mini580-cursor.env");
}
if (!process.env.CURSOR_MODEL?.trim()) {
  process.env.CURSOR_MODEL = "composer-2.5";
}

process.env.MEDIA_ROOT =
  process.env.MEDIA_ROOT || resolve(process.cwd(), "data/media-it");
