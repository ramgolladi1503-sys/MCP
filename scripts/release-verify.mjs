#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(repoRoot, "packages");
const expectedVersion = process.env.MCP_SHIELD_EXPECTED_VERSION;
const allowZeroVersion = process.env.MCP_SHIELD_ALLOW_ZERO_VERSION === "1";
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(message) {
  process.stderr.write(`Release verification failed: ${message}\n`);
  process.exit(1);
}

function listWorkspacePackages() {
  return readdirSync(packagesDir)
    .map((name) => join(packagesDir, name))
    .filter((path) => statSync(path).isDirectory())
    .map((dir) => ({ dir, packageJsonPath: join(dir, "package.json") }))
    .map((entry) => ({ ...entry, manifest: readJson(entry.packageJsonPath) }))
    .filter((entry) => entry.manifest.private !== true);
}

const packages = listWorkspacePackages();

if (packages.length === 0) {
  fail("No publishable packages found under packages/*.");
}

const names = packages.map((entry) => entry.manifest.name).sort();
for (const name of names) {
  if (typeof name !== "string" || !name.startsWith("@mcp-shield/")) {
    fail(`Unexpected package name '${name}'. Expected @mcp-shield/* packages only.`);
  }
}

const versions = [...new Set(packages.map((entry) => entry.manifest.version))];
if (versions.length !== 1) {
  fail(`Workspace package versions must match. Found: ${versions.join(", ")}`);
}

const version = versions[0];
if (typeof version !== "string" || !semverPattern.test(version)) {
  fail(`Invalid package version '${String(version)}'. Use semver like 0.1.0 or 0.1.0-beta.1.`);
}

if (version === "0.0.0" && !allowZeroVersion) {
  fail("Refusing to publish version 0.0.0. Bump package versions first, or set MCP_SHIELD_ALLOW_ZERO_VERSION=1 for dry-run only.");
}

if (expectedVersion && expectedVersion !== version) {
  fail(`Expected version ${expectedVersion}, but workspace packages are ${version}.`);
}

for (const entry of packages) {
  const manifest = entry.manifest;
  if (!manifest.main || !String(manifest.main).startsWith("dist/")) {
    fail(`${manifest.name} must publish built dist entrypoint via main.`);
  }
  if (!manifest.types || !String(manifest.types).startsWith("dist/")) {
    fail(`${manifest.name} must publish built dist typings via types.`);
  }

  const dependencySections = ["dependencies", "peerDependencies", "optionalDependencies"];
  for (const section of dependencySections) {
    const deps = manifest[section] ?? {};
    for (const [depName, depVersion] of Object.entries(deps)) {
      if (depName.startsWith("@mcp-shield/") && depVersion !== "workspace:*") {
        fail(`${manifest.name} ${section}.${depName} must use workspace:* before publish.`);
      }
    }
  }
}

process.stdout.write("Release verification passed.\n");
process.stdout.write(`Version: ${version}\n`);
process.stdout.write("Packages:\n");
for (const name of names) {
  process.stdout.write(`- ${name}\n`);
}
