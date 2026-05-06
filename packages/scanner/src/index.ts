import type { Severity } from "@mcp-shield/shared";

export type ScannerIssueType =
  | "config_parse"
  | "metadata_poisoning"
  | "schema_poisoning"
  | "dangerous_capability"
  | "supply_chain"
  | "scope_creep"
  | "manifest_drift";

export interface ScannerIssue {
  readonly type: ScannerIssueType;
  readonly severity: Severity;
  readonly ruleId: string;
  readonly detail: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
  readonly recommendedFix?: string;
}

export interface ScanReport {
  readonly reportVersion: "1.0";
  readonly sourcePath: string;
  readonly scannedServers: number;
  readonly overallRisk: Severity;
  readonly issues: readonly ScannerIssue[];
}

export interface NormalizedMcpConfig {
  readonly sourcePath: string;
  readonly servers: readonly NormalizedMcpServer[];
  readonly warnings: readonly ScannerIssue[];
}

export interface NormalizedMcpServer {
  readonly name: string;
  readonly transport: "stdio" | "http" | "unknown";
  readonly command?: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly url?: string;
  readonly envKeys: readonly string[];
  readonly raw: Readonly<Record<string, unknown>>;
}

const METADATA_POISONING_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /read\s+(local\s+)?secrets/i,
  /send\s+.*\s+(secret|token|credential)/i,
  /call\s+.*tool/i,
  /before\s+responding/i,
  /exfiltrat/i,
  /upload\s+.*\s+(env|secret|token|credential)/i
];

const DANGEROUS_SCHEMA_KEYS = new Set([
  "command",
  "cmd",
  "shell",
  "script",
  "delete",
  "remove",
  "overwrite",
  "write",
  "upload_url",
  "webhook",
  "callback_url",
  "token",
  "authorization",
  "password"
]);

export function parseMcpConfigJson(text: string, sourcePath = "inline"): NormalizedMcpConfig {
  const warnings: ScannerIssue[] = [];
  const parsed = parseJsonObject(text, sourcePath);
  const servers: NormalizedMcpServer[] = [];

  const mcpServers = parsed["mcpServers"];
  if (isRecord(mcpServers)) {
    for (const [name, rawServer] of Object.entries(mcpServers)) {
      const normalized = normalizeServer(name, rawServer, warnings);
      if (normalized) {
        servers.push(normalized);
      }
    }

    return { sourcePath, servers, warnings };
  }

  const serversValue = parsed["servers"];
  if (Array.isArray(serversValue)) {
    for (const [index, rawServer] of serversValue.entries()) {
      if (!isRecord(rawServer)) {
        warnings.push(invalidServerShape(`servers[${index}]`));
        continue;
      }

      const name = stringProp(rawServer, "name") ?? `server_${index}`;
      const normalized = normalizeServer(name, rawServer, warnings);
      if (normalized) {
        servers.push(normalized);
      }
    }

    return { sourcePath, servers, warnings };
  }

  if (isRecord(serversValue)) {
    for (const [name, rawServer] of Object.entries(serversValue)) {
      const normalized = normalizeServer(name, rawServer, warnings);
      if (normalized) {
        servers.push(normalized);
      }
    }

    return { sourcePath, servers, warnings };
  }

  if (stringProp(parsed, "command") || stringProp(parsed, "url")) {
    const normalized = normalizeServer(stringProp(parsed, "name") ?? "default", parsed, warnings);
    if (normalized) {
      servers.push(normalized);
    }
  }

  return { sourcePath, servers, warnings };
}

export function scanMcpConfigJson(text: string, sourcePath = "inline"): ScanReport {
  return scanNormalizedMcpConfig(parseMcpConfigJson(text, sourcePath));
}

export function scanNormalizedMcpConfig(config: NormalizedMcpConfig): ScanReport {
  const issues: ScannerIssue[] = [...config.warnings];

  if (config.servers.length === 0) {
    issues.push({
      type: "config_parse",
      severity: "medium",
      ruleId: "scanner.config.no_mcp_servers",
      detail: "No MCP servers were found in the config.",
      evidence: { sourcePath: config.sourcePath },
      recommendedFix: "Use a supported MCP config shape such as { mcpServers: { name: { command, args } } }."
    });
  }

  for (const server of config.servers) {
    issues.push(...scanServerLaunch(server));
    issues.push(...scanDangerousCapabilities(server));
    issues.push(...scanPermissionScope(server));
    issues.push(...scanSupplyChainLaunch(server));
  }

  return createScanReport(issues, config.sourcePath, config.servers.length);
}

