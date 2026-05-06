import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { createAuditEvent, appendAuditEvent } from "@mcp-shield/audit";
import { blockedJsonRpcResponse, nowIso } from "@mcp-shield/shared";
import type { AuditEvent, JsonRpcRequest, JsonRpcResponse, ToolCallContext } from "@mcp-shield/shared";
import { decideToolCall } from "@mcp-shield/policy";
import type { PolicyConfig } from "@mcp-shield/policy";

export interface GatewayDecisionResult {
  readonly shouldForward: boolean;
  readonly response?: JsonRpcResponse;
  readonly context?: ToolCallContext;
  readonly auditEvent?: AuditEvent;
}

export interface StdioGatewayOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly policy: PolicyConfig;
  readonly sessionId: string;
  readonly serverName: string;
  readonly mode: ToolCallContext["mode"];
  readonly auditFile: string;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export function evaluateJsonRpcRequest(params: {
  readonly request: JsonRpcRequest;
  readonly policy: PolicyConfig;
  readonly sessionId: string;
  readonly serverName: string;
  readonly mode: ToolCallContext["mode"];
  readonly eventId: string;
  readonly previousEventHash?: string | null;
}): GatewayDecisionResult {
  const { request, policy, sessionId, serverName, mode, eventId, previousEventHash = null } = params;

  if (request.method === "tools/list" || request.method === "initialize" || request.method === "notifications/initialized" || request.method === "ping") {
    return { shouldForward: true };
  }

  if (request.method !== "tools/call") {
    return { shouldForward: true };
  }

  const toolCall = parseToolCallParams(request.params);
  if (!toolCall) {
    const response = blockedJsonRpcResponse(
      request.id ?? null,
      {
        ruleId: "protocol.invalid_tool_call_shape",
        severity: "high"
      },
      eventId
    );
    const auditEvent = createAuditEvent({
      previousEventHash,
      sessionId,
      serverName,
      method: request.method,
      decision: "BLOCK",
      severity: "high",
      ruleId: "protocol.invalid_tool_call_shape",
      reason: "tools/call params must include name and arguments object",
      mode
    });
    return { shouldForward: false, response, auditEvent };
  }

  const context: ToolCallContext = {
    sessionId,
    serverName,
    toolName: toolCall.name,
    arguments: toolCall.arguments,
    rawMessageId: request.id ?? null,
    timestamp: nowIso(),
    mode
  };

  const decision = decideToolCall(policy, context);
  const auditEvent = createAuditEvent({
    previousEventHash,
    sessionId,
    serverName,
    method: request.method,
    toolName: context.toolName,
    argsSummary: context.arguments,
    decision: decision.decision,
    severity: decision.severity,
    ruleId: decision.ruleId,
    reason: decision.reason,
    mode
  });

  if (decision.decision === "BLOCK") {
    return {
      shouldForward: false,
      context,
      auditEvent,
      response: blockedJsonRpcResponse(request.id ?? null, decision, eventId)
    };
  }

  return { shouldForward: true, context, auditEvent };
}

export function parseJsonRpcLine(line: string): JsonRpcRequest | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (!isJsonRpcRequest(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function serializeJsonRpc(value: JsonRpcRequest | JsonRpcResponse | unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export async function startStdioGateway(options: StdioGatewayOptions): Promise<void> {
  const child = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    env: buildChildEnv(options.env),
    stdio: ["pipe", "pipe", "pipe"]
  });

  let previousEventHash: string | null = null;

  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(`[mcp-shield:${options.serverName}:stderr] ${chunk.toString()}`);
  });

  const serverLines = createInterface({ input: child.stdout });
  serverLines.on("line", (line) => {
    // stdout is protocol-only: server protocol output is forwarded as-is.
    process.stdout.write(`${line}\n`);
  });

  const clientLines = createInterface({ input: process.stdin });
  clientLines.on("line", async (line) => {
    const request = parseJsonRpcLine(line);
    if (!request) {
      process.stderr.write("[mcp-shield] Dropped malformed client JSON-RPC line.\n");
      return;
    }

    const result = evaluateJsonRpcRequest({
      request,
      policy: options.policy,
      sessionId: options.sessionId,
      serverName: options.serverName,
      mode: options.mode,
      eventId: `evt_${Date.now()}`,
      previousEventHash
    });

    if (result.auditEvent) {
      previousEventHash = result.auditEvent.eventHash;
      await appendAuditEvent(options.auditFile, result.auditEvent);
    }

    if (!result.shouldForward) {
      if (result.response) {
        process.stdout.write(serializeJsonRpc(result.response));
      }
      return;
    }

    child.stdin.write(`${line}\n`);
  });

  const stop = (): void => {
    child.kill("SIGTERM");
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
}

function parseToolCallParams(params: unknown): { readonly name: string; readonly arguments: Readonly<Record<string, unknown>> } | null {
  if (!isRecord(params)) {
    return null;
  }

  const name = params.name;
  const args = params.arguments;

  if (typeof name !== "string" || !isRecord(args)) {
    return null;
  }

  return { name, arguments: args };
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return isRecord(value) && value["jsonrpc"] === "2.0" && typeof value["method"] === "string";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildChildEnv(allowedEnv: Readonly<Record<string, string>> | undefined): NodeJS.ProcessEnv {
  // Fail-safe default: do not inherit secrets from parent env. Caller must explicitly pass allowed env.
  return {
    PATH: process.env["PATH"] ?? "",
    ...(allowedEnv ?? {})
  };
}
