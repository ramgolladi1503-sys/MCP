import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyAgentReviewChangedFilesWithSummary,
  loadAgentReviewConfig
} from "../../../packages/agent-review/src/index";

describe("generic TypeScript agent-review config example", () => {
  it("loads as a valid generic_project config", async () => {
    const result = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "generic-typescript.agent-review.yaml")
    });

    expect(result.config.schema_version).toBe("1.0");
    expect(result.config.profile).toBe("generic_project");
    expect(result.config.metadata.product).toBe("Generic TypeScript Project");
    expect(result.config.required_sections).toContain("Acceptance Proof");
    expect(result.config.required_evidence_contract_fields).toContain("mode");
    expect(result.config.modes.RUNTIME_CHANGE.product_tests_required).toBe(true);
    expect(result.config.modes.SECURITY_RUNTIME_CHANGE.must_include_false_positive_tests).toBe(true);
    expect(result.config.required_default_commands).toContain("pnpm typecheck");
  });

  it("classifies common TypeScript repository paths", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd(), {
      configPath: join("examples", "agent-review", "generic-typescript.agent-review.yaml")
    });

    const result = classifyAgentReviewChangedFilesWithSummary(
      [
        { path: "src/index.ts" },
        { path: "packages/api/src/routes.ts" },
        { path: "tests/index.test.ts" },
        { path: "docs/ARCHITECTURE.md" },
        { path: "package.json" }
      ],
      config
    );

    expect(result.detected_areas.map((area) => area.area)).toEqual(["source", "tests", "docs", "config"]);
    expect(result.unmatched_files).toEqual([]);
    expect(result.detected_areas.find((area) => area.area === "source")?.required_proof).toContain("unit test proof");
    expect(result.detected_areas.find((area) => area.area === "tests")?.required_proof).toContain("no test weakening");
    expect(result.detected_areas.find((area) => area.area === "docs")?.required_proof).toContain("no runtime claims");
    expect(result.detected_areas.find((area) => area.area === "config")?.required_proof).toContain("config validation proof");
  });
});
