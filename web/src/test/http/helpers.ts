/**
 * Real HTTP client against a live environment (TEST by default).
 * Requires env — suite FAILS (does not skip) if missing.
 */
export type HttpEnv = {
  baseUrl: string;
  ingestApiKey: string;
  adminEmail: string;
  adminPassword: string;
};

export function requireHttpEnv(): HttpEnv {
  const baseUrl = (process.env.TEST_BASE_URL || "").replace(/\/$/, "");
  // Prefer TEST_INGEST_API_KEY only — never fall back to .env.test INGEST_API_KEY
  // (that local IT key is invalid against the live TEST server).
  const ingestApiKey = process.env.TEST_INGEST_API_KEY || "";
  const adminEmail =
    process.env.TEST_ADMIN_EMAIL ||
    process.env.SEED_ADMIN_EMAIL ||
    "admin@classmini580.blog";
  const adminPassword =
    process.env.TEST_ADMIN_PASSWORD ||
    process.env.SEED_ADMIN_PASSWORD ||
    "";

  const missing: string[] = [];
  if (!baseUrl) missing.push("TEST_BASE_URL");
  if (!ingestApiKey || ingestApiKey.length < 16) missing.push("TEST_INGEST_API_KEY");
  if (!adminPassword) missing.push("TEST_ADMIN_PASSWORD");

  if (missing.length) {
    throw new Error(
      `HTTP integration suite requires: ${missing.join(", ")}. ` +
        `Example: TEST_BASE_URL=https://test.classmini580.blog TEST_INGEST_API_KEY=… TEST_ADMIN_PASSWORD=…`
    );
  }

  return { baseUrl, ingestApiKey, adminEmail, adminPassword };
}

export async function httpJson(
  env: HttpEnv,
  path: string,
  init: RequestInit & { bearer?: boolean; cookie?: string } = {}
): Promise<{ status: number; json: unknown; headers: Headers; cookies: string[] }> {
  const headers = new Headers(init.headers);
  if (init.bearer) {
    headers.set("Authorization", `Bearer ${env.ingestApiKey}`);
  }
  if (init.cookie) {
    headers.set("Cookie", init.cookie);
  }
  if (init.body && !headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${env.baseUrl}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });

  const setCookies = res.headers.getSetCookie?.() ?? [];
  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { _raw: text };
    }
  }
  return { status: res.status, json, headers: res.headers, cookies: setCookies };
}

export async function loginSession(env: HttpEnv): Promise<string> {
  const res = await httpJson(env, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: env.adminEmail,
      password: env.adminPassword,
    }),
  });
  if (res.status !== 200) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(res.json)}`);
  }
  const cookie = res.cookies.find((c) => c.startsWith("mini580_session="));
  if (!cookie) {
    // Some runtimes fold Set-Cookie; try parsing from a single header
    const raw = res.headers.get("set-cookie") || "";
    const match = /mini580_session=[^;]+/.exec(raw);
    if (!match) {
      throw new Error("Login OK but no mini580_session cookie returned");
    }
    return match[0];
  }
  return cookie.split(";")[0];
}

export async function pollSyncJob(
  env: HttpEnv,
  cookie: string,
  jobId: string,
  timeoutMs = 120_000
): Promise<Record<string, unknown>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await httpJson(env, `/api/sync/jobs/${jobId}`, { cookie });
    if (res.status !== 200) {
      throw new Error(`Job poll failed: ${res.status}`);
    }
    const body = res.json as { job?: Record<string, unknown> };
    const job = body.job;
    if (!job) throw new Error("No job in response");
    const status = String(job.status);
    if (status === "COMPLETED" || status === "FAILED") {
      return job;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Sync job ${jobId} timed out after ${timeoutMs}ms`);
}
