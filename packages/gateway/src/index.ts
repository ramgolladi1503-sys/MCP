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

export interface ResponseInspectionResult {
  readonly decision: "ALLOW_RESPONSE" | "WARN_RESPONSE" | "BLOCK_RESPONSE";
  readonly severity: "info" | "medium" | "high" | "critical";
  readonly ruleId: string;
  readonly reason: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
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
  readonly startupTimeoutMs?: number;
  readonly toolCallTimeoutMs?: number;
}

interface PendingRequest {
  readonly request: JsonRpcRequest;
  readonly timer: NodeJS.Timeout;
  timedOut: boolean;
}

const RESPONSE_POISONING_PATTERNS: readonly [RegExp, string][] = [
  [/ignore\s+(all\s+)?previous\s+instructions/i, "response.poisoning.ignore_previous_instructions"],
  [/read\s+\.env/i, "response.poisoning.secret_read_instruction"],
  [/read\s+(local\s+)?secrets/i, "response.poisoning.secret_read_instruction"],
  [/call\s+.*\b(shell|terminal|exec|tool)\b/i, "response.poisoning.risky_tool_instruction"],
  [/send\s+.*\b(token|credential|secret)\b/i, "response.poisoning.exfiltration_instruction"],
  [/<!--\s*(ignore|read|call|send)/i, "response.poisoning.hidden_markdown_instruction"]
];

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

  if (isPassthroughMethod(request.method)) {
    return { shouldForward: true };
  }

  if (request.method === "resources/read") {
    return evaluateResourceRead({ request, policy, sessionId, serverName, mode, eventId, previousEventHash });
  }

  if (request.method === "prompts/get") {
    return evaluatePromptGet({ request, sessionId, serverName, mode, previousEventHash });
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

export function inspectResponsePayload(payload: unknown): ResponseInspectionResult {
  const text = extractText(payload);
  if (text.length === 0) {
    return {
      decision: "ALLOW_RESPONSE",
      severity: "info",
      ruleId: "response.clean",
      reason: "Response contains no inspectable text."
    };
  }

  for (const [pattern, ruleId] of RESPONSE_POISONING_PATTERNS) {
    if (pattern.test(text)) {
      return {
        decision: "BLOCK_RESPONSE",
        severity: "high",
        ruleId,
        reason: "Tool response contains instruction-like content that may poison the agent.",
        evidence: { excerpt: summarize(text) }
      };
    }
  }

  if (/[A-Za-z0-9+/]{80,}={0,2}/.test(text)) {
    return {
      decision: "WARN_RESPONSE",
      severity: "medium",
      ruleId: "response.suspicious.base64_like_payload",
      reason: "Response contains a long base64-like payload.",
      evidence: { excerpt: summarize(text) }
    };
  }

  return {
    decision: "ALLOW_RESPONSE",
    severity: "info",
    ruleId: "response.clean",
    reason: "Response inspection did not find obvious poisoning patterns."
  };
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

export function parseJsonRpcMessage(line: string): unknown | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function serializeJsonRpc(value: JsonRpcRequest | JsonRpcResponse | unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export async function startStdioGateway(options: StdioGatewayOptions): Promise<void> {
  const startupTimeoutMs = options.startupTimeoutMs ?? 10000;
  const toolCallTimeoutMs = options.toolCallTimeoutMs ?? 60000;
  const child = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    env: buildChildEnv(options.env),
    stdio: ["pipe", "pipe", "pipe"]
  });

  let previousEventHash: string | null = null;
  const pending = new Map<string | number, PendingRequest>();
  const startupTimer = setTimeout(() => {
    process.stderr.write(`[mcp-shield] Gateway startup timeout after ${startupTimeoutMs}ms.\n`);
    child.kill("SIGTERM");
  }, startupTimeoutMs);

  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(`[mcp-shield:${options.serverName}:stderr] ${chunk.toString()}`);
  });

  const serverLines = createInterface({ input: child.stdout });
  serverLines.on("line", async (line) => {
    clearTimeout(startupTimer);
    const message = parseJsonRpcMessage(line);

    if (isJsonRpcRequest(message) && isReverseRequest(message.method)) {
      handleReverseRequest(message, options.policy, child.stdin);
      return;
    }

    if (isJsonRpcResponseLike(message)) {
      const pendingRequest = pending.get(message.id);
      if (pendingRequest) {
        clearTimeout(pendingRequest.timer);
      }

      if (pendingRequest?.timedOut) {
        process.stderr.write(`[mcp-shield] Dropped late response for timed out request ${String(message.id)}.\n`);
        pending.delete(message.id);
        return;
      }

      pending.delete(message.id);

      if (options.policy.featureFlags.responseInspector) {
        const inspection = inspectResponsePayload(message);
        if (inspection.decision === "BLOCK_RESPONSE") {
          const auditEvent = createAuditEvent({
            previousEventHash,
            sessionId: options.sessionId,
            serverName: options.serverName,
            method: pendingRequest?.request.method ?? "response",
            decision: "BLOCK_RESPONSE",
            severity: inspection.severity,
            ruleId: inspection.ruleId,
            reason: inspection.reason,
            mode: options.mode
          });
          previousEventHash = auditEvent.eventHash;
          await appendAuditEvent(options.auditFile, auditEvent);
          process.stdout.write(serializeJsonRpc(blockedJsonRpcResponse(message.id, { ruleId: inspection.ruleId, severity: inspection.severity }, auditEvent.eventId)));
          return;
        }
      }
    }

    process.stdout.write(`${line}\n`);
  });

  const clientLines = createInterface({ input: process.stdin });
  clientLines.on("line", async (line) => {
    const request = parseJsonRpcLine(line);
    if (!request) {
      process.stderr.write("[mcp-shield] Dropped malformed client JSON-RPC line.\n");
      return;
    }

    if (isCancellationRequest(request)) {
      removePendingCancellation(request, pending);
      child.stdin.write(`${line}\n`);
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

    trackPendingRequest(request, pending, toolCallTimeoutMs, options);
    child.stdin.write(`${line}\n`);
  });

  const stop = (): void => {
    for (const pendingRequest of pending.values()) {
      clearTimeout(pendingRequest.timer);
    }
    clearTimeout(startupTimer);
    child.kill("SIGTERM");
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => {
      clearTimeout(startupTimer);
      resolve();
    });
  });
}

