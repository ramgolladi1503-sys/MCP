import type { PolicyDecision, RuntimeMode, ToolCallContext } from "@mcp-shield/shared";

export interface PolicyConfig {
  readonly policyVersion: string;
  readonly defaultAction: "allow" | "warn" | "approve" | "block";
  readonly workspaceRoots: readonly string[];
  readonly blockedPaths: readonly string[];
  readonly allowedPathExceptions: readonly string[];
  readonly blockedCommands: readonly string[];
  readonly approvalRequired: readonly string[];
  readonly allowedDomains: readonly string[];
  readonly denyUnknownDomains: boolean;
  readonly featureFlags: FeatureFlags;
}

export interface FeatureFlags {
  readonly scanner: boolean;
  readonly gateway: boolean;
  readonly responseInspector: boolean;
  readonly resourcePromptInspector: boolean;
  readonly manifestDrift: boolean;
  readonly tamperEvidentAudit: boolean;
  readonly approvalPrompt: boolean;
  readonly configRewrite: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  scanner: true,
  gateway: false,
  responseInspector: false,
  resourcePromptInspector: false,
  manifestDrift: false,
  tamperEvidentAudit: true,
  approvalPrompt: false,
  configRewrite: false
};

export function decideToolCall(policy: PolicyConfig, context: ToolCallContext): PolicyDecision {
  const pathCandidate = extractStringArg(context.arguments, "path");
  if (pathCandidate && matchesAny(pathCandidate, policy.allowedPathExceptions)) {
    return allow("path.exception", "Path matches an explicit safe exception");
  }

  if (pathCandidate && matchesAny(pathCandidate, policy.blockedPaths)) {
    return block("secret.path.blocked", "Attempted access to a blocked sensitive path", { path: pathCandidate });
  }

  const commandCandidate = extractStringArg(context.arguments, "command");
  if (commandCandidate && matchesAny(commandCandidate, policy.blockedCommands)) {
    return block("command.blocked", "Attempted execution of a blocked command pattern", {
      command: summarizeCommand(commandCandidate)
    });
  }

  if (commandCandidate && matchesAny(commandCandidate, policy.approvalRequired)) {
    return approveByMode(context.mode, "command.approval_required", "Command requires explicit approval", {
      command: summarizeCommand(commandCandidate)
    });
  }

  return decisionFromDefault(policy.defaultAction);
}

function allow(ruleId: string, reason: string): PolicyDecision {
  return { decision: "ALLOW", severity: "info", ruleId, reason };
}

function block(ruleId: string, reason: string, matched?: Readonly<Record<string, unknown>>): PolicyDecision {
  return { decision: "BLOCK", severity: "critical", ruleId, reason, matched };
}

function approveByMode(
  mode: RuntimeMode,
  ruleId: string,
  reason: string,
  matched?: Readonly<Record<string, unknown>>
): PolicyDecision {
  if (mode === "strict") {
    return { decision: "BLOCK", severity: "high", ruleId, reason, matched };
  }

  if (mode === "audit-only") {
    return { decision: "WARN", severity: "high", ruleId, reason: `Would require approval: ${reason}`, matched };
  }

  return { decision: "APPROVE", severity: "high", ruleId, reason, matched, approvalScope: "once" };
}

function decisionFromDefault(defaultAction: PolicyConfig["defaultAction"]): PolicyDecision {
  switch (defaultAction) {
    case "block":
      return { decision: "BLOCK", severity: "medium", ruleId: "default.block", reason: "Default policy action blocks this call" };
    case "approve":
      return { decision: "APPROVE", severity: "medium", ruleId: "default.approve", reason: "Default policy action requires approval", approvalScope: "once" };
    case "warn":
      return { decision: "WARN", severity: "low", ruleId: "default.warn", reason: "Default policy action warns on this call" };
    case "allow":
      return allow("default.allow", "Default policy action allows this call");
  }
}

function extractStringArg(args: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = args[key];
  return typeof value === "string" ? value : null;
}

function matchesAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => wildcardToRegex(pattern).test(value));
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function summarizeCommand(command: string): string {
  return command.length <= 120 ? command : `${command.slice(0, 117)}...`;
}
