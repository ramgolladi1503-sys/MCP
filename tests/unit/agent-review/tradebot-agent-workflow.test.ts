import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyAgentReviewChangedFilesWithSummary,
  loadAgentReviewConfig
} from "../../../packages/agent-review/src/index";
import { parseAgentReviewEvidenceMarkdown } from "../../../packages/agent-review/src/evidence-markdown";
import { validateAgentReviewAgentEvidence } from "../../../packages/agent-review/src/review-agent-evidence";
import { resolveAgentReviewRequiredReviewAgents } from "../../../packages/agent-review/src/review-agent-resolver";
import { getAgentReviewReviewAgents } from "../../../packages/agent-review/src/review-agent-workflow";

describe("Tradebot agent workflow mapping", () => {
  it("loads declared review agents from the Tradebot config", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "tradebot.agent-review.yaml")
    });

    const agents = getAgentReviewReviewAgents(config);

    expect(Object.keys(agents)).toEqual([
      "scope_lock",
      "evidence_replay",
      "qa_failure",
      "gsd",
      "risk_gating",
      "safety_boundary",
      "security_review",
      "data_freshness",
      "runtime_boundary",
      "execution_boundary",
      "human_approval_gate",
      "no_test_weakening",
      "docs_runbook",
      "ci_release_guard"
    ]);
    expect(agents.execution_boundary.required_for).toEqual(["execution"]);
    expect(agents.risk_gating.required_for).toEqual(["risk"]);
    expect(agents.data_freshness.required_for).toEqual(["market_data"]);
  });

  it("resolves Tradebot area changes to required review agents", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "tradebot.agent-review.yaml")
    });

    const classified = classifyAgentReviewChangedFilesWithSummary(
      [
        { path: "strategies/nifty_intraday.py" },
        { path: "core/risk/limits.py" },
        { path: "core/feed/market_feed.py" },
        { path: "core/execution/orders.py" },
        { path: "tests/test_orders.py" },
        { path: "docs/RUNBOOK_LIVE.md" },
        { path: "config/config.py" }
      ],
      config
    );

    const resolved = resolveAgentReviewRequiredReviewAgents(classified.detected_areas, config);

    expect(resolved.required_review_agents).toEqual([
      "scope_lock",
      "evidence_replay",
      "qa_failure",
      "gsd",
      "risk_gating",
      "safety_boundary",
      "security_review",
      "data_freshness",
      "runtime_boundary",
      "execution_boundary",
      "human_approval_gate",
      "no_test_weakening",
      "docs_runbook",
      "ci_release_guard"
    ]);
    expect(resolved.resolved_review_agents.find((agent) => agent.agent === "execution_boundary")?.areas).toEqual(["execution"]);
    expect(resolved.resolved_review_agents.find((agent) => agent.agent === "qa_failure")?.areas).toEqual([
      "strategy",
      "risk",
      "market_data",
      "execution",
      "tests"
    ]);
  });

  it("validates Tradebot required review-agent evidence", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "tradebot.agent-review.yaml")
    });
    const classified = classifyAgentReviewChangedFilesWithSummary([{ path: "core/execution/orders.py" }], config);
    const resolved = resolveAgentReviewRequiredReviewAgents(classified.detected_areas, config);

    const evidence = parseAgentReviewEvidenceMarkdown(`# Evidence\n\n## Required Review Agents\n\n- QA Failure Agent: PASS\n- Security Review Agent: PASS\n- Runtime Boundary Agent: PASS\n- Execution Boundary Agent: PASS\n- Human Approval Gate: PASS\n`, "docs/agent_reviews/example.md");

    const result = validateAgentReviewAgentEvidence({
      evidence,
      resolved_review_agents: resolved.resolved_review_agents
    });

    expect(result.passed).toBe(true);
    expect(result.missing_review_agents).toEqual([]);
  });
});
