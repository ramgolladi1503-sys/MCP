import type {
  AgentReviewConfig,
  AgentReviewEvidenceDocument,
  AgentReviewEvidenceSection,
  AgentReviewValidationIssue
} from "./index";

export interface AgentReviewRequiredSectionValidationInput {
  readonly config: AgentReviewConfig;
  readonly evidence: AgentReviewEvidenceDocument;
}

export interface AgentReviewRequiredSectionValidationResult {
  readonly passed: boolean;
  readonly present_sections: readonly string[];
  readonly missing_sections: readonly string[];
  readonly issues: readonly AgentReviewValidationIssue[];
}

export function validateAgentReviewRequiredSections(
  input: AgentReviewRequiredSectionValidationInput
): AgentReviewRequiredSectionValidationResult {
  const presentSections = input.evidence.sections.map((section) => section.heading);
  const presentSectionKeys = new Set(presentSections.map(normalizeEvidenceSectionHeading));
  const missingSections = input.config.required_sections.filter(
    (requiredSection) => !presentSectionKeys.has(normalizeEvidenceSectionHeading(requiredSection))
  );

  const issues = missingSections.map((missingSection): AgentReviewValidationIssue => ({
    severity: "error",
    rule_id: "agent_review.required_section_missing",
    message: `Missing required evidence section: ${missingSection}`,
    path: input.evidence.path,
    section: missingSection,
    suggested_fix: `Add a "## ${missingSection}" section to ${input.evidence.path}.`
  }));

  return {
    passed: issues.length === 0,
    present_sections: presentSections,
    missing_sections: missingSections,
    issues
  };
}

export function hasAgentReviewEvidenceSection(evidence: AgentReviewEvidenceDocument, heading: string): boolean {
  return findAgentReviewEvidenceSection(evidence, heading) !== undefined;
}

export function findAgentReviewEvidenceSection(
  evidence: AgentReviewEvidenceDocument,
  heading: string
): AgentReviewEvidenceSection | undefined {
  const expectedHeading = normalizeEvidenceSectionHeading(heading);
  return evidence.sections.find((section) => normalizeEvidenceSectionHeading(section.heading) === expectedHeading);
}

function normalizeEvidenceSectionHeading(heading: string): string {
  return heading.trim().replace(/\s+/g, " ").toLowerCase();
}
