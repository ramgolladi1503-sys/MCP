import { describe, expect, it } from "vitest";
import { evaluateJsonRpcRequest } from "../../../packages/gateway/src/index";
import type { PolicyConfig } from "../../../packages/policy/src/index";

const policy: PolicyConfig = {
  policyVersion: "1.0",
  defaultAction: "allow",
  workspaceRoots: ["./project"],
  blockedPaths: [".env"],
  allowedPathExceptions: [".env.example"],
  blockedCommands: ["rm -rf*"],
  approvalRequired: ["git push*"],
  allowedDomains: ["github.com"],
  denyUnknownDomains: true,
  featureFlags: {
    scanner: true,
    gateway: true,
    responseInspector: false,
    resourcePromptInspector: false,
    manifestDrift: false,
    tamperEvidentAudit: true,
    approvalPrompt: false,
    configRewrite: false
  }
};

describe("evaluateJsonRpcRequest", () => {
  it("passes through non-tool-call JSON-RPC methods", () => {
    const result = evaluateJsonRpcRequest({
      request: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      policy,
      sessionId: "sess_test",
      serverName: "filesystem",
      mode: "balanced",
      eventId: "evt_1"
    });

    expect(result.shouldForward).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it("blocks malformed tools/call requests with a protocol-safe response", () => {
    const result = evaluateJsonRpcRequest({
      request: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "filesystem.read_file" } },
      policy,
      sessionId: "sess_test",
      serverName: "filesystem",
      mode: "balanced",
      eventId: "evt_bad"
    });

    expect(result.shouldForward).toBe(false);
    expect(result.response).toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: {
        code: -32001,
        message: "MCP Shield blocked this tool call",
        data: {
          event_id: "evt_bad",
          rule_id: "protocol.invalid_tool_call_shape",
          severity: "high"
        }
      }
    });
  });

  it("blocks unsafe tools/call requests before forwarding", () => {
    const result = evaluateJsonRpcRequest({
      request: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "filesystem.read_file",
          arguments: { path: ".env" }
        }
      },
      policy,
      sessionId: "sess_test",
      serverName: "filesystem",
      mode: "balanced",
      eventId: "evt_block"
    });

    expect(result.shouldForward).toBe(false);
    expect(result.context?.toolName).toBe("filesystem.read_file");
    expect(result.response?.jsonrpc).toBe("2.0");
  });

  it("forwards safe tools/call requests and preserves context", () => {
    const result = evaluateJsonRpcRequest({
      request: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "filesystem.read_file",
          arguments: { path: "README.md" }
        }
      },
      policy,
      sessionId: "sess_test",
      serverName: "filesystem",
      mode: "balanced",
      eventId: "evt_allow"
    });

    expect(result.shouldForward).toBe(true);
    expect(result.context).toMatchObject({
      sessionId: "sess_test",
      serverName: "filesystem",
      toolName: "filesystem.read_file",
      rawMessageId: 4,
      mode: "balanced"
    });
  });
});
