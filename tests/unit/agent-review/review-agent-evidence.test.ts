import { describe, expect, it } from "vitest";
import { parseAgentReviewEvidenceMarkdown } from "../../../packages/agent-review/src/evidence-markdown";
import { validateAgentReviewAgentEvidence } from "../../../packages/agent-review/src/review-agent-evidence";
import type { AgentReviewResolvedReviewAgent } from "../../../packages/agent-review/src/review-agent-resolver";

const RESOLVED_AGENTS: AgentReviewResolvedReviewAgent[] = [
  {
    agent: "scope_lock",
    label: "Scope Lock Agent",
    areas: ["docs"],
    files: [{ path: "docs/README.md" }],
    required_sections: ["Scope Guard"],
    required_proof: ["scope is explicit"]
  },
  {
    agent: "qa_failure",
    label: "QA Failure Agent",
    areas: ["tests"],
    files: [{ path: "tests/example.test.ts" }],
    required_sections: ["QA / Failure Review"],
    required_proof: ["negative-path proof"]
  }
];

function evidence(markdown: string) {
  return parseAgentReviewEvidenceMarkdown(markdown, "docs/agent_reviews/example.md");
}

describe("review agent evidence validator", () => {
  it("passes when every required review agent has PASS evidence", () => {
    const result = validateAgentReviewAgentEvidence({
      evidence: evidence(`# Evidence\n\n## Required Review Agents\n\n- Scope Lock Agent: PASS\n- QA Failure Agent: PASS\n`),
      resolved_review_agents: RESOLVED_AGENTS
    });

    expect(result).toEqual({
      passed: true,
      required_review_agents: ["scope_lock", "qa_failure"],
      satisfied_review_agents: ["scope_lock", "qa_failure"],
      missing_review_agents: [],
      issues: []
    });
  });

  it("fails when the required section is missing", () => {
    const result = validateAgentReviewAgentEvidence({
      evidence: evidence(`# Evidence\n\n## Scope Guard\n\nNo drift.\n`),
      resolved_review_agents: RESOLVED_AGENTS
    });

    expect(result.passed).toBe(false);
    expect(result.satisfied_review_agents).toEqual([]);
    expect(result.missing_review_agents).toEqual(["scope_lock", "qa_failure"]);
    expect(result.issues[0]?.rule_id).toBe("agent_review.required_review_agents_section_missing");
  });

  it("fails when a required review agent PASS line is missing", () => {
    const result = validateAgentReviewAgentEvidence({
      evidence: evidence(`# Evidence\n\n## Required Review Agents\n\n- Scope Lock Agent: PASS\n`),
      resolved_review_agents: RESOLVED_AGENTS
    });

    expect(result.passed).toBe(false);
    expect(result.satisfied_review_agents).toEqual(["scope_lock"]);
    expect(result.missing_review_agents).toEqual(["qa_failure"]);
    expect(result.issues[0]?.rule_id).toBe("agent_review.required_review_agent_missing");
    expect(result.issues[0]?.message).toContain("QA Failure Agent");
  });

  it("accepts agent IDs as PASS evidence keys", () => {
    const result = validateAgentReviewAgentEvidence({
      evidence: evidence(`# Evidence\n\n## Required Review Agents\n\n- scope_lock: PASS\n- qa_failure: PASS\n`),
      resolved_review_agents: RESOLVED_AGENTS
    });

    expect(result.passed).toBe(true);
    expect(result.satisfied_review_agents).toEqual(["scope_lock", "qa_failure"]);
  });

  it("passes without requiring a section when there are no required review agents", () => {
    const result = validateAgentReviewAgentEvidence({
      evidence: evidence(`# Evidence\n\n## Scope Guard\n\nNo drift.\n`),
      resolved_review_agents: []
    });

    expect(result).toEqual({
      passed: true,
      required_review_agents: [],
      satisfied_review_agents: [],
      missing_review_agents: [],
      issues: []
    });
  });
});
