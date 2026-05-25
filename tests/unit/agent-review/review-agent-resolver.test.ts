import { describe, expect, it } from "vitest";
import type { AgentReviewAreaClassification, AgentReviewConfig } from "../../../packages/agent-review/src/index";
import { resolveAgentReviewRequiredReviewAgents } from "../../../packages/agent-review/src/review-agent-resolver";
import type { AgentReviewConfigWithAgentWorkflow } from "../../../packages/agent-review/src/review-agent-workflow";

function config(reviewAgents?: AgentReviewConfigWithAgentWorkflow["review_agents"]): AgentReviewConfig {
  return {
    schema_version: "1.0",
    profile: "generic_project",
    metadata: { product: "Example", category: "Example", purpose: "Example" },
    required_sections: ["Agent Work Contract"],
    required_evidence_contract_fields: ["mode"],
    modes: {
      DOCS_ONLY: { runtime_changes_allowed: false, product_tests_required: false },
      CONTRACT_ONLY: { runtime_changes_allowed: false, product_tests_required: false },
      RUNTIME_CHANGE: { runtime_changes_allowed: true, product_tests_required: true },
      SECURITY_RUNTIME_CHANGE: { runtime_changes_allowed: true, product_tests_required: true }
    },
    hard_rules: { no_fake_progress: true },
    runtime_safety_rules: { fail_closed_on_invalid_config: true },
    area_rules: { docs: { path_patterns: ["docs/**"], required_proof: ["no runtime claims"] } },
    required_default_commands: ["pnpm test"],
    ...(reviewAgents === undefined ? {} : { review_agents: reviewAgents })
  } as AgentReviewConfig;
}

function detected(areaName: string, files: string[]): AgentReviewAreaClassification {
  return {
    area: areaName,
    matched_patterns: [`${areaName}/**`],
    files: files.map((path) => ({ path })),
    required_proof: [],
    required_sections: []
  };
}

describe("review agent resolver", () => {
  it("resolves required agents from detected areas", () => {
    const result = resolveAgentReviewRequiredReviewAgents(
      [detected("docs", ["docs/README.md"]), detected("tests", ["tests/example.test.ts"])],
      config({
        scope_lock: {
          label: "Scope Lock Agent",
          required_for: ["docs"],
          required_sections: ["Scope Guard"],
          required_proof: ["scope is explicit"]
        },
        qa_failure: {
          label: "QA Failure Agent",
          required_for: ["tests"],
          required_sections: ["QA / Failure Review"],
          required_proof: ["negative-path proof"]
        }
      })
    );

    expect(result.required_review_agents).toEqual(["scope_lock", "qa_failure"]);
    expect(result.resolved_review_agents[0]).toEqual({
      agent: "scope_lock",
      label: "Scope Lock Agent",
      areas: ["docs"],
      files: [{ path: "docs/README.md" }],
      required_sections: ["Scope Guard"],
      required_proof: ["scope is explicit"]
    });
    expect(result.resolved_review_agents[1]?.agent).toBe("qa_failure");
  });

  it("supports wildcard agents for all detected areas", () => {
    const result = resolveAgentReviewRequiredReviewAgents(
      [detected("docs", ["docs/a.md"]), detected("source", ["src/a.ts"])],
      config({ gsd: { label: "GSD Reviewer", required_for: ["*"], required_proof: ["not fake progress"] } })
    );

    expect(result.required_review_agents).toEqual(["gsd"]);
    expect(result.resolved_review_agents[0]?.areas).toEqual(["docs", "source"]);
    expect(result.resolved_review_agents[0]?.files).toEqual([{ path: "docs/a.md" }, { path: "src/a.ts" }]);
    expect(result.resolved_review_agents[0]?.required_proof).toEqual(["not fake progress"]);
  });

  it("dedupes repeated files and metadata", () => {
    const result = resolveAgentReviewRequiredReviewAgents(
      [detected("docs", ["docs/a.md", "docs/a.md"]), detected("config", ["package.json"])],
      config({
        scope_lock: {
          label: "Scope Lock Agent",
          required_for: ["docs", "config"],
          required_sections: ["Scope Guard", "Scope Guard"],
          required_proof: ["scope is explicit", "scope is explicit"]
        }
      })
    );

    expect(result.resolved_review_agents[0]?.areas).toEqual(["docs", "config"]);
    expect(result.resolved_review_agents[0]?.files).toEqual([{ path: "docs/a.md" }, { path: "package.json" }]);
    expect(result.resolved_review_agents[0]?.required_sections).toEqual(["Scope Guard"]);
    expect(result.resolved_review_agents[0]?.required_proof).toEqual(["scope is explicit"]);
  });

  it("returns empty results when no workflow is configured", () => {
    expect(resolveAgentReviewRequiredReviewAgents([detected("docs", ["docs/a.md"])], config())).toEqual({
      required_review_agents: [],
      resolved_review_agents: []
    });
  });
});
