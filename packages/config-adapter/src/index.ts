import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type SupportedMcpClient = "claude-desktop" | "cursor" | "custom";

export interface ConfigRewritePlan {
  readonly client: SupportedMcpClient;
  readonly originalConfigPath: string;
  readonly backupPath: string;
  readonly mappingPath: string;
  readonly operations: readonly ConfigRewriteOperation[];
}

export interface ConfigRewriteOperation {
  readonly serverName: string;
  readonly originalCommand: string;
  readonly originalArgs: readonly string[];
  readonly protectedCommand: string;
  readonly protectedArgs: readonly string[];
}

export interface ConfigRewriteSafetyResult {
  readonly safeToRewrite: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface ConfigStatus {
  readonly client: SupportedMcpClient;
  readonly configPath: string;
  readonly exists: boolean;
  readonly protected: boolean;
  readonly serverCount: number;
  readonly backupPath?: string;
  readonly mappingPath?: string;
}

export interface RewriteOptions {
  readonly client: SupportedMcpClient;
  readonly configPath?: string;
  readonly shieldCommand?: string;
  readonly policyPath?: string;
  readonly mode?: "audit-only" | "balanced" | "strict";
}

export function detectClientConfigPath(client: SupportedMcpClient): string {
  if (client === "claude-desktop") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }

  if (client === "cursor") {
    return join(homedir(), ".cursor", "mcp.json");
  }

  return resolve("mcp.json");
}

export function validateRewritePlan(plan: ConfigRewritePlan): ConfigRewriteSafetyResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (plan.operations.length === 0) {
    blockers.push("No MCP server entries were found to protect.");
  }

  if (!plan.backupPath.includes(".mcp-shield")) {
    blockers.push("Backup path must live under .mcp-shield to keep rollback state discoverable.");
  }

  for (const operation of plan.operations) {
    if (operation.originalCommand.length === 0) {
      blockers.push(`Server ${operation.serverName} has an empty command.`);
    }

    if (operation.protectedCommand === operation.originalCommand) {
      warnings.push(`Server ${operation.serverName} protected command matches original command; verify wrapper arguments.`);
    }
  }

  return {
    safeToRewrite: blockers.length === 0,
    blockers,
    warnings
  };
}

export function createRewritePlan(configText: string, options: RewriteOptions): ConfigRewritePlan {
  const configPath = options.configPath ?? detectClientConfigPath(options.client);
  const parsed = parseConfig(configText);
  const servers = getMcpServers(parsed);
  const operations: ConfigRewriteOperation[] = [];
  const shieldCommand = options.shieldCommand ?? "mcp-shield";
  const policyPath = options.policyPath ?? "examples/policies/coding-agent.yaml";
  const mode = options.mode ?? "balanced";

  for (const [serverName, server] of Object.entries(servers)) {
    if (!isRecord(server)) {
      continue;
    }

    const originalCommand = stringValue(server["command"]);
    const originalArgs = stringArray(server["args"]);
    if (!originalCommand) {
      continue;
    }

    operations.push({
      serverName,
      originalCommand,
      originalArgs,
      protectedCommand: shieldCommand,
      protectedArgs: ["gateway", "--policy", policyPath, "--mode", mode, "--server-name", serverName, "--", originalCommand, ...originalArgs]
    });
  }

  return {
    client: options.client,
    originalConfigPath: configPath,
    backupPath: backupPathFor(configPath),
    mappingPath: mappingPathFor(configPath),
    operations
  };
}

