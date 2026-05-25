import type {
  AgentReviewConfig,
  AgentReviewEvidenceDocument,
  AgentReviewModeRule,
  AgentReviewValidationIssue
} from "./index";
import { getAgentReviewEvidenceFieldValue } from "./evidence-fields";
import { findAgentReviewEvidenceSection } from "./required-sections";

const RUNTIME_CHANGE_FIELD_NAMES = [
  "is_runtime_change",
  "is_security_runtime_change",
  "child_mcp_forwarding_changed",
  "policy_behavior_changed",
  "approval_behavior_changed",
  "audit_schema_changed",
  "trace_behavior_changed",
  "scanner_behavior_changed",
  "cli_behavior_changed",
  "config_adapter_behavior_changed",
  "release_behavior_changed",
  "ci_behavior_changed"
] as const;

export interface AgentReviewModeRuleValidationInput {
  readonly config: AgentReviewConfig;
  readonly evidence: AgentReviewEvidenceDocument;
}

export interface AgentReviewModeRuleValidationResult {
  readonly passed: boolean;
  readonly mode?: string;
  readonly evaluated_rules: readonly string[];
  readonly issues: readonly AgentReviewValidationIssue[];
}

export function validateAgentReviewModeRules(
  input: AgentReviewModeRuleValidationInput
): AgentReviewModeRuleValidationResult {
  const mode = getAgentReviewEvidenceFieldValue(input.evidence, "mode");
  const issues: AgentReviewValidationIssue[] = [];

  if (!mode) {
    issues.push(buildModeRuleIssue(input.evidence, "mode", "agent_review.mode_rule_missing_mode", "Cannot evaluate mode rules without an evidence contract mode."));
    return { passed: false, mode, evaluated_rules: [], issues };
  }

  const modeRule = getConfiguredModeRule(input.config, mode);
  if (!modeRule) {
    issues.push(
      buildModeRuleIssue(
        input.evidence,
        "mode",
        "agent_review.mode_rule_unknown_mode",
        `Cannot evaluate mode rules for unconfigured mode: ${mode}.`
      )
    );
    return { passed: false, mode, evaluated_rules: [], issues };
  }

  const evaluatedRules: string[] = [];

  if (!modeRule.runtime_changes_allowed) {
    evaluatedRules.push("runtime_changes_allowed");
    issues.push(...validateNoRuntimeChangeFields(input.evidence));
  }

  if (modeRule.product_tests_required) {
    evaluatedRules.push("product_tests_required");
    const issue = validateProductTestProof(input.config, input.evidence);
    if (issue) {
      issues.push(issue);
    }
  }

  if (modeRule.must_state_no_runtime_claims) {
    evaluatedRules.push("must_state_no_runtime_claims");
    const issue = validateSectionContainsAny(input.evidence, "What This PR Does Not Prove", ["runtime"], "agent_review.mode_rule_no_runtime_claims_missing");
    if (issue) {
      issues.push(issue);
    }
  }

  if (modeRule.must_state_future_runtime_proof) {
    evaluatedRules.push("must_state_future_runtime_proof");
    const issue = validateSectionContainsAny(
      input.evidence,
      "Runtime Proof Required After Merge",
      ["future", "after merge", "required"],
      "agent_review.mode_rule_future_runtime_proof_missing"
    );
    if (issue) {
      issues.push(issue);
    }
  }

  if (modeRule.must_include_negative_tests) {
    evaluatedRules.push("must_include_negative_tests");
    const issue = validateSectionContainsAny(
      input.evidence,
      "QA / Failure Review",
      ["negative", "fail", "failure", "invalid"],
      "agent_review.mode_rule_negative_tests_missing"
    );
    if (issue) {
      issues.push(issue);
    }
  }

  if (modeRule.must_include_false_positive_tests) {
    evaluatedRules.push("must_include_false_positive_tests");
    const issue = validateSectionContainsAny(
      input.evidence,
      "QA / Failure Review",
      ["false-positive", "false positive"],
      "agent_review.mode_rule_false_positive_tests_missing"
    );
    if (issue) {
      issues.push(issue);
    }
  }

  if (modeRule.must_include_audit_or_debug_evidence) {
    evaluatedRules.push("must_include_audit_or_debug_evidence");
    const issue = validateAnySectionContainsAny(
      input.evidence,
      ["Security Review", "QA / Failure Review", "Acceptance Proof"],
      ["audit", "debug"],
      "agent_review.mode_rule_audit_or_debug_evidence_missing"
    );
    if (issue) {
      issues.push(issue);
    }
  }

  return {
    passed: issues.length === 0,
    mode,
    evaluated_rules: evaluatedRules,
    issues
  };
}

