export type DecisionType = "ALLOW" | "WARN" | "APPROVE" | "BLOCK";
export type ResponseDecisionType = "ALLOW_RESPONSE" | "WARN_RESPONSE" | "REDACT_RESPONSE" | "BLOCK_RESPONSE";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type RuntimeMode = "audit-only" | "balanced" | "strict";

export interface PolicyDecision {
  readonly decision: DecisionType;
  readonly severity: Severity;
  readonly ruleId: string;
  readonly reason: string;
  readonly matched?: Readonly<Record<string, unknown>>;
  readonly suggestedFix?: string;
  readonly approvalScope?: "once" | "session";
}

export interface ToolCallContext {
  readonly sessionId: string;
  readonly serverName: string;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly rawMessageId: string | number | null;
  readonly timestamp: string;
  readonly mode: RuntimeMode;
}

export interface AuditEvent {
  readonly auditSchemaVersion: "1.0";
  readonly eventId: string;
  readonly previousEventHash: string | null;
  readonly eventHash: string;
  readonly timestamp: string;
  readonly sessionId: string;
  readonly serverName: string;
  readonly method: string;
  readonly toolName?: string;
  readonly argsSummary?: Readonly<Record<string, unknown>>;
  readonly decision: DecisionType | ResponseDecisionType;
  readonly severity: Severity;
  readonly ruleId?: string;
  readonly reason?: string;
  readonly redactionApplied: boolean;
  readonly mode: RuntimeMode;
}

export interface ToolFingerprint {
  readonly serverName: string;
  readonly toolName: string;
  readonly descriptionHash: string;
  readonly inputSchemaHash: string;
  readonly fullManifestHash: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
}

export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: string | number | null;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcSuccessResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly result: unknown;
}

export interface JsonRpcErrorResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly data?: Readonly<Record<string, unknown>>;
  };
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export const MCP_SHIELD_BLOCKED_ERROR_CODE = -32001;

export function blockedJsonRpcResponse(
  id: string | number | null,
  decision: Pick<PolicyDecision, "ruleId" | "severity"> & Partial<Pick<PolicyDecision, "reason" | "suggestedFix" | "matched">>,
  eventId: string
): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: MCP_SHIELD_BLOCKED_ERROR_CODE,
      message: "MCP Shield blocked this tool call",
      data: compactRecord({
        event_id: eventId,
        rule_id: decision.ruleId,
        severity: decision.severity,
        reason: decision.reason,
        suggested_fix: decision.suggestedFix,
        safe_alternative: decision.suggestedFix,
        matched: decision.matched
      })
    }
  };
}

export function nowIso(): string {
  return new Date().toISOString();
}

function compactRecord(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
