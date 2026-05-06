export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcValidation = {
  ok: boolean;
  code?: string;
  reason?: string;
};

export function validateJsonRpcRequest(input: unknown): JsonRpcValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      code: "JSONRPC_REQUEST_NOT_OBJECT",
      reason: "JSON-RPC request must be an object.",
    };
  }

  const request = input as Record<string, unknown>;

  if (request.jsonrpc !== "2.0") {
    return {
      ok: false,
      code: "JSONRPC_VERSION_INVALID",
      reason: "JSON-RPC request must declare jsonrpc version 2.0.",
    };
  }

  if (typeof request.method !== "string" || request.method.trim().length === 0) {
    return {
      ok: false,
      code: "JSONRPC_METHOD_INVALID",
      reason: "JSON-RPC request method must be a non-empty string.",
    };
  }

  if (
    "id" in request &&
    request.id !== null &&
    typeof request.id !== "string" &&
    typeof request.id !== "number"
  ) {
    return {
      ok: false,
      code: "JSONRPC_ID_INVALID",
      reason: "JSON-RPC id must be a string, number, null, or omitted.",
    };
  }

  return { ok: true };
}

export function isMcpToolCallRequest(input: unknown): boolean {
  const validation = validateJsonRpcRequest(input);
  if (!validation.ok) return false;

  const request = input as JsonRpcRequest;
  return request.method === "tools/call";
}

export function extractMcpToolCall(input: unknown): {
  ok: boolean;
  toolName?: string;
  args?: unknown;
  code?: string;
  reason?: string;
} {
  const validation = validateJsonRpcRequest(input);
  if (!validation.ok) {
    return validation;
  }

  const request = input as JsonRpcRequest;
  if (request.method !== "tools/call") {
    return {
      ok: false,
      code: "MCP_METHOD_NOT_TOOL_CALL",
      reason: "Only MCP tools/call requests can be converted into tool-call policy input.",
    };
  }

  if (!request.params || typeof request.params !== "object" || Array.isArray(request.params)) {
    return {
      ok: false,
      code: "MCP_TOOL_PARAMS_INVALID",
      reason: "MCP tools/call params must be an object.",
    };
  }

  const params = request.params as Record<string, unknown>;
  if (typeof params.name !== "string" || params.name.trim().length === 0) {
    return {
      ok: false,
      code: "MCP_TOOL_NAME_INVALID",
      reason: "MCP tools/call params.name must be a non-empty string.",
    };
  }

  return {
    ok: true,
    toolName: params.name,
    args: params.arguments ?? {},
  };
}
