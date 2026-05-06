import { describe, expect, it } from "vitest";
import {
  compilePolicy,
  formatPolicyCheck,
  loadPolicyFromYaml,
  runPolicyDryRun
} from "../../../packages/policy/src/index";
import type { PolicyDryRunFixture } from "../../../packages/policy/src/index";

describe("loadPolicyFromYaml", () => {
  it("loads valid YAML policies", () => {
    const compiled = loadPolicyFromYaml(`
policy_version: "1.0"
default_action: allow
workspace_roots:
  - "./project"
blocked_paths:
  - ".env"
blocked_commands:
  - "rm -rf*"
allowed_path_exceptions:
  - ".env.example"
approval_required:
  - "git push*"
allowed_domains:
  - "github.com"
deny_unknown_domains: true
`);

    expect(compiled.valid).toBe(true);
    expect(compiled.policy.workspaceRoots).toEqual(["./project"]);
    expect(compiled.policy.blockedPaths).toEqual([".env"]);
  });

  it("returns errors for invalid YAML", () => {
    const compiled = loadPolicyFromYaml("default_action: [");

    expect(compiled.valid).toBe(false);
    expect(compiled.issues[0]?.ruleId).toBe("policy.yaml.invalid");
  });
});

describe("compilePolicy", () => {
  it("warns on unknown keys and unsafe settings", () => {
    const compiled = compilePolicy({
      default_action: "allow",
      workspace_roots: ["./project"],
      blocked_paths: [],
      blocked_commands: [],
      deny_unknown_domains: false,
      random_key: true
    });

    expect(compiled.valid).toBe(true);
    expect(compiled.issues.map((issue) => issue.ruleId)).toEqual(
      expect.arrayContaining([
        "policy.unknown_key",
        "policy.unsafe.default_allow_without_command_blocks",
        "policy.unsafe.no_blocked_paths",
        "policy.network.unknown_domains_allowed"
      ])
    );
  });

  it("fails on invalid default_action", () => {
    const compiled = compilePolicy({
      default_action: "maybe",
      workspace_roots: ["./project"]
    });

    expect(compiled.valid).toBe(false);
    expect(compiled.issues.map((issue) => issue.ruleId)).toContain("policy.default_action.invalid");
  });
});

describe("formatPolicyCheck", () => {
  it("prints readable warnings and fixes", () => {
    const compiled = compilePolicy({
      default_action: "allow",
      workspace_roots: ["./project"],
      blocked_paths: [],
      blocked_commands: []
    });

    const output = formatPolicyCheck(compiled);

    expect(output).toContain("Policy valid: yes");
    expect(output).toContain("Warnings:");
    expect(output).toContain("Recommended fixes:");
  });
});

describe("runPolicyDryRun", () => {
  it("validates expected fixture decisions", () => {
    const compiled = compilePolicy({
      default_action: "allow",
      workspace_roots: ["./project"],
      blocked_paths: [".env"],
      allowed_path_exceptions: [".env.example"],
      blocked_commands: ["rm -rf*"],
      approval_required: ["git push*"],
      deny_unknown_domains: true
    });

    const fixtures: readonly PolicyDryRunFixture[] = [
      {
        id: "secret-env-read",
        description: "Secret env read is blocked.",
        context: {
          sessionId: "sess_test",
          serverName: "filesystem",
          toolName: "filesystem.read_file",
          arguments: { path: ".env" },
          rawMessageId: 1,
          timestamp: "2026-05-07T00:00:00.000Z",
          mode: "strict"
        },
        expectedDecision: "BLOCK",
        expectedRuleId: "secret.path.blocked"
      }
    ];

    const results = runPolicyDryRun(compiled.policy, fixtures);

    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(true);
  });
});
