import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approveRequest, createApprovalRequest } from "../../packages/gateway/src/index";
import type { PolicyDecision, ToolCallContext } from "../../packages/shared/src/index";

const decision: PolicyDecision = {
  decision: "APPROVE",
  severity: "high",
  ruleId: "command.approval_required",
  reason: "Command requires explicit approval",
  suggestedFix: "Approve only after checking command scope."
};

const context: ToolCallContext = {
  sessionId: "sess_watch_test",
  serverName: "shell",
  toolName: "shell.run",
  arguments: {
    command: "git push origin main"
  },
  rawMessageId: 7,
  timestamp: "2026-05-09T00:00:00.000Z",
  mode: "balanced"
};

describe("approval watch CLI", () => {
  it("prints pending and decided approval snapshots in one-shot mode", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "mcp-shield-watch-"));
    try {
      const pending = await createApprovalRequest({ storeDir, context, decision, ttlMs: 60_000 });
      const decided = await createApprovalRequest({
        storeDir,
        context: { ...context, rawMessageId: 8, arguments: { command: "git push origin release" } },
        decision,
        ttlMs: 60_000
      });
      await approveRequest({ storeDir, id: decided.id, reason: "watch test approval" });

      const result = await runCli([
        "--filter",
        "@mcp-shield/cli",
        "exec",
        "tsx",
        "src/index.ts",
        "approval",
        "watch",
        "--once",
        "--no-clear",
        "--dir",
        storeDir,
        "--interval-ms",
        "50"
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("MCP Shield Approval Watch");
      expect(result.stdout).toContain("Pending approvals: 1");
      expect(result.stdout).toContain(pending.id);
      expect(result.stdout).toContain("Approve: mcp-shield approval approve");
      expect(result.stdout).toContain("Deny:    mcp-shield approval deny");
      expect(result.stdout).toContain("Recent decided approvals: 1");
      expect(result.stdout).toContain(decided.id);
      expect(result.stdout).toContain("APPROVED");
      expect(result.stdout).toContain("watch test approval");
      expect(result.stdout).toContain("git push origin main");
    } finally {
      await rm(storeDir, { recursive: true, force: true });
    }
  }, 15000);
});

async function runCli(args: readonly string[]): Promise<{ readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }> {
  const child = spawn("pnpm", [...args], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });

  return { exitCode, stdout, stderr };
}
