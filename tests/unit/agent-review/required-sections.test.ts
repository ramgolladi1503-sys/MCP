import { describe, expect, it } from "vitest";
import { loadAgentReviewConfig } from "../../../packages/agent-review/src/index";
import { parseAgentReviewEvidenceMarkdown } from "../../../packages/agent-review/src/evidence-markdown";
import {
  findAgentReviewEvidenceSection,
  hasAgentReviewEvidenceSection,
  validateAgentReviewRequiredSections
} from "../../../packages/agent-review/src/required-sections";

describe("agent-review required section validator", () => {
  it("passes when the real PR #31 evidence has every configured required section", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const evidence = parseAgentReviewEvidenceMarkdown(
      await import("node:fs/promises").then((fs) => fs.readFile("docs/agent_reviews/pr_31_evidence_markdown_parser.md", "utf8")),
      "docs/agent_reviews/pr_31_evidence_markdown_parser.md"
    );

    const result = validateAgentReviewRequiredSections({ config, evidence });

    expect(result.passed).toBe(true);
    expect(result.missing_sections).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it("fails with structured issues for missing required sections", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const requiredSectionsExceptHumanApproval = config.required_sections.filter((section) => section !== "Human Approval");
    const markdown = ["# Evidence", ...requiredSectionsExceptHumanApproval.map((section) => `\n## ${section}\nPresent.`)].join("\n");
    const evidence = parseAgentReviewEvidenceMarkdown(markdown, "docs/agent_reviews/missing_human_approval.md");

    const result = validateAgentReviewRequiredSections({ config, evidence });

    expect(result.passed).toBe(false);
    expect(result.missing_sections).toEqual(["Human Approval"]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        severity: "error",
        rule_id: "agent_review.required_section_missing",
        path: "docs/agent_reviews/missing_human_approval.md",
        section: "Human Approval"
      })
    ]);
  });

  it("matches section headings case-insensitively with normalized whitespace", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());
    const markdown = [
      "# Evidence",
      ...config.required_sections.map((section) => {
        const heading = section === "QA / Failure Review" ? "qa   /   failure   review" : section.toUpperCase();
        return `\n## ${heading}\nPresent.`;
      })
    ].join("\n");
    const evidence = parseAgentReviewEvidenceMarkdown(markdown, "docs/agent_reviews/case_normalized.md");

    const result = validateAgentReviewRequiredSections({ config, evidence });

    expect(result.passed).toBe(true);
    expect(hasAgentReviewEvidenceSection(evidence, "qa / failure review")).toBe(true);
    expect(findAgentReviewEvidenceSection(evidence, "QA / Failure Review")?.heading).toBe("qa   /   failure   review");
  });
});
