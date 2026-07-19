#!/usr/bin/env node
/**
 * Print the semver that the next TEST deploy would produce (dry-run, no counter write).
 *
 * Usage: node scripts/compute-build-version.mjs
 */
import { resolveNextBuildVersion } from "./build-version-lib.mjs";

const { version } = resolveNextBuildVersion({ persist: false });
process.stdout.write(version);
