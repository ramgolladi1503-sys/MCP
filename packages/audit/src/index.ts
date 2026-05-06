import type { AuditEvent } from "@mcp-shield/shared";

const REDACTION_PATTERNS: readonly [RegExp, string][] = [
  [/ghp_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]"],
  [/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_ACCESS_KEY]"],
  [/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer [REDACTED]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
  [/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]"],
  [/(password\s*[=:]\s*)[^\s"']+/gi, "$1[REDACTED_PASSWORD]"]
];

export interface RedactionResult {
  readonly value: string;
  readonly redactionApplied: boolean;
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

export function serializeAuditEvent(event: AuditEvent): string {
  const raw = JSON.stringify(event);
  const redacted = redactText(raw);

  if (redacted.redactionApplied && !event.redactionApplied) {
    throw new Error("Audit event contained secrets but redactionApplied was false");
  }

  return `${redacted.value}\n`;
}
