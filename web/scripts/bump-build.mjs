#!/usr/bin/env node
/**
 * Bake FE/BE versions into versions.json at Docker build time.
 *
 * Env:
 *   BUILD_VERSION — exact semver from CI (Deploy TEST); no counter increment here
 *   BUMP_TARGET — "fe" | "be" | "all" (default: all)
 *
 * Local `npm run build` without BUILD_VERSION increments patch by 1 in versions.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatSemver, parseSemver } from "./build-version-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionsPath = join(__dirname, "..", "versions.json");

function bumpPatch(version) {
  const parts = parseSemver(version);
  parts.patch += 1;
  return formatSemver(parts);
}

function resolveBuildVersion() {
  const raw = process.env.BUILD_VERSION?.trim();
  if (!raw) return null;
  parseSemver(raw);
  return raw;
}

const target = process.env.BUMP_TARGET || "all";
if (!["fe", "be", "all"].includes(target)) {
  throw new Error(`Invalid BUMP_TARGET: ${target}`);
}

const buildVersion = resolveBuildVersion();
const versions = JSON.parse(readFileSync(versionsPath, "utf8"));

if (typeof versions.fe !== "string" || typeof versions.be !== "string") {
  throw new Error("versions.json must contain string fields fe and be");
}

if (buildVersion) {
  if (target === "all" || target === "fe") versions.fe = buildVersion;
  if (target === "all" || target === "be") versions.be = buildVersion;
} else {
  if (target === "all" || target === "fe") versions.fe = bumpPatch(versions.fe);
  if (target === "all" || target === "be") versions.be = bumpPatch(versions.be);
}

writeFileSync(versionsPath, `${JSON.stringify(versions, null, 2)}\n`);
console.log(`Versions bumped → FE v${versions.fe} / BE v${versions.be}`);
