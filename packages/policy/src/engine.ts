export type PolicyDecision = "allow" | "audit_only" | "require_approval" | "block";

export type Severity = "low" | "medium" | "high" | "critical";

export type ToolCall = {
  toolName: string;
  command?: string;
  args?: unknown;
  metadata?: Record<string, unknown>;
};

export type PolicyRule = {
  id: string;
  decision: PolicyDecision;
  severity: Severity;
  reason: string;
  match: {
    tool_name_contains_any?: string[];
    command_contains_any?: string[];
    args_contains_any?: string[];
    metadata_contains_any?: string[];
  };
};

export type PolicyEvaluation = {
  decision: PolicyDecision;
  severity: Severity;
  matchedRules: PolicyRule[];
  reason: string;
};

const DECISION_RANK: Record<PolicyDecision, number> = {
  allow: 0,
  audit_only: 1,
  require_approval: 2,
  block: 3,
};

const SEVERITY_RANK: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.toLowerCase();
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return String(value).toLowerCase();
  }
}

function containsAny(haystack: unknown, needles: string[] | undefined): boolean {
  if (!needles || needles.length === 0) return false;
  const normalizedHaystack = normalize(haystack);
  return needles.some((needle) => normalizedHaystack.includes(String(needle).toLowerCase()));
}

export function ruleMatches(rule: PolicyRule, call: ToolCall): boolean {
  const match = rule.match || {};

  return (
    containsAny(call.toolName, match.tool_name_contains_any) ||
    containsAny(call.command, match.command_contains_any) ||
    containsAny(call.args, match.args_contains_any) ||
    containsAny(call.metadata, match.metadata_contains_any)
  );
}

export function evaluatePolicy(rules: PolicyRule[], call: ToolCall): PolicyEvaluation {
  const matchedRules = rules.filter((rule) => ruleMatches(rule, call));

  if (matchedRules.length === 0) {
    return {
      decision: "allow",
      severity: "low",
      matchedRules: [],
      reason: "No policy rules matched.",
    };
  }

  const winner = [...matchedRules].sort((left, right) => {
    const decisionDelta = DECISION_RANK[right.decision] - DECISION_RANK[left.decision];
    if (decisionDelta !== 0) return decisionDelta;
    return SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
  })[0];

  return {
    decision: winner.decision,
    severity: winner.severity,
    matchedRules,
    reason: winner.reason,
  };
}

export function redactSecrets(value: unknown): unknown {
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