export function scanToolMetadata(toolName: string, description: string): readonly ScannerIssue[] {
  const hits = METADATA_POISONING_PATTERNS.filter((pattern) => pattern.test(description));
  if (hits.length === 0) {
    return [];
  }

  return [
    {
      type: "metadata_poisoning",
      severity: "high",
      ruleId: "scanner.metadata.instruction_like_text",
      detail: `Tool ${toolName} contains instruction-like metadata that may poison an agent.`,
      evidence: { toolName, patternCount: hits.length },
      recommendedFix: "Review the MCP server source and remove tool descriptions that instruct the agent to access secrets or call other tools."
    }
  ];
}

export function scanToolSchema(toolName: string, inputSchema: unknown): readonly ScannerIssue[] {
  const keys = collectSchemaKeys(inputSchema);
  const dangerousKeys = keys.filter((key) => DANGEROUS_SCHEMA_KEYS.has(key.toLowerCase()));

  if (dangerousKeys.length === 0) {
    return [];
  }

  const benignName = /read|list|get|search|safe|view/i.test(toolName) && !/write|delete|run|exec|shell/i.test(toolName);

  return [
    {
      type: "schema_poisoning",
      severity: benignName ? "high" : "medium",
      ruleId: benignName ? "scanner.schema.benign_tool_dangerous_schema" : "scanner.schema.dangerous_parameters",
      detail: benignName
        ? `Tool ${toolName} has a benign name but exposes dangerous input parameters.`
        : `Tool ${toolName} exposes dangerous input parameters.`,
      evidence: { toolName, dangerousKeys },
      recommendedFix: "Review the tool schema and verify that parameter names match the advertised tool behavior."
    }
  ];
}

export function scanServerLaunch(server: NormalizedMcpServer): readonly ScannerIssue[] {
  const issues: ScannerIssue[] = [];

  if (server.transport === "http" && server.url && !isLocalUrl(server.url)) {
    issues.push({
      type: "supply_chain",
      severity: "medium",
      ruleId: "scanner.launch.remote_server",
      detail: `Server ${server.name} uses a remote MCP endpoint.`,
      evidence: { server: server.name, url: server.url },
      recommendedFix: "For v1 local developer protection, prefer local stdio servers or explicitly trust the remote endpoint."
    });
  }

  if (server.command && isShellBinary(server.command)) {
    issues.push({
      type: "dangerous_capability",
      severity: "critical",
      ruleId: "scanner.launch.shell_entrypoint",
      detail: `Server ${server.name} is launched through a shell entrypoint.`,
      evidence: { server: server.name, command: server.command, args: server.args },
      recommendedFix: "Avoid shell wrappers. Launch a pinned MCP server package or a reviewed local executable directly."
    });
  }

  if (server.envKeys.some((key) => /TOKEN|SECRET|KEY|PASSWORD|AWS_|GITHUB_/i.test(key))) {
    issues.push({
      type: "scope_creep",
      severity: "high",
      ruleId: "scanner.launch.sensitive_env_exposed",
      detail: `Server ${server.name} receives sensitive-looking environment variables.`,
      evidence: { server: server.name, envKeys: server.envKeys.filter((key) => /TOKEN|SECRET|KEY|PASSWORD|AWS_|GITHUB_/i.test(key)) },
      recommendedFix: "Scrub child process environment by default and allowlist only variables the server truly needs."
    });
  }

  return issues;
}

export function scanDangerousCapabilities(server: NormalizedMcpServer): readonly ScannerIssue[] {
  const haystack = `${server.name} ${server.command ?? ""} ${server.args.join(" ")}`.toLowerCase();
  const issues: ScannerIssue[] = [];

  if (/shell|terminal|exec|command/.test(haystack)) {
    issues.push({
      type: "dangerous_capability",
      severity: "critical",
      ruleId: "scanner.capability.shell_execution",
      detail: `Server ${server.name} appears to expose shell or command execution capability.`,
      evidence: { server: server.name, command: server.command ?? null, args: server.args },
      recommendedFix: "Place this server behind strict mode and block destructive commands before execution."
    });
  }

  if (/github|git\b/.test(haystack) && /write|push|repo|pull-request|pr/.test(haystack)) {
    issues.push({
      type: "dangerous_capability",
      severity: "high",
      ruleId: "scanner.capability.git_write",
      detail: `Server ${server.name} appears to expose Git or GitHub write capability.`,
      evidence: { server: server.name, command: server.command ?? null, args: server.args },
      recommendedFix: "Require approval for push, PR, merge, workflow, and branch deletion actions."
    });
  }

  return issues;
}