function getConfiguredModeRule(config: AgentReviewConfig, mode: string): AgentReviewModeRule | undefined {
  return (config.modes as Readonly<Record<string, AgentReviewModeRule>>)[mode];
}

function validateNoRuntimeChangeFields(evidence: AgentReviewEvidenceDocument): AgentReviewValidationIssue[] {
  const issues: AgentReviewValidationIssue[] = [];

  for (const field of RUNTIME_CHANGE_FIELD_NAMES) {
    const value = getAgentReviewEvidenceFieldValue(evidence, field);
    if (value === "true") {
      issues.push(
        buildModeRuleIssue(
          evidence,
          field,
          "agent_review.mode_rule_runtime_change_not_allowed",
          `Mode does not allow runtime changes but evidence field is true: ${field}.`
        )
      );
    }
  }

  return issues;
}

function validateProductTestProof(config: AgentReviewConfig, evidence: AgentReviewEvidenceDocument): AgentReviewValidationIssue | undefined {
  const acceptanceProof = findAgentReviewEvidenceSection(evidence, "Acceptance Proof");
  if (!acceptanceProof || acceptanceProof.content.trim() === "") {
    return buildModeRuleIssue(
      evidence,
      "Acceptance Proof",
      "agent_review.mode_rule_product_tests_missing",
      "Mode requires product test proof but the Acceptance Proof section is missing or empty."
    );
  }

  const normalizedContent = normalizeText(acceptanceProof.content);
  const hasConfiguredCommand = config.required_default_commands.some((command) => normalizedContent.includes(normalizeText(command)));

  if (!hasConfiguredCommand) {
    return buildModeRuleIssue(
      evidence,
      "Acceptance Proof",
      "agent_review.mode_rule_product_tests_missing",
      "Mode requires product test proof but Acceptance Proof does not mention any configured default command."
    );
  }

  return undefined;
}

function validateSectionContainsAny(
  evidence: AgentReviewEvidenceDocument,
  sectionName: string,
  requiredTerms: readonly string[],
  ruleId: string
): AgentReviewValidationIssue | undefined {
  const section = findAgentReviewEvidenceSection(evidence, sectionName);
  if (!section) {
    return buildModeRuleIssue(evidence, sectionName, ruleId, `Mode requires evidence in missing section: ${sectionName}.`);
  }

  const normalizedContent = normalizeText(section.content);
  if (!requiredTerms.some((term) => normalizedContent.includes(normalizeText(term)))) {
    return buildModeRuleIssue(evidence, sectionName, ruleId, `Mode requires ${sectionName} to mention one of: ${requiredTerms.join(", ")}.`);
  }

  return undefined;
}

function validateAnySectionContainsAny(
  evidence: AgentReviewEvidenceDocument,
  sectionNames: readonly string[],
  requiredTerms: readonly string[],
  ruleId: string
): AgentReviewValidationIssue | undefined {
  const combinedContent = sectionNames
    .map((sectionName) => findAgentReviewEvidenceSection(evidence, sectionName)?.content ?? "")
    .join("\n");
  const normalizedContent = normalizeText(combinedContent);

  if (!requiredTerms.some((term) => normalizedContent.includes(normalizeText(term)))) {
    return buildModeRuleIssue(
      evidence,
      sectionNames.join(" | "),
      ruleId,
      `Mode requires at least one of ${sectionNames.join(", ")} to mention one of: ${requiredTerms.join(", ")}.`
    );
  }

  return undefined;
}

function buildModeRuleIssue(
  evidence: AgentReviewEvidenceDocument,
  field: string,
  ruleId: string,
  message: string
): AgentReviewValidationIssue {
  return {
    severity: "error",
    rule_id: ruleId,
    message,
    path: evidence.path,
    section: "Evidence Contract Fields",
    field,
    suggested_fix: "Update the evidence document so its mode-specific claims match the configured mode rules."
  };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
