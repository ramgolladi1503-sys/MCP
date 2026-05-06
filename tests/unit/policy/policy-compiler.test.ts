import { describe, expect, it } from "vitest";
import { formatPolicyCheck, loadPolicyFromYaml, runPolicyDryRun } from "../../../packages/policy/src/index";

describe("loadPolicyFromYaml", () => {
  it("loads a valid coding-agent policy", () => {
    const compiled = loadPolicyFromYaml(`
policy_version: "1.0"
default_action: allow
workspace_roots:
  - "./project"
blocked_paths:
  - ".env"
allowed_path_exceptions:
  - ".env.example"
blocked_commands:
  - "rm -rf*"
approval_required:
  - "git push*"
allowed_domains:
  - "github.com"
deny_unknown_domains: true
feature_flags:
  scanner: true
  gateway: true
  tamper_evident_audit: true
`);

    expect(compiled.valid).toBe(true);
    expect(compiled.issues).toEqual([]);
    expect(compiled.policy.blockedPaths).toEqual([".env"]);
    expect(compiled.policy.featureFlags.gateway).toBe(true);
  });

  it("returns validation errors for unsafe missing workspace roots", () => {
    const compiled = loadPolicyFromYaml(`
default_action: allow
workspace_roots: []
blocked_paths: []
blocked_commands: []
deny_unknown_domains: false
`);

    expect(compiled.valid).toBe(false);
    expect(compiled.issues.map((issue) => issue.ruleId)).toEqual(
      expect.arrayContaining([
        "policy.workspace_roots.missing",
        "policy.unsafe.default_allow_without_command_blocks",
        "policy.unsafe.no_blocked_paths",
        "policy.network.unknown_domains_allowed"
      ])
    );
  });

  it("warns about unknown keys", () => {
    const compiled = loadPolicyFromYaml(`
default_action: allow
workspace_roots:
  - "./project"
unknown_thing: true
`);

    expect(compiled.issues.map((issue) => issue.ruleId)).toContain("policy.unknown_key");
  });

  it("reports invalid YAML without throwing", () => {
    const compiled = loadPolicyFromYaml("default_action: [");

    expect(compiled.valid).toBe(false);
    expect(compiled.issues[0]?.ruleId).toBe("policy.yaml.invalid");
  });
});

describe("formatPolicyCheck", () => {
  it("formats errors and warnings", () => {
    const compiled = loadPolicyFromYaml(`
default_action: allow
workspace_roots: []
blocked_paths: []
blocked_commands: []
deny_unknown_domains: false
`);

    const output = formatPolicyCheck(compiled);

    expect(output).toContain("Policy valid: no");
    expect(output).toContain("Errors:");
    expect(output).toContain("Warnings:");
    expect(output).toContain("Recommended fixes:");
  });
});

describe("runPolicyDryRun", () => {
  it("runs deterministic fixture decisions", () => {
    const compiled = loadPolicyFromYaml(`
default_action: allow
workspace_roots:
  - "./project"
blocked_paths:
  - ".env"
blocked_commands:
  - "rm -rf*"
deny_unknown_domains: true
`);

    const results = runPolicyDryRun(compiled.policy, [
      {
        id: "secret-env-read",
        description: "Block .env read",
        context: {
          sessionId: "sess_test",
          serverName: "filesystem",
          toolName: "filesystem.read_file",
          arguments: { path: ".env" },
          rawMessageId: 1,
          timestamp: "2026-05-07T00:00:00.000Z",
          mode: "balanced"
        },
        expectedDecision: "BLOCK",
        expectedRuleId: "secret.path.blocked"
      }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(true);
  });
});
