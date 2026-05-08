import { parse as parseYaml } from "yaml";
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

export interface PolicyCheckIssue {
  readonly level: "error" | "warning";
  readonly ruleId: string;
  readonly message: string;
  readonly suggestedFix?: string;
}

export interface CompiledPolicy {
  readonly policy: PolicyConfig;
  readonly issues: readonly PolicyCheckIssue[];
  readonly valid: boolean;
}

export interface PolicyDryRunFixture {
  readonly id: string;
  readonly description: string;
  readonly context: ToolCallContext;
  readonly expectedDecision: PolicyDecision["decision"];
  readonly expectedRuleId?: string;
}

export interface PolicyDryRunResult {
  readonly id: string;
  readonly passed: boolean;
  readonly actualDecision: PolicyDecision;
  readonly expectedDecision: PolicyDecision["decision"];
  readonly expectedRuleId?: string;
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

export const DEFAULT_POLICY: PolicyConfig = {
  policyVersion: "1.0",
  defaultAction: "allow",
  workspaceRoots: ["./project"],
  blockedPaths: [".env", "*.pem", "*.key", "credentials.json", ".ssh/*", ".aws/*", ".npmrc"],
  allowedPathExceptions: [".env.example"],
  blockedCommands: ["rm -rf*", "sudo*", "chmod 777*", "curl *--data*", "wget *--post-data*", "scp*", "ssh*"],
  approvalRequired: ["git push*", "git reset --hard*", "npm install*", "pip install*", "docker build*", "docker run*"],
  allowedDomains: ["github.com", "api.github.com"],
  denyUnknownDomains: true,
  featureFlags: DEFAULT_FEATURE_FLAGS
};

const KNOWN_POLICY_KEYS = new Set([
  "policy_version",
  "policyVersion",
  "default_action",
  "defaultAction",
  "workspace_roots",
  "workspaceRoots",
  "blocked_paths",
  "blockedPaths",
  "allowed_path_exceptions",
  "allowedPathExceptions",
  "blocked_commands",
  "blockedCommands",
  "approval_required",
  "approvalRequired",
  "allowed_domains",
  "allowedDomains",
  "deny_unknown_domains",
  "denyUnknownDomains",
  "feature_flags",
  "featureFlags"
]);

const URL_VALUE_ARG_KEYS = ["url", "uri", "endpoint"] as const;
const HOST_VALUE_ARG_KEYS = ["host", "domain"] as const;

export function loadPolicyFromYaml(text: string): CompiledPolicy {
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown YAML parse error";
    return {
      policy: DEFAULT_POLICY,
      valid: false,
      issues: [
        {
          level: "error",
          ruleId: "policy.yaml.invalid",
          message: `Invalid YAML: ${message}`,
          suggestedFix: "Fix YAML syntax before starting MCP Shield."
        }
      ]
    };
  }

  return compilePolicy(parsed);
}

export function compilePolicy(input: unknown): CompiledPolicy {
  const issues: PolicyCheckIssue[] = [];
  if (!isRecord(input)) {
    return {
      policy: DEFAULT_POLICY,
      valid: false,
      issues: [
        {
          level: "error",
          ruleId: "policy.shape.invalid",
          message: "Policy must be a YAML/JSON object.",
          suggestedFix: "Use key/value policy fields such as default_action, blocked_paths, and blocked_commands."
        }
      ]
    };
  }

  for (const key of Object.keys(input)) {
    if (!KNOWN_POLICY_KEYS.has(key)) {
      issues.push({
        level: "warning",
        ruleId: "policy.unknown_key",
        message: `Unknown policy key '${key}' will be ignored.`,
        suggestedFix: "Remove the key or add support in the policy schema."
      });
    }
  }

  const defaultAction = enumValue(read(input, "default_action", "defaultAction"), ["allow", "warn", "approve", "block"] as const);
  if (!defaultAction) {
    issues.push({
      level: "error",
      ruleId: "policy.default_action.invalid",
      message: "default_action must be one of allow, warn, approve, or block.",
      suggestedFix: "Set default_action to allow for developer mode or block for strict locked-down mode."
    });
  }

  const policy: PolicyConfig = {
    policyVersion: stringValue(read(input, "policy_version", "policyVersion")) ?? DEFAULT_POLICY.policyVersion,
    defaultAction: defaultAction ?? DEFAULT_POLICY.defaultAction,
    workspaceRoots: stringList(read(input, "workspace_roots", "workspaceRoots"), DEFAULT_POLICY.workspaceRoots),
    blockedPaths: stringList(read(input, "blocked_paths", "blockedPaths"), DEFAULT_POLICY.blockedPaths),
    allowedPathExceptions: stringList(read(input, "allowed_path_exceptions", "allowedPathExceptions"), DEFAULT_POLICY.allowedPathExceptions),
    blockedCommands: stringList(read(input, "blocked_commands", "blockedCommands"), DEFAULT_POLICY.blockedCommands),
    approvalRequired: stringList(read(input, "approval_required", "approvalRequired"), DEFAULT_POLICY.approvalRequired),
    allowedDomains: stringList(read(input, "allowed_domains", "allowedDomains"), DEFAULT_POLICY.allowedDomains).map(normalizeDomain).filter(isString),
    denyUnknownDomains: booleanValue(read(input, "deny_unknown_domains", "denyUnknownDomains"), DEFAULT_POLICY.denyUnknownDomains),
    featureFlags: featureFlagsValue(read(input, "feature_flags", "featureFlags"))
  };

  issues.push(...validatePolicy(policy));

  return {
    policy,
    issues,
    valid: !issues.some((issue) => issue.level === "error")
  };
}