function evaluateResourceRead(params: {
  readonly request: JsonRpcRequest;
  readonly policy: PolicyConfig;
  readonly sessionId: string;
  readonly serverName: string;
  readonly mode: ToolCallContext["mode"];
  readonly eventId: string;
  readonly previousEventHash: string | null;
}): GatewayDecisionResult {
  const resourceArgs = extractResourceArgs(params.request.params);
  const context: ToolCallContext = {
    sessionId: params.sessionId,
    serverName: params.serverName,
    toolName: "resources/read",
    arguments: resourceArgs,
    rawMessageId: params.request.id ?? null,
    timestamp: nowIso(),
    mode: params.mode
  };
  const decision = decideToolCall(params.policy, context);
  const auditEvent = createAuditEvent({
    previousEventHash: params.previousEventHash,
    sessionId: params.sessionId,
    serverName: params.serverName,
    method: params.request.method,
    toolName: "resources/read",
    argsSummary: resourceArgs,
    decision: decision.decision,
    severity: decision.severity,
    ruleId: decision.ruleId,
    reason: decision.reason,
    mode: params.mode
  });

  if (decision.decision === "BLOCK") {
    return {
      shouldForward: false,
      context,
      auditEvent,
      response: blockedJsonRpcResponse(params.request.id ?? null, decision, params.eventId)
    };
  }

  return { shouldForward: true, context, auditEvent };
}

