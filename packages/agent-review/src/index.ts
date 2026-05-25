export const AGENT_REVIEW_CONFIG_SCHEMA_VERSION = "1.0" as const;

export type AgentReviewConfigSchemaVersion = typeof AGENT_REVIEW_CONFIG_SCHEMA_VERSION;

export type AgentReviewProfile =
  | "enterprise_agent_firewall"
  | "generic_project"
  | "tradebot"
  | "algotradify"
  | string;

export type AgentReviewModeName = "DOCS_ONLY" | "CONTRACT_ONLY" | "RUNTIME_CHANGE" | "SECURITY_RUNTIME_CHANGE";

export type EvidenceBooleanString = "true" | "false";

export interface AgentReviewConfigMetadata {
  readonly product: string;
  readonly category: string;
  readonly purpose: string;
}

export interface AgentReviewModeRule {
  readonly runtime_changes_allowed: boolean;
  readonly product_tests_required: boolean;
  readonly must_state_no_runtime_claims?: boolean;
  readonly must_state_future_runtime_proof?: boolean;
  readonly must_include_negative_tests?: boolean;
  readonly must_include_false_positive_tests?: boolean;
  readonly must_include_audit_or_debug_evidence?: boolean;
}

export interface AgentReviewAreaRule {
  readonly path_patterns: readonly string[];
  readonly required_proof: readonly string[];
  readonly required_sections?: readonly string[];
}

export interface AgentReviewFutureEnforcement {
  readonly validator_cli_pr?: number;
  readonly scope_guard_ci_pr?: number;
  readonly changed_file_classifier_pr?: number;
}

export interface AgentReviewConfig {
  readonly schema_version: AgentReviewConfigSchemaVersion;
  readonly profile: AgentReviewProfile;
  readonly metadata: AgentReviewConfigMetadata;
  readonly required_sections: readonly string[];
  readonly required_evidence_contract_fields: readonly string[];
  readonly optional_evidence_contract_fields?: readonly string[];
  readonly modes: Readonly<Record<AgentReviewModeName, AgentReviewModeRule>>;
  readonly hard_rules: Readonly<Record<string, boolean>>;
  readonly runtime_safety_rules: Readonly<Record<string, boolean>>;
  readonly area_rules: Readonly<Record<string, AgentReviewAreaRule>>;
  readonly required_default_commands: readonly string[];
  readonly future_enforcement?: AgentReviewFutureEnforcement;
}

export interface AgentReviewEvidenceContract {
  readonly mode: AgentReviewModeName;
  readonly candidate_id: string;
  readonly decision: string;
  readonly reason: string;
  readonly is_runtime_change: EvidenceBooleanString;
  readonly is_security_runtime_change: EvidenceBooleanString;
  readonly child_mcp_forwarding_changed: EvidenceBooleanString;
  readonly policy_behavior_changed: EvidenceBooleanString;
  readonly approval_behavior_changed: EvidenceBooleanString;
  readonly audit_schema_changed: EvidenceBooleanString;
  readonly source: string;
  readonly trace_behavior_changed?: EvidenceBooleanString;
  readonly scanner_behavior_changed?: EvidenceBooleanString;
  readonly cli_behavior_changed?: EvidenceBooleanString;
  readonly config_adapter_behavior_changed?: EvidenceBooleanString;
  readonly release_behavior_changed?: EvidenceBooleanString;
  readonly ci_behavior_changed?: EvidenceBooleanString;
}

export interface AgentReviewEvidenceDocument {
  readonly path: string;
  readonly title: string;
  readonly sections: readonly AgentReviewEvidenceSection[];
  readonly evidence_contract?: AgentReviewEvidenceContract;
  readonly raw_markdown: string;
}

export interface AgentReviewEvidenceSection {
  readonly heading: string;
  readonly level: number;
  readonly content: string;
  readonly start_line: number;
  readonly end_line: number;
}

export interface AgentReviewAdapterIdentity {
  readonly id: string;
  readonly product: string;
  readonly category: string;
  readonly config_file_names: readonly string[];
}

export interface AgentReviewChangedFile {
  readonly path: string;
  readonly status?: "added" | "modified" | "removed" | "renamed" | string;
}

export interface AgentReviewAreaClassification {
  readonly area: string;
  readonly matched_patterns: readonly string[];
  readonly files: readonly AgentReviewChangedFile[];
  readonly required_proof: readonly string[];
  readonly required_sections: readonly string[];
}

export type AgentReviewValidationSeverity = "info" | "warning" | "error";

export interface AgentReviewValidationIssue {
  readonly severity: AgentReviewValidationSeverity;
  readonly rule_id: string;
  readonly message: string;
  readonly path?: string;
  readonly section?: string;
  readonly field?: string;
  readonly suggested_fix?: string;
}

export interface AgentReviewValidationInput {
  readonly adapter: AgentReviewAdapterIdentity;
  readonly config: AgentReviewConfig;
  readonly evidence: AgentReviewEvidenceDocument;
  readonly changed_files?: readonly AgentReviewChangedFile[];
}

export interface AgentReviewValidationResult {
  readonly passed: boolean;
  readonly adapter: AgentReviewAdapterIdentity;
  readonly profile: AgentReviewProfile;
  readonly evidence_path: string;
  readonly detected_areas: readonly AgentReviewAreaClassification[];
  readonly issues: readonly AgentReviewValidationIssue[];
}

export interface AgentReviewAdapter {
  readonly identity: AgentReviewAdapterIdentity;
  loadConfig(project_root: string): Promise<AgentReviewConfig>;
  classifyChangedFiles(files: readonly AgentReviewChangedFile[], config: AgentReviewConfig): readonly AgentReviewAreaClassification[];
  validateEvidence(input: AgentReviewValidationInput): AgentReviewValidationResult;
  requiredProofForAreas(areas: readonly AgentReviewAreaClassification[], config: AgentReviewConfig): readonly string[];
}
