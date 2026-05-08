import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, decideToolCall } from "../../packages/policy/src/index";
import type { RuntimeMode, ToolCallContext } from "../../packages/shared/src/index";

function context(mode: RuntimeMode, args: Record<string, unknown>): ToolCallContext {
  return {
    sessionId: `sess_${mode}`,
    serverName: "matrix-server",
    toolName: "shell.run",
    arguments: args,
    rawMessageId: 1,
    timestamp: "2026-05-07T00:00:00.000Z",
    mode
  };
}

describe("policy mode matrix", () => {
  it.each([
    ["audit-only" as const, "WARN", "command.approval_required"],
    ["balanced" as const, "APPROVE", "command.approval_required"],
    ["strict" as const, "BLOCK", "command.approval_required"]
  ])("maps approval-required commands in %s mode", (mode, expectedDecision, expectedRule) => {
    const decision = decideToolCall(DEFAULT_POLICY, context(mode, { command: "git push origin main" }));

    expect(decision.decision).toBe(expectedDecision);
    expect(decision.ruleId).toBe(expectedRule);
  });

  it.each(["audit-only", "balanced", "strict"] as const)("always blocks explicit blocked commands in %s mode", (mode) => {
    const decision = decideToolCall(DEFAULT_POLICY, context(mode, { command: "rm -rf ./src" }));

    expect(decision.decision).toBe("BLOCK");
    expect(decision.ruleId).toBe("command.blocked");
  });

  it.each(["audit-only", "balanced", "strict"] as const)("always blocks blocked secret paths in %s mode", (mode) => {
    const decision = decideToolCall(DEFAULT_POLICY, context(mode, { path: ".env" }));

    expect(decision.decision).toBe("BLOCK");
    expect(decision.ruleId).toBe("secret.path.blocked");
  });

  it.each(["audit-only", "balanced", "strict"] as const)("allows explicit safe path exceptions in %s mode", (mode) => {
    const decision = decideToolCall(DEFAULT_POLICY, context(mode, { path: ".env.example" }));

    expect(decision.decision).toBe("ALLOW");
    expect(decision.ruleId).toBe("path.exception");
  });
});
