import { access, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

export const AGENT_REVIEW_CONFIG_SCHEMA_VERSION = "1.0" as const;

export const DEFAULT_AGENT_REVIEW_CONFIG_FILE_NAMES = [
  "mcp-shield.agent-review.yaml",
  "tradebot.agent-review.yaml",
  "algotradify.agent-review.yaml",
  "agent-review.yaml",
  "agent-review.json"
] as const;

const REQUIRED_MODE_NAMES = ["DOCS_ONLY", "CONTRACT_ONLY", "RUNTIME_CHANGE", "SECURITY_RUNTIME_CHANGE"] as const;

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

export interface AgentReviewConfigLoadOptions {
  readonly configPath?: string;
  readonly configFileNames?: readonly string[];
}

export interface AgentReviewConfigLoadResult {
  readonly config: AgentReviewConfig;
  readonly path: string;
  readonly warnings: readonly string[];
}

export class AgentReviewConfigError extends Error {
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(message);
    this.name = "AgentReviewConfigError";
    this.issues = issues;
  }
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

export async function loadAgentReviewConfig(
  projectRoot: string,
  options: AgentReviewConfigLoadOptions = {}
): Promise<AgentReviewConfigLoadResult> {
  const configPath = await findAgentReviewConfigPath(projectRoot, options);
  const text = await readFile(configPath, "utf8");
  const parsed = parseAgentReviewConfigText(text, configPath);
  const warnings = validateAgentReviewConfig(parsed, configPath);

  return {
    config: parsed,
    path: configPath,
    warnings
  };
}

export async function findAgentReviewConfigPath(
  projectRoot: string,
  options: AgentReviewConfigLoadOptions = {}
): Promise<string> {
  if (options.configPath !== undefined) {
    const explicitPath = isAbsolute(options.configPath) ? options.configPath : join(projectRoot, options.configPath);
    await assertReadableFile(explicitPath, `Explicit agent-review config not found: ${explicitPath}`);
    return explicitPath;
  }

  const configFileNames = options.configFileNames ?? DEFAULT_AGENT_REVIEW_CONFIG_FILE_NAMES;

  for (const fileName of configFileNames) {
    const candidate = join(projectRoot, fileName);
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new AgentReviewConfigError(
    `No agent-review config found in ${projectRoot}`,
    [`Searched: ${configFileNames.join(", ")}`]
  );
}

export function parseAgentReviewConfigText(text: string, sourcePath = "agent-review.yaml"): AgentReviewConfig {
  const parsed = sourcePath.endsWith(".json") ? parseJsonConfig(text, sourcePath) : parseYamlSubsetConfig(text, sourcePath);
  const config = normalizeAgentReviewConfig(parsed, sourcePath);
  validateAgentReviewConfig(config, sourcePath);
  return config;
}

export function validateAgentReviewConfig(config: AgentReviewConfig, sourcePath = "agent-review.yaml"): readonly string[] {
  const issues: string[] = [];

  if (config.schema_version !== AGENT_REVIEW_CONFIG_SCHEMA_VERSION) {
    issues.push(`schema_version must be ${AGENT_REVIEW_CONFIG_SCHEMA_VERSION}`);
  }

  requireNonEmptyString(config.profile, "profile", issues);
  requireNonEmptyString(config.metadata?.product, "metadata.product", issues);
  requireNonEmptyString(config.metadata?.category, "metadata.category", issues);
  requireNonEmptyString(config.metadata?.purpose, "metadata.purpose", issues);
  requireStringArray(config.required_sections, "required_sections", issues);
  requireStringArray(config.required_evidence_contract_fields, "required_evidence_contract_fields", issues);
  requireStringArray(config.required_default_commands, "required_default_commands", issues);

  if (!isPlainRecord(config.modes)) {
    issues.push("modes must be an object");
  } else {
    for (const modeName of REQUIRED_MODE_NAMES) {
      const mode = config.modes[modeName];
      if (!isPlainRecord(mode)) {
        issues.push(`modes.${modeName} must be an object`);
        continue;
      }
      requireBoolean(mode.runtime_changes_allowed, `modes.${modeName}.runtime_changes_allowed`, issues);
      requireBoolean(mode.product_tests_required, `modes.${modeName}.product_tests_required`, issues);
    }
  }

  requireBooleanRecord(config.hard_rules, "hard_rules", issues);
  requireBooleanRecord(config.runtime_safety_rules, "runtime_safety_rules", issues);

  if (!isPlainRecord(config.area_rules)) {
    issues.push("area_rules must be an object");
  } else {
    for (const [areaName, areaRule] of Object.entries(config.area_rules)) {
      if (!isPlainRecord(areaRule)) {
        issues.push(`area_rules.${areaName} must be an object`);
        continue;
      }
      requireStringArray(areaRule.path_patterns, `area_rules.${areaName}.path_patterns`, issues);
      requireStringArray(areaRule.required_proof, `area_rules.${areaName}.required_proof`, issues);
      if (areaRule.required_sections !== undefined) {
        requireStringArray(areaRule.required_sections, `area_rules.${areaName}.required_sections`, issues);
      }
    }
  }

  if (issues.length > 0) {
    throw new AgentReviewConfigError(`Invalid agent-review config: ${sourcePath}`, issues);
  }

  const warnings: string[] = [];
  if (!config.future_enforcement) {
    warnings.push("future_enforcement is missing; validator/CI roadmap metadata will not be available");
  }
  return warnings;
}

function parseJsonConfig(text: string, sourcePath: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AgentReviewConfigError(`Invalid JSON config: ${sourcePath}`, [formatUnknownError(error)]);
  }
}

function parseYamlSubsetConfig(text: string, sourcePath: string): unknown {
  const root: Record<string, unknown> = {};
  const stack: Array<{ readonly indent: number; readonly value: unknown }> = [{ indent: -1, value: root }];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = stripYamlComment(lines[index] ?? "");
    if (rawLine.trim() === "") {
      continue;
    }

    const indent = countLeadingSpaces(rawLine);
    if (indent % 2 !== 0) {
      throw new AgentReviewConfigError(`Invalid YAML indentation in ${sourcePath}`, [`Line ${index + 1}: indentation must use multiples of two spaces`]);
    }

    const line = rawLine.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.value;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) {
        throw new AgentReviewConfigError(`Invalid YAML list item in ${sourcePath}`, [`Line ${index + 1}: list item has no array parent`]);
      }
      parent.push(parseYamlScalar(line.slice(2).trim()));
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) {
      throw new AgentReviewConfigError(`Invalid YAML line in ${sourcePath}`, [`Line ${index + 1}: expected key: value`]);
    }

    if (!isMutableRecord(parent)) {
      throw new AgentReviewConfigError(`Invalid YAML object entry in ${sourcePath}`, [`Line ${index + 1}: object entry has no object parent`]);
    }

    const key = line.slice(0, colonIndex).trim();
    const rest = line.slice(colonIndex + 1).trim();

    if (rest !== "") {
      parent[key] = parseYamlScalar(rest);
      continue;
    }

    const child: unknown[] | Record<string, unknown> = nextSignificantLineIsList(lines, index + 1, indent) ? [] : {};
    parent[key] = child;
    stack.push({ indent, value: child });
  }

  return root;
}