export function validatePolicy(policy: PolicyConfig): readonly PolicyCheckIssue[] {
  const issues: PolicyCheckIssue[] = [];

  if (policy.workspaceRoots.length === 0) {
    issues.push({
      level: "error",
      ruleId: "policy.workspace_roots.missing",
      message: "workspace_roots must contain at least one approved workspace root.",
      suggestedFix: "Add the local project root, for example workspace_roots: ['./project']."
    });
  }

  if (policy.defaultAction === "allow" && policy.blockedCommands.length === 0) {
    issues.push({
      level: "warning",
      ruleId: "policy.unsafe.default_allow_without_command_blocks",
      message: "default_action=allow with no blocked_commands is unsafe for coding agents.",
      suggestedFix: "Add blocked destructive commands such as rm -rf, sudo, curl --data, scp, and ssh."
    });
  }

  if (policy.blockedPaths.length === 0) {
    issues.push({
      level: "warning",
      ruleId: "policy.unsafe.no_blocked_paths",
      message: "No blocked_paths are configured, so secret files may be readable.",
      suggestedFix: "Block .env, private keys, .ssh, .aws, .npmrc, and credential JSON files."
    });
  }

  if (policy.denyUnknownDomains && policy.allowedDomains.length === 0) {
    issues.push({
      level: "warning",
      ruleId: "policy.network.no_allowed_domains",
      message: "deny_unknown_domains=true with no allowed_domains will block all network egress.",
      suggestedFix: "Add only required domains, for example github.com and api.github.com."
    });
  }

  if (!policy.denyUnknownDomains) {
    issues.push({
      level: "warning",
      ruleId: "policy.network.unknown_domains_allowed",
      message: "deny_unknown_domains=false can allow exfiltration to unknown hosts.",
      suggestedFix: "Set deny_unknown_domains: true and allow only required domains."
    });
  }

  if (policy.featureFlags.configRewrite && !policy.featureFlags.tamperEvidentAudit) {
    issues.push({
      level: "warning",
      ruleId: "policy.flags.config_rewrite_without_audit",
      message: "configRewrite is enabled while tamperEvidentAudit is disabled.",
      suggestedFix: "Keep tamper-evident audit enabled before rewriting user MCP configs."
    });
  }

  return issues;
}

export function formatPolicyCheck(compiled: CompiledPolicy): string {
  const lines: string[] = [];
  lines.push(compiled.valid ? "Policy valid: yes" : "Policy valid: no");
  lines.push(`Policy version: ${compiled.policy.policyVersion}`);
  lines.push(`Default action: ${compiled.policy.defaultAction}`);
  lines.push(`Workspace roots: ${compiled.policy.workspaceRoots.join(", ") || "none"}`);
  lines.push(`Allowed domains: ${compiled.policy.allowedDomains.join(", ") || "none"}`);
  lines.push(`Deny unknown domains: ${compiled.policy.denyUnknownDomains ? "yes" : "no"}`);

  if (compiled.issues.length === 0) {
    lines.push("\nNo policy issues found.");
    return lines.join("\n");
  }

  const errors = compiled.issues.filter((issue) => issue.level === "error");
  const warnings = compiled.issues.filter((issue) => issue.level === "warning");

  if (errors.length > 0) {
    lines.push("\nErrors:");
    errors.forEach((issue) => lines.push(`- [${issue.ruleId}] ${issue.message}`));
  }

  if (warnings.length > 0) {
    lines.push("\nWarnings:");
    warnings.forEach((issue) => lines.push(`- [${issue.ruleId}] ${issue.message}`));
  }

  const fixes = unique(compiled.issues.map((issue) => issue.suggestedFix).filter(isString));
  if (fixes.length > 0) {
    lines.push("\nRecommended fixes:");
    fixes.forEach((fix, index) => lines.push(`${index + 1}. ${fix}`));
  }

  return lines.join("\n");
}

