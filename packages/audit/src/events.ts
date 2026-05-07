export type AuditPolicyDecision = "allow" | "audit_only" | "require_approval" | "block";

export type AuditSeverity = "low" | "medium" | "high" | "critical";

export type AuditToolCall = {
  toolName: string;
  command?: string;
  args?: unknown;
  metadata?: Record<string, unknown>;
};

export type AuditPolicyEvaluation = {
  decision: AuditPolicyDecision;
  severity: AuditSeverity;
  matchedRules: Array<{ id: string }>;
  reason: string;
};

export type AuditEvent = {
  eventType: "tool_call_decision";
  timestampEpochMs: number;
  toolName: string;
  decision: AuditPolicyDecision;
  severity: AuditSeverity;
  reason: string;
  matchedRuleIds: string[];
  redactedArgs: unknown;
};

export function buildToolCallDecisionAuditEvent(
  call: AuditToolCall,
  evaluation: AuditPolicyEvaluation,
  timestampEpochMs: number = Date.now(),
): AuditEvent {
  return {
    eventType: "tool_call_decision",
    timestampEpochMs,
    toolName: call.toolName,
    decision: evaluation.decision,
    severity: evaluation.severity,
    reason: evaluation.reason,
    matchedRuleIds: evaluation.matchedRules.map((rule) => rule.id),
    redactedArgs: redactSecrets(call.args ?? {}),
  };
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => {
        const normalizedKey = key.toLowerCase();
        if (
          normalizedKey.includes("secret") ||
          normalizedKey.includes("token") ||
          normalizedKey.includes("password") ||
          normalizedKey.includes("api_key") ||
          normalizedKey.includes("apikey") ||
          normalizedKey.includes("credential")
        ) {
          return [key, "[REDACTED]"];
        }
        return [key, redactSecrets(inner)];
      }),
    );
  }

  return value;
}
