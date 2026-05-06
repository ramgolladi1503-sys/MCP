import { blockedJsonRpcResponse, nowIso } from "@mcp-shield/shared";
import type { JsonRpcRequest, JsonRpcResponse, ToolCallContext } from "@mcp-shield/shared";
import { decideToolCall } from "@mcp-shield/policy";
import type { PolicyConfig } from "@mcp-shield/policy";

export interface GatewayDecisionResult {
  readonly shouldForward: boolean;
  readonly response?: JsonRpcResponse;
  readonly context?: ToolCallContext;
}

export function evaluateJsonRpcRequest(params: {
  readonly request: JsonRpcRequest;
  readonly policy: PolicyConfig;
  readonly sessionId: string;
  readonly serverName: string;
  readonly mode: ToolCallContext["mode"];
  readonly eventId: string;
}): GatewayDecisionResult {
  const { request, policy, sessionId, serverName, mode, eventId } = params;

  if (request.method !== "tools/call") {
    return { shouldForward: true };
  }

  const toolCall = parseToolCallParams(request.params);
  if (!toolCall) {
    return {
      shouldForward: false,
      response: blockedJsonRpcResponse(
        request.id ?? null,
        {
          ruleId: "protocol.invalid_tool_call_shape",
          severity: "high"
        },
        eventId
      )
    };
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

  if (decision.decision === "BLOCK") {
    return {
      shouldForward: false,
      context,
      response: blockedJsonRpcResponse(request.id ?? null, decision, eventId)
    };
  }

  return { shouldForward: true, context };
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
