import { describe, expect, it } from "vitest";
import { loadAgentReviewConfig } from "../../../packages/agent-review/src/index";
import {
  changedFileMatchesPattern,
  classifyAgentReviewChangedFiles,
  classifyAgentReviewChangedFilesWithSummary
} from "../../../packages/agent-review/src/changed-files";

describe("agent-review changed-file classifier", () => {
  it("matches configured glob patterns deterministically", () => {
    expect(changedFileMatchesPattern("packages/gateway/src/index.ts", "packages/gateway/**")).toBe(true);
    expect(changedFileMatchesPattern("packages/policy/src/index.ts", "packages/gateway/**")).toBe(false);
    expect(changedFileMatchesPattern(".github/workflows/ci.yml", ".github/workflows/**")).toBe(true);
    expect(changedFileMatchesPattern("packages/gateway/package.json", "packages/*/package.json")).toBe(true);
    expect(changedFileMatchesPattern("README.md", "*.md")).toBe(true);
    expect(changedFileMatchesPattern("docs/README.md", "*.md")).toBe(false);
    expect(changedFileMatchesPattern("docs/README.md", "docs/**")).toBe(true);
  });

  it("classifies changed files into configured areas with required proof and sections", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());

    const result = classifyAgentReviewChangedFilesWithSummary(
      [
        { path: "packages/gateway/src/index.ts", status: "modified" },
        { path: "packages/policy/src/rules.ts", status: "modified" },
        { path: "docs/README.md", status: "modified" },
        { path: "unknown/place.txt", status: "added" }
      ],
      config
    );

    expect(result.detected_areas.map((area) => area.area)).toEqual(["gateway", "policy", "docs_only"]);
    expect(result.matched_files.map((file) => file.path)).toEqual([
      "packages/gateway/src/index.ts",
      "packages/policy/src/rules.ts",
      "docs/README.md"
    ]);
    expect(result.unmatched_files.map((file) => file.path)).toEqual(["unknown/place.txt"]);

    const gateway = result.detected_areas.find((area) => area.area === "gateway");
    expect(gateway?.matched_patterns).toEqual(["packages/gateway/**"]);
    expect(gateway?.required_proof).toContain("protocol test");
    expect(gateway?.required_sections).toEqual(["Security Review", "QA / Failure Review", "Scope Guard"]);
  });

  it("allows one file to classify into multiple configured areas", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());

    const result = classifyAgentReviewChangedFiles([{ path: "packages/cli/package.json", status: "modified" }], config);

    expect(result.map((area) => area.area)).toEqual(["cli", "release"]);
    expect(result.find((area) => area.area === "cli")?.files.map((file) => file.path)).toEqual(["packages/cli/package.json"]);
    expect(result.find((area) => area.area === "release")?.matched_patterns).toEqual(["packages/*/package.json"]);
  });

  it("normalizes changed file paths before matching", async () => {
    const { config } = await loadAgentReviewConfig(process.cwd());

    const result = classifyAgentReviewChangedFilesWithSummary(
      [
        { path: "./packages\\scanner\\src\\index.ts", status: "modified" },
        { path: "  docs/agent_reviews/example.md  ", status: "added" }
      ],
      config
    );

    expect(result.detected_areas.map((area) => area.area)).toEqual(["scanner", "docs_only"]);
    expect(result.unmatched_files).toEqual([]);
  });
});