function normalizeAgentReviewConfig(value: unknown, sourcePath: string): AgentReviewConfig {
  if (!isPlainRecord(value)) {
    throw new AgentReviewConfigError(`Invalid agent-review config: ${sourcePath}`, ["Config root must be an object"]);
  }
  return value as unknown as AgentReviewConfig;
}

function stripYamlComment(line: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return line.slice(0, index).trimEnd();
    }
  }

  return line;
}

function parseYamlScalar(value: string): unknown {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return value;
}

function nextSignificantLineIsList(lines: readonly string[], startIndex: number, parentIndent: number): boolean {
  for (let index = startIndex; index < lines.length; index += 1) {
    const candidate = stripYamlComment(lines[index] ?? "");
    if (candidate.trim() === "") {
      continue;
    }
    const indent = countLeadingSpaces(candidate);
    return indent > parentIndent && candidate.trim().startsWith("- ");
  }
  return false;
}

function countLeadingSpaces(value: string): number {
  return value.length - value.trimStart().length;
}

async function assertReadableFile(path: string, errorMessage: string): Promise<void> {
  if (!(await fileExists(path))) {
    throw new AgentReviewConfigError(errorMessage);
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function requireNonEmptyString(value: unknown, field: string, issues: string[]): void {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`${field} must be a non-empty string`);
  }
}

function requireStringArray(value: unknown, field: string, issues: string[]): void {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    issues.push(`${field} must be a non-empty string array`);
  }
}

function requireBoolean(value: unknown, field: string, issues: string[]): void {
  if (typeof value !== "boolean") {
    issues.push(`${field} must be boolean`);
  }
}

function requireBooleanRecord(value: unknown, field: string, issues: string[]): void {
  if (!isPlainRecord(value) || Object.keys(value).length === 0) {
    issues.push(`${field} must be a non-empty object`);
    return;
  }

  for (const [key, recordValue] of Object.entries(value)) {
    if (typeof recordValue !== "boolean") {
      issues.push(`${field}.${key} must be boolean`);
    }
  }
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMutableRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
