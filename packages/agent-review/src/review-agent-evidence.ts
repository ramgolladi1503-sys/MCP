import type { AgentReviewEvidenceDocument, AgentReviewValidationIssue } from "./index.js";
import { findAgentReviewEvidenceSection } from "./required-sections.js";
import type { AgentReviewResolvedReviewAgent } from "./review-agent-resolver.js";

export const AGENT_REVIEW_REQUIRED_REVIEW_AGENTS_SECTION = "Required Review Agents" as const;

export interface AgentReviewAgentEvidenceValidationInput {
  readonly evidence: AgentReviewEvidenceDocument;
  readonly resolved_review_agents: readonly AgentReviewResolvedReviewAgent[];
  readonly section_heading?: string;
}

export interface AgentReviewAgentEvidenceValidationResult {
  readonly passed: boolean;
  readonly required_review_agents: readonly string[];
  readonly satisfied_review_agents: readonly string[];
  readonly missing_review_agents: readonly string[];
  readonly issues: readonly AgentReviewValidationIssue[];
}

export function validateAgentReviewAgentEvidence(
  input: AgentReviewAgentEvidenceValidationInput
): AgentReviewAgentEvidenceValidationResult {
  const requiredAgents = input.resolved_review_agents.map((agent) => agent.agent);

  if (requiredAgents.length === 0) {
    return {
      passed: true,
      required_review_agents: [],
      satisfied_review_agents: [],
      missing_review_agents: [],
      issues: []
    };
  }

  const sectionHeading = input.section_heading ?? AGENT_REVIEW_REQUIRED_REVIEW_AGENTS_SECTION;
  const section = findAgentReviewEvidenceSection(input.evidence, sectionHeading);

  if (section === undefined) {
    return {
      passed: false,
      required_review_agents: requiredAgents,
      satisfied_review_agents: [],
      missing_review_agents: requiredAgents,
      issues: [
        {
          severity: "error",
          rule_id: "agent_review.required_review_agents_section_missing",
          message: `Missing required evidence section: ${sectionHeading}`,
          path: input.evidence.path,
          section: sectionHeading,
          suggested_fix: `Add a "## ${sectionHeading}" section with one PASS line for each required review agent.`
        }
      ]
    };
  }

  const passedEntries = parsePassingReviewAgentEntries(section.content);
  const satisfiedAgents = input.resolved_review_agents
    .filter((agent) => passedEntries.has(normalizeAgentEvidenceKey(agent.agent)) || passedEntries.has(normalizeAgentEvidenceKey(agent.label)))
    .map((agent) => agent.agent);
  const satisfiedAgentSet = new Set(satisfiedAgents);
  const missingAgents = requiredAgents.filter((agent) => !satisfiedAgentSet.has(agent));

  const issues = missingAgents.map((agent): AgentReviewValidationIssue => {
    const resolvedAgent = input.resolved_review_agents.find((candidate) => candidate.agent === agent);
    const label = resolvedAgent?.label ?? agent;

    return {
      severity: "error",
      rule_id: "agent_review.required_review_agent_missing",
      message: `Missing PASS evidence for required review agent: ${label}`,
      path: input.evidence.path,
      section: sectionHeading,
      suggested_fix: `Add "- ${label}: PASS" to the "## ${sectionHeading}" section.`
    };
  });

  return {
    passed: issues.length === 0,
    required_review_agents: requiredAgents,
    satisfied_review_agents: satisfiedAgents,
    missing_review_agents: missingAgents,
    issues
  };
}

function parsePassingReviewAgentEntries(content: string): ReadonlySet<string> {
  const passedEntries = new Set<string>();

  for (const line of content.split("\n")) {
    const match = line.trim().match(/^-\s*(.+?)\s*:\s*PASS\s*$/i);
    if (!match) {
      continue;
    }

    passedEntries.add(normalizeAgentEvidenceKey(match[1]));
  }

  return passedEntries;
}

function normalizeAgentEvidenceKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
