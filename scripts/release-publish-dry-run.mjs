#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = join(repoRoot, "packages", "cli");
const packageDir = mkdtempSync(join(tmpdir(), "mcp-shield-release-"));
const shouldPublish = process.env.MCP_SHIELD_PUBLISH === "1";

function run(name, command, args, options = {}) {
  const cwd = options.cwd ?? repoRoot;
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: process.env.CI ?? "1" }
    });
    process.stdout.write(`✓ ${name}\n`);
    if (options.printOutput) {
      process.stdout.write(output);
    }
    return output;
  } catch (error) {
    const exitCode = typeof error.status === "number" ? error.status : 1;
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    throw new Error(`${name} failed with exit ${exitCode}\n${output}`);
  }
}

function assertIncludes(name, value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`${name} did not include '${expected}'.\n${value}`);
  }
}

function assertNotIncludes(name, value, forbidden) {
  if (value.includes(forbidden)) {
    throw new Error(`${name} unexpectedly included '${forbidden}'.\n${value}`);
  }
}

try {
  const status = run("git status", "git", ["status", "--porcelain"]);
  if (status.trim().length > 0) {
    throw new Error(`Release dry-run requires a clean working tree. Dirty files:\n${status}`);
  }

  run("build", "pnpm", ["build"]);
  assertIncludes("built CLI help", run("built CLI help", "node", ["packages/cli/dist/index.js", "--help"]), "MCP Shield");
  assertIncludes(
    "built policy check",
    run("built policy check", "node", ["packages/cli/dist/index.js", "policy", "check", "examples/policies/coding-agent.yaml"]),
    "Policy valid: yes"
  );

  run("pack CLI package", "pnpm", ["pack", "--pack-destination", packageDir], { cwd: cliDir });
  const packageList = run("inspect package tarball", "sh", ["-c", `tar -tf "$(find ${JSON.stringify(packageDir)} -name '*.tgz' -print -quit)"`]);
  assertIncludes("package contents", packageList, "package/package.json");
  assertIncludes("package contents", packageList, "package/dist/index.js");
  assertIncludes("package contents", packageList, "package/dist/index.d.ts");
  assertNotIncludes("package contents", packageList, "package/src/");
  assertNotIncludes("package contents", packageList, "tsbuildinfo");

  run("pnpm publish dry-run", "pnpm", ["publish", "--dry-run", "--no-git-checks", "--access", "public"], { cwd: cliDir, printOutput: true });

  if (!shouldPublish) {
    process.stdout.write("✓ Real publish skipped. Set MCP_SHIELD_PUBLISH=1 only when intentionally publishing.\n");
    process.exit(0);
  }

  run("pnpm publish", "pnpm", ["publish", "--no-git-checks", "--access", "public"], { cwd: cliDir, printOutput: true });
} finally {
  rmSync(packageDir, { recursive: true, force: true });
}
