import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  fetchWithNetworkRetry,
  isNetworkFetchError,
} from "@/lib/fetch-with-network-retry";
import { waitForMediaRebake } from "@/lib/wait-for-media-rebake";

describe("isNetworkFetchError", () => {
  it("detects Failed to fetch", () => {
    expect(isNetworkFetchError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("detects Firefox network error", () => {
    expect(
      isNetworkFetchError(
        new TypeError("NetworkError when attempting to fetch resource.")
      )
    ).toBe(true);
  });

  it("detects UploadNetworkError", () => {
    const err = new TypeError("Failed to fetch");
    err.name = "UploadNetworkError";
    expect(isNetworkFetchError(err)).toBe(true);
  });
});

describe("fetchWithNetworkRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries transient fetch failures", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithNetworkRetry("/api/test", {}, { baseDelayMs: 1 });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("waitForMediaRebake", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns when variant URLs rotate", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "m1",
            urlMoyenne: "/media/new/moyenne.webp",
          })
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const promise = waitForMediaRebake(
      "m1",
      { urlMoyenne: "/media/old/moyenne.webp" },
      { intervalMs: 100, maxMs: 5000 }
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    expect(result?.urlMoyenne).toBe("/media/new/moyenne.webp");
  });

  it("skips invalid JSON responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("<html>error</html>"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "m1",
            urlMoyenne: "/media/new/moyenne.webp",
          })
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const promise = waitForMediaRebake(
      "m1",
      { urlMoyenne: "/media/old/moyenne.webp" },
      { intervalMs: 100, maxMs: 5000 }
    );
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result?.urlMoyenne).toBe("/media/new/moyenne.webp");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
