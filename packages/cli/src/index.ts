#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { explainAuditEvent, formatReplaySummary, parseAuditJsonl, replayAuditEvents } from "@mcp-shield/audit";
import { formatConfigStatus, getConfigStatus, initProtectedConfig, restoreLatestBackup } from "@mcp-shield/config-adapter";
import type { SupportedMcpClient } from "@mcp-shield/config-adapter";
import {
  approveRequest,
  defaultApprovalStoreDir,
  denyRequest,
  formatApprovalList,
  formatApprovalRequest,
  listApprovalRequests,
  readApprovalRequest,
  startStdioGateway
} from "@mcp-shield/gateway";
import type { ApprovalRequest } from "@mcp-shield/gateway";
import { formatPolicyCheck, loadPolicyFromYaml } from "@mcp-shield/policy";
import type { RuntimeMode } from "@mcp-shield/shared";
import { formatScanReport, scanMcpConfigJson, stringifyScanReport } from "@mcp-shield/scanner";
import { startApprovalConsole } from "./approval-server.js";

const rawArgs = process.argv.slice(2);
const cliArgs = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const command = cliArgs[0] ?? "help";

const commands: Record<string, string> = {
  help: "Show available MCP Shield commands",
  scan: "Scan an MCP config for risky servers, metadata, schemas, and drift",
  init: "Rewrite an MCP client config through MCP Shield with backup and rollback state",
  gateway: "Start the stdio MCP gateway",
  approval: "List, watch, serve, inspect, approve, or deny approval requests",
  doctor: "Run local installation and configuration diagnostics",
  explain: "Explain one audit event decision",
  replay: "Summarize a JSONL audit file",
  rollback: "Restore the previous MCP client config",
  disable: "Emergency restore and stop protected config usage",
  status: "Show MCP Shield config protection status",
  policy: "Check or test policy files"
};

async function main(): Promise<void> {
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "scan") {
    await runScan(cliArgs.slice(1));
    return;
  }

  if (command === "policy") {
    await runPolicy(cliArgs.slice(1));
    return;
  }

  if (command === "approval") {
    await runApproval(cliArgs.slice(1));
    return;
  }

  if (command === "explain") {
    await runExplain(cliArgs.slice(1));
    return;
  }

  if (command === "replay") {
    await runReplay(cliArgs.slice(1));
    return;
  }

  if (command === "gateway") {
    await runGateway(cliArgs.slice(1));
    return;
  }

  if (command === "init") {
    await runInit(cliArgs.slice(1));
    return;
  }

  if (command === "status") {
    await runStatus(cliArgs.slice(1));
    return;
  }

  if (command === "rollback" || command === "disable") {
    await runRollback(cliArgs.slice(1), command);
    return;
  }

  if (!Object.hasOwn(commands, command)) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
    return;
  }
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
    const file = await readCliFile(targetPath);
    const report = scanMcpConfigJson(file.text, file.path);
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
    const file = await readCliFile(targetPath);
    const compiled = loadPolicyFromYaml(file.text);
    process.stdout.write(`${formatPolicyCheck(compiled)}\n`);
    process.exitCode = compiled.valid ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown policy failure";
    console.error(`Policy check failed: ${message}`);
    process.exitCode = 1;
  }
}

