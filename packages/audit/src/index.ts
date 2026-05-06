import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditEvent, DecisionType, ResponseDecisionType, RuntimeMode, Severity } from "@mcp-shield/shared";
import { nowIso } from "@mcp-shield/shared";

const REDACTION_PATTERNS: readonly [RegExp, string][] = [
  [/ghp_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]"],
  [/github_pat_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]"],
  [/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_ACCESS_KEY]"],
  [/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer [REDACTED]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
  [/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]"],
  [/(password\s*[=:]\s*)[^\s"']+/gi, "$1[REDACTED_PASSWORD]"],
  [/(authorization\s*[=:]\s*)[^\s"']+/gi, "$1[REDACTED_AUTHORIZATION]"],
  [/(cookie\s*[=:]\s*)[^\s"']+/gi, "$1[REDACTED_COOKIE]"]
];

export interface RedactionResult {
  readonly value: string;
  readonly redactionApplied: boolean;
}

export interface CreateAuditEventInput {
  readonly previousEventHash: string | null;
  readonly sessionId: string;
  readonly serverName: string;
  readonly method: string;
  readonly toolName?: string;
  readonly argsSummary?: Readonly<Record<string, unknown>>;
  readonly decision: DecisionType | ResponseDecisionType;
  readonly severity: Severity;
  readonly ruleId?: string;
  readonly reason?: string;
  readonly mode: RuntimeMode;
}

export interface ReplaySummary {
  readonly totalEvents: number;
  readonly bySeverity: Readonly<Record<Severity, number>>;
  readonly byDecision: Readonly<Record<string, number>>;
  readonly blockedEvents: readonly AuditEvent[];
  readonly approvedEvents: readonly AuditEvent[];
  readonly warnings: readonly string[];
}

export function redactText(input: string): RedactionResult {
  let output = input;
  let redactionApplied = false;

  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    const next = output.replace(pattern, replacement);
    if (next !== output) {
      redactionApplied = true;
      output = next;
    }
  }

  return { value: output, redactionApplied };
}

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent {
  const preEvent = {
    auditSchemaVersion: "1.0" as const,
    eventId: `evt_${randomUUID()}`,
    previousEventHash: input.previousEventHash,
    eventHash: "pending",
    timestamp: nowIso(),
    sessionId: input.sessionId,
    serverName: input.serverName,
    method: input.method,
    ...(input.toolName ? { toolName: input.toolName } : {}),
    ...(input.argsSummary ? { argsSummary: redactJsonObject(input.argsSummary).value } : {}),
    decision: input.decision,
    severity: input.severity,
    ...(input.ruleId ? { ruleId: input.ruleId } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    redactionApplied: input.argsSummary ? redactJsonObject(input.argsSummary).redactionApplied : false,
    mode: input.mode
  } satisfies AuditEvent;

  return {
    ...preEvent,
    eventHash: hashEvent({ ...preEvent, eventHash: "pending" })
  };
}

export function serializeAuditEvent(event: AuditEvent): string {
  const raw = JSON.stringify(event);
  const redacted = redactText(raw);

  if (redacted.redactionApplied && !event.redactionApplied) {
    throw new Error("Audit event contained secrets but redactionApplied was false");
  }

  return `${redacted.value}\n`;
}

export async function appendAuditEvent(auditFile: string, event: AuditEvent): Promise<void> {
  await mkdir(dirname(auditFile), { recursive: true });
  await appendFile(auditFile, serializeAuditEvent(event), "utf8");
}

export async function readAuditEvents(auditFile: string): Promise<readonly AuditEvent[]> {
  const text = await readFile(auditFile, "utf8");
  return parseAuditJsonl(text);
}

export function parseAuditJsonl(text: string): readonly AuditEvent[] {
  const events: AuditEvent[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line.trim().length === 0) {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(line);
      if (isAuditEvent(parsed)) {
        events.push(parsed);
      }
    } catch {
      throw new Error(`Invalid audit JSONL at line ${index + 1}`);
    }
  }

  return events;
}

export function explainAuditEvent(event: AuditEvent): string {
  const lines: string[] = [];
  lines.push(`Decision: ${event.decision}`);
  lines.push(`Severity: ${event.severity.toUpperCase()}`);
  if (event.ruleId) {
    lines.push(`Rule: ${event.ruleId}`);
  }
  if (event.reason) {
    lines.push(`Reason: ${event.reason}`);
  }
  lines.push(`Server: ${event.serverName}`);
  lines.push(`Method: ${event.method}`);
  if (event.toolName) {
    lines.push(`Tool: ${event.toolName}`);
  }
  if (event.argsSummary) {
    lines.push(`Matched: ${JSON.stringify(event.argsSummary)}`);
  }
  lines.push(`Mode: ${event.mode}`);
  lines.push(`Event ID: ${event.eventId}`);

  if (event.decision === "BLOCK" || event.decision === "BLOCK_RESPONSE") {
    lines.push("Fix: Use a safer input, adjust policy intentionally, or run audit-only mode to inspect behavior before enforcement.");
  }

  return lines.join("\n");
}

export function replayAuditEvents(events: readonly AuditEvent[]): ReplaySummary {
  const bySeverity = zeroSeverityCounts();
  const byDecision: Record<string, number> = {};
  const blockedEvents: AuditEvent[] = [];
  const approvedEvents: AuditEvent[] = [];
  const warnings: string[] = [];

  let previousHash: string | null = null;
  for (const event of events) {
    bySeverity[event.severity] += 1;
    byDecision[event.decision] = (byDecision[event.decision] ?? 0) + 1;

    if (event.decision === "BLOCK" || event.decision === "BLOCK_RESPONSE") {
      blockedEvents.push(event);
    }

    if (event.decision === "APPROVE") {
      approvedEvents.push(event);
    }

    if (event.previousEventHash !== previousHash) {
      warnings.push(`Hash chain mismatch before event ${event.eventId}`);
    }

    const expectedHash = hashEvent({ ...event, eventHash: "pending" });
    if (event.eventHash !== expectedHash) {
      warnings.push(`Event hash mismatch for ${event.eventId}`);
    }

    previousHash = event.eventHash;
  }

  return {
    totalEvents: events.length,
    bySeverity,
    byDecision,
    blockedEvents,
    approvedEvents,
    warnings
  };
}

export function formatReplaySummary(summary: ReplaySummary): string {
  const lines: string[] = [];
  lines.push(`Total events: ${summary.totalEvents}`);
  lines.push("\nBy severity:");
  for (const severity of ["critical", "high", "medium", "low", "info"] as const) {
    lines.push(`- ${severity}: ${summary.bySeverity[severity]}`);
  }

  lines.push("\nBy decision:");
  for (const [decision, count] of Object.entries(summary.byDecision).sort()) {
    lines.push(`- ${decision}: ${count}`);
  }

  if (summary.blockedEvents.length > 0) {
    lines.push("\nBlocked events:");
    summary.blockedEvents.forEach((event) => lines.push(`- ${event.eventId} ${event.ruleId ?? "unknown_rule"} ${event.toolName ?? event.method}`));
  }

  if (summary.warnings.length > 0) {
    lines.push("\nAudit integrity warnings:");
    summary.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  return lines.join("\n");
}

export function hashEvent(event: AuditEvent): string {
  const canonical = JSON.stringify(sortKeys(event));
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function redactJsonObject(input: Readonly<Record<string, unknown>>): { readonly value: Readonly<Record<string, unknown>>; readonly redactionApplied: boolean } {
  const raw = JSON.stringify(input);
  const redacted = redactText(raw);
  return {
    value: JSON.parse(redacted.value) as Readonly<Record<string, unknown>>,
    redactionApplied: redacted.redactionApplied
  };
}

function zeroSeverityCounts(): Record<Severity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

function isAuditEvent(value: unknown): value is AuditEvent {
  return isRecord(value) && value["auditSchemaVersion"] === "1.0" && typeof value["eventId"] === "string";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, sortKeys(nested)]));
}
