import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function loadEnvTest() {
  const file = resolve(process.cwd(), ".env.test");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
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
    if (!process.env[key]) process.env[key] = val;
  }
}

export async function assertTestDatabaseReachable() {
  if (process.env.SKIP_TEST_DB_CHECK === "1") return;

  loadEnvTest();
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error(
      "DATABASE_URL is missing. Copy web/.env.test or run tests via npm run test:local."
    );
  }

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("SELECT 1");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        "Postgres integration database is not reachable.",
        `DATABASE_URL=${url}`,
        `Cause: ${message}`,
        "",
        "Start the IT database (same as CI):",
        "  cd web && npm run test:db:up && npm run test:db:migrate",
        "",
        "Or run the full local suite (starts DB automatically):",
        "  cd web && npm run test:local",
      ].join("\n")
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

export default async function globalSetup() {
  await assertTestDatabaseReachable();
}
