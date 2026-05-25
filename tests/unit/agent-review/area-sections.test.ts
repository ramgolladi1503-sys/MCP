import { describe, expect, it } from "vitest";
import type { AgentReviewAreaClassification } from "../../../packages/agent-review/src/index";
import { parseAgentReviewEvidenceMarkdown } from "../../../packages/agent-review/src/evidence-markdown";
import {
  evidenceHasNonEmptyAreaSection,
  validateAgentReviewAreaSections
} from "../../../packages/agent-review/src/area-sections";

const gatewayArea: AgentReviewAreaClassification = {
  area: "gateway",
  matched_patterns: ["packages/gateway/**"],
  files: [{ path: "packages/gateway/src/index.ts", status: "modified" }],
  required_proof: ["protocol test"],
  required_sections: ["Security Review", "QA / Failure Review", "Scope Guard"]
};

const observabilityArea: AgentReviewAreaClassification = {
  area: "observability",
  matched_patterns: ["packages/**/observability/**"],
  files: [{ path: "packages/gateway/observability/trace.ts", status: "modified" }],
  required_proof: ["trace context proof"],
  required_sections: ["Security Review", "QA / Failure Review"]
};

describe("agent-review area-specific evidence validator", () => {
  it("passes when all detected area required sections are present and non-empty", () => {
    const evidence = parseAgentReviewEvidenceMarkdown(
      [
        "# Evidence",
        "",
        "## Security Review",
        "Gateway security impact is reviewed.",
        "",
        "## QA / Failure Review",
        "Failure coverage is documented.",
        "",
        "## Scope Guard",
        "Gateway-only scope is confirmed."
      ].join("\n"),
      "docs/area-sections-pass.md"
    );

    const result = validateAgentReviewAreaSections({ evidence, detected_areas: [gatewayArea] });

    expect(result.passed).toBe(true);
    expect(result.satisfied_sections).toEqual(["Security Review", "QA / Failure Review", "Scope Guard"]);
    expect(result.missing_sections).toEqual([]);
    expect(result.empty_sections).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(evidenceHasNonEmptyAreaSection(evidence, "Security Review")).toBe(true);
  });

  it("fails with structured issues for missing area-specific sections", () => {
    const evidence = parseAgentReviewEvidenceMarkdown(
      ["# Evidence", "", "## Security Review", "Security review exists."].join("\n"),
      "docs/area-section-missing.md"
    );

    const result = validateAgentReviewAreaSections({ evidence, detected_areas: [gatewayArea] });

    expect(result.passed).toBe(false);
    expect(result.missing_sections).toEqual(["QA / Failure Review", "Scope Guard"]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          rule_id: "agent_review.area_section_missing",
          path: "docs/area-section-missing.md",
          section: "QA / Failure Review",
          field: "gateway"
        })
      ])
    );
  });

  it("fails with structured issues for empty area-specific sections", () => {
    const evidence = parseAgentReviewEvidenceMarkdown(
      [
        "# Evidence",
        "",
        "## Security Review",
        "Security review exists.",
        "",
        "## QA / Failure Review",
        "",
        "## Scope Guard",
        "Scope guard exists."
      ].join("\n"),
      "docs/area-section-empty.md"
    );

    const result = validateAgentReviewAreaSections({ evidence, detected_areas: [gatewayArea] });

    expect(result.passed).toBe(false);
    expect(result.empty_sections).toEqual(["QA / Failure Review"]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule_id: "agent_review.area_section_empty",
          section: "QA / Failure Review",
          field: "gateway"
        })
      ])
    );
  });

  it("collapses duplicate required sections across areas while preserving area and file context", () => {
    const evidence = parseAgentReviewEvidenceMarkdown(
      ["# Evidence", "", "## Security Review", "Security review exists."].join("\n"),
      "docs/area-section-shared.md"
    );

    const result = validateAgentReviewAreaSections({ evidence, detected_areas: [gatewayArea, observabilityArea] });

    expect(result.required_sections.find((section) => section.section === "Security Review")?.areas).toEqual([
      "gateway",
      "observability"
    ]);
    expect(result.required_sections.find((section) => section.section === "Security Review")?.files).toEqual([
      "packages/gateway/src/index.ts",
      "packages/gateway/observability/trace.ts"
    ]);
    expect(result.missing_sections).toEqual(["QA / Failure Review", "Scope Guard"]);
  });

  it("passes with no required area sections when no areas are detected", () => {
    const evidence = parseAgentReviewEvidenceMarkdown("# Evidence\n\n## Acceptance Proof\nNo area sections required.", "docs/no-areas.md");

    const result = validateAgentReviewAreaSections({ evidence, detected_areas: [] });

    expect(result.passed).toBe(true);
    expect(result.expectations).toEqual([]);
    expect(result.required_sections).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
