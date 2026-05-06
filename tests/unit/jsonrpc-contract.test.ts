import { describe, expect, it } from "vitest";
import {
  extractMcpToolCall,
  isMcpToolCallRequest,
  validateJsonRpcRequest,
} from "../../packages/shared/src/jsonrpc";

describe("JSON-RPC contract validation", () => {
  it("accepts a valid JSON-RPC 2.0 request", () => {
    const result = validateJsonRpcRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects non-object payloads", () => {
    const result = validateJsonRpcRequest("not-jsonrpc");

    expect(result.ok).toBe(false);
    expect(result.code).toBe("JSONRPC_REQUEST_NOT_OBJECT");
  });

  it("rejects invalid jsonrpc version", () => {
    const result = validateJsonRpcRequest({ jsonrpc: "1.0", method: "tools/list" });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("JSONRPC_VERSION_INVALID");
  });

  it("rejects missing or empty method", () => {
    const result = validateJsonRpcRequest({ jsonrpc: "2.0", method: "" });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("JSONRPC_METHOD_INVALID");
  });

  it("detects MCP tool-call requests", () => {
    const request = {
      jsonrpc: "2.0",
      id: "abc",
      method: "tools/call",
      params: { name: "filesystem.read", arguments: { path: "README.md" } },
    };

    expect(isMcpToolCallRequest(request)).toBe(true);
  });

  it("extracts MCP tool-call policy input", () => {
    const result = extractMcpToolCall({
      jsonrpc: "2.0",
      id: "abc",
      method: "tools/call",
      params: { name: "shell.run", arguments: { command: "echo safe" } },
    });

    expect(result).toEqual({
      ok: true,
      toolName: "shell.run",
      args: { command: "echo safe" },
    });
  });

  it("rejects malformed MCP tool-call params", () => {
    const result = extractMcpToolCall({
      jsonrpc: "2.0",
      id: "abc",
      method: "tools/call",
      params: { arguments: { path: ".env" } },
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("MCP_TOOL_NAME_INVALID");
  });
});
