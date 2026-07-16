import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

function loadEnvFile(file: string) {
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
    // .env.test wins for integration suite
    process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.test"));

process.env.MEDIA_ROOT =
  process.env.MEDIA_ROOT || resolve(process.cwd(), "data/media-it");