async function runApproval(args: readonly string[]): Promise<void> {
  const subcommand = args[0] ?? "list";
  const storeDir = getOption(args, "--dir") ?? defaultApprovalStoreDir();

  try {
    if (subcommand === "list") {
      process.stdout.write(`${formatApprovalList(await listApprovalRequests(storeDir))}\n`);
      return;
    }

    if (subcommand === "watch") {
      await runApprovalWatch(args, storeDir);
      return;
    }

    if (subcommand === "serve") {
      await runApprovalServe(args, storeDir);
      return;
    }

    if (subcommand === "show") {
      const id = firstPositional(args.slice(1));
      if (!id) {
        console.error("Usage: mcp-shield approval show <approval_id> [--dir path]");
        process.exitCode = 1;
        return;
      }
      const request = await readApprovalRequest(storeDir, id);
      if (!request) {
        console.error(`Approval request not found: ${id}`);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${formatApprovalRequest(request)}\n`);
      return;
    }

    if (subcommand === "approve" || subcommand === "deny") {
      const id = firstPositional(args.slice(1));
      if (!id) {
        console.error(`Usage: mcp-shield approval ${subcommand} <approval_id> [--reason text] [--dir path]`);
        process.exitCode = 1;
        return;
      }
      const reason = getOption(args, "--reason") ?? undefined;
      const decided =
        subcommand === "approve"
          ? await approveRequest({ storeDir, id, reason })
          : await denyRequest({ storeDir, id, reason });
      process.stdout.write(`${formatApprovalRequest(decided)}\n`);
      return;
    }

    console.error("Unsupported approval command.");
    console.error("Usage: mcp-shield approval list|watch|serve|show|approve|deny [args] [--dir path]");
    process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown approval failure";
    console.error(`Approval command failed: ${message}`);
    process.exitCode = 1;
  }
}

async function runApprovalServe(args: readonly string[], storeDir: string): Promise<void> {
  const host = getOption(args, "--host") ?? "127.0.0.1";
  const port = parseOptionalPositiveInteger(getOption(args, "--port"), "--port") ?? 6277;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("approval serve only allows --host 127.0.0.1 or localhost for local safety.");
  }
  await startApprovalConsole({ storeDir, host, port });
}

async function runApprovalWatch(args: readonly string[], storeDir: string): Promise<void> {
  const intervalMs = parseOptionalPositiveInteger(getOption(args, "--interval-ms"), "--interval-ms") ?? 1000;
  const once = args.includes("--once");
  const includeAll = args.includes("--all");
  const noClear = args.includes("--no-clear") || once;

  const render = async (): Promise<void> => {
    const requests = await listApprovalRequests(storeDir);
    const output = formatApprovalWatchSnapshot(requests, { storeDir, includeAll, intervalMs });
    if (!noClear) {
      process.stdout.write("\x1Bc");
    }
    process.stdout.write(`${output}\n`);
  };

  await render();
  if (once) {
    return;
  }

  let stopped = false;
  const stop = (): void => {
    stopped = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  while (!stopped) {
    await sleep(intervalMs);
    if (!stopped) {
      await render();
    }
  }
}

function formatApprovalWatchSnapshot(
  requests: readonly ApprovalRequest[],
  options: { readonly storeDir: string; readonly includeAll: boolean; readonly intervalMs: number }
): string {
  const pending = requests.filter((request) => request.status === "pending");
  const decided = requests.filter((request) => request.status !== "pending");
  const visibleDecided = options.includeAll ? decided : decided.slice(0, 10);
  const lines: string[] = [];

  lines.push("MCP Shield Approval Watch");
  lines.push(`Store: ${options.storeDir}`);
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Refresh: ${options.intervalMs}ms`);
  lines.push("");
  lines.push(`Pending approvals: ${pending.length}`);

  if (pending.length === 0) {
    lines.push("  No pending approvals.");
  } else {
    for (const request of pending) {
      lines.push(`  ${request.id}  ${request.severity.toUpperCase()}  ${request.serverName}/${request.toolName}`);
      lines.push(`    Rule: ${request.ruleId}`);
      lines.push(`    Reason: ${request.policyReason}`);
      lines.push(`    Args: ${JSON.stringify(request.argumentsSummary)}`);
      lines.push(`    Approve: mcp-shield approval approve ${request.id} --dir ${shellQuote(options.storeDir)} --reason "reviewed"`);
      lines.push(`    Deny:    mcp-shield approval deny ${request.id} --dir ${shellQuote(options.storeDir)} --reason "not approved"`);
    }
  }

  lines.push("");
  lines.push(`Recent decided approvals: ${visibleDecided.length}${options.includeAll ? "" : decided.length > visibleDecided.length ? ` of ${decided.length}` : ""}`);
  if (visibleDecided.length === 0) {
    lines.push("  No decided approvals yet.");
  } else {
    for (const request of visibleDecided) {
      lines.push(
        `  ${request.id}  ${request.status.toUpperCase()}  ${request.serverName}/${request.toolName}  ${request.decidedAt ?? request.createdAt}`
      );
      if (request.reason) {
        lines.push(`    Decision reason: ${request.reason}`);
      }
    }
  }

  lines.push("");
  lines.push("Controls: Ctrl+C to stop. Use --once for scripts, --all to show every decided approval, --no-clear to avoid screen clearing.");
  return lines.join("\n");
}

async function runExplain(args: readonly string[]): Promise<void> {
  const auditPath = args[0];
  const eventId = args[1];
  if (!auditPath || !eventId) {
    console.error("Usage: mcp-shield explain <audit.jsonl> <event_id>");
    process.exitCode = 1;
    return;
  }

  const file = await readCliFile(auditPath);
  const events = parseAuditJsonl(file.text);
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

  const file = await readCliFile(auditPath);
  const events = parseAuditJsonl(file.text);
  process.stdout.write(`${formatReplaySummary(replayAuditEvents(events))}\n`);
}

async function runGateway(args: readonly string[]): Promise<void> {
  const separatorIndex = args.indexOf("--");
  if (separatorIndex === -1 || separatorIndex === args.length - 1) {
    console.error("Usage: mcp-shield gateway --policy <policy.yaml> [--mode strict|balanced|audit-only] [--server-name name] [--audit-file path] [--approval-wait-ms ms] -- <server-command> [args...]");
    process.exitCode = 1;
    return;
  }

  const options = args.slice(0, separatorIndex);
  const target = args.slice(separatorIndex + 1);
  const policyPath = getOption(options, "--policy") ?? "examples/policies/coding-agent.yaml";
  const mode = parseMode(getOption(options, "--mode") ?? "balanced");
  const serverName = getOption(options, "--server-name") ?? "target";
  const auditFile = getOption(options, "--audit-file") ?? ".mcp-shield/audit.jsonl";
  const approvalStoreDir = getOption(options, "--approval-dir") ?? defaultApprovalStoreDir();
  const approvalWaitMs = parseOptionalNonNegativeInteger(getOption(options, "--approval-wait-ms"), "--approval-wait-ms");
  const approvalTtlMs = parseOptionalPositiveInteger(getOption(options, "--approval-ttl-ms"), "--approval-ttl-ms");
  const approvalPollIntervalMs = parseOptionalPositiveInteger(getOption(options, "--approval-poll-ms"), "--approval-poll-ms");
  const command = target[0];
  const serverArgs = target.slice(1);

  if (!command) {
    console.error("Missing target MCP server command after -- separator.");
    process.exitCode = 1;
    return;
  }

  const policyFile = await readCliFile(policyPath);
  const compiled = loadPolicyFromYaml(policyFile.text);
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
    auditFile,
    approvalStoreDir,
    ...(approvalWaitMs !== undefined ? { approvalWaitMs } : {}),
    ...(approvalTtlMs !== undefined ? { approvalTtlMs } : {}),
    ...(approvalPollIntervalMs !== undefined ? { approvalPollIntervalMs } : {})
  });
}

