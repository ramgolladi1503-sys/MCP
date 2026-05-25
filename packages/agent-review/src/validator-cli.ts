import { isAbsolute, join } from "node:path";

import type { AgentReviewAreaSectionValidationResult } from "./area-sections";
import { validateAgentReviewAreaSections } from "./area-sections";
import type { AgentReviewChangedFileClassificationResult } from "./changed-files";
import { classifyAgentReviewChangedFilesWithSummary } from "./changed-files";
import type { AgentReviewEvidenceFieldValidationResult } from "./evidence-fields";
import { validateAgentReviewEvidenceFields } from "./evidence-fields";
import { loadAgentReviewEvidenceDocument } from "./evidence-markdown";
import type {
  AgentReviewChangedFile,
  AgentReviewValidationIssue
} from "./index";
import { loadAgentReviewConfig } from "./index";
import type { AgentReviewModeRuleValidationResult } from "./mode-rules";
import { validateAgentReviewModeRules } from "./mode-rules";
import type { AgentReviewRequiredProofResolutionResult } from "./required-proof";
import { resolveAgentReviewRequiredProof } from "./required-proof";
import type { AgentReviewRequiredSectionValidationResult } from "./required-sections";
import { validateAgentReviewRequiredSections } from "./required-sections";

export const AGENT_REVIEW_VALIDATOR_CLI_SCHEMA_VERSION = "agent_review.validator_cli.v1" as const;

export interface AgentReviewValidatorCliOptions {
  readonly project_root: string;
  readonly evidence_path: string;
  readonly changed_files: readonly AgentReviewChangedFile[];
}

export interface AgentReviewValidatorCliReport {
  readonly schema_version: typeof AGENT_REVIEW_VALIDATOR_CLI_SCHEMA_VERSION;
  readonly passed: boolean;
  readonly config_path: string;
  readonly evidence_path: string;
  readonly changed_files: readonly AgentReviewChangedFile[];
  readonly detected_areas: AgentReviewChangedFileClassificationResult["detected_areas"];
  readonly unmatched_files: readonly AgentReviewChangedFile[];
  readonly checks: {
    readonly required_sections: AgentReviewRequiredSectionValidationResult;
    readonly evidence_fields: AgentReviewEvidenceFieldValidationResult;
    readonly mode_rules: AgentReviewModeRuleValidationResult;
    readonly area_sections: AgentReviewAreaSectionValidationResult;
    readonly required_proof: AgentReviewRequiredProofResolutionResult;
  };
  readonly issues: readonly AgentReviewValidationIssue[];
}

export interface AgentReviewValidatorCliRunResult {
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly report?: AgentReviewValidatorCliReport;
}

interface ParsedCliArgs {
  readonly help: boolean;
  readonly project_root?: string;
  readonly evidence_path?: string;
  readonly changed_files: readonly AgentReviewChangedFile[];
}

export async function runAgentReviewValidatorCli(args: readonly string[]): Promise<AgentReviewValidatorCliRunResult> {
  const parsed = parseAgentReviewValidatorCliArgs(args);

  if (parsed.help) {
    return {
      exit_code: 0,
      stdout: getAgentReviewValidatorCliHelp(),
      stderr: ""
    };
  }

  if (!parsed.evidence_path) {
    return buildCliError("Missing required --evidence <path> argument.");
  }

  const projectRoot = parsed.project_root ?? process.cwd();
  const evidencePath = resolvePath(projectRoot, parsed.evidence_path);

  try {
    const { config, path: configPath } = await loadAgentReviewConfig(projectRoot);
    const evidence = await loadAgentReviewEvidenceDocument(evidencePath);
    const changedFileSummary = classifyAgentReviewChangedFilesWithSummary(parsed.changed_files, config);
    const requiredSections = validateAgentReviewRequiredSections({ config, evidence });
    const evidenceFields = validateAgentReviewEvidenceFields({ config, evidence });
    const modeRules = validateAgentReviewModeRules({ config, evidence });
    const areaSections = validateAgentReviewAreaSections({
      evidence,
      detected_areas: changedFileSummary.detected_areas
    });
    const requiredProof = resolveAgentReviewRequiredProof({
      evidence,
      detected_areas: changedFileSummary.detected_areas
    });
    const issues = [
      ...requiredSections.issues,
      ...evidenceFields.issues,
      ...modeRules.issues,
      ...areaSections.issues,
      ...requiredProof.issues
    ];
    const report: AgentReviewValidatorCliReport = {
      schema_version: AGENT_REVIEW_VALIDATOR_CLI_SCHEMA_VERSION,
      passed: issues.length === 0,
      config_path: configPath,
      evidence_path: evidence.path,
      changed_files: changedFileSummary.matched_files.concat(changedFileSummary.unmatched_files),
      detected_areas: changedFileSummary.detected_areas,
      unmatched_files: changedFileSummary.unmatched_files,
      checks: {
        required_sections: requiredSections,
        evidence_fields: evidenceFields,
        mode_rules: modeRules,
        area_sections: areaSections,
        required_proof: requiredProof
      },
      issues
    };

    return {
      exit_code: report.passed ? 0 : 1,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
      report
    };
  } catch (error: unknown) {
    return buildCliError(error instanceof Error ? error.message : String(error));
  }
}

export function parseAgentReviewValidatorCliArgs(args: readonly string[]): ParsedCliArgs {
  const changedFiles: AgentReviewChangedFile[] = [];
  let projectRoot: string | undefined;
  let evidencePath: string | undefined;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--project-root") {
      projectRoot = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--evidence") {
      evidencePath = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--changed-file") {
      changedFiles.push({ path: readValue(args, index, arg) });
      index += 1;
      continue;
    }

    if (arg.startsWith("--changed-file=")) {
      changedFiles.push({ path: arg.slice("--changed-file=".length) });
      continue;
    }

    if (arg.startsWith("--evidence=")) {
      evidencePath = arg.slice("--evidence=".length);
      continue;
    }

    if (arg.startsWith("--project-root=")) {
      projectRoot = arg.slice("--project-root=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    help,
    project_root: projectRoot,
    evidence_path: evidencePath,
    changed_files: changedFiles
  };
}

export function getAgentReviewValidatorCliHelp(): string {
  return [
    "Agent Review validator CLI",
    "",
    "Usage:",
    "  node packages/agent-review/dist/validator-cli.js --evidence <path> [--project-root <path>] [--changed-file <path> ...]",
    "",
    "Options:",
    "  --evidence <path>       Evidence markdown file to validate.",
    "  --project-root <path>   Project root containing agent-review config. Defaults to current working directory.",
    "  --changed-file <path>   Changed file path. Can be repeated.",
    "  --help                  Print this help text.",
    ""
  ].join("\n");
}

function readValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function resolvePath(projectRoot: string, path: string): string {
  return isAbsolute(path) ? path : join(projectRoot, path);
}

function buildCliError(message: string): AgentReviewValidatorCliRunResult {
  return {
    exit_code: 2,
    stdout: "",
    stderr: `${message}\n`
  };
}

if (process.argv[1]?.endsWith("validator-cli.js")) {
  const result = await runAgentReviewValidatorCli(process.argv.slice(2));
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exit_code;
}
