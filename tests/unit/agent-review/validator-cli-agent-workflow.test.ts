import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runAgentReviewValidatorCli } from "../../../packages/agent-review/src/validator-cli";

const CONFIG = `
schema_version: "1.0"
profile: generic_project
metadata:
  product: Example
  category: Example
  purpose: Example
required_sections:
  - Agent Work Contract
  - Required Review Agents
  - Acceptance Proof
required_evidence_contract_fields:
  - mode
  - candidate_id
  - decision
  - reason
  - is_runtime_change
  - is_security_runtime_change
  - child_mcp_forwarding_changed
  - policy_behavior_changed
  - approval_behavior_changed
  - audit_schema_changed
  - source
modes:
  DOCS_ONLY:
    runtime_changes_allowed: false
    product_tests_required: false
  CONTRACT_ONLY:
    runtime_changes_allowed: false
    product_tests_required: false
  RUNTIME_CHANGE:
    runtime_changes_allowed: true
    product_tests_required: true
  SECURITY_RUNTIME_CHANGE:
    runtime_changes_allowed: true
    product_tests_required: true
hard_rules:
  no_fake_progress: true
runtime_safety_rules:
  fail_closed_on_invalid_config: true
area_rules:
  docs:
    path_patterns:
      - "docs/**"
    required_proof:
      - scope is explicit
review_agents:
  scope_lock:
    label: Scope Lock Agent
    required_for:
      - docs
    required_sections:
      - Required Review Agents
    required_proof:
      - scope is explicit
required_default_commands:
  - pnpm test
future_enforcement:
  validator_cli_pr: 38
`;

function evidence(requiredAgentsSection: string): string {
  return `# Evidence

## Agent Work Contract

mode: CONTRACT_ONLY
candidate_id: TEST
candidate_id: TEST
decision: TEST
reason: Test evidence.
is_runtime_change: false
is_security_runtime_change: false
child_mcp_forwarding_changed: false
policy_behavior_changed: false
approval_behavior_changed: false
audit_schema_changed: false
source: docs/agent_reviews/test.md

${requiredAgentsSection}

## Acceptance Proof

scope is explicit
`;
}

async function writeFixture(evidenceMarkdown: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agent-review-cli-"));
  await writeFile(join(root, "agent-review.yaml"), CONFIG, "utf8");
  await writeFile(join(root, "evidence.md"), evidenceMarkdown, "utf8");
  return root;
}

describe("validator CLI agent workflow report", () => {
  it("reports satisfied review agents when evidence is complete", async () => {
    const root = await writeFixture(evidence(`## Required Review Agents

- Scope Lock Agent: PASS`));

    const result = await runAgentReviewValidatorCli([
      "--project-root",
      root,
      "--evidence",
      "evidence.md",
      "--changed-file",
      "docs/readme.md"
    ]);

    expect(result.exit_code).toBe(0);
    expect(result.report?.required_review_agents).toEqual(["scope_lock"]);
    expect(result.report?.satisfied_review_agents).toEqual(["scope_lock"]);
    expect(result.report?.missing_review_agents).toEqual([]);
    expect(result.report?.checks.agent_evidence.passed).toBe(true);
  });

  it("reports missing review agents when evidence is incomplete", async () => {
    const root = await writeFixture(evidence(`## Required Review Agents

No approval line.`));

    const result = await runAgentReviewValidatorCli([
      "--project-root",
      root,
      "--evidence",
      "evidence.md",
      "--changed-file",
      "docs/readme.md"
    ]);

    expect(result.exit_code).toBe(1);
    expect(result.report?.required_review_agents).toEqual(["scope_lock"]);
    expect(result.report?.satisfied_review_agents).toEqual([]);
    expect(result.report?.missing_review_agents).toEqual(["scope_lock"]);
    expect(result.report?.checks.agent_evidence.passed).toBe(false);
    expect(result.report?.issues.some((issue) => issue.rule_id === "agent_review.required_review_agent_missing")).toBe(true);
  });
});
