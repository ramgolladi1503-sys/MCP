import { describe, expect, it } from "vitest";
import {
  createAuditEvent,
  explainAuditEvent,
  hashEvent,
  parseAuditJsonl,
  redactText,
  replayAuditEvents,
  serializeAuditEvent
} from "../../packages/audit/src/index";

describe("audit redaction and hash-chain", () => {
  it("redacts common secret formats before audit persistence", () => {
    const raw = JSON.stringify({
      authorization: "Bearer abcdefghijklmnopqrstuvwxyz",
      githubToken: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
      db: "postgres://user:password@localhost:5432/app",
      password: "super-secret"
    });

    const redacted = redactText(raw);

    expect(redacted.redactionApplied).toBe(true);
    expect(redacted.value).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(redacted.value).not.toContain("postgres://user:password");
    expect(redacted.value).not.toContain("super-secret");
    expect(redacted.value).toContain("[REDACTED");
  });

  it("creates chained audit events and detects tampering", () => {
    const first = createAuditEvent({
      previousEventHash: null,
      sessionId: "sess_audit",
      serverName: "filesystem",
      method: "tools/call",
      toolName: "filesystem.read_file",
      argsSummary: { path: ".env", authorization: "Bearer abcdefghijklmnopqrstuvwxyz" },
      decision: "BLOCK",
      severity: "critical",
      ruleId: "secret.path.blocked",
      reason: "Attempted access to a blocked sensitive path",
      mode: "strict"
    });

    const second = createAuditEvent({
      previousEventHash: first.eventHash,
      sessionId: "sess_audit",
      serverName: "shell",
      method: "tools/call",
      toolName: "shell.run",
      argsSummary: { command: "rm -rf ./src" },
      decision: "BLOCK",
      severity: "critical",
      ruleId: "command.blocked",
      reason: "Attempted execution of a blocked command pattern",
      mode: "strict"
    });

    expect(first.eventHash).toBe(hashEvent({ ...first, eventHash: "pending" }));
    expect(second.previousEventHash).toBe(first.eventHash);

    const serialized = serializeAuditEvent(first) + serializeAuditEvent(second);
    expect(serialized).not.toContain("abcdefghijklmnopqrstuvwxyz");

    const cleanReplay = replayAuditEvents(parseAuditJsonl(serialized));
    expect(cleanReplay.totalEvents).toBe(2);
    expect(cleanReplay.warnings).toHaveLength(0);
    expect(cleanReplay.byDecision.BLOCK).toBe(2);

    const tampered = { ...second, ruleId: "default.allow" };
    const tamperedReplay = replayAuditEvents([first, tampered]);
    expect(tamperedReplay.warnings.some((warning) => warning.includes("Event hash mismatch"))).toBe(true);
  });

  it("explain output is useful without dumping raw secrets", () => {
    const event = createAuditEvent({
      previousEventHash: null,
      sessionId: "sess_explain",
      serverName: "filesystem",
      method: "tools/call",
      toolName: "filesystem.read_file",
      argsSummary: { path: ".env", password: "super-secret" },
      decision: "BLOCK",
      severity: "critical",
      ruleId: "secret.path.blocked",
      reason: "Attempted access to a blocked sensitive path",
      mode: "strict"
    });

    const explanation = explainAuditEvent(event);

    expect(explanation).toContain("Decision: BLOCK");
    expect(explanation).toContain("Rule: secret.path.blocked");
    expect(explanation).toContain("Fix:");
    expect(explanation).not.toContain("super-secret");
    expect(explanation).toContain("[REDACTED_PASSWORD]");
  });
});
