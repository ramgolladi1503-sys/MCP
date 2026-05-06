import { describe, expect, it } from "vitest";
import {
  createAuditEvent,
  explainAuditEvent,
  hashEvent,
  parseAuditJsonl,
  redactText,
  replayAuditEvents,
  serializeAuditEvent
} from "../../../packages/audit/src/index";
import type { AuditEvent } from "../../../packages/shared/src/index";

const baseEvent: AuditEvent = {
  auditSchemaVersion: "1.0",
  eventId: "evt_1",
  previousEventHash: null,
  eventHash: "sha256:test",
  timestamp: "2026-05-07T00:00:00.000Z",
  sessionId: "sess_1",
  serverName: "filesystem",
  method: "tools/call",
  toolName: "filesystem.read_file",
  argsSummary: { path: "README.md" },
  decision: "ALLOW",
  severity: "info",
  ruleId: "default.allow",
  reason: "Default policy action allows this call",
  redactionApplied: false,
  mode: "balanced"
};

describe("redactText", () => {
  it("redacts common token patterns", () => {
    const result = redactText("Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789");

    expect(result.redactionApplied).toBe(true);
    expect(result.value).toBe("Authorization: Bearer [REDACTED]");
  });

  it("redacts database URLs", () => {
    const result = redactText("DATABASE_URL=postgres://user:password@localhost:5432/app");

    expect(result.redactionApplied).toBe(true);
    expect(result.value).toContain("[REDACTED_DATABASE_URL]");
  });
});

describe("createAuditEvent", () => {
  it("creates tamper-evident audit events", () => {
    const event = createAuditEvent({
      previousEventHash: null,
      sessionId: "sess_1",
      serverName: "filesystem",
      method: "tools/call",
      toolName: "filesystem.read_file",
      argsSummary: { path: ".env" },
      decision: "BLOCK",
      severity: "critical",
      ruleId: "secret.path.blocked",
      reason: "Attempted access to a blocked sensitive path",
      mode: "strict"
    });

    expect(event.eventId).toMatch(/^evt_/);
    expect(event.eventHash).toBe(hashEvent({ ...event, eventHash: "pending" }));
    expect(event.previousEventHash).toBeNull();
  });

  it("redacts secrets before putting args into an audit event", () => {
    const event = createAuditEvent({
      previousEventHash: null,
      sessionId: "sess_1",
      serverName: "http",
      method: "tools/call",
      toolName: "http.request",
      argsSummary: { Authorization: "Bearer abcdefghijklmnopqrstuvwxyz0123456789" },
      decision: "BLOCK",
      severity: "critical",
      ruleId: "secret.argument.authorization",
      reason: "Authorization header detected",
      mode: "strict"
    });

    expect(event.redactionApplied).toBe(true);
    expect(JSON.stringify(event.argsSummary)).toContain("Bearer [REDACTED]");
  });
});

describe("serializeAuditEvent", () => {
  it("serializes clean audit events as JSONL", () => {
    const line = serializeAuditEvent(baseEvent);

    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toMatchObject({ eventId: "evt_1", decision: "ALLOW" });
  });

  it("fails closed if secrets are present but redactionApplied is false", () => {
    const eventWithSecret: AuditEvent = {
      ...baseEvent,
      argsSummary: { Authorization: "Bearer abcdefghijklmnopqrstuvwxyz0123456789" }
    };

    expect(() => serializeAuditEvent(eventWithSecret)).toThrow("redactionApplied was false");
  });

  it("allows serialization when redactionApplied is true", () => {
    const eventWithSecret: AuditEvent = {
      ...baseEvent,
      argsSummary: { Authorization: "Bearer abcdefghijklmnopqrstuvwxyz0123456789" },
      redactionApplied: true
    };

    const line = serializeAuditEvent(eventWithSecret);

    expect(line).toContain("Bearer [REDACTED]");
    expect(line).not.toContain("abcdefghijklmnopqrstuvwxyz0123456789");
  });
});

describe("explain and replay", () => {
  it("explains blocked events", () => {
    const event = createAuditEvent({
      previousEventHash: null,
      sessionId: "sess_1",
      serverName: "filesystem",
      method: "tools/call",
      toolName: "filesystem.read_file",
      argsSummary: { path: ".env" },
      decision: "BLOCK",
      severity: "critical",
      ruleId: "secret.path.blocked",
      reason: "Attempted access to a blocked sensitive path",
      mode: "strict"
    });

    const output = explainAuditEvent(event);

    expect(output).toContain("Decision: BLOCK");
    expect(output).toContain("Rule: secret.path.blocked");
    expect(output).toContain("Fix:");
  });

  it("parses and replays JSONL audit events", () => {
    const first = createAuditEvent({
      previousEventHash: null,
      sessionId: "sess_1",
      serverName: "filesystem",
      method: "tools/call",
      toolName: "filesystem.read_file",
      argsSummary: { path: ".env" },
      decision: "BLOCK",
      severity: "critical",
      ruleId: "secret.path.blocked",
      reason: "Attempted access to a blocked sensitive path",
      mode: "strict"
    });
    const second = createAuditEvent({
      previousEventHash: first.eventHash,
      sessionId: "sess_1",
      serverName: "filesystem",
      method: "tools/call",
      toolName: "filesystem.read_file",
      argsSummary: { path: "README.md" },
      decision: "ALLOW",
      severity: "info",
      ruleId: "default.allow",
      reason: "Default policy action allows this call",
      mode: "strict"
    });

    const events = parseAuditJsonl(`${serializeAuditEvent(first)}${serializeAuditEvent(second)}`);
    const replay = replayAuditEvents(events);

    expect(replay.totalEvents).toBe(2);
    expect(replay.bySeverity.critical).toBe(1);
    expect(replay.byDecision.BLOCK).toBe(1);
    expect(replay.warnings).toEqual([]);
  });
});