export function scanPermissionScope(server: NormalizedMcpServer): readonly ScannerIssue[] {
  const haystack = `${server.name} ${server.command ?? ""} ${server.args.join(" ")}`.toLowerCase();
  const looksLikeFilesystem = /filesystem|file-system|fileserver|fs\b/.test(haystack);
  if (!looksLikeFilesystem) {
    return [];
  }

  const broadRoots = server.args.filter(isBroadFilesystemRoot);
  if (broadRoots.length === 0) {
    return [];
  }

  return [
    {
      type: "scope_creep",
      severity: "critical",
      ruleId: "scanner.scope.filesystem_broad_root",
      detail: `Filesystem server ${server.name} appears to expose a broad filesystem root.`,
      evidence: { server: server.name, broadRoots },
      recommendedFix: "Restrict filesystem MCP roots to the project workspace and block home/root traversal."
    }
  ];
}

export function scanSupplyChainLaunch(server: NormalizedMcpServer): readonly ScannerIssue[] {
  const issues: ScannerIssue[] = [];
  const command = server.command ?? "";
  const launchText = `${command} ${server.args.join(" ")}`.trim();

  if (usesPackageRunner(command)) {
    const packageName = firstPackageArg(server.args);
    if (!packageName || !isPinnedPackage(packageName)) {
      issues.push({
        type: "supply_chain",
        severity: "medium",
        ruleId: "scanner.supply_chain.unpinned_package_runner",
        detail: `Server ${server.name} uses a package runner without a pinned package version.`,
        evidence: { server: server.name, command, packageName: packageName ?? null },
        recommendedFix: "Pin MCP server packages, for example @modelcontextprotocol/server-filesystem@x.y.z."
      });
    }
  }

  if (/curl\s+|wget\s+/i.test(launchText) && /\|\s*(sh|bash|zsh)\b/i.test(launchText)) {
    issues.push({
      type: "supply_chain",
      severity: "critical",
      ruleId: "scanner.supply_chain.pipe_to_shell",
      detail: `Server ${server.name} launch command appears to pipe a remote script into a shell.`,
      evidence: { server: server.name, launch: launchText },
      recommendedFix: "Never launch MCP servers through curl|sh. Use reviewed, pinned packages or local executables."
    });
  }

  return issues;
}

export function riskFromIssues(issues: readonly ScannerIssue[]): Severity {
  const rank: Record<Severity, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };

  return issues.reduce<Severity>((highest, issue) => (rank[issue.severity] > rank[highest] ? issue.severity : highest), "info");
}

export function createScanReport(issues: readonly ScannerIssue[], sourcePath = "inline", scannedServers = 0): ScanReport {
  return {
    reportVersion: "1.0",
    sourcePath,
    scannedServers,
    overallRisk: riskFromIssues(issues),
    issues
  };
}

export function formatScanReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`Overall risk: ${report.overallRisk.toUpperCase()}`);
  lines.push(`Source: ${report.sourcePath}`);
  lines.push(`Servers scanned: ${report.scannedServers}`);

  if (report.issues.length === 0) {
    lines.push("\nNo scanner issues found.");
    return lines.join("\n");
  }

  const severities: readonly Severity[] = ["critical", "high", "medium", "low", "info"];
  for (const severity of severities) {
    const issues = report.issues.filter((issue) => issue.severity === severity);
    if (issues.length === 0) {
      continue;
    }

    lines.push(`\n${capitalize(severity)}:`);
    for (const issue of issues) {
      lines.push(`- [${issue.ruleId}] ${issue.detail}`);
    }
  }

  const fixes = unique(report.issues.map((issue) => issue.recommendedFix).filter(isString));
  if (fixes.length > 0) {
    lines.push("\nRecommended fixes:");
    fixes.forEach((fix, index) => lines.push(`${index + 1}. ${fix}`));
  }

  return lines.join("\n");
}

