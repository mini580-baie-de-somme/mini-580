import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  incrementBuildCounter,
  parseSemver,
  readBuildCounter,
  resolveNextBuildVersion,
  writeBuildCounter,
} from "../../../scripts/build-version-lib.mjs";

describe("build-version-lib", () => {
  let tempDir: string;

  afterEach(() => {
    tempDir = "";
  });

  function tempFiles(versions: string, counter: string) {
    tempDir = mkdtempSync(join(tmpdir(), "mini580-build-version-"));
    const versionsFile = join(tempDir, "versions.json");
    const counterFile = join(tempDir, "build-counter.json");
    writeFileSync(versionsFile, versions);
    writeFileSync(counterFile, counter);
    return { versionsFile, counterFile };
  }

  it("resets patch to 0 when major.minor line changes", () => {
    const next = incrementBuildCounter(parseSemver("1.1.0"), {
      line: "1.0",
      patch: 89,
    });
    expect(next.version).toBe("1.1.0");
    expect(next.counter).toEqual({ line: "1.1", patch: 0 });
  });

  it("increments patch on the same minor line", () => {
    const first = incrementBuildCounter(parseSemver("1.1.0"), {
      line: "1.1",
      patch: 0,
    });
    expect(first.version).toBe("1.1.1");

    const second = incrementBuildCounter(parseSemver("1.1.0"), first.counter);
    expect(second.version).toBe("1.1.2");
    expect(second.counter).toEqual({ line: "1.1", patch: 2 });
  });

  it("persists counter when requested", () => {
    const { versionsFile, counterFile } = tempFiles(
      JSON.stringify({ fe: "1.1.0", be: "1.1.0" }, null, 2) + "\n",
      JSON.stringify({ line: "1.0", patch: 89 }, null, 2) + "\n"
    );

    const next = resolveNextBuildVersion({
      versionsFile,
      counterFile,
      persist: true,
    });

    expect(next.version).toBe("1.1.0");
    expect(readBuildCounter(counterFile)).toEqual({ line: "1.1", patch: 0 });
  });

  it("dry-run leaves counter unchanged", () => {
    const { versionsFile, counterFile } = tempFiles(
      JSON.stringify({ fe: "1.1.0", be: "1.1.0" }, null, 2) + "\n",
      JSON.stringify({ line: "1.1", patch: 0 }, null, 2) + "\n"
    );

    const next = resolveNextBuildVersion({
      versionsFile,
      counterFile,
      persist: false,
    });

    expect(next.version).toBe("1.1.1");
    expect(readBuildCounter(counterFile)).toEqual({ line: "1.1", patch: 0 });
  });

  it("starts at patch 0 when counter file is missing", () => {
    tempDir = mkdtempSync(join(tmpdir(), "mini580-build-version-"));
    const versionsFile = join(tempDir, "versions.json");
    const counterFile = join(tempDir, "missing-counter.json");
    writeFileSync(
      versionsFile,
      `${JSON.stringify({ fe: "2.0.0", be: "2.0.0" }, null, 2)}\n`
    );

    const next = resolveNextBuildVersion({
      versionsFile,
      counterFile,
      persist: true,
    });

    expect(next.version).toBe("2.0.0");
    expect(readBuildCounter(counterFile)).toEqual({ line: "2.0", patch: 0 });
  });

  it("writeBuildCounter stores valid JSON", () => {
    tempDir = mkdtempSync(join(tmpdir(), "mini580-build-version-"));
    const counterFile = join(tempDir, "build-counter.json");
    writeBuildCounter({ line: "1.1", patch: 3 }, counterFile);
    expect(readBuildCounter(counterFile)).toEqual({ line: "1.1", patch: 3 });
  });
});
