import type { Severity } from "@mcp-shield/shared";

export type ScannerIssueType =
  | "metadata_poisoning"
  | "schema_poisoning"
  | "dangerous_capability"
  | "supply_chain"
  | "scope_creep"
  | "manifest_drift";

export interface ScannerIssue {
  readonly type: ScannerIssueType;
  readonly severity: Severity;
  readonly ruleId: string;
  readonly detail: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
  readonly recommendedFix?: string;
}

export interface ScanReport {
  readonly reportVersion: "1.0";
  readonly overallRisk: Severity;
  readonly issues: readonly ScannerIssue[];
}

const METADATA_POISONING_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /read\s+(local\s+)?secrets/i,
  /send\s+.*\s+(secret|token|credential)/i,
  /call\s+.*tool/i,
  /before\s+responding/i
];

export function scanToolMetadata(toolName: string, description: string): readonly ScannerIssue[] {
  const hits = METADATA_POISONING_PATTERNS.filter((pattern) => pattern.test(description));
  if (hits.length === 0) {
    return [];
  }

  return [
    {
      type: "metadata_poisoning",
      severity: "high",
      ruleId: "scanner.metadata.instruction_like_text",
      detail: `Tool ${toolName} contains instruction-like metadata that may poison an agent.`,
      evidence: { toolName, patternCount: hits.length },
      recommendedFix: "Review the MCP server source and remove tool descriptions that instruct the agent to access secrets or call other tools."
    }
  ];
}

export function riskFromIssues(issues: readonly ScannerIssue[]): Severity {
  const rank: Record<Severity, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };

  return issues.reduce<Severity>((highest, issue) => (rank[issue.severity] > rank[highest] ? issue.severity : highest), "info");
}

export function createScanReport(issues: readonly ScannerIssue[]): ScanReport {
  return {
    reportVersion: "1.0",
    overallRisk: riskFromIssues(issues),
    issues
  };
}