async function runInit(args: readonly string[]): Promise<void> {
  const client = parseClient(getOption(args, "--client") ?? "custom");
  const configPath = getOption(args, "--config") ?? undefined;
  const policyPath = getOption(args, "--policy") ?? "examples/policies/coding-agent.yaml";
  const policyFile = await readCliFile(policyPath);
  const mode = parseMode(getOption(args, "--mode") ?? "balanced");
  const plan = await initProtectedConfig({ client, configPath, policyPath: policyFile.path, mode });
  process.stdout.write(`Protected ${plan.operations.length} MCP server(s).\nBackup: ${plan.backupPath}\nMapping: ${plan.mappingPath}\n`);
}

async function runStatus(args: readonly string[]): Promise<void> {
  const client = parseClient(getOption(args, "--client") ?? "custom");
  const configPath = getOption(args, "--config") ?? undefined;
  process.stdout.write(`${formatConfigStatus(await getConfigStatus(client, configPath))}\n`);
}

async function runRollback(args: readonly string[], action: "rollback" | "disable"): Promise<void> {
  const client = parseClient(getOption(args, "--client") ?? "custom");
  const configPath = getOption(args, "--config") ?? undefined;
  const restored = await restoreLatestBackup(client, configPath);
  process.stdout.write(`${action === "disable" ? "Disabled protection and restored" : "Restored"}: ${restored}\n`);
}

