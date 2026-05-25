import { describe, expect, it } from "vitest";
import {
  assertAgentEvidenceEnforced,
  parseValidatorReport
} from "../../../scripts/agent-review-ci-scope-guard.mjs";

describe("CI agent evidence guard", () => {
  it("accepts validator reports with complete agent evidence", () => {
    expect(() =>
      assertAgentEvidenceEnforced({
        required_review_agents: ["scope_lock"],
        satisfied_review_agents: ["scope_lock"],
        missing_review_agents: [],
        checks: {
          agent_evidence: {
            missing_review_agents: []
          }
        }
      })
    ).not.toThrow();
  });

  it("fails when top-level missing review agents are present", () => {
    expect(() =>
      assertAgentEvidenceEnforced({
        required_review_agents: ["scope_lock"],
        satisfied_review_agents: [],
        missing_review_agents: ["scope_lock"],
        checks: {
          agent_evidence: {
            missing_review_agents: []
          }
        }
      })
    ).toThrow("scope_lock");
  });

  it("fails when agent evidence check reports missing review agents", () => {
    expect(() =>
      assertAgentEvidenceEnforced({
        required_review_agents: ["scope_lock"],
        satisfied_review_agents: [],
        missing_review_agents: [],
        checks: {
          agent_evidence: {
            missing_review_agents: ["scope_lock"]
          }
        }
      })
    ).toThrow("scope_lock");
  });

  it("fails when validator report has no agent evidence check", () => {
    expect(() =>
      assertAgentEvidenceEnforced({
        required_review_agents: [],
        satisfied_review_agents: [],
        missing_review_agents: [],
        checks: {}
      })
    ).toThrow("checks.agent_evidence");
  });

  it("parses validator JSON report output", () => {
    expect(parseValidatorReport('{"passed":true,"checks":{"agent_evidence":{"missing_review_agents":[]}}}')).toEqual({
      passed: true,
      checks: {
        agent_evidence: {
          missing_review_agents: []
        }
      }
    });
  });
});
