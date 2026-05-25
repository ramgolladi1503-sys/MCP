import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = "scripts/agent-review-ci-scope-guard.mjs";

describe("agent-review CI scope guard script", () => {
  it("skips safely for non-pull-request events", () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "push"
      }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Agent Review CI scope guard skipped for event: push");
    expect(result.stderr).toBe("");
  });

  it("fails closed for pull-request events without event payload path", () => {
    const { GITHUB_EVENT_PATH: _githubEventPath, ...envWithoutEventPath } = process.env;
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...envWithoutEventPath,
        GITHUB_EVENT_NAME: "pull_request"
      }
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("GITHUB_EVENT_PATH is required");
  });
});
