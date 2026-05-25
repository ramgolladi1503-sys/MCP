import type {
  AgentReviewConfig,
  AgentReviewEvidenceContract,
  AgentReviewEvidenceDocument,
  AgentReviewValidationIssue
} from "./index.js";

const BOOLEAN_STRING_FIELD_NAMES = [
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

const BOOLEAN_STRING_FIELD_NAME_SET = new Set<string>(BOOLEAN_STRING_FIELD_NAMES);

export interface AgentReviewEvidenceFieldValidationInput {
  readonly config: AgentReviewConfig;
  readonly evidence: AgentReviewEvidenceDocument;
}

export interface AgentReviewEvidenceFieldValidationResult {
  readonly passed: boolean;
  readonly present_fields: readonly string[];
  readonly missing_fields: readonly string[];
  readonly invalid_fields: readonly string[];
  readonly issues: readonly AgentReviewValidationIssue[];
}

export function validateAgentReviewEvidenceFields(
  input: AgentReviewEvidenceFieldValidationInput
): AgentReviewEvidenceFieldValidationResult {
  const contractFields = getEvidenceContractFieldMap(input.evidence.evidence_contract);
  const presentFields = contractFields ? Object.keys(contractFields) : [];
  const issues: AgentReviewValidationIssue[] = [];

  if (!contractFields) {
    issues.push({
      severity: "error",
      rule_id: "agent_review.evidence_contract_missing",
      message: "Missing evidence contract fields block",
      path: input.evidence.path,
      section: "Evidence Contract Fields",
      suggested_fix: `Add a "### Evidence Contract Fields" section with all required fields to ${input.evidence.path}.`
    });
  }

  const missingFields = input.config.required_evidence_contract_fields.filter(
    (field) => !hasNonEmptyEvidenceField(contractFields, field)
  );

  for (const missingField of missingFields) {
    issues.push({
      severity: "error",
      rule_id: "agent_review.evidence_field_missing",
      message: `Missing required evidence contract field: ${missingField}`,
      path: input.evidence.path,
      section: "Evidence Contract Fields",
      field: missingField,
      suggested_fix: `Add "${missingField}: <value>" to the Evidence Contract Fields section.`
    });
  }

  const invalidFields = collectInvalidEvidenceFields(input.config, contractFields);

  for (const invalidField of invalidFields) {
    issues.push({
      severity: "error",
      rule_id: getEvidenceFieldRuleId(invalidField),
      message: getEvidenceFieldErrorMessage(input.config, invalidField, getEvidenceFieldValue(contractFields, invalidField)),
      path: input.evidence.path,
      section: "Evidence Contract Fields",
      field: invalidField,
      suggested_fix: getEvidenceFieldSuggestedFix(input.config, invalidField)
    });
  }

  return {
    passed: issues.length === 0,
    present_fields: presentFields,
    missing_fields: missingFields,
    invalid_fields: invalidFields,
    issues
  };
}

export function hasAgentReviewEvidenceField(
  evidence: AgentReviewEvidenceDocument,
  field: string
): boolean {
  return hasNonEmptyEvidenceField(getEvidenceContractFieldMap(evidence.evidence_contract), field);
}

export function getAgentReviewEvidenceFieldValue(
  evidence: AgentReviewEvidenceDocument,
  field: string
): string | undefined {
  return getEvidenceFieldValue(getEvidenceContractFieldMap(evidence.evidence_contract), field);
}

function collectInvalidEvidenceFields(
  config: AgentReviewConfig,
  contractFields: Readonly<Record<string, unknown>> | undefined
): readonly string[] {
  if (!contractFields) {
    return [];
  }

  const invalidFields: string[] = [];
  const configuredModeNames = new Set(Object.keys(config.modes));
  const mode = getEvidenceFieldValue(contractFields, "mode");

  if (mode !== undefined && mode !== "" && !configuredModeNames.has(mode)) {
    invalidFields.push("mode");
  }

  for (const fieldName of BOOLEAN_STRING_FIELD_NAMES) {
    const value = getEvidenceFieldValue(contractFields, fieldName);
    if (value !== undefined && value !== "true" && value !== "false") {
      invalidFields.push(fieldName);
    }
  }

  return invalidFields;
}

function hasNonEmptyEvidenceField(
  contractFields: Readonly<Record<string, unknown>> | undefined,
  field: string
): boolean {
  const value = getEvidenceFieldValue(contractFields, field);
  return value !== undefined && value.trim() !== "";
}

function getEvidenceFieldValue(
  contractFields: Readonly<Record<string, unknown>> | undefined,
  field: string
): string | undefined {
  const value = contractFields?.[field];
  return typeof value === "string" ? value : undefined;
}

function getEvidenceContractFieldMap(
  contract: AgentReviewEvidenceContract | undefined
): Readonly<Record<string, unknown>> | undefined {
  return contract as unknown as Readonly<Record<string, unknown>> | undefined;
}

function getEvidenceFieldRuleId(field: string): string {
  return field === "mode" ? "agent_review.evidence_field_invalid_mode" : "agent_review.evidence_field_invalid_boolean_string";
}

function getEvidenceFieldErrorMessage(config: AgentReviewConfig, field: string, value: string | undefined): string {
  if (field === "mode") {
    return `Invalid evidence contract mode: ${value ?? "<missing>"}. Expected one of: ${Object.keys(config.modes).join(", ")}`;
  }

  return `Invalid evidence contract boolean string field: ${field}. Expected "true" or "false".`;
}

function getEvidenceFieldSuggestedFix(config: AgentReviewConfig, field: string): string {
  if (field === "mode") {
    return `Use one of the configured mode values: ${Object.keys(config.modes).join(", ")}.`;
  }

  if (BOOLEAN_STRING_FIELD_NAME_SET.has(field)) {
    return `Set "${field}" to either "true" or "false".`;
  }

  return `Fix the value for "${field}".`;
}
