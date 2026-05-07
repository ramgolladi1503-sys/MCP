import type { PolicyRule } from "./engine.js";

export type PolicyDocument = {
  rules: PolicyRule[];
};

function parseScalar(value: string): string | number | boolean | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^['"]|['"]$/g, "");
}

function parseInlineList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [String(parseScalar(trimmed))];
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((item) => String(parseScalar(item.trim())))
    .filter((item) => item.length > 0);
}

export function parsePolicyJson(raw: string): PolicyDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`POLICY_JSON_INVALID: ${(error as Error).message}`);
  }
  return validatePolicyDocument(parsed);
}

export function parsePolicyYamlLite(raw: string): PolicyDocument {
  const rules: PolicyRule[] = [];
  let current: Partial<PolicyRule> | null = null;
  let inMatch = false;

  for (const originalLine of raw.split(/\r?\n/)) {
    const withoutComment = originalLine.replace(/\s+#.*$/, "");
    const line = withoutComment.trimEnd();
    if (!line.trim()) continue;
    const trimmed = line.trim();

    if (trimmed === "rules:") continue;

    if (trimmed.startsWith("- id:")) {
      if (current) rules.push(validatePolicyRule(current));
      current = { id: String(parseScalar(trimmed.slice("- id:".length))), match: {} } as Partial<PolicyRule>;
      inMatch = false;
      continue;
    }

    if (!current) {
      throw new Error("POLICY_YAML_INVALID: rule entry must start with '- id:'");
    }

    if (trimmed === "match:") {
      current.match = current.match || {};
      inMatch = true;
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      throw new Error(`POLICY_YAML_INVALID: invalid line '${trimmed}'`);
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (inMatch) {
      (current.match as Record<string, string[]>)[key] = parseInlineList(value);
    } else {
      (current as Record<string, unknown>)[key] = parseScalar(value);
    }
  }

  if (current) rules.push(validatePolicyRule(current));
  return validatePolicyDocument({ rules });
}

export function parsePolicyDocument(raw: string, format: "json" | "yaml" = "yaml"): PolicyDocument {
  return format === "json" ? parsePolicyJson(raw) : parsePolicyYamlLite(raw);
}

export function validatePolicyDocument(input: unknown): PolicyDocument {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("POLICY_DOCUMENT_INVALID: policy document must be an object");
  }

  const rules = (input as Record<string, unknown>).rules;
  if (!Array.isArray(rules)) {
    throw new Error("POLICY_RULES_INVALID: rules must be an array");
  }

  return { rules: rules.map((rule) => validatePolicyRule(rule)) };
}

function validatePolicyRule(input: unknown): PolicyRule {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("POLICY_RULE_INVALID: rule must be an object");
  }

  const rule = input as Partial<PolicyRule>;
  if (!rule.id || typeof rule.id !== "string") {
    throw new Error("POLICY_RULE_ID_INVALID: rule.id must be a non-empty string");
  }

  if (!rule.reason || typeof rule.reason !== "string") {
    throw new Error(`POLICY_RULE_REASON_INVALID: ${rule.id} must include a reason`);
  }

  if (!rule.decision || !["allow", "audit_only", "require_approval", "block"].includes(rule.decision)) {
    throw new Error(`POLICY_RULE_DECISION_INVALID: ${rule.id} has invalid decision`);
  }

  if (!rule.severity || !["low", "medium", "high", "critical"].includes(rule.severity)) {
    throw new Error(`POLICY_RULE_SEVERITY_INVALID: ${rule.id} has invalid severity`);
  }

  if (!rule.match || typeof rule.match !== "object" || Array.isArray(rule.match)) {
    throw new Error(`POLICY_RULE_MATCH_INVALID: ${rule.id} must include match object`);
  }

  return {
    id: rule.id,
    decision: rule.decision,
    severity: rule.severity,
    reason: rule.reason,
    match: rule.match,
  };
}
