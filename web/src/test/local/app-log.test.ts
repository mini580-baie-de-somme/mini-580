import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appLog,
  resetLogLevelCache,
  resolveLogLevel,
  shouldLog,
} from "@/lib/app-log";

describe("app-log", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    resetLogLevelCache();
    vi.restoreAllMocks();
  });

  it("defaults to debug for dev/test environments", () => {
    delete process.env.LOG_LEVEL;
    delete process.env.NEXT_PUBLIC_LOG_LEVEL;
    delete process.env.SYNC_ENV;
    process.env.SITE_URL = "https://test.classmini580.blog";
    resetLogLevelCache();
    expect(resolveLogLevel()).toBe("debug");
  });

  it("defaults to warn for prod SYNC_ENV", () => {
    delete process.env.LOG_LEVEL;
    process.env.SYNC_ENV = "prod";
    resetLogLevelCache();
    expect(resolveLogLevel()).toBe("warn");
  });

  it("defaults to warn when SITE_URL has no test segment", () => {
    delete process.env.LOG_LEVEL;
    delete process.env.SYNC_ENV;
    process.env.SITE_URL = "https://classmini580.blog";
    resetLogLevelCache();
    expect(resolveLogLevel()).toBe("warn");
  });

  it("respects explicit LOG_LEVEL over environment heuristics", () => {
    process.env.LOG_LEVEL = "error";
    process.env.SYNC_ENV = "test";
    resetLogLevelCache();
    expect(resolveLogLevel()).toBe("error");
  });

  it("filters messages below the resolved threshold", () => {
    process.env.LOG_LEVEL = "warn";
    resetLogLevelCache();
    expect(shouldLog("debug")).toBe(false);
    expect(shouldLog("warn")).toBe(true);
    expect(shouldLog("error")).toBe(true);
  });

  it("appLog skips output when level is below threshold", () => {
    process.env.LOG_LEVEL = "error";
    resetLogLevelCache();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    appLog("test-channel", "info", "hidden");
    appLog("test-channel", "error", "visible");

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
