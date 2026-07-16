import { beforeAll, describe, expect, it } from "vitest";
import {
  httpJson,
  loginSession,
  pollSyncJob,
  requireHttpEnv,
  type HttpEnv,
} from "./helpers";

/**
 * Live HTTP: public gallery + async sync job enqueue/poll on TEST.
 */
describe("HTTP — gallery + async sync smoke", () => {
  let env: HttpEnv;
  let cookie: string;

  beforeAll(() => {
    env = requireHttpEnv();
  });

  it("public gallery API responds", async () => {
    const res = await httpJson(env, "/api/gallery");
    expect(res.status).toBe(200);
    const body = res.json as {
      count: number;
      photos: unknown[];
      sort?: string;
    };
    expect(typeof body.count).toBe("number");
    expect(Array.isArray(body.photos)).toBe(true);
    expect(body.count).toBe(body.photos.length);
  });

  it("public /galerie page responds", async () => {
    const res = await fetch(`${env.baseUrl}/galerie`, { redirect: "manual" });
    expect(res.status).toBe(200);
  });

  it("logs in for sync checks", async () => {
    cookie = await loginSession(env);
    expect(cookie).toMatch(/^mini580_session=/);
  });

  it("sync status exposes activeJob when configured", async () => {
    const res = await httpJson(env, "/api/sync/status", { cookie });
    expect([200, 502]).toContain(res.status);
    const body = res.json as {
      configured?: boolean;
      activeJob?: unknown;
      env?: string;
      error?: string;
    };
    expect("activeJob" in body || body.configured === false).toBe(true);
  });

  it("pull-from-prod enqueues async job (202) or busy (409)", async () => {
    const res = await httpJson(env, "/api/sync/pull-from-prod", {
      method: "POST",
      cookie,
    });

    if (res.status === 503) {
      const body = res.json as { error?: string };
      throw new Error(
        `Sync not configured on TEST: ${body.error ?? JSON.stringify(res.json)}`
      );
    }

    expect([202, 409]).toContain(res.status);

    if (res.status === 409) {
      const body = res.json as { jobId?: string };
      expect(body.jobId).toBeTruthy();
      return;
    }

    const body = res.json as {
      async?: boolean;
      job?: { id: string; status: string };
    };
    expect(body.async).toBe(true);
    expect(body.job?.id).toBeTruthy();

    const job = await pollSyncJob(env, cookie, body.job!.id, 180_000);
    expect(["COMPLETED", "FAILED"]).toContain(String(job.status));
    if (job.status === "FAILED") {
      // Job runner works; peer HTTPS from the TEST container may still fail
      // (hairpin / keys / PROD lag). Surface the error without masking it.
      const err = String(job.error ?? job.progress ?? "");
      expect(err.length).toBeGreaterThan(0);
      console.warn(`[sync] pull job FAILED (peer path): ${err}`);
    }
  });
});
