import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyAgentReviewChangedFilesWithSummary,
  loadAgentReviewConfig
} from "../../../packages/agent-review/src/index";

describe("Tradebot agent-review config example", () => {
  it("loads as a valid tradebot config", async () => {
    const result = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "tradebot.agent-review.yaml")
    });

    expect(result.config.schema_version).toBe("1.0");
    expect(result.config.profile).toBe("tradebot");
    expect(result.config.metadata.product).toBe("Tradebot");
    expect(result.config.required_sections).toContain("Acceptance Proof");
    expect(result.config.hard_rules.no_live_behavior_without_explicit_scope).toBe(true);
    expect(result.config.hard_rules.no_broker_adapter_change_without_explicit_scope).toBe(true);
    expect(result.config.runtime_safety_rules.strict_paper_live_boundary_required).toBe(true);
    expect(result.config.required_default_commands).toContain("python scripts/verify_paper_live_boundary.py");
  });

  it("classifies Tradebot-specific repository paths", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "tradebot.agent-review.yaml")
    });

    const result = classifyAgentReviewChangedFilesWithSummary(
      [
        { path: "strategies/nifty_intraday.py" },
        { path: "core/risk/limits.py" },
        { path: "core/feed/market_feed.py" },
        { path: "core/execution/orders.py" },
        { path: "tests/test_risk_limits.py" },
        { path: "docs/RUNBOOK_LIVE.md" },
        { path: "config/config.py" }
      ],
      config
    );

    expect(result.detected_areas.map((area) => area.area)).toEqual([
      "strategy",
      "risk",
      "market_data",
      "execution",
      "tests",
      "docs",
      "config"
    ]);
    expect(result.unmatched_files).toEqual([]);
    expect(result.detected_areas.find((area) => area.area === "strategy")?.required_proof).toContain("no profitability claim without evidence");
    expect(result.detected_areas.find((area) => area.area === "risk")?.required_proof).toContain("risk rejection proof");
    expect(result.detected_areas.find((area) => area.area === "market_data")?.required_proof).toContain("stale-feed proof");
    expect(result.detected_areas.find((area) => area.area === "execution")?.required_proof).toContain("paper-live boundary proof");
    expect(result.detected_areas.find((area) => area.area === "config")?.required_proof).toContain("no accidental live behavior change");
  });
});
