import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyAgentReviewChangedFilesWithSummary,
  loadAgentReviewConfig,
  type AgentReviewChangedFile,
  type AgentReviewConfig
} from "../../../packages/agent-review/src/index";
import { resolveAgentReviewRequiredReviewAgents } from "../../../packages/agent-review/src/review-agent-resolver";
import { getAgentReviewReviewAgents } from "../../../packages/agent-review/src/review-agent-workflow";

interface AdapterSnapshotFixture {
  readonly id: string;
  readonly configPath: string;
  readonly changedFiles: readonly AgentReviewChangedFile[];
}

const FIXTURES: readonly AdapterSnapshotFixture[] = [
  {
    id: "mcp_shield",
    configPath: "mcp-shield.agent-review.yaml",
    changedFiles: [
      { path: "packages/gateway/src/index.ts" },
      { path: "packages/policy/src/index.ts" },
      { path: "packages/audit/src/index.ts" },
      { path: "packages/gateway/src/approval.ts" },
      { path: "packages/scanner/src/index.ts" },
      { path: "packages/cli/src/index.ts" },
      { path: "packages/config-adapter/src/index.ts" },
      { path: "packages/gateway/observability/trace.ts" },
      { path: ".github/workflows/ci.yml" },
      { path: "docs/README.md" }
    ]
  },
  {
    id: "tradebot",
    configPath: join("examples", "agent-review", "tradebot.agent-review.yaml"),
    changedFiles: [
      { path: "strategies/nifty_intraday.py" },
      { path: "core/risk/limits.py" },
      { path: "core/feed/market_feed.py" },
      { path: "core/execution/orders.py" },
      { path: "tests/test_orders.py" },
      { path: "docs/RUNBOOK_LIVE.md" },
      { path: "config/config.py" }
    ]
  },
  {
    id: "algotradify",
    configPath: join("examples", "agent-review", "algotradify.agent-review.yaml"),
    changedFiles: [
      { path: "runtime/paper/journal/events.py" },
      { path: "paper/reducer/state.py" },
      { path: "paper/execution.py" },
      { path: "strategies/momentum.py" },
      { path: "risk/limits.py" },
      { path: "evidence/replay.json" },
      { path: "tests/test_replay.py" },
      { path: "docs/RUNBOOK.md" },
      { path: "config/config.py" }
    ]
  },
  {
    id: "generic_typescript",
    configPath: join("examples", "agent-review", "generic-typescript.agent-review.yaml"),
    changedFiles: [
      { path: "src/index.ts" },
      { path: "tests/index.test.ts" },
      { path: "docs/README.md" },
      { path: "package.json" }
    ]
  },
  {
    id: "generic_python",
    configPath: join("examples", "agent-review", "generic-python.agent-review.yaml"),
    changedFiles: [
      { path: "src/app.py" },
      { path: "tests/test_app.py" },
      { path: "docs/README.md" },
      { path: "pyproject.toml" }
    ]
  }
];

describe("cross-adapter Agent Review snapshots", () => {
  it("locks adapter area and review-agent surfaces", async () => {
    const snapshots = await Promise.all(FIXTURES.map(buildAdapterSnapshot));

    expect(snapshots).toEqual([
      {
        id: "mcp_shield",
        profile: "enterprise_agent_firewall",
        areas: [
          "gateway",
          "policy",
          "audit",
          "approval",
          "scanner",
          "cli",
          "config_adapter",
          "observability",
          "release",
          "docs_only"
        ],
        review_agents: [
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
        ],
        resolved_agents: [
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
        ]
      },
      {
        id: "tradebot",
        profile: "tradebot",
        areas: ["strategy", "risk", "market_data", "execution", "tests", "docs", "config"],
        review_agents: [
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
        ],
        resolved_agents: [
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
        ]
      },
      {
        id: "algotradify",
        profile: "algotradify",
        areas: ["journal", "reducer", "paper_trading", "strategy", "risk", "evidence", "tests", "docs", "config"],
        review_agents: [],
        resolved_agents: []
      },
      {
        id: "generic_typescript",
        profile: "generic_project",
        areas: ["source", "tests", "docs", "config"],
        review_agents: [],
        resolved_agents: []
      },
      {
        id: "generic_python",
        profile: "generic_project",
        areas: ["source", "tests", "docs", "config"],
        review_agents: [],
        resolved_agents: []
      }
    ]);
  });
});

async function buildAdapterSnapshot(fixture: AdapterSnapshotFixture) {
  const { config } = await loadAgentReviewConfig(process.cwd(), { configPath: fixture.configPath });
  const classified = classifyAgentReviewChangedFilesWithSummary(fixture.changedFiles, config);
  const resolved = resolveAgentReviewRequiredReviewAgents(classified.detected_areas, config);

  return {
    id: fixture.id,
    profile: config.profile,
    areas: classified.detected_areas.map((area) => area.area),
    review_agents: Object.keys(getAgentReviewReviewAgents(config)),
    resolved_agents: resolved.required_review_agents
  };
}
