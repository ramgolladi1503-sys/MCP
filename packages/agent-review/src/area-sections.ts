import type {
  AgentReviewAreaClassification,
  AgentReviewEvidenceDocument,
  AgentReviewValidationIssue
} from "./index.js";
import { findAgentReviewEvidenceSection } from "./required-sections.js";

export interface AgentReviewAreaSectionValidationInput {
  readonly evidence: AgentReviewEvidenceDocument;
  readonly detected_areas: readonly AgentReviewAreaClassification[];
}

export interface AgentReviewAreaSectionExpectation {
  readonly area: string;
  readonly section: string;
  readonly files: readonly string[];
}

export interface AgentReviewResolvedAreaSection {
  readonly section: string;
  readonly areas: readonly string[];
  readonly files: readonly string[];
  readonly present: boolean;
  readonly non_empty: boolean;
}

export interface AgentReviewAreaSectionValidationResult {
  readonly passed: boolean;
  readonly expectations: readonly AgentReviewAreaSectionExpectation[];
  readonly required_sections: readonly AgentReviewResolvedAreaSection[];
  readonly satisfied_sections: readonly string[];
  readonly missing_sections: readonly string[];
  readonly empty_sections: readonly string[];
  readonly issues: readonly AgentReviewValidationIssue[];
}

export function validateAgentReviewAreaSections(
  input: AgentReviewAreaSectionValidationInput
): AgentReviewAreaSectionValidationResult {
  const expectations = buildAreaSectionExpectations(input.detected_areas);
  const requiredSections = collapseAreaSectionExpectations(expectations, input.evidence);
  const missingSections = requiredSections.filter((section) => !section.present);
  const emptySections = requiredSections.filter((section) => section.present && !section.non_empty);
  const issues = [
    ...missingSections.flatMap((section) => buildAreaSectionIssues(input.evidence, section, "missing")),
    ...emptySections.flatMap((section) => buildAreaSectionIssues(input.evidence, section, "empty"))
  ];

  return {
    passed: issues.length === 0,
    expectations,
    required_sections: requiredSections,
    satisfied_sections: requiredSections.filter((section) => section.present && section.non_empty).map((section) => section.section),
    missing_sections: missingSections.map((section) => section.section),
    empty_sections: emptySections.map((section) => section.section),
    issues
  };
}

export function evidenceHasNonEmptyAreaSection(evidence: AgentReviewEvidenceDocument, section: string): boolean {
  const evidenceSection = findAgentReviewEvidenceSection(evidence, section);
  return evidenceSection !== undefined && evidenceSection.content.trim() !== "";
}

function buildAreaSectionExpectations(
  detectedAreas: readonly AgentReviewAreaClassification[]
): readonly AgentReviewAreaSectionExpectation[] {
  const expectations: AgentReviewAreaSectionExpectation[] = [];

  for (const area of detectedAreas) {
    for (const section of area.required_sections) {
      expectations.push({
        area: area.area,
        section,
        files: area.files.map((file) => file.path)
      });
    }
  }

  return expectations;
}

function collapseAreaSectionExpectations(
  expectations: readonly AgentReviewAreaSectionExpectation[],
  evidence: AgentReviewEvidenceDocument
): readonly AgentReviewResolvedAreaSection[] {
  const bySection = new Map<string, AgentReviewResolvedAreaSection>();

  for (const expectation of expectations) {
    const existing = bySection.get(expectation.section);
    if (existing) {
      bySection.set(expectation.section, {
        section: expectation.section,
        areas: dedupePreservingOrder([...existing.areas, expectation.area]),
        files: dedupePreservingOrder([...existing.files, ...expectation.files]),
        present: existing.present,
        non_empty: existing.non_empty
      });
      continue;
    }

    const evidenceSection = findAgentReviewEvidenceSection(evidence, expectation.section);
    bySection.set(expectation.section, {
      section: expectation.section,
      areas: [expectation.area],
      files: dedupePreservingOrder(expectation.files),
      present: evidenceSection !== undefined,
      non_empty: evidenceSection !== undefined && evidenceSection.content.trim() !== ""
    });
  }

  return Array.from(bySection.values());
}

function buildAreaSectionIssues(
  evidence: AgentReviewEvidenceDocument,
  section: AgentReviewResolvedAreaSection,
  reason: "missing" | "empty"
): readonly AgentReviewValidationIssue[] {
  const ruleId = reason === "missing" ? "agent_review.area_section_missing" : "agent_review.area_section_empty";
  const reasonText = reason === "missing" ? "Missing" : "Empty";

  return section.areas.map((area) => ({
    severity: "error",
    rule_id: ruleId,
    message: `${reasonText} required evidence section for ${area}: ${section.section}`,
    path: evidence.path,
    section: section.section,
    field: area,
    suggested_fix: `Add non-empty evidence to "${section.section}" covering ${section.files.join(", ")}.`
  }));
}

function dedupePreservingOrder(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}
