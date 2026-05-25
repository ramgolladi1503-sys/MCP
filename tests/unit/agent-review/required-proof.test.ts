import { describe, expect, it } from "vitest";
import type { AgentReviewAreaClassification } from "../../../packages/agent-review/src/index";
import { parseAgentReviewEvidenceMarkdown } from "../../../packages/agent-review/src/evidence-markdown";
import {
  evidenceContainsRequiredProof,
  resolveAgentReviewRequiredProof
} from "../../../packages/agent-review/src/required-proof";

const gatewayArea: AgentReviewAreaClassification = {
  area: "gateway",
  matched_patterns: ["packages/gateway/**"],
  files: [{ path: "packages/gateway/src/index.ts", status: "modified" }],
  required_proof: ["protocol test", "stdout purity", "block before forward proof", "timeout behavior"],
  required_sections: ["Security Review", "QA / Failure Review", "Scope Guard"]
};

const policyArea: AgentReviewAreaClassification = {
  area: "policy",
  matched_patterns: ["packages/policy/**"],
  files: [{ path: "packages/policy/src/rules.ts", status: "modified" }],
  required_proof: ["mode matrix", "fail-closed test", "false-positive test"],
  required_sections: []
};

describe("agent-review required proof resolver", () => {
  it("passes when all detected area proof strings are present in evidence", () => {
    const evidence = parseAgentReviewEvidenceMarkdown(
      [
        "# Evidence",
        "",
        "## Acceptance Proof",
        "protocol test completed",
        "stdout purity verified",
        "block before forward proof captured",
        "timeout behavior checked"
      ].join("\n"),
      "docs/proof-pass.md"
    );

    const result = resolveAgentReviewRequiredProof({ evidence, detected_areas: [gatewayArea] });

    expect(result.passed).toBe(true);
    expect(result.missing_proof).toEqual([]);
    expect(result.satisfied_proof).toEqual(["protocol test", "stdout purity", "block before forward proof", "timeout behavior"]);
    expect(result.issues).toEqual([]);
  });

  it("fails with structured issues when required proof is missing", () => {
    const evidence = parseAgentReviewEvidenceMarkdown(
      ["# Evidence", "", "## Acceptance Proof", "protocol test completed", "stdout purity verified"].join("\n"),
      "docs/proof-missing.md"
    );

    const result = resolveAgentReviewRequiredProof({ evidence, detected_areas: [gatewayArea] });

    expect(result.passed).toBe(false);
    expect(result.missing_proof).toEqual(["block before forward proof", "timeout behavior"]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          rule_id: "agent_review.required_proof_missing",
          path: "docs/proof-missing.md",
          section: "Acceptance Proof",
          field: "block before forward proof"
        })
      ])
    );
  });

  it("collapses duplicate proof across multiple detected areas while preserving area context", () => {
    const gatewayWithSharedProof: AgentReviewAreaClassification = {
      ...gatewayArea,
      required_proof: ["protocol test", "fail-closed test"]
    };
    const evidence = parseAgentReviewEvidenceMarkdown(
      ["# Evidence", "", "## Acceptance Proof", "protocol test completed"].join("\n"),
      "docs/shared-proof.md"
    );

    const result = resolveAgentReviewRequiredProof({ evidence, detected_areas: [gatewayWithSharedProof, policyArea] });

    expect(result.required_proof.find((proof) => proof.proof === "fail-closed test")?.areas).toEqual(["gateway", "policy"]);
    expect(result.required_proof.find((proof) => proof.proof === "fail-closed test")?.files).toEqual([
      "packages/gateway/src/index.ts",
      "packages/policy/src/rules.ts"
    ]);
    expect(result.missing_proof).toContain("fail-closed test");
  });

  it("normalizes markdown punctuation when searching proof text", () => {
    const evidence = parseAgentReviewEvidenceMarkdown(
      ["# Evidence", "", "## Acceptance Proof", "- false_positive test completed", "- fail closed test completed"].join("\n"),
      "docs/normalized-proof.md"
    );

    expect(evidenceContainsRequiredProof(evidence, "false-positive test")).toBe(true);
    expect(evidenceContainsRequiredProof(evidence, "fail-closed test")).toBe(true);
  });

  it("passes with no required proof when no areas are detected", () => {
    const evidence = parseAgentReviewEvidenceMarkdown("# Evidence\n\n## Acceptance Proof\nNo area proof required.", "docs/no-areas.md");

    const result = resolveAgentReviewRequiredProof({ evidence, detected_areas: [] });

    expect(result.passed).toBe(true);
    expect(result.expectations).toEqual([]);
    expect(result.required_proof).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