export function runPolicyDryRun(policy: PolicyConfig, fixtures: readonly PolicyDryRunFixture[]): readonly PolicyDryRunResult[] {
  return fixtures.map((fixture) => {
    const actualDecision = decideToolCall(policy, fixture.context);
    const ruleIdMatches = fixture.expectedRuleId ? actualDecision.ruleId === fixture.expectedRuleId : true;
    return {
      id: fixture.id,
      passed: actualDecision.decision === fixture.expectedDecision && ruleIdMatches,
      actualDecision,
      expectedDecision: fixture.expectedDecision,
      ...(fixture.expectedRuleId ? { expectedRuleId: fixture.expectedRuleId } : {})
    };
  });
}

export function decideToolCall(policy: PolicyConfig, context: ToolCallContext): PolicyDecision {
  const pathCandidate = extractStringArg(context.arguments, "path");
  if (pathCandidate && matchesAny(pathCandidate, policy.allowedPathExceptions)) {
    return allow("path.exception", "Path matches an explicit safe exception");
  }

  if (pathCandidate && matchesAny(pathCandidate, policy.blockedPaths)) {
    return block("secret.path.blocked", "Attempted access to a blocked sensitive path", { path: pathCandidate }, "Use a non-secret fixture such as .env.example, or request a redacted secret-specific workflow instead.");
  }

  const commandCandidate = extractStringArg(context.arguments, "command");
  const egressDecision = decideNetworkEgress(policy, context.arguments, commandCandidate);
  if (egressDecision) {
    return egressDecision;
  }

  if (commandCandidate && matchesAny(commandCandidate, policy.blockedCommands)) {
    return block("command.blocked", "Attempted execution of a blocked command pattern", {
      command: summarizeCommand(commandCandidate)
    }, "Use a read-only command first, for example git status, git diff, ls, or a dry-run/no-write equivalent.");
  }

  if (commandCandidate && matchesAny(commandCandidate, policy.approvalRequired)) {
    return approveByMode(context.mode, "command.approval_required", "Command requires explicit approval", {
      command: summarizeCommand(commandCandidate)
    });
  }

  return decisionFromDefault(policy.defaultAction);
}

function decideNetworkEgress(policy: PolicyConfig, args: Readonly<Record<string, unknown>>, commandCandidate: string | null): PolicyDecision | null {
  const hosts = extractEgressHosts(args, commandCandidate);
  if (hosts.length === 0) {
    return null;
  }

  const uniqueHosts = unique(hosts);
  const unknownHosts = uniqueHosts.filter((host) => !isAllowedDomain(host, policy.allowedDomains));
  if (unknownHosts.length === 0) {
    return null;
  }

  if (!policy.denyUnknownDomains) {
    return null;
  }

  return block(
    "network.egress.domain_blocked",
    "Attempted network egress to a domain outside the policy allowlist",
    { domains: unknownHosts, allowedDomains: policy.allowedDomains },
    `Use an allowlisted endpoint only (${policy.allowedDomains.join(", ") || "none configured"}) or update policy through review before sending data externally.`
  );
}

export function extractEgressHosts(args: Readonly<Record<string, unknown>>, commandCandidate?: string | null): readonly string[] {
  const hosts: string[] = [];

  for (const key of URL_VALUE_ARG_KEYS) {
    const value = args[key];
    if (typeof value === "string") {
      hosts.push(...extractUrlHosts(value));
    }
  }

  for (const key of HOST_VALUE_ARG_KEYS) {
    const value = args[key];
    if (typeof value === "string") {
      hosts.push(...extractUrlHosts(value));
      hosts.push(...extractBareHosts(value));
    }
  }

  if (commandCandidate) {
    hosts.push(...extractUrlHosts(commandCandidate));
  }

  return hosts.map(normalizeDomain).filter(isString);
}

