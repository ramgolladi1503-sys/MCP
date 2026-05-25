import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyAgentReviewChangedFilesWithSummary,
  loadAgentReviewConfig
} from "../../../packages/agent-review/src/index";

describe("generic Python agent-review config example", () => {
  it("loads as a valid generic_project config", async () => {
    const result = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "generic-python.agent-review.yaml")
    });

    expect(result.config.schema_version).toBe("1.0");
    expect(result.config.profile).toBe("generic_project");
    expect(result.config.metadata.product).toBe("Generic Python Project");
    expect(result.config.required_sections).toContain("Acceptance Proof");
    expect(result.config.required_evidence_contract_fields).toContain("mode");
    expect(result.config.hard_rules.no_dependency_churn_without_scope).toBe(true);
    expect(result.config.runtime_safety_rules.never_silently_skip_negative_paths).toBe(true);
    expect(result.config.required_default_commands).toContain("python -m pytest");
  });

  it("classifies common Python repository paths", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "generic-python.agent-review.yaml")
    });

    const result = classifyAgentReviewChangedFilesWithSummary(
      [
        { path: "app/main.py" },
        { path: "services/orders.py" },
        { path: "tests/test_orders.py" },
        { path: "docs/ARCHITECTURE.md" },
        { path: "pyproject.toml" },
        { path: "requirements.txt" }
      ],
      config
    );

    expect(result.detected_areas.map((area) => area.area)).toEqual(["source", "tests", "docs", "config"]);
    expect(result.unmatched_files).toEqual([]);
    expect(result.detected_areas.find((area) => area.area === "source")?.required_proof).toContain("failure-path proof");
    expect(result.detected_areas.find((area) => area.area === "tests")?.required_proof).toContain("negative-path proof");
    expect(result.detected_areas.find((area) => area.area === "docs")?.required_proof).toContain("no runtime claims");
    expect(result.detected_areas.find((area) => area.area === "config")?.required_proof).toContain("dependency impact proof");
  });
});
