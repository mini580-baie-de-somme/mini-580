/**
 * Shared semver helpers for CI build versioning.
 * Major/minor base from web/versions.json; patch from build-counter.json (per minor line).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const versionsPath = join(__dirname, "..", "versions.json");
export const buildCounterPath = join(__dirname, "..", "..", "build-counter.json");

export function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) {
    throw new Error(`Invalid semver (expected major.minor.patch): ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

export function lineKey({ major, minor }) {
  return `${major}.${minor}`;
}

export function readVersionsBase(path = versionsPath) {
  const versions = JSON.parse(readFileSync(path, "utf8"));
  if (typeof versions.be !== "string") {
    throw new Error("versions.json must contain string field be");
  }
  return parseSemver(versions.be);
}

export function readBuildCounter(path = buildCounterPath) {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (typeof raw.line !== "string" && raw.line !== null) {
      throw new Error("build-counter.json field line must be a string or null");
    }
    if (typeof raw.patch !== "number" || !Number.isInteger(raw.patch) || raw.patch < -1) {
      throw new Error("build-counter.json field patch must be an integer >= -1");
    }
    return raw;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { line: null, patch: -1 };
    }
    throw error;
  }
}

export function writeBuildCounter(counter, path = buildCounterPath) {
  writeFileSync(path, `${JSON.stringify(counter, null, 2)}\n`);
}

/**
 * Compute the next TEST build version and updated counter state.
 * Resets patch to 0 when major.minor line changes in versions.json.
 */
export function incrementBuildCounter(baseParts, counter) {
  const line = lineKey(baseParts);
  let patch;
  if (counter.line !== line) {
    patch = 0;
  } else {
    patch = counter.patch + 1;
  }
  return {
    version: formatSemver({
      major: baseParts.major,
      minor: baseParts.minor,
      patch,
    }),
    counter: { line, patch },
  };
}

export function resolveNextBuildVersion({
  versionsFile = versionsPath,
  counterFile = buildCounterPath,
  persist = false,
} = {}) {
  const base = readVersionsBase(versionsFile);
  const counter = readBuildCounter(counterFile);
  const next = incrementBuildCounter(base, counter);
  if (persist) {
    writeBuildCounter(next.counter, counterFile);
  }
  return next;
}
