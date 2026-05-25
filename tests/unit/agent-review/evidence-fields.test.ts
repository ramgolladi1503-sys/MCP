import { describe, expect, it } from "vitest";
import { loadAgentReviewConfig } from "../../../packages/agent-review/src/index";
import { parseAgentReviewEvidenceMarkdown } from "../../../packages/agent-review/src/evidence-markdown";
import {
  getAgentReviewEvidenceFieldValue,
  hasAgentReviewEvidenceField,
  validateAgentReviewEvidenceFields
} from "../../../packages/agent-review/src/evidence-fields";

function buildEvidenceMarkdown(fields: readonly string[]): string {
  return ["# Evidence", "", "## Agent Work Contract", "", "### Evidence Contract Fields", ...fields].join("\n");
}

describe("agent-review evidence field validator", () => {
  it("passes when the real PR #32 evidence has valid configured fields", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const markdown = await import("node:fs/promises").then((fs) =>
      fs.readFile("docs/agent_reviews/pr_32_required_section_validator.md", "utf8")
    );
    const evidence = parseAgentReviewEvidenceMarkdown(markdown, "docs/agent_reviews/pr_32_required_section_validator.md");

    const result = validateAgentReviewEvidenceFields({ config, evidence });

    expect(result.passed).toBe(true);
    expect(result.missing_fields).toEqual([]);
    expect(result.invalid_fields).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(hasAgentReviewEvidenceField(evidence, "candidate_id")).toBe(true);
    expect(getAgentReviewEvidenceFieldValue(evidence, "mode")).toBe("CONTRACT_ONLY");
  });

  it("fails when required evidence contract fields are missing", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown(
      buildEvidenceMarkdown(["mode: CONTRACT_ONLY", "candidate_id: PARTIAL"]),
      "docs/agent_reviews/partial_contract.md"
    );

    const result = validateAgentReviewEvidenceFields({ config, evidence });

    expect(result.passed).toBe(false);
    expect(result.missing_fields).toContain("decision");
    expect(result.missing_fields).toContain("source");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          rule_id: "agent_review.evidence_field_missing",
          field: "decision",
          path: "docs/agent_reviews/partial_contract.md"
        })
      ])
    );
  });

  it("fails when the evidence contract block is missing", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown("# Evidence\n\n## Agent Work Contract\nNo contract fields.", "docs/no_contract.md");

    const result = validateAgentReviewEvidenceFields({ config, evidence });

    expect(result.passed).toBe(false);
    expect(result.missing_fields).toEqual(config.required_evidence_contract_fields);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule_id: "agent_review.evidence_contract_missing",
          section: "Evidence Contract Fields"
        })
      ])
    );
  });

  it("fails on invalid mode and invalid boolean string values", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown(
      buildEvidenceMarkdown([
        "mode: MADE_UP_MODE",
        "candidate_id: BAD_FIELDS",
        "decision: FIELD_VALIDATION",
        "reason: Proves invalid field values are rejected.",
        "is_runtime_change: maybe",
        "is_security_runtime_change: false",
        "child_mcp_forwarding_changed: false",
        "policy_behavior_changed: false",
        "approval_behavior_changed: false",
        "audit_schema_changed: false",
        "source: docs/bad_fields.md",
        "trace_behavior_changed: nope"
      ]),
      "docs/bad_fields.md"
    );

    const result = validateAgentReviewEvidenceFields({ config, evidence });

    expect(result.passed).toBe(false);
    expect(result.invalid_fields).toEqual(["mode", "is_runtime_change", "trace_behavior_changed"]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule_id: "agent_review.evidence_field_invalid_mode", field: "mode" }),
        expect.objectContaining({ rule_id: "agent_review.evidence_field_invalid_boolean_string", field: "is_runtime_change" }),
        expect.objectContaining({ rule_id: "agent_review.evidence_field_invalid_boolean_string", field: "trace_behavior_changed" })
      ])
    );
  });
});
