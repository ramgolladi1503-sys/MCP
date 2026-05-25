import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyAgentReviewChangedFilesWithSummary,
  loadAgentReviewConfig
} from "../../../packages/agent-review/src/index";

describe("Algotradify agent-review config example", () => {
  it("loads as a valid algotradify config", async () => {
    const result = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "algotradify.agent-review.yaml")
    });

    expect(result.config.schema_version).toBe("1.0");
    expect(result.config.profile).toBe("algotradify");
    expect(result.config.metadata.product).toBe("Algotradify");
    expect(result.config.required_sections).toContain("Acceptance Proof");
    expect(result.config.hard_rules.journal_is_truth).toBe(true);
    expect(result.config.hard_rules.reducer_derives_state).toBe(true);
    expect(result.config.hard_rules.no_live_execution_before_approved_phase).toBe(true);
    expect(result.config.runtime_safety_rules.reducer_replay_must_be_deterministic).toBe(true);
    expect(result.config.required_default_commands).toContain("python scripts/verify_reducer_replay.py");
  });

  it("classifies Algotradify-specific repository paths", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "algotradify.agent-review.yaml")
    });

    const result = classifyAgentReviewChangedFilesWithSummary(
      [
        { path: "paper/journal/events.py" },
        { path: "paper/reducer/state.py" },
        { path: "paper/orders.py" },
        { path: "strategies/opening_range.py" },
        { path: "risk/limits.py" },
        { path: "runtime/replay/query.py" },
        { path: "tests/test_reducer_replay.py" },
        { path: "docs/PAPER_TRUTH_FOUNDATION.md" },
        { path: "config/settings.py" }
      ],
      config
    );

    expect(result.detected_areas.map((area) => area.area)).toEqual([
      "journal",
      "reducer",
      "paper_trading",
      "strategy",
      "risk",
      "evidence",
      "tests",
      "docs",
      "config"
    ]);
    expect(result.unmatched_files).toEqual([]);
    expect(result.detected_areas.find((area) => area.area === "journal")?.required_proof).toContain("journal is truth proof");
    expect(result.detected_areas.find((area) => area.area === "reducer")?.required_proof).toContain("deterministic replay proof");
    expect(result.detected_areas.find((area) => area.area === "paper_trading")?.required_proof).toContain("no live order path proof");
    expect(result.detected_areas.find((area) => area.area === "evidence")?.required_proof).toContain("read-only evidence proof");
    expect(result.detected_areas.find((area) => area.area === "risk")?.required_proof).toContain("fail-closed proof");
  });
});
