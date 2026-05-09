import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApprovalRequest, readApprovalRequest } from "../../packages/gateway/src/index";
import type { PolicyDecision, ToolCallContext } from "../../packages/shared/src/index";

const decision: PolicyDecision = {
  decision: "APPROVE",
  severity: "high",
  ruleId: "command.approval_required",
  reason: "Command requires explicit approval",
  suggestedFix: "Approve only after checking command scope."
};

const baseContext: ToolCallContext = {
  sessionId: "sess_console_test",
  serverName: "shell",
  toolName: "shell.run",
  arguments: {
    command: "git push origin main"
  },
  rawMessageId: 11,
  timestamp: "2026-05-10T00:00:00.000Z",
  mode: "balanced"
};

describe("approval web console", () => {
  it("serves pending approvals and records approve/deny decisions through HTTP", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "mcp-shield-console-"));
    const port = 18_000 + Math.floor(Math.random() * 10_000);
    const approveTarget = await createApprovalRequest({ storeDir, context: baseContext, decision, ttlMs: 60_000 });
    const denyTarget = await createApprovalRequest({
      storeDir,
      context: { ...baseContext, rawMessageId: 12, arguments: { command: "git push origin release" } },
      decision,
      ttlMs: 60_000
    });
    const server = startConsole({ storeDir, port });

    try {
      await waitForServer(port, server.stderrChunks);

      const health = await fetchJson(`http://127.0.0.1:${port}/healthz`);
      expect(health).toEqual({ ok: true });

      const html = await fetchText(`http://127.0.0.1:${port}/`);
      expect(html).toContain("MCP Shield Approval Console");

      const list = await fetchJson(`http://127.0.0.1:${port}/api/approvals`) as { readonly approvals: readonly { readonly id: string; readonly status: string }[] };
      expect(list.approvals.map((approval) => approval.id)).toEqual(expect.arrayContaining([approveTarget.id, denyTarget.id]));

      const approved = await postJson(`http://127.0.0.1:${port}/api/approvals/${approveTarget.id}/approve`, {
        reason: "approved through test console"
      }) as { readonly approval: { readonly status: string; readonly reason: string; readonly decidedBy: string } };
      expect(approved.approval).toMatchObject({
        status: "approved",
        reason: "approved through test console",
        decidedBy: "approval-console"
      });

      const denied = await postJson(`http://127.0.0.1:${port}/api/approvals/${denyTarget.id}/deny`, {
        reason: "denied through test console"
      }) as { readonly approval: { readonly status: string; readonly reason: string; readonly decidedBy: string } };
      expect(denied.approval).toMatchObject({
        status: "denied",
        reason: "denied through test console",
        decidedBy: "approval-console"
      });

      expect(await readApprovalRequest(storeDir, approveTarget.id)).toMatchObject({ status: "approved" });
      expect(await readApprovalRequest(storeDir, denyTarget.id)).toMatchObject({ status: "denied" });
    } finally {
      server.child.kill("SIGTERM");
      await waitForExit(server.child, 5000).catch(() => undefined);
      await rm(storeDir, { recursive: true, force: true });
    }
  }, 20000);
});

function startConsole(params: { readonly storeDir: string; readonly port: number }): { readonly child: ReturnType<typeof spawn>; readonly stdoutChunks: string[]; readonly stderrChunks: string[] } {
  const child = spawn(
    "node",
    [
      "packages/cli/dist/index.js",
      "approval",
      "serve",
      "--dir",
      params.storeDir,
      "--host",
      "127.0.0.1",
      "--port",
      String(params.port)
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdoutChunks.push(chunk);
  });
  child.stderr.on("data", (chunk: string) => {
    stderrChunks.push(chunk);
  });
  return { child, stdoutChunks, stderrChunks };
}

async function waitForServer(port: number, stderrChunks: readonly string[]): Promise<void> {
  await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      return response.ok;
    } catch {
      return false;
    }
  }, 8000, () => stderrChunks.join(""));
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return response.json() as Promise<unknown>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return response.text();
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  expect(response.ok).toBe(true);
  return response.json() as Promise<unknown>;
}

async function waitFor(assertion: () => boolean | Promise<boolean>, timeoutMs: number, describeState?: () => string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for condition${describeState ? `\n${describeState()}` : ""}`);
}

async function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for process exit")), timeoutMs))
  ]);
}
