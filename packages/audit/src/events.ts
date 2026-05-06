import { redactSecrets, type PolicyEvaluation, type ToolCall } from "../../policy/src/engine";

export type AuditEvent = {
  eventType: "tool_call_decision";
  timestampEpochMs: number;
  toolName: string;
  decision: PolicyEvaluation["decision"];
  severity: PolicyEvaluation["severity"];
  reason: string;
  matchedRuleIds: string[];
  redactedArgs: unknown;
};

export function buildToolCallDecisionAuditEvent(
  call: ToolCall,
  evaluation: PolicyEvaluation,
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
