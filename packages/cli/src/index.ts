#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { explainAuditEvent, formatReplaySummary, parseAuditJsonl, replayAuditEvents } from "@mcp-shield/audit";
import { startStdioGateway } from "@mcp-shield/gateway";
import { formatPolicyCheck, loadPolicyFromYaml } from "@mcp-shield/policy";
import type { RuntimeMode } from "@mcp-shield/shared";
import { formatScanReport, scanMcpConfigJson, stringifyScanReport } from "@mcp-shield/scanner";

const command = process.argv[2] ?? "help";

const commands: Record<string, string> = {
  help: "Show available MCP Shield commands",
  scan: "Scan an MCP config for risky servers, metadata, schemas, and drift",
  init: "Rewrite an MCP client config through MCP Shield with backup and rollback state",
  gateway: "Start the stdio MCP gateway",
  doctor: "Run local installation and configuration diagnostics",
  explain: "Explain one audit event decision",
  replay: "Summarize a JSONL audit file",
  rollback: "Restore the previous MCP client config",
  disable: "Emergency restore and stop protected config usage",
  policy: "Check or test policy files"
};

async function main(): Promise<void> {
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "scan") {
    await runScan(process.argv.slice(3));
    return;
  }

  if (command === "policy") {
    await runPolicy(process.argv.slice(3));
    return;
  }

  if (command === "explain") {
    await runExplain(process.argv.slice(3));
    return;
  }

  if (command === "replay") {
    await runReplay(process.argv.slice(3));
    return;
  }

  if (command === "gateway") {
    await runGateway(process.argv.slice(3));
    return;
  }

  if (!Object.hasOwn(commands, command)) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  console.error(`Command '${command}' is planned but not implemented in this feature block yet.`);
  console.error("Scanner, policy, audit, and gateway commands are implemented first. Config adapter and demo come next.");
  process.exitCode = 2;
}

async function runScan(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const targetPath = args.find((arg) => !arg.startsWith("-"));

  if (!targetPath) {
    console.error("Missing MCP config path.");
    console.error("Usage: mcp-shield scan <config.json> [--json]");
    process.exitCode = 1;
    return;
  }

  try {
    const text = await readFile(targetPath, "utf8");
    const report = scanMcpConfigJson(text, targetPath);
    process.stdout.write(json ? `${stringifyScanReport(report)}\n` : `${formatScanReport(report)}\n`);

    if (report.overallRisk === "critical" || report.overallRisk === "high") {
      process.exitCode = 2;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan failure";
    console.error(`Scan failed: ${message}`);
    process.exitCode = 1;
  }
}

async function runPolicy(args: readonly string[]): Promise<void> {
  const subcommand = args[0] ?? "help";

  if (subcommand !== "check") {
    console.error("Unsupported policy command.");
    console.error("Usage: mcp-shield policy check <policy.yaml>");
    process.exitCode = 1;
    return;
  }

  const targetPath = args.slice(1).find((arg) => !arg.startsWith("-"));
  if (!targetPath) {
    console.error("Missing policy path.");
    console.error("Usage: mcp-shield policy check <policy.yaml>");
    process.exitCode = 1;
    return;
  }

  try {
    const text = await readFile(targetPath, "utf8");
    const compiled = loadPolicyFromYaml(text);
    process.stdout.write(`${formatPolicyCheck(compiled)}\n`);
    process.exitCode = compiled.valid ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown policy failure";
    console.error(`Policy check failed: ${message}`);
    process.exitCode = 1;
  }
}

async function runExplain(args: readonly string[]): Promise<void> {
  const auditPath = args[0];
  const eventId = args[1];
  if (!auditPath || !eventId) {
    console.error("Usage: mcp-shield explain <audit.jsonl> <event_id>");
    process.exitCode = 1;
    return;
  }

  const events = parseAuditJsonl(await readFile(auditPath, "utf8"));
  const event = events.find((candidate) => candidate.eventId === eventId);
  if (!event) {
    console.error(`Audit event not found: ${eventId}`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${explainAuditEvent(event)}\n`);
}

async function runReplay(args: readonly string[]): Promise<void> {
  const auditPath = args[0];
  if (!auditPath) {
    console.error("Usage: mcp-shield replay <audit.jsonl>");
    process.exitCode = 1;
    return;
  }

  const events = parseAuditJsonl(await readFile(auditPath, "utf8"));
  process.stdout.write(`${formatReplaySummary(replayAuditEvents(events))}\n`);
}

async function runGateway(args: readonly string[]): Promise<void> {
  const separatorIndex = args.indexOf("--");
  if (separatorIndex === -1 || separatorIndex === args.length - 1) {
    console.error("Usage: mcp-shield gateway --policy <policy.yaml> [--mode strict|balanced|audit-only] [--server-name name] [--audit-file path] -- <server-command> [args...]");
    process.exitCode = 1;
    return;
  }

  const options = args.slice(0, separatorIndex);
  const target = args.slice(separatorIndex + 1);
  const policyPath = getOption(options, "--policy") ?? "examples/policies/coding-agent.yaml";
  const mode = parseMode(getOption(options, "--mode") ?? "balanced");
  const serverName = getOption(options, "--server-name") ?? "target";
  const auditFile = getOption(options, "--audit-file") ?? ".mcp-shield/audit.jsonl";
  const command = target[0];
  const serverArgs = target.slice(1);

  if (!command) {
    console.error("Missing target MCP server command after -- separator.");
    process.exitCode = 1;
    return;
  }

  const compiled = loadPolicyFromYaml(await readFile(policyPath, "utf8"));
  if (!compiled.valid) {
    console.error(formatPolicyCheck(compiled));
    process.exitCode = 1;
    return;
  }

  await startStdioGateway({
    command,
    args: serverArgs,
    policy: compiled.policy,
    sessionId: `sess_${Date.now()}`,
    serverName,
    mode,
    auditFile
  });
}

function getOption(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

function parseMode(value: string): RuntimeMode {
  if (value === "audit-only" || value === "balanced" || value === "strict") {
    return value;
  }

  throw new Error(`Invalid mode '${value}'. Use audit-only, balanced, or strict.`);
}

function printHelp(): void {
  const rows = Object.entries(commands)
    .map(([name, description]) => `  ${name.padEnd(10)} ${description}`)
    .join("\n");

  process.stdout.write(`MCP Shield\n\nUsage:\n  mcp-shield <command> [options]\n\nCommands:\n${rows}\n\nExamples:\n  mcp-shield scan ./mcp.json\n  mcp-shield scan ./mcp.json --json\n  mcp-shield policy check ./coding-agent.yaml\n  mcp-shield gateway --policy ./coding-agent.yaml --mode strict -- node ./server.js\n  mcp-shield replay .mcp-shield/audit.jsonl\n  mcp-shield explain .mcp-shield/audit.jsonl evt_123\n`);
}

await main();
