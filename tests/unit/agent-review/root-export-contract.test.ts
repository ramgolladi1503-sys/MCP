import { describe, expect, it } from "vitest";
import * as agentReview from "../../../packages/agent-review/src/index";

describe("agent-review package root export contract", () => {
  it("exports config loader contract from package root", () => {
    expect(agentReview.AGENT_REVIEW_CONFIG_SCHEMA_VERSION).toBe("1.0");
    expect(agentReview.DEFAULT_AGENT_REVIEW_CONFIG_FILE_NAMES).toContain("mcp-shield.agent-review.yaml");
    expect(agentReview.AgentReviewConfigError).toBeInstanceOf(Function);
    expect(agentReview.loadAgentReviewConfig).toBeInstanceOf(Function);
    expect(agentReview.findAgentReviewConfigPath).toBeInstanceOf(Function);
    expect(agentReview.parseAgentReviewConfigText).toBeInstanceOf(Function);
    expect(agentReview.validateAgentReviewConfig).toBeInstanceOf(Function);
  });

  it("exports evidence parsing and validation contract from package root", () => {
    expect(agentReview.loadAgentReviewEvidenceDocument).toBeInstanceOf(Function);
    expect(agentReview.parseAgentReviewEvidenceMarkdown).toBeInstanceOf(Function);
    expect(agentReview.parseAgentReviewEvidenceContractFields).toBeInstanceOf(Function);
    expect(agentReview.validateAgentReviewEvidenceFields).toBeInstanceOf(Function);
    expect(agentReview.validateAgentReviewRequiredSections).toBeInstanceOf(Function);
    expect(agentReview.validateAgentReviewModeRules).toBeInstanceOf(Function);
    expect(agentReview.validateAgentReviewAreaSections).toBeInstanceOf(Function);
    expect(agentReview.resolveAgentReviewRequiredProof).toBeInstanceOf(Function);
  });

  it("exports changed-file and CLI contract from package root", () => {
    expect(agentReview.changedFileMatchesPattern("packages/agent-review/src/index.ts", "packages/agent-review/**")).toBe(true);
    expect(agentReview.classifyAgentReviewChangedFiles).toBeInstanceOf(Function);
    expect(agentReview.classifyAgentReviewChangedFilesWithSummary).toBeInstanceOf(Function);
    expect(agentReview.AGENT_REVIEW_VALIDATOR_CLI_SCHEMA_VERSION).toBe("agent_review.validator_cli.v1");
    expect(agentReview.getAgentReviewValidatorCliHelp()).toContain("Agent Review validator CLI");
    expect(agentReview.runAgentReviewValidatorCli).toBeInstanceOf(Function);
  });
});
