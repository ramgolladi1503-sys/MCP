import { describe, expect, it } from "vitest";
import { evaluatePolicy, redactSecrets, type PolicyRule } from "../../packages/policy/src/engine";

const rules: PolicyRule[] = [
  {
    id: "block-secret-file-access",
    decision: "block",
    severity: "high",
    reason: "Tool call attempts to access sensitive credential material.",
    match: {
      args_contains_any: [".env", "id_rsa", "credentials.json"],
    },
  },
  {
    id: "require-approval-for-destructive-shell",
    decision: "require_approval",
    severity: "critical",
    reason: "Destructive operation requires human approval.",
    match: {
      command_contains_any: ["rm -rf", "drop database", "kubectl delete"],
    },
  },
  {
    id: "audit-repository-writes",
    decision: "audit_only",
    severity: "medium",
    reason: "Repository write should be audited.",
    match: {
      tool_name_contains_any: ["github"],
      args_contains_any: ["create_file", "update_file", "delete_file"],
    },
  },
];

describe("policy engine", () => {
  it("allows safe tool calls when no rule matches", () => {
    const result = evaluatePolicy(rules, {
      toolName: "filesystem.read",
      args: { path: "docs/README.md" },
    });

    expect(result.decision).toBe("allow");
    expect(result.matchedRules).toHaveLength(0);
  });

  it("blocks secret access before execution", () => {
    const result = evaluatePolicy(rules, {
      toolName: "filesystem.read",
      args: { path: "/repo/.env" },
    });

    expect(result.decision).toBe("block");
    expect(result.severity).toBe("high");
    expect(result.matchedRules.map((rule) => rule.id)).toContain("block-secret-file-access");
  });

  it("requires approval for destructive shell commands", () => {
    const result = evaluatePolicy(rules, {
      toolName: "shell.run",
      command: "rm -rf /tmp/build-cache",
    });

    expect(result.decision).toBe("require_approval");
    expect(result.severity).toBe("critical");
  });

  it("uses the highest-risk decision when multiple rules match", () => {
    const result = evaluatePolicy(rules, {
      toolName: "github.update_file",
      command: "rm -rf .git",
      args: { path: ".env", operation: "update_file" },
    });

    expect(result.decision).toBe("block");
    expect(result.matchedRules.length).toBeGreaterThanOrEqual(2);
  });

  it("redacts nested secrets before audit persistence", () => {
    const redacted = redactSecrets({
      apiKey: "abc",
      user: "ram",
      nested: {
        accessToken: "token-value",
        password: "secret-password",
      },
    });

    expect(redacted).toEqual({
      apiKey: "[REDACTED]",
      user: "ram",
      nested: {
        accessToken: "[REDACTED]",
        password: "[REDACTED]",
      },
    });
  });
});
