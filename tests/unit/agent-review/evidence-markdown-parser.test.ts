import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  loadAgentReviewEvidenceDocument,
  parseAgentReviewEvidenceContractFields,
  parseAgentReviewEvidenceMarkdown
} from "../../../packages/agent-review/src/evidence-markdown";

describe("agent-review evidence markdown parser", () => {
  it("parses the real PR #30 evidence markdown structure", async () => {
    const document = await loadAgentReviewEvidenceDocument("docs/agent_reviews/pr_30_agent_review_config_loader.md");

    expect(document.title).toBe("Agent Review Evidence — PR #30 Agent Review Config Loader");
    expect(document.sections.map((section) => section.heading)).toContain("Agent Work Contract");
    expect(document.sections.map((section) => section.heading)).toContain("Acceptance Proof");
    expect(document.evidence_contract?.mode).toBe("CONTRACT_ONLY");
    expect(document.evidence_contract?.candidate_id).toBe("PR_30_AGENT_REVIEW_CONFIG_LOADER");
  });

  it("parses headings and key value fields without validation", () => {
    const document = parseAgentReviewEvidenceMarkdown(
      [
        "# Example Evidence",
        "",
        "## Agent Work Contract",
        "",
        "### Goal",
        "Parse section content.",
        "",
        "### Evidence Contract Fields",
        "mode: DOCS_ONLY",
        "candidate_id: PR_31_EVIDENCE_MARKDOWN_PARSER",
        "source: docs/example.md",
        "",
        "## Scope Guard",
        "No behavior change."
      ].join("\n"),
      "docs/example.md"
    );

    expect(document.title).toBe("Example Evidence");
    expect(document.sections.map((section) => section.heading)).toEqual([
      "Agent Work Contract",
      "Goal",
      "Evidence Contract Fields",
      "Scope Guard"
    ]);
    expect(document.sections.find((section) => section.heading === "Goal")?.content).toBe("Parse section content.");
    expect(document.evidence_contract?.candidate_id).toBe("PR_31_EVIDENCE_MARKDOWN_PARSER");
  });

  it("keeps parser permissive and does not validate missing fields", () => {
    const contract = parseAgentReviewEvidenceContractFields(
      ["mode: DOCS_ONLY", "candidate_id: PARTIAL_CONTRACT", "source without colon", "- source: ignored bullet"].join("\n")
    );

    expect(contract?.mode).toBe("DOCS_ONLY");
    expect(contract?.candidate_id).toBe("PARTIAL_CONTRACT");
    expect(contract?.source).toBeUndefined();
  });

  it("loads evidence markdown from an explicit file path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-review-evidence-"));
    try {
      const evidencePath = join(directory, "evidence.md");
      await writeFile(evidencePath, "# Title\n\n## Evidence Contract Fields\n\nmode: DOCS_ONLY\n", "utf8");

      const document = await loadAgentReviewEvidenceDocument(evidencePath);
      expect(document.path).toBe(evidencePath);
      expect(document.title).toBe("Title");
      expect(document.evidence_contract?.mode).toBe("DOCS_ONLY");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
