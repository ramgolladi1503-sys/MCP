import { describe, expect, it } from "vitest";
import { AgentReviewConfigError, parseAgentReviewConfigText } from "../../../packages/agent-review/src/index";
import {
  getAgentReviewReviewAgents,
  validateAgentReviewAgentWorkflowConfig
} from "../../../packages/agent-review/src/review-agent-workflow";

const BASE_CONFIG = `
schema_version: "1.0"
profile: generic_project
metadata:
  product: Example
  category: Example Category
  purpose: Example purpose
required_sections:
  - Agent Work Contract
required_evidence_contract_fields:
  - mode
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
      - no runtime claims
required_default_commands:
  - pnpm test
`;

describe("agent workflow schema contract", () => {
  it("accepts optional review agent declarations", () => {
    const config = parseAgentReviewConfigText(`${BASE_CONFIG}
review_agents:
  scope_lock:
    label: Scope Lock Agent
    description: Confirms the PR stays inside its declared boundary
    required_for:
      - docs
      - config
    required_sections:
      - Scope Guard
    required_proof:
      - scope is explicit
  qa_failure:
    label: QA Failure Agent
    required_for:
      - tests
      - runtime
`, "agent-review.yaml");

    const agents = getAgentReviewReviewAgents(config);

    expect(Object.keys(agents)).toEqual(["scope_lock", "qa_failure"]);
    expect(agents.scope_lock.label).toBe("Scope Lock Agent");
    expect(agents.scope_lock.required_for).toEqual(["docs", "config"]);
    expect(agents.scope_lock.required_sections).toEqual(["Scope Guard"]);
    expect(agents.scope_lock.required_proof).toEqual(["scope is explicit"]);
    expect(agents.qa_failure.required_for).toEqual(["tests", "runtime"]);
  });

  it("treats missing review_agents as valid and empty", () => {
    const config = parseAgentReviewConfigText(BASE_CONFIG, "agent-review.yaml");

    expect(validateAgentReviewAgentWorkflowConfig(config)).toEqual([]);
    expect(getAgentReviewReviewAgents(config)).toEqual({});
  });

  it("fails closed when review_agents is empty", () => {
    const config = parseAgentReviewConfigText(`${BASE_CONFIG}
review_agents:
`, "agent-review.yaml");

    expect(() => validateAgentReviewAgentWorkflowConfig(config)).toThrow(AgentReviewConfigError);
    expect(() => validateAgentReviewAgentWorkflowConfig(config)).toThrow("Invalid agent-review config");
  });

  it("fails closed when an agent is missing required_for", () => {
    const config = parseAgentReviewConfigText(`${BASE_CONFIG}
review_agents:
  scope_lock:
    label: Scope Lock Agent
`, "agent-review.yaml");

    expect(() => validateAgentReviewAgentWorkflowConfig(config)).toThrow(AgentReviewConfigError);
  });

  it("fails closed when an agent label is blank", () => {
    const config = parseAgentReviewConfigText(`${BASE_CONFIG}
review_agents:
  scope_lock:
    label: ""
    required_for:
      - docs
`, "agent-review.yaml");

    expect(() => validateAgentReviewAgentWorkflowConfig(config)).toThrow(AgentReviewConfigError);
  });
});
