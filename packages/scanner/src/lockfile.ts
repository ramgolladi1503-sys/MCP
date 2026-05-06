import { createHash } from "node:crypto";
import type { ScannerIssue } from "./index";

export interface ToolManifestInput {
  readonly serverName: string;
  readonly toolName: string;
  readonly description?: string;
  readonly inputSchema?: unknown;
}

export interface ServerManifestInput {
  readonly serverName: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly tools: readonly ToolManifestInput[];
}

export interface ToolManifestLock {
  readonly serverName: string;
  readonly toolName: string;
  readonly descriptionHash: string;
  readonly inputSchemaHash: string;
  readonly fullManifestHash: string;
}

export interface ServerManifestLock {
  readonly serverName: string;
  readonly commandHash: string;
  readonly argsHash: string;
  readonly cwdHash: string;
  readonly toolsHash: string;
  readonly tools: readonly ToolManifestLock[];
  readonly firstSeen: string;
  readonly lastSeen: string;
}

export interface McpShieldLockfile {
  readonly lockfileVersion: "1.0";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly servers: readonly ServerManifestLock[];
}

export interface ManifestDiff {
  readonly serverName: string;
  readonly type: "server_added" | "server_removed" | "server_changed" | "tool_added" | "tool_removed" | "tool_changed";
  readonly severity: "medium" | "high";
  readonly detail: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

export function createLockfileFromManifests(manifests: readonly ServerManifestInput[], timestamp: string): McpShieldLockfile {
  return {
    lockfileVersion: "1.0",
    createdAt: timestamp,
    updatedAt: timestamp,
    servers: manifests.map((manifest) => createServerLock(manifest, timestamp))
  };
}

export function updateLockfile(previous: McpShieldLockfile, manifests: readonly ServerManifestInput[], timestamp: string): McpShieldLockfile {
  const previousByName = new Map(previous.servers.map((server) => [server.serverName, server]));
  return {
    lockfileVersion: "1.0",
    createdAt: previous.createdAt,
    updatedAt: timestamp,
    servers: manifests.map((manifest) => {
      const old = previousByName.get(manifest.serverName);
      const next = createServerLock(manifest, timestamp);
      return old ? { ...next, firstSeen: old.firstSeen } : next;
    })
  };
}

export function diffLockfile(previous: McpShieldLockfile, next: McpShieldLockfile): readonly ManifestDiff[] {
  const diffs: ManifestDiff[] = [];
  const previousServers = new Map(previous.servers.map((server) => [server.serverName, server]));
  const nextServers = new Map(next.servers.map((server) => [server.serverName, server]));

  for (const [serverName, oldServer] of previousServers) {
    const newServer = nextServers.get(serverName);
    if (!newServer) {
      diffs.push({ serverName, type: "server_removed", severity: "medium", detail: `Server ${serverName} was removed from the manifest.` });
      continue;
    }

    if (oldServer.commandHash !== newServer.commandHash || oldServer.argsHash !== newServer.argsHash || oldServer.cwdHash !== newServer.cwdHash) {
      diffs.push({
        serverName,
        type: "server_changed",
        severity: "high",
        detail: `Server ${serverName} launch command, args, or cwd changed.`,
        before: { commandHash: oldServer.commandHash, argsHash: oldServer.argsHash, cwdHash: oldServer.cwdHash },
        after: { commandHash: newServer.commandHash, argsHash: newServer.argsHash, cwdHash: newServer.cwdHash }
      });
    }

    const previousTools = new Map(oldServer.tools.map((tool) => [tool.toolName, tool]));
    const nextTools = new Map(newServer.tools.map((tool) => [tool.toolName, tool]));

    for (const [toolName, oldTool] of previousTools) {
      const newTool = nextTools.get(toolName);
      if (!newTool) {
        diffs.push({ serverName, type: "tool_removed", severity: "medium", detail: `Tool ${toolName} was removed from server ${serverName}.` });
        continue;
      }

      if (oldTool.fullManifestHash !== newTool.fullManifestHash) {
        diffs.push({
          serverName,
          type: "tool_changed",
          severity: "high",
          detail: `Tool ${toolName} manifest changed on server ${serverName}.`,
          before: oldTool,
          after: newTool
        });
      }
    }

    for (const toolName of nextTools.keys()) {
      if (!previousTools.has(toolName)) {
        diffs.push({ serverName, type: "tool_added", severity: "high", detail: `Tool ${toolName} was added to server ${serverName}.` });
      }
    }
  }

  for (const serverName of nextServers.keys()) {
    if (!previousServers.has(serverName)) {
      diffs.push({ serverName, type: "server_added", severity: "high", detail: `New server ${serverName} was added to the manifest.` });
    }
  }

  return diffs;
}

export function scanManifestDrift(diffs: readonly ManifestDiff[]): readonly ScannerIssue[] {
  return diffs.map((diff) => ({
    type: "manifest_drift",
    severity: diff.severity,
    ruleId: `scanner.manifest_drift.${diff.type}`,
    detail: diff.detail,
    evidence: { before: diff.before ?? null, after: diff.after ?? null },
    recommendedFix: "Review the readable manifest diff and re-lock only trusted server/tool changes."
  }));
}

export function formatManifestDiff(diffs: readonly ManifestDiff[]): string {
  if (diffs.length === 0) {
    return "No manifest drift detected.";
  }

  return diffs
    .map((diff) => {
      const lines = [`${diff.severity.toUpperCase()} ${diff.type}: ${diff.detail}`];
      if (diff.before !== undefined) {
        lines.push(`Before: ${JSON.stringify(diff.before, null, 2)}`);
      }
      if (diff.after !== undefined) {
        lines.push(`After: ${JSON.stringify(diff.after, null, 2)}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function createServerLock(manifest: ServerManifestInput, timestamp: string): ServerManifestLock {
  const tools = manifest.tools.map(createToolLock).sort((a, b) => a.toolName.localeCompare(b.toolName));
  return {
    serverName: manifest.serverName,
    commandHash: hash(manifest.command ?? ""),
    argsHash: hash(manifest.args ?? []),
    cwdHash: hash(manifest.cwd ?? ""),
    toolsHash: hash(tools.map((tool) => tool.fullManifestHash)),
    tools,
    firstSeen: timestamp,
    lastSeen: timestamp
  };
}

function createToolLock(tool: ToolManifestInput): ToolManifestLock {
  const descriptionHash = hash(tool.description ?? "");
  const inputSchemaHash = hash(tool.inputSchema ?? {});
  return {
    serverName: tool.serverName,
    toolName: tool.toolName,
    descriptionHash,
    inputSchemaHash,
    fullManifestHash: hash({ descriptionHash, inputSchemaHash, toolName: tool.toolName })
  };
}

function hash(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(sortKeys(value))).digest("hex")}`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, sortKeys(nested)]));
}
