import { describe, expect, it } from "vitest";
import {
  AGENT_REVIEW_ROLE_CATALOG,
  AGENT_REVIEW_ROLE_CATALOG_VERSION,
  AGENT_REVIEW_ROLE_IDS,
  getAgentReviewRole,
  isAgentReviewRoleId,
  listAgentReviewRoles
} from "../../../packages/agent-review/src/agent-roles";

describe("agent role catalog", () => {
  it("locks the reusable role catalog version and IDs", () => {
    expect(AGENT_REVIEW_ROLE_CATALOG_VERSION).toBe("agent_review.role_catalog.v1");
    expect(AGENT_REVIEW_ROLE_IDS).toEqual([
      "scope_lock",
      "repo_cartographer",
      "architecture_drift",
      "safety_boundary",
      "runtime_boundary",
      "risk_gating",
      "execution_boundary",
      "data_freshness",
      "evidence_replay",
      "qa_failure",
      "security_review",
      "no_test_weakening",
      "ci_release_guard",
      "docs_runbook",
      "human_approval_gate",
      "grill_me",
      "hermes",
      "gsd"
    ]);
  });

  it("defines every locked role with complete metadata", () => {
    const roles = listAgentReviewRoles();

    expect(roles).toHaveLength(AGENT_REVIEW_ROLE_IDS.length);

    for (const role of roles) {
      expect(role.id).toBeTruthy();
      expect(role.label).toBeTruthy();
      expect(role.category).toBeTruthy();
      expect(role.description).toBeTruthy();
      expect(role.portable_to.length).toBeGreaterThan(0);
      expect(AGENT_REVIEW_ROLE_CATALOG[role.id]).toBe(role);
    }
  });

  it("supports deterministic role lookup", () => {
    expect(getAgentReviewRole("scope_lock").label).toBe("Scope Lock Agent");
    expect(getAgentReviewRole("human_approval_gate").label).toBe("Human Approval Gate");
    expect(getAgentReviewRole("gsd").label).toBe("GSD Reviewer");
  });

  it("detects valid and invalid role IDs", () => {
    expect(isAgentReviewRoleId("scope_lock")).toBe(true);
    expect(isAgentReviewRoleId("qa_failure")).toBe(true);
    expect(isAgentReviewRoleId("unknown_agent")).toBe(false);
    expect(isAgentReviewRoleId("")).toBe(false);
  });

  it("keeps core roles portable to MCP Shield, Tradebot, and Algotradify", () => {
    expect(getAgentReviewRole("scope_lock").portable_to).toEqual(
      expect.arrayContaining(["mcp_shield", "tradebot", "algotradify"])
    );
    expect(getAgentReviewRole("safety_boundary").portable_to).toEqual(
      expect.arrayContaining(["mcp_shield", "tradebot", "algotradify"])
    );
    expect(getAgentReviewRole("evidence_replay").portable_to).toEqual(
      expect.arrayContaining(["mcp_shield", "tradebot", "algotradify"])
    );
  });
});