function getOption(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

function firstPositional(args: readonly string[]): string | null {
  return (
    args.find(
      (arg, index) =>
        !arg.startsWith("-") &&
        args[index - 1] !== "--dir" &&
        args[index - 1] !== "--reason" &&
        args[index - 1] !== "--interval-ms" &&
        args[index - 1] !== "--host" &&
        args[index - 1] !== "--port"
    ) ?? null
  );
}

async function readCliFile(inputPath: string): Promise<{ readonly path: string; readonly text: string }> {
  let missingError: unknown;

  for (const candidate of candidateInputPaths(inputPath)) {
    try {
      return { path: candidate, text: await readFile(candidate, "utf8") };
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
      missingError = error;
    }
  }

  if (missingError instanceof Error) {
    throw missingError;
  }

  throw new Error(`File not found: ${inputPath}`);
}

function candidateInputPaths(inputPath: string): readonly string[] {
  if (isAbsolute(inputPath)) {
    return [inputPath];
  }

  const candidates: string[] = [];
  let current = process.cwd();
  while (true) {
    candidates.push(join(current, inputPath));
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return [...new Set(candidates)];
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { readonly code?: unknown }).code === "ENOENT";
}

function parseMode(value: string): RuntimeMode {
  if (value === "audit-only" || value === "balanced" || value === "strict") {
    return value;
  }

  throw new Error(`Invalid mode '${value}'. Use audit-only, balanced, or strict.`);
}

function parseClient(value: string): SupportedMcpClient {
  if (value === "claude-desktop" || value === "cursor" || value === "custom") {
    return value;
  }

  throw new Error(`Invalid client '${value}'. Use claude-desktop, cursor, or custom.`);
}

function parseOptionalPositiveInteger(value: string | null, optionName: string): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  return parsed;
}

function parseOptionalNonNegativeInteger(value: string | null, optionName: string): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${optionName} must be a non-negative integer.`);
  }

  return parsed;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp(): void {
  const rows = Object.entries(commands)
    .map(([name, description]) => `  ${name.padEnd(10)} ${description}`)
    .join("\n");

  process.stdout.write(`MCP Shield\n\nUsage:\n  mcp-shield <command> [options]\n\nCommands:\n${rows}\n\nExamples:\n  mcp-shield scan ./mcp.json\n  mcp-shield scan ./mcp.json --json\n  mcp-shield policy check ./coding-agent.yaml\n  mcp-shield gateway --policy ./coding-agent.yaml --mode strict -- node ./server.js\n  mcp-shield gateway --policy ./coding-agent.yaml --mode balanced --approval-wait-ms 30000 -- node ./server.js\n  mcp-shield approval list\n  mcp-shield approval watch --dir .mcp-shield/approvals\n  mcp-shield approval serve --dir .mcp-shield/approvals --port 6277\n  mcp-shield approval watch --once --dir .mcp-shield/approvals\n  mcp-shield approval show apr_123\n  mcp-shield approval approve apr_123 --reason "Reviewed command and branch"\n  mcp-shield approval deny apr_123 --reason "Unexpected production target"\n  mcp-shield init --client custom --config ./mcp.json\n  mcp-shield status --client custom --config ./mcp.json\n  mcp-shield rollback --client custom --config ./mcp.json\n  mcp-shield replay .mcp-shield/audit.jsonl\n  mcp-shield explain .mcp-shield/audit.jsonl evt_123\n`);
}

await main();
