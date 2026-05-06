import { describe, expect, it } from "vitest";
import { decideToolCall } from "../../../packages/policy/src/index";
import type { PolicyConfig } from "../../../packages/policy/src/index";
import type { ToolCallContext } from "../../../packages/shared/src/index";

const basePolicy: PolicyConfig = {
  policyVersion: "1.0",
  defaultAction: "allow",
  workspaceRoots: ["./project"],
  blockedPaths: [".env", "*.pem", ".ssh/*"],
  allowedPathExceptions: [".env.example"],
  blockedCommands: ["rm -rf*", "sudo*", "curl *--data*"],
  approvalRequired: ["git push*", "npm install*"],
  allowedDomains: ["github.com", "api.github.com"],
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

function context(args: Record<string, unknown>, mode: ToolCallContext["mode"] = "balanced"): ToolCallContext {
  return {
    sessionId: "sess_test",
    serverName: "filesystem",
    toolName: "filesystem.read_file",
    arguments: args,
    rawMessageId: 1,
    timestamp: "2026-05-07T00:00:00.000Z",
    mode
  };
}

describe("decideToolCall", () => {
  it("blocks sensitive path reads before default allow", () => {
    const decision = decideToolCall(basePolicy, context({ path: ".env" }));

    expect(decision.decision).toBe("BLOCK");
    expect(decision.ruleId).toBe("secret.path.blocked");
    expect(decision.severity).toBe("critical");
  });

  it("allows explicit safe path exceptions", () => {
    const decision = decideToolCall(basePolicy, context({ path: ".env.example" }));

    expect(decision.decision).toBe("ALLOW");
    expect(decision.ruleId).toBe("path.exception");
  });

  it("blocks destructive shell command patterns", () => {
    const decision = decideToolCall(basePolicy, context({ command: "rm -rf ./src" }));

    expect(decision.decision).toBe("BLOCK");
    expect(decision.ruleId).toBe("command.blocked");
  });

  it("requires approval for risky commands in balanced mode", () => {
    const decision = decideToolCall(basePolicy, context({ command: "git push origin main" }, "balanced"));

    expect(decision.decision).toBe("APPROVE");
    expect(decision.severity).toBe("high");
  });

  it("turns approval-required commands into warnings in audit-only mode", () => {
    const decision = decideToolCall(basePolicy, context({ command: "npm install left-pad" }, "audit-only"));

    expect(decision.decision).toBe("WARN");
    expect(decision.reason).toContain("Would require approval");
  });

  it("turns approval-required commands into blocks in strict mode", () => {
    const decision = decideToolCall(basePolicy, context({ command: "git push origin main" }, "strict"));

    expect(decision.decision).toBe("BLOCK");
    expect(decision.severity).toBe("high");
  });
});
