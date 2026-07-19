#!/usr/bin/env node
/**
 * Increment repo build-counter.json and print the semver for the next TEST deploy.
 *
 * Usage: node scripts/increment-build-counter.mjs [--dry-run]
 */
import { resolveNextBuildVersion } from "./build-version-lib.mjs";

const dryRun = process.argv.includes("--dry-run");

const { version } = resolveNextBuildVersion({ persist: !dryRun });
process.stdout.write(version);
