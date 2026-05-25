import { describe, expect, it } from "vitest";
import {
  classifyAgentReviewChangedFilesWithSummary,
  loadAgentReviewConfig
} from "../../../packages/agent-review/src/index";
import { parseAgentReviewEvidenceMarkdown } from "../../../packages/agent-review/src/evidence-markdown";
import { validateAgentReviewAgentEvidence } from "../../../packages/agent-review/src/review-agent-evidence";
import { resolveAgentReviewRequiredReviewAgents } from "../../../packages/agent-review/src/review-agent-resolver";
import { getAgentReviewReviewAgents } from "../../../packages/agent-review/src/review-agent-workflow";

describe("MCP Shield agent workflow mapping", () => {
  it("loads declared review agents from the MCP Shield config", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), { configPath: "mcp-shield.agent-review.yaml" });
    const agents = getAgentReviewReviewAgents(config);

    expect(Object.keys(agents)).toEqual([
      "scope_lock",
      "repo_cartographer",
      "runtime_boundary",
      "execution_boundary",
      "risk_gating",
      "safety_boundary",
      "evidence_replay",
      "security_review",
      "qa_failure",
      "human_approval_gate",
      "no_test_weakening",
      "ci_release_guard",
      "docs_runbook",
      "data_freshness",
      "gsd"
    ]);
    expect(agents.execution_boundary.label).toBe("Child Forwarding Boundary Agent");
    expect(agents.risk_gating.label).toBe("Policy Decision Agent");
    expect(agents.evidence_replay.label).toBe("Audit Evidence Agent");
  });

  it("resolves MCP Shield area changes to required review agents", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), { configPath: "mcp-shield.agent-review.yaml" });

    const classified = classifyAgentReviewChangedFilesWithSummary(
      [
        { path: "packages/gateway/src/index.ts" },
        { path: "packages/policy/src/index.ts" },
        { path: "packages/gateway/src/approval.ts" },
        { path: "packages/audit/src/index.ts" },
        { path: ".github/workflows/ci.yml" },
        { path: "docs/README.md" }
      ],
      config
    );

    const resolved = resolveAgentReviewRequiredReviewAgents(classified.detected_areas, config);

    expect(resolved.required_review_agents).toEqual([
      "scope_lock",
      "repo_cartographer",
      "runtime_boundary",
      "execution_boundary",
      "risk_gating",
      "safety_boundary",
      "evidence_replay",
      "security_review",
      "qa_failure",
      "human_approval_gate",
      "no_test_weakening",
      "ci_release_guard",
      "docs_runbook",
      "gsd"
    ]);
    expect(resolved.resolved_review_agents.find((agent) => agent.agent === "execution_boundary")?.areas).toEqual(["gateway"]);
    expect(resolved.resolved_review_agents.find((agent) => agent.agent === "human_approval_gate")?.areas).toEqual([
      "approval"
    ]);
    expect(resolved.resolved_review_agents.find((agent) => agent.agent === "gsd")?.areas).toEqual([
      "gateway",
      "policy",
      "audit",
      "approval",
      "release",
      "docs_only"
    ]);
  });

  it("validates MCP Shield gateway review-agent evidence", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), { configPath: "mcp-shield.agent-review.yaml" });
    const classified = classifyAgentReviewChangedFilesWithSummary([{ path: "packages/gateway/src/index.ts" }], config);
    const resolved = resolveAgentReviewRequiredReviewAgents(classified.detected_areas, config);

    const evidence = parseAgentReviewEvidenceMarkdown(`# Evidence\n\n## Required Review Agents\n\n- Repo Cartographer Agent: PASS\n- MCP Runtime Boundary Agent: PASS\n- Child Forwarding Boundary Agent: PASS\n- Safety Boundary Agent: PASS\n- Security Review Agent: PASS\n- QA Failure Agent: PASS\n- No-Test-Weakening Agent: PASS\n- GSD Reviewer: PASS\n`, "docs/agent_reviews/example.md");

    const result = validateAgentReviewAgentEvidence({
      evidence,
      resolved_review_agents: resolved.resolved_review_agents
    });

    expect(result.passed).toBe(true);
    expect(result.missing_review_agents).toEqual([]);
  });
});