function extractUrlHosts(text: string): readonly string[] {
  const hosts: string[] = [];
  const urlMatches = text.matchAll(/https?:\/\/[^\s"'<>]+/gi);
  for (const match of urlMatches) {
    const host = hostFromMaybeUrl(match[0]);
    if (host) {
      hosts.push(host);
    }
  }
  return hosts;
}

function extractBareHosts(text: string): readonly string[] {
  const trimmed = text.trim();
  if (!trimmed.includes(" ") && !trimmed.includes("/") && /^[a-z0-9.-]+(?::\d+)?$/i.test(trimmed)) {
    const host = hostFromMaybeUrl(`https://${trimmed}`);
    return host ? [host] : [];
  }

  return [];
}

function hostFromMaybeUrl(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isAllowedDomain(host: string, allowedDomains: readonly string[]): boolean {
  return allowedDomains.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function allow(ruleId: string, reason: string): PolicyDecision {
  return { decision: "ALLOW", severity: "info", ruleId, reason };
}

function block(ruleId: string, reason: string, matched?: Readonly<Record<string, unknown>>, suggestedFix?: string): PolicyDecision {
  return { decision: "BLOCK", severity: "critical", ruleId, reason, matched, suggestedFix };
}

function approveByMode(
  mode: RuntimeMode,
  ruleId: string,
  reason: string,
  matched?: Readonly<Record<string, unknown>>
): PolicyDecision {
  if (mode === "strict") {
    return { decision: "BLOCK", severity: "high", ruleId, reason, matched, suggestedFix: "Strict mode does not permit approvals. Switch to balanced mode for approval-gated commands, or use a read-only/dry-run command." };
  }

  if (mode === "audit-only") {
    return { decision: "WARN", severity: "high", ruleId, reason: `Would require approval: ${reason}`, matched };
  }

  return { decision: "APPROVE", severity: "high", ruleId, reason, matched, approvalScope: "once", suggestedFix: "Approve only after checking command scope, target branch/environment, and rollback plan. Otherwise deny and use a read-only command first." };
}

function decisionFromDefault(defaultAction: PolicyConfig["defaultAction"]): PolicyDecision {
  switch (defaultAction) {
    case "block":
      return { decision: "BLOCK", severity: "medium", ruleId: "default.block", reason: "Default policy action blocks this call", suggestedFix: "Add a narrow allow rule or use an already-approved safe workflow." };
    case "approve":
      return { decision: "APPROVE", severity: "medium", ruleId: "default.approve", reason: "Default policy action requires approval", approvalScope: "once", suggestedFix: "Approve only when the tool, arguments, and destination are expected." };
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

function read(record: Readonly<Record<string, unknown>>, snake: string, camel: string): unknown {
  return record[snake] ?? record[camel];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function stringList(value: unknown, fallback: readonly string[]): readonly string[] {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isString);
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function featureFlagsValue(value: unknown): FeatureFlags {
  if (!isRecord(value)) {
    return DEFAULT_FEATURE_FLAGS;
  }

  return {
    scanner: booleanValue(value["scanner"], DEFAULT_FEATURE_FLAGS.scanner),
    gateway: booleanValue(value["gateway"], DEFAULT_FEATURE_FLAGS.gateway),
    responseInspector: booleanValue(value["responseInspector"] ?? value["response_inspector"], DEFAULT_FEATURE_FLAGS.responseInspector),
    resourcePromptInspector: booleanValue(value["resourcePromptInspector"] ?? value["resource_prompt_inspector"], DEFAULT_FEATURE_FLAGS.resourcePromptInspector),
    manifestDrift: booleanValue(value["manifestDrift"] ?? value["manifest_drift"], DEFAULT_FEATURE_FLAGS.manifestDrift),
    tamperEvidentAudit: booleanValue(value["tamperEvidentAudit"] ?? value["tamper_evident_audit"], DEFAULT_FEATURE_FLAGS.tamperEvidentAudit),
    approvalPrompt: booleanValue(value["approvalPrompt"] ?? value["approval_prompt"], DEFAULT_FEATURE_FLAGS.approvalPrompt),
    configRewrite: booleanValue(value["configRewrite"] ?? value["config_rewrite"], DEFAULT_FEATURE_FLAGS.configRewrite)
  };
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value : null;
}

function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");
  if (trimmed.length === 0) {
    return null;
  }

  const withoutPort = trimmed.startsWith("[") ? trimmed : trimmed.replace(/:\d+$/, "");
  if (!/^[a-z0-9.-]+$/.test(withoutPort)) {
    return null;
  }

  return withoutPort;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