function evaluatePromptGet(params: {
  readonly request: JsonRpcRequest;
  readonly sessionId: string;
  readonly serverName: string;
  readonly mode: ToolCallContext["mode"];
  readonly previousEventHash: string | null;
}): GatewayDecisionResult {
  const args = isRecord(params.request.params) ? params.request.params : {};
  const auditEvent = createAuditEvent({
    previousEventHash: params.previousEventHash,
    sessionId: params.sessionId,
    serverName: params.serverName,
    method: params.request.method,
    toolName: "prompts/get",
    argsSummary: args,
    decision: "ALLOW",
    severity: "info",
    ruleId: "prompt.request.audit",
    reason: "Prompt request is forwarded and response will be inspected when enabled.",
    mode: params.mode
  });

  return { shouldForward: true, auditEvent };
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

function extractResourceArgs(params: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(params)) {
    return {};
  }

  const uri = params["uri"];
  const path = params["path"];
  if (typeof path === "string") {
    return { path };
  }

  if (typeof uri === "string") {
    return { path: uri, uri };
  }

  return params;
}

function isPassthroughMethod(method: string): boolean {
  return method === "tools/list" || method === "initialize" || method === "notifications/initialized" || method === "ping" || method === "resources/list" || method === "prompts/list";
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return isRecord(value) && value["jsonrpc"] === "2.0" && typeof value["method"] === "string";
}

function isJsonRpcResponseLike(value: unknown): value is { readonly jsonrpc: "2.0"; readonly id: string | number | null; readonly result?: unknown; readonly error?: unknown } {
  return isRecord(value) && value["jsonrpc"] === "2.0" && "id" in value && ("result" in value || "error" in value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildChildEnv(allowedEnv: Readonly<Record<string, string>> | undefined): NodeJS.ProcessEnv {
  return {
    PATH: process.env["PATH"] ?? "",
    ...(allowedEnv ?? {})
  };
}

function isReverseRequest(method: string): boolean {
  return method === "roots/list" || method === "sampling/createMessage" || method === "elicitation/create";
}

function handleReverseRequest(request: JsonRpcRequest, policy: PolicyConfig, childStdin: NodeJS.WritableStream): void {
  if (request.method === "roots/list") {
    childStdin.write(
      serializeJsonRpc({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          roots: policy.workspaceRoots.map((root) => ({ uri: `file://${root}`, name: root }))
        }
      })
    );
    return;
  }

  childStdin.write(
    serializeJsonRpc({
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: -32001,
        message: "MCP Shield blocked this server-initiated request",
        data: {
          rule_id: `reverse_request.${request.method}.blocked`,
          severity: "high"
        }
      }
    })
  );
}

function isCancellationRequest(request: JsonRpcRequest): boolean {
  return request.method === "notifications/cancelled" || request.method === "$/cancelRequest";
}

function removePendingCancellation(request: JsonRpcRequest, pending: Map<string | number, PendingRequest>): void {
  if (!isRecord(request.params)) {
    return;
  }

  const id = request.params["requestId"] ?? request.params["id"];
  if (typeof id !== "string" && typeof id !== "number") {
    return;
  }

  const pendingRequest = pending.get(id);
  if (pendingRequest) {
    clearTimeout(pendingRequest.timer);
  }
  pending.delete(id);
}

function trackPendingRequest(
  request: JsonRpcRequest,
  pending: Map<string | number, PendingRequest>,
  timeoutMs: number,
  options: StdioGatewayOptions
): void {
  if (request.id === undefined || request.id === null) {
    return;
  }

  const pendingRequest: PendingRequest = {
    request,
    timedOut: false,
    timer: setTimeout(() => {
      pendingRequest.timedOut = true;
      process.stderr.write(`[mcp-shield] Request ${String(request.id)} timed out after ${timeoutMs}ms.\n`);
      process.stdout.write(
        serializeJsonRpc({
          jsonrpc: "2.0",
          id: request.id ?? null,
          error: {
            code: -32002,
            message: "MCP Shield timed out waiting for MCP server response",
            data: {
              server_name: options.serverName,
              timeout_ms: timeoutMs
            }
          }
        })
      );
    }, timeoutMs)
  };

  pending.set(request.id, pendingRequest);
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("\n");
  }

  if (!isRecord(value)) {
    return "";
  }

  return Object.values(value).map(extractText).filter(Boolean).join("\n");
}

function summarize(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`;
}
