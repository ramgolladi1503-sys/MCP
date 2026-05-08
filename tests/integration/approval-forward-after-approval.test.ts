import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approveRequest, listApprovalRequests } from "../../packages/gateway/src/index";
import { parseAuditJsonl } from "../../packages/audit/src/index";

interface JsonRpcMessage {
  readonly jsonrpc: "2.0";
  readonly id?: string | number | null;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string; readonly data?: unknown };
}

describe("approval wait mode forward-after-approval", () => {
  it("keeps approval-gated calls away from the child MCP server until side-channel approval", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "mcp-shield-approval-forward-"));
    const auditFile = join(tempDir, "audit.jsonl");
    const approvalDir = join(tempDir, "approvals");
    const childCallLog = join(tempDir, "child-calls.jsonl");

    const gateway = spawn(
      "pnpm",
      [
        "--filter",
        "@mcp-shield/cli",
        "exec",
        "tsx",
        "src/index.ts",
        "gateway",
        "--policy",
        "../../examples/policies/coding-agent.yaml",
        "--mode",
        "balanced",
        "--server-name",
        "approval-child",
        "--audit-file",
        auditFile,
        "--approval-dir",
        approvalDir,
        "--approval-wait-ms",
        "5000",
        "--approval-poll-ms",
        "25",
        "--approval-ttl-ms",
        "10000",
        "--",
        "node",
        "../../tests/fixtures/approval-child-mcp-server.mjs",
        childCallLog
      ],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    const stdoutLines: string[] = [];
    const stderrChunks: string[] = [];
    gateway.stdout.setEncoding("utf8");
    gateway.stderr.setEncoding("utf8");
    gateway.stdout.on("data", (chunk: string) => {
      stdoutLines.push(...chunk.split(/\r?\n/).filter(Boolean));
    });
    gateway.stderr.on("data", (chunk: string) => {
      stderrChunks.push(chunk);
    });

    try {
      gateway.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
      await waitFor(() => stdoutLines.some((line) => (JSON.parse(line) as JsonRpcMessage).id === 1), 8000, () => stderrChunks.join(""));

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "shell.run", arguments: { command: "git push origin main" } }
        })}\n`
      );

      await waitFor(async () => (await listApprovalRequests(approvalDir)).length === 1, 8000, () => stderrChunks.join(""));
      expect(existsSync(childCallLog)).toBe(false);
      expect(stdoutLines.some((line) => (JSON.parse(line) as JsonRpcMessage).id === 2)).toBe(false);

      const [approval] = await listApprovalRequests(approvalDir);
      expect(approval).toMatchObject({ status: "pending", toolName: "shell.run", serverName: "approval-child" });

      await approveRequest({ storeDir: approvalDir, id: approval.id, reason: "integration side-channel approval" });

      await waitFor(() => stdoutLines.some((line) => (JSON.parse(line) as JsonRpcMessage).id === 2), 8000, () => stderrChunks.join(""));
      const forwardedResponse = stdoutLines.map((line) => JSON.parse(line) as JsonRpcMessage).find((message) => message.id === 2);
      expect(forwardedResponse?.result).toBeDefined();

      const childCalls = (await readFile(childCallLog, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line) as { readonly params: { readonly arguments: { readonly command: string } } });
      expect(childCalls).toHaveLength(1);
      expect(childCalls[0].params.arguments.command).toBe("git push origin main");

      const auditEvents = parseAuditJsonl(await readFile(auditFile, "utf8"));
      expect(auditEvents.map((event) => event.decision)).toEqual(
        expect.arrayContaining(["BLOCK", "APPROVAL_REQUESTED", "APPROVAL_APPROVED", "APPROVAL_FORWARDED"])
      );
      expect(auditEvents.find((event) => event.decision === "APPROVAL_REQUESTED")?.argsSummary).toMatchObject({
        approval_status: "pending",
        arguments: { command: "git push origin main" }
      });
      expect(auditEvents.find((event) => event.decision === "APPROVAL_FORWARDED")?.reason).toContain("forwarded to the child MCP server");
    } finally {
      gateway.kill("SIGTERM");
      await waitForExit(gateway, 5000).catch(() => undefined);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 20000);
});

async function waitFor(assertion: () => boolean | Promise<boolean>, timeoutMs: number, describeState?: () => string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for condition${describeState ? `\n${describeState()}` : ""}`);
}

async function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for process exit")), timeoutMs))
  ]);
}