export function rewriteConfigText(configText: string, plan: ConfigRewritePlan): string {
  const parsed = parseConfig(configText);
  const servers = getMcpServers(parsed);

  for (const operation of plan.operations) {
    const server = servers[operation.serverName];
    if (!isRecord(server)) {
      continue;
    }

    server["command"] = operation.protectedCommand;
    server["args"] = [...operation.protectedArgs];
    server["_mcpShieldProtected"] = true;
  }

  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export async function initProtectedConfig(options: RewriteOptions): Promise<ConfigRewritePlan> {
  const configPath = options.configPath ?? detectClientConfigPath(options.client);
  const originalText = await readFile(configPath, "utf8");
  const plan = createRewritePlan(originalText, { ...options, configPath });
  const safety = validateRewritePlan(plan);
  if (!safety.safeToRewrite) {
    throw new Error(`Config rewrite blocked: ${safety.blockers.join("; ")}`);
  }

  const protectedText = rewriteConfigText(originalText, plan);
  JSON.parse(protectedText);

  await mkdir(dirname(plan.backupPath), { recursive: true });
  await copyFile(configPath, plan.backupPath);
  await writeFile(plan.mappingPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  const tempPath = `${configPath}.mcp-shield.tmp`;
  await writeFile(tempPath, protectedText, "utf8");
  JSON.parse(await readFile(tempPath, "utf8"));
  await rename(tempPath, configPath);

  return plan;
}

export async function restoreLatestBackup(client: SupportedMcpClient, configPath = detectClientConfigPath(client)): Promise<string> {
  const backupPath = backupPathFor(configPath);
  if (!existsSync(backupPath)) {
    throw new Error(`No backup found for restore: ${backupPath}`);
  }

  await copyFile(backupPath, configPath);
  return configPath;
}

export async function getConfigStatus(client: SupportedMcpClient, configPath = detectClientConfigPath(client)): Promise<ConfigStatus> {
  const exists = existsSync(configPath);
  if (!exists) {
    return { client, configPath, exists: false, protected: false, serverCount: 0 };
  }

  const text = await readFile(configPath, "utf8");
  const parsed = parseConfig(text);
  const servers = getMcpServers(parsed);
  const protectedEntries = Object.values(servers).filter((server) => isRecord(server) && server["_mcpShieldProtected"] === true);
  const backupPath = backupPathFor(configPath);
  const mappingPath = mappingPathFor(configPath);

  return {
    client,
    configPath,
    exists: true,
    protected: protectedEntries.length > 0,
    serverCount: Object.keys(servers).length,
    ...(existsSync(backupPath) ? { backupPath } : {}),
    ...(existsSync(mappingPath) ? { mappingPath } : {})
  };
}

export function formatConfigStatus(status: ConfigStatus): string {
  const lines = [
    `Client: ${status.client}`,
    `Config path: ${status.configPath}`,
    `Config exists: ${status.exists ? "yes" : "no"}`,
    `Protected: ${status.protected ? "yes" : "no"}`,
    `Servers: ${status.serverCount}`
  ];

  if (status.backupPath) {
    lines.push(`Backup: ${status.backupPath}`);
  }

  if (status.mappingPath) {
    lines.push(`Mapping: ${status.mappingPath}`);
  }

  return lines.join("\n");
}

function parseConfig(configText: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(configText);
  if (!isRecord(parsed)) {
    throw new Error("MCP client config must be a JSON object.");
  }
  return { ...parsed };
}

function getMcpServers(config: Record<string, unknown>): Record<string, unknown> {
  const mcpServers = config["mcpServers"];
  if (isRecord(mcpServers)) {
    return mcpServers as Record<string, unknown>;
  }

  const servers = config["servers"];
  if (isRecord(servers)) {
    return servers as Record<string, unknown>;
  }

  config["mcpServers"] = {};
  return config["mcpServers"] as Record<string, unknown>;
}

function backupPathFor(configPath: string): string {
  return join(dirname(configPath), ".mcp-shield", "backups", `${basenameSafe(configPath)}.bak`);
}

function mappingPathFor(configPath: string): string {
  return join(dirname(configPath), ".mcp-shield", "config-map.json");
}

function basenameSafe(path: string): string {
  return path.split(/[\\/]/).pop() ?? "config.json";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
