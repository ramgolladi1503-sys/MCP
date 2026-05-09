#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(formatHelp());
  process.exit(0);
}

const client = optionValue(args, "--client") ?? "generic";
const repoRoot = resolveUserPath(optionValue(args, "--repo-root") ?? defaultRepoRoot);
const demoDir = resolveUserPath(optionValue(args, "--demo-dir") ?? join(tmpdir(), "mcp-shield-live-client-demo"));
const outputPath = optionValue(args, "--output");
const serverName = optionValue(args, "--server-name") ?? "mcp-shield-real-world-demo";
const nodeCommand = optionValue(args, "--node-command") ?? "node";

validateClient(client);
validateName(serverName, "--server-name");
mkdirSync(demoDir, { recursive: true });

const config = buildDemoClientConfig({ repoRoot, demoDir, serverName, nodeCommand });
const json = `${JSON.stringify(config, null, 2)}\n`;

if (outputPath) {
  const absoluteOutputPath = resolveUserPath(outputPath);
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, json, "utf8");
  process.stderr.write(`Wrote ${client} MCP demo config to ${absoluteOutputPath}\n`);
  process.stderr.write(`Approval store: ${join(demoDir, "approvals")}\n`);
  process.stderr.write(`Audit file: ${join(demoDir, "audit.jsonl")}\n`);
  process.stderr.write(`Child call proof log: ${join(demoDir, "child-calls.jsonl")}\n`);
} else {
  process.stdout.write(json);
}

function buildDemoClientConfig(options) {
  const policyPath = join(options.repoRoot, "examples", "policies", "real-world-demo.yaml");
  const cliPath = join(options.repoRoot, "packages", "cli", "dist", "index.js");
  const demoServerPath = join(options.repoRoot, "examples", "real-world-mcp-server", "index.js");
  const auditFile = join(options.demoDir, "audit.jsonl");
  const approvalDir = join(options.demoDir, "approvals");
  const childCallLog = join(options.demoDir, "child-calls.jsonl");

  return {
    mcpServers: {
      [options.serverName]: {
        command: options.nodeCommand,
        args: [
          cliPath,
          "gateway",
          "--policy",
          policyPath,
          "--mode",
          "balanced",
          "--server-name",
          "real-world-demo",
          "--audit-file",
          auditFile,
          "--approval-dir",
          approvalDir,
          "--approval-wait-ms",
          "30000",
          "--approval-poll-ms",
          "250",
          "--approval-ttl-ms",
          "60000",
          "--",
          options.nodeCommand,
          demoServerPath,
          childCallLog
        ]
      }
    }
  };
}

function optionValue(inputArgs, name) {
  const index = inputArgs.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = inputArgs[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`${name} requires a value.`);
  }
  return value;
}

function validateClient(value) {
  if (value === "generic" || value === "claude-desktop" || value === "cursor") {
    return;
  }
  fail("--client must be generic, claude-desktop, or cursor.");
}

function validateName(value, optionName) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    fail(`${optionName} must contain only letters, numbers, dots, underscores, or dashes.`);
  }
}

function resolveUserPath(value) {
  if (value === "~") {
    return process.env.HOME ?? value;
  }
  if (value.startsWith("~/")) {
    return join(process.env.HOME ?? "~", value.slice(2));
  }
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function fail(message) {
  process.stderr.write(`Live client demo config generation failed: ${message}\n`);
  process.exit(1);
}

function formatHelp() {
  return `Generate a Claude Desktop / Cursor MCP client config for the MCP Shield live real-world demo.\n\nUsage:\n  node scripts/generate-live-client-demo-config.mjs [options]\n\nOptions:\n  --client generic|claude-desktop|cursor   Label the target client. Default: generic\n  --repo-root <path>                       Repository root. Default: current script parent\n  --demo-dir <path>                        Runtime proof directory. Default: OS temp demo dir\n  --output <path>                          Write JSON config to a file instead of stdout\n  --server-name <name>                     MCP server name in generated config\n  --node-command <command>                 Node command path/name. Default: node\n\nBefore using the generated config, run:\n  pnpm install --frozen-lockfile\n  pnpm build\n\nThen watch approvals with:\n  pnpm --filter @mcp-shield/cli dev -- approval watch --dir <demo-dir>/approvals\n`;
}
