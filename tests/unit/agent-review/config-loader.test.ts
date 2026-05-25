import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  AGENT_REVIEW_CONFIG_SCHEMA_VERSION,
  AgentReviewConfigError,
  findAgentReviewConfigPath,
  loadAgentReviewConfig,
  parseAgentReviewConfigText
} from "../../../packages/agent-review/src/index";

describe("agent-review config loader", () => {
  it("loads and validates the default MCP Shield YAML config", async () => {
    const result = await loadAgentReviewConfig(process.cwd());

    expect(result.path).toContain("mcp-shield.agent-review.yaml");
    expect(result.config.schema_version).toBe(AGENT_REVIEW_CONFIG_SCHEMA_VERSION);
    expect(result.config.profile).toBe("enterprise_agent_firewall");
    expect(result.config.required_sections).toContain("Agent Work Contract");
    expect(result.config.required_evidence_contract_fields).toContain("mode");
    expect(result.config.modes.SECURITY_RUNTIME_CHANGE.must_include_negative_tests).toBe(true);
    expect(result.config.area_rules.gateway.required_proof).toContain("stdout purity");
    expect(result.config.runtime_safety_rules.never_forward_blocked_calls).toBe(true);
  });

  it("loads an explicit JSON config path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-review-config-"));
    try {
      const configPath = join(directory, "agent-review.json");
      await writeFile(
        configPath,
        JSON.stringify({
          schema_version: "1.0",
          profile: "generic_project",
          metadata: {
            product: "Example",
            category: "Example Category",
            purpose: "Test config loading"
          },
          required_sections: ["Agent Work Contract"],
          required_evidence_contract_fields: ["mode"],
          modes: {
            DOCS_ONLY: { runtime_changes_allowed: false, product_tests_required: false },
            CONTRACT_ONLY: { runtime_changes_allowed: false, product_tests_required: false },
            RUNTIME_CHANGE: { runtime_changes_allowed: true, product_tests_required: true },
            SECURITY_RUNTIME_CHANGE: { runtime_changes_allowed: true, product_tests_required: true }
          },
          hard_rules: { no_fake_progress: true },
          runtime_safety_rules: { fail_closed: true },
          area_rules: {
            docs: {
              path_patterns: ["docs/**"],
              required_proof: ["no runtime claims"]
            }
          },
          required_default_commands: ["pnpm build"]
        }),
        "utf8"
      );

      const result = await loadAgentReviewConfig(directory, { configPath });
      expect(result.config.profile).toBe("generic_project");
      expect(result.path).toBe(configPath);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("finds config using custom search names", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-review-config-"));
    try {
      const configPath = join(directory, "custom.agent-review.yaml");
      await writeFile(
        configPath,
        [
          'schema_version: "1.0"',
          "profile: generic_project",
          "metadata:",
          "  product: Example",
          "  category: Example Category",
          "  purpose: Test config loading",
          "required_sections:",
          "  - Agent Work Contract",
          "required_evidence_contract_fields:",
          "  - mode",
          "modes:",
          "  DOCS_ONLY:",
          "    runtime_changes_allowed: false",
          "    product_tests_required: false",
          "  CONTRACT_ONLY:",
          "    runtime_changes_allowed: false",
          "    product_tests_required: false",
          "  RUNTIME_CHANGE:",
          "    runtime_changes_allowed: true",
          "    product_tests_required: true",
          "  SECURITY_RUNTIME_CHANGE:",
          "    runtime_changes_allowed: true",
          "    product_tests_required: true",
          "hard_rules:",
          "  no_fake_progress: true",
          "runtime_safety_rules:",
          "  fail_closed: true",
          "area_rules:",
          "  docs:",
          "    path_patterns:",
          "      - docs/**",
          "    required_proof:",
          "      - no runtime claims",
          "required_default_commands:",
          "  - pnpm build"
        ].join("\n"),
        "utf8"
      );

      await expect(findAgentReviewConfigPath(directory, { configFileNames: ["custom.agent-review.yaml"] })).resolves.toBe(configPath);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when no config exists", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-review-config-"));
    try {
      await expect(loadAgentReviewConfig(directory)).rejects.toBeInstanceOf(AgentReviewConfigError);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed on invalid config shape", () => {
    expect(() =>
      parseAgentReviewConfigText(
        [
          'schema_version: "1.0"',
          "profile: generic_project",
          "metadata:",
          "  product: Example"
        ].join("\n"),
        "broken.agent-review.yaml"
      )
    ).toThrow(AgentReviewConfigError);
  });
});
