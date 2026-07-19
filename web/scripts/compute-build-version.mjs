#!/usr/bin/env node
/**
 * Compute the semver baked into Docker images at build time.
 * Major/minor from versions.json; patch = BUILD_NUMBER (CI run number on TEST deploy).
 *
 * Usage: BUILD_NUMBER=89 node scripts/compute-build-version.mjs
 * Prints one line: e.g. 1.0.89
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionsPath = join(__dirname, "..", "versions.json");

function parseSemver(version) {
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

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function resolveBuildNumber() {
  const raw = process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || "";
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid BUILD_NUMBER: ${raw}`);
  }
  return n;
}

function computeBuildVersion(baseVersion, buildNumber) {
  const parts = parseSemver(baseVersion);
  if (buildNumber !== null) {
    parts.patch = buildNumber;
  } else {
    parts.patch += 1;
  }
  return formatSemver(parts);
}

const buildNumber = resolveBuildNumber();
const versions = JSON.parse(readFileSync(versionsPath, "utf8"));

if (typeof versions.be !== "string") {
  throw new Error("versions.json must contain string field be");
}

process.stdout.write(computeBuildVersion(versions.be, buildNumber));
