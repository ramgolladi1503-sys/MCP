import { describe, expect, it } from "vitest";
import { loadAgentReviewConfig } from "../../../packages/agent-review/src/index";
import { parseAgentReviewEvidenceMarkdown } from "../../../packages/agent-review/src/evidence-markdown";
import { validateAgentReviewModeRules } from "../../../packages/agent-review/src/mode-rules";

function buildEvidenceMarkdown(fields: readonly string[], sections: readonly string[] = []): string {
  return [
    "# Evidence",
    "",
    "## Agent Work Contract",
    "",
    "### Evidence Contract Fields",
    ...fields,
    "",
    ...sections
  ].join("\n");
}

const baseFields = [
  "candidate_id: MODE_RULE_TEST",
  "decision: MODE_RULE_VALIDATION",
  "reason: Proves mode-specific evidence validation.",
  "is_runtime_change: false",
  "is_security_runtime_change: false",
  "child_mcp_forwarding_changed: false",
  "policy_behavior_changed: false",
  "approval_behavior_changed: false",
  "audit_schema_changed: false",
  "source: docs/mode-rule-test.md"
];

describe("agent-review mode-specific validator", () => {
  it("passes when the real PR #33 evidence satisfies CONTRACT_ONLY mode rules", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const markdown = await import("node:fs/promises").then((fs) =>
      fs.readFile("docs/agent_reviews/pr_33_evidence_field_validator.md", "utf8")
    );
    const evidence = parseAgentReviewEvidenceMarkdown(markdown, "docs/agent_reviews/pr_33_evidence_field_validator.md");

    const result = validateAgentReviewModeRules({ config, evidence });

    expect(result.passed).toBe(true);
    expect(result.mode).toBe("CONTRACT_ONLY");
    expect(result.evaluated_rules).toContain("runtime_changes_allowed");
    expect(result.evaluated_rules).toContain("must_state_future_runtime_proof");
    expect(result.issues).toEqual([]);
  });

  it("fails when a non-runtime mode claims runtime changes", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown(
      buildEvidenceMarkdown([
        "mode: CONTRACT_ONLY",
        ...baseFields.filter((field) => !field.startsWith("is_runtime_change:")),
        "is_runtime_change: true"
      ]),
      "docs/runtime-claim.md"
    );

    const result = validateAgentReviewModeRules({ config, evidence });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule_id: "agent_review.mode_rule_runtime_change_not_allowed",
          field: "is_runtime_change",
          path: "docs/runtime-claim.md"
        })
      ])
    );
  });

  it("fails CONTRACT_ONLY when future runtime proof is not stated", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown(
      buildEvidenceMarkdown(["mode: CONTRACT_ONLY", ...baseFields], ["## Runtime Proof Required After Merge", "None."]),
      "docs/missing-future-proof.md"
    );

    const result = validateAgentReviewModeRules({ config, evidence });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule_id: "agent_review.mode_rule_future_runtime_proof_missing",
          field: "Runtime Proof Required After Merge"
        })
      ])
    );
  });

  it("fails RUNTIME_CHANGE when configured product test proof is missing", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown(
      buildEvidenceMarkdown(
        [
          "mode: RUNTIME_CHANGE",
          ...baseFields.filter((field) => !field.startsWith("is_runtime_change:")),
          "is_runtime_change: true"
        ],
        ["## QA / Failure Review", "Negative test coverage is described.", "## Acceptance Proof", "Manual review only."]
      ),
      "docs/runtime-no-product-proof.md"
    );

    const result = validateAgentReviewModeRules({ config, evidence });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule_id: "agent_review.mode_rule_product_tests_missing",
          field: "Acceptance Proof"
        })
      ])
    );
  });

  it("passes RUNTIME_CHANGE when product and negative test proof are present", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown(
      buildEvidenceMarkdown(
        [
          "mode: RUNTIME_CHANGE",
          ...baseFields.filter((field) => !field.startsWith("is_runtime_change:")),
          "is_runtime_change: true"
        ],
        ["## QA / Failure Review", "Negative tests cover invalid input.", "## Acceptance Proof", "pnpm test:hardening"]
      ),
      "docs/runtime-valid.md"
    );

    const result = validateAgentReviewModeRules({ config, evidence });

    expect(result.passed).toBe(true);
    expect(result.evaluated_rules).toContain("product_tests_required");
    expect(result.evaluated_rules).toContain("must_include_negative_tests");
  });

  it("fails SECURITY_RUNTIME_CHANGE when false-positive and audit/debug evidence are missing", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown(
      buildEvidenceMarkdown(
        [
          "mode: SECURITY_RUNTIME_CHANGE",
          ...baseFields.filter((field) => !field.startsWith("is_runtime_change:")).filter((field) => !field.startsWith("is_security_runtime_change:")),
          "is_runtime_change: true",
          "is_security_runtime_change: true"
        ],
        ["## QA / Failure Review", "Negative tests cover invalid input.", "## Acceptance Proof", "pnpm test:hardening"]
      ),
      "docs/security-runtime-missing-proof.md"
    );

    const result = validateAgentReviewModeRules({ config, evidence });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule_id: "agent_review.mode_rule_false_positive_tests_missing" }),
        expect.objectContaining({ rule_id: "agent_review.mode_rule_audit_or_debug_evidence_missing" })
      ])
    );
  });
});
