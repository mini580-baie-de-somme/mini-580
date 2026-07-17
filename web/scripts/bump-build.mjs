#!/usr/bin/env node
/**
 * Auto-increment the patch (build) segment of FE and/or BE versions.
 * Major and minor are edited manually in versions.json.
 *
 * Env:
 *   BUILD_NUMBER / GITHUB_RUN_NUMBER — if set, use as patch instead of +1
 *   BUMP_TARGET — "fe" | "be" | "all" (default: all)
 */
import { readFileSync, writeFileSync } from "node:fs";
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

function bumpPatch(version, buildNumber) {
  const parts = parseSemver(version);
  if (buildNumber !== null) {
    parts.patch = buildNumber;
  } else {
    parts.patch += 1;
  }
  return formatSemver(parts);
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

const target = process.env.BUMP_TARGET || "all";
if (!["fe", "be", "all"].includes(target)) {
  throw new Error(`Invalid BUMP_TARGET: ${target}`);
}

const buildNumber = resolveBuildNumber();
const versions = JSON.parse(readFileSync(versionsPath, "utf8"));

if (typeof versions.fe !== "string" || typeof versions.be !== "string") {
  throw new Error("versions.json must contain string fields fe and be");
}

if (target === "all" || target === "fe") {
  versions.fe = bumpPatch(versions.fe, buildNumber);
}
if (target === "all" || target === "be") {
  versions.be = bumpPatch(versions.be, buildNumber);
}

writeFileSync(versionsPath, `${JSON.stringify(versions, null, 2)}\n`);
console.log(`Versions bumped → FE v${versions.fe} / BE v${versions.be}`);