export function stringifyScanReport(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}

function parseJsonObject(text: string, sourcePath: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      throw new Error("top-level JSON value must be an object");
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Invalid MCP config JSON in ${sourcePath}: ${message}`);
  }
}

function normalizeServer(
  name: string,
  rawServer: unknown,
  warnings: ScannerIssue[]
): NormalizedMcpServer | null {
  if (!isRecord(rawServer)) {
    warnings.push(invalidServerShape(name));
    return null;
  }

  const command = stringProp(rawServer, "command");
  const args = stringArrayProp(rawServer, "args");
  const cwd = stringProp(rawServer, "cwd");
  const url = stringProp(rawServer, "url") ?? stringProp(rawServer, "endpoint");
  const env = rawServer["env"];
  const envKeys = isRecord(env) ? Object.keys(env).sort() : [];
  const transport = command ? "stdio" : url ? "http" : "unknown";

  if (!command && !url) {
    warnings.push({
      type: "config_parse",
      severity: "medium",
      ruleId: "scanner.config.missing_launch_target",
      detail: `Server ${name} does not define a command or URL.`,
      evidence: { server: name },
      recommendedFix: "Define a stdio command or explicit remote URL for the MCP server."
    });
  }

  return compactServer({ name, transport, command, args, cwd, url, envKeys, raw: rawServer });
}

function compactServer(input: {
  readonly name: string;
  readonly transport: "stdio" | "http" | "unknown";
  readonly command?: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly url?: string;
  readonly envKeys: readonly string[];
  readonly raw: Readonly<Record<string, unknown>>;
}): NormalizedMcpServer {
  const base = {
    name: input.name,
    transport: input.transport,
    args: input.args,
    envKeys: input.envKeys,
    raw: input.raw
  };

  return {
    ...base,
    ...(input.command ? { command: input.command } : {}),
    ...(input.cwd ? { cwd: input.cwd } : {}),
    ...(input.url ? { url: input.url } : {})
  };
}

function invalidServerShape(name: string): ScannerIssue {
  return {
    type: "config_parse",
    severity: "medium",
    ruleId: "scanner.config.invalid_server_shape",
    detail: `Server ${name} is not an object and cannot be scanned.`,
    evidence: { server: name },
    recommendedFix: "Use an object with command, args, env, cwd, or url fields."
  };
}

function collectSchemaKeys(value: unknown): readonly string[] {
  const keys = new Set<string>();
  walk(value);
  return [...keys].sort();

  function walk(current: unknown): void {
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    if (!isRecord(current)) {
      return;
    }

    for (const [key, nested] of Object.entries(current)) {
      keys.add(key);
      if (key === "properties" && isRecord(nested)) {
        Object.keys(nested).forEach((propertyName) => keys.add(propertyName));
      }
      walk(nested);
    }
  }
}

function stringProp(record: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function stringArrayProp(record: Readonly<Record<string, unknown>>, key: string): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isString);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isShellBinary(command: string): boolean {
  return /(^|\/|\\)(sh|bash|zsh|fish|powershell|pwsh|cmd)(\.exe)?$/i.test(command);
}

function usesPackageRunner(command: string): boolean {
  return /(^|\/|\\)(npx|bunx)$/.test(command) || /(^|\/|\\)(pnpm|yarn)$/.test(command);
}

function firstPackageArg(args: readonly string[]): string | null {
  const ignored = new Set(["-y", "--yes", "dlx", "exec", "--package"]);
  for (const arg of args) {
    if (arg.startsWith("--package=")) {
      return arg.slice("--package=".length);
    }

    if (arg.startsWith("-") || ignored.has(arg)) {
      continue;
    }

    return arg;
  }

  return null;
}

function isPinnedPackage(packageName: string): boolean {
  if (packageName.startsWith("@")) {
    return packageName.lastIndexOf("@") > 0;
  }

  return packageName.includes("@");
}

function isBroadFilesystemRoot(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, "/");
  return (
    normalized === "/" ||
    normalized === "~" ||
    normalized === "$HOME" ||
    normalized === "${HOME}" ||
    /^\/users\/?$/i.test(normalized) ||
    /^\/home\/?$/i.test(normalized) ||
    /^[a-z]:\/?$/i.test(normalized)
  );
}

function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/|$)/i.test(url);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
