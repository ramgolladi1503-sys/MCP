import { describe, expect, it } from "vitest";
import { buildToolCallDecisionAuditEvent } from "../../packages/audit/src/events";
import { evaluatePolicy } from "../../packages/policy/src/engine";
import { parsePolicyDocument, parsePolicyJson } from "../../packages/policy/src/parser";

describe("policy parser", () => {
  it("parses a YAML-lite policy document", () => {
    const policy = parsePolicyDocument(`
rules:
  - id: block-secrets
    decision: block
    severity: high
    reason: Block secret access
    match:
      args_contains_any: [.env, id_rsa, credentials.json]
  - id: approve-shell-delete
    decision: require_approval
    severity: critical
    reason: Require approval for destructive shell commands
    match:
      command_contains_any: [rm -rf, drop database]
`);

    expect(policy.rules).toHaveLength(2);
    expect(policy.rules[0].id).toBe("block-secrets");
    expect(policy.rules[0].match.args_contains_any).toEqual([".env", "id_rsa", "credentials.json"]);
  });

  it("parses a JSON policy document", () => {
    const policy = parsePolicyJson(
      JSON.stringify({
        rules: [
          {
            id: "audit-github-write",
            decision: "audit_only",
            severity: "medium",
            reason: "Audit GitHub writes",
            match: { tool_name_contains_any: ["github"] },
          },
        ],
      }),
    );

    expect(policy.rules[0].decision).toBe("audit_only");
  });

  it("rejects rules without reasons", () => {
    expect(() =>
      parsePolicyDocument(`
rules:
  - id: bad-rule
    decision: block
    severity: high
    match:
      args_contains_any: [.env]
`),
    ).toThrow(/POLICY_RULE_REASON_INVALID/);
  });
});

describe("audit event builder", () => {
  it("builds redacted tool-call decision audit events", () => {
    const policy = parsePolicyDocument(`
rules:
  - id: block-secrets
    decision: block
    severity: high
    reason: Block secret access
    match:
      args_contains_any: [.env]
`);

    const call = {
      toolName: "filesystem.read",
      args: {
        path: "/repo/.env",
        apiKey: "should-not-log",
        nested: { accessToken: "token" },
      },
    };
    const evaluation = evaluatePolicy(policy.rules, call);
    const event = buildToolCallDecisionAuditEvent(call, evaluation, 123456);

    expect(event).toEqual({
      eventType: "tool_call_decision",
      timestampEpochMs: 123456,
      toolName: "filesystem.read",
      decision: "block",
      severity: "high",
      reason: "Block secret access",
      matchedRuleIds: ["block-secrets"],
      redactedArgs: {
        path: "/repo/.env",
        apiKey: "[REDACTED]",
        nested: { accessToken: "[REDACTED]" },
      },
    });
  });
});
