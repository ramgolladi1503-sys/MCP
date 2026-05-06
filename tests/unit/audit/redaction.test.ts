import { describe, expect, it } from "vitest";
import { redactText, serializeAuditEvent } from "../../../packages/audit/src/index";
import type { AuditEvent } from "../../../packages/shared/src/index";

const baseEvent: AuditEvent = {
  auditSchemaVersion: "1.0",
  eventId: "evt_1",
  previousEventHash: null,
  eventHash: "hash_1",
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
