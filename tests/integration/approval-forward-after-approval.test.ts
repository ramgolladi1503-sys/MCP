import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approveRequest, denyRequest, listApprovalRequests } from "../../packages/gateway/src/index";
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
    const gateway = startGateway({ auditFile, approvalDir, childCallLog, approvalWaitMs: 5000, approvalTtlMs: 10000 });

    try {
      await initializeGateway(gateway);

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "shell.run", arguments: { command: "git push origin main" } }
        })}\n`
      );

      await waitFor(async () => (await listApprovalRequests(approvalDir)).length === 1, 8000, () => gateway.stderrChunks.join(""));
      expect(existsSync(childCallLog)).toBe(false);
      expect(gateway.stdoutLines.some((line) => parseMessage(line).id === 2)).toBe(false);

      const [approval] = await listApprovalRequests(approvalDir);
      expect(approval).toMatchObject({ status: "pending", toolName: "shell.run", serverName: "approval-child" });

      await approveRequest({ storeDir: approvalDir, id: approval.id, reason: "integration side-channel approval" });

      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 2), 8000, () => gateway.stderrChunks.join(""));
      const forwardedResponse = gateway.stdoutLines.map(parseMessage).find((message) => message.id === 2);
      expect(forwardedResponse?.result).toBeDefined();

      let childCalls = await readChildCalls(childCallLog);
      expect(childCalls).toHaveLength(1);
      expect(childCalls[0].params.arguments.command).toBe("git push origin main");

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "shell.run", arguments: { command: "git push origin release" } }
        })}\n`
      );

      await waitFor(async () => (await listApprovalRequests(approvalDir)).length === 2, 8000, () => gateway.stderrChunks.join(""));
      const denial = (await listApprovalRequests(approvalDir)).find((request) => request.rawMessageId === 3);
      expect(denial).toBeDefined();
      await denyRequest({ storeDir: approvalDir, id: denial!.id, reason: "integration side-channel denial" });

      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 3), 8000, () => gateway.stderrChunks.join(""));
      const deniedResponse = gateway.stdoutLines.map(parseMessage).find((message) => message.id === 3);
      expect(deniedResponse?.error?.code).toBe(-32001);
      expect(deniedResponse?.error?.data).toMatchObject({ approval_status: "denied" });

      childCalls = await readChildCalls(childCallLog);
      expect(childCalls).toHaveLength(1);

      const auditEvents = parseAuditJsonl(await readFile(auditFile, "utf8"));
      expect(auditEvents.map((event) => event.decision)).toEqual(
        expect.arrayContaining(["BLOCK", "APPROVAL_REQUESTED", "APPROVAL_APPROVED", "APPROVAL_FORWARDED", "APPROVAL_DENIED"])
      );
      expect(auditEvents.find((event) => event.decision === "APPROVAL_REQUESTED")?.argsSummary).toMatchObject({
        approval_status: "pending",
        arguments: { command: "git push origin main" }
      });
      expect(auditEvents.find((event) => event.decision === "APPROVAL_FORWARDED")?.reason).toContain("forwarded to the child MCP server");
      expect(auditEvents.find((event) => event.decision === "APPROVAL_DENIED")?.reason).toBe("integration side-channel denial");
    } finally {
      gateway.child.kill("SIGTERM");
      await waitForExit(gateway.child, 5000).catch(() => undefined);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 25000);

  it("audits expired approvals and still does not forward to the child MCP server", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "mcp-shield-approval-expired-"));
    const auditFile = join(tempDir, "audit.jsonl");
    const approvalDir = join(tempDir, "approvals");
    const childCallLog = join(tempDir, "child-calls.jsonl");
    const gateway = startGateway({ auditFile, approvalDir, childCallLog, approvalWaitMs: 1000, approvalTtlMs: 75 });

    try {
      await initializeGateway(gateway);

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "shell.run", arguments: { command: "git push origin expired" } }
        })}\n`
      );

      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 2), 8000, () => gateway.stderrChunks.join(""));
      const expiredResponse = gateway.stdoutLines.map(parseMessage).find((message) => message.id === 2);
      expect(expiredResponse?.error?.code).toBe(-32001);
      expect(expiredResponse?.error?.data).toMatchObject({ approval_status: "expired" });
      expect(existsSync(childCallLog)).toBe(false);

      const auditEvents = parseAuditJsonl(await readFile(auditFile, "utf8"));
      expect(auditEvents.map((event) => event.decision)).toEqual(expect.arrayContaining(["BLOCK", "APPROVAL_REQUESTED", "APPROVAL_EXPIRED"]));
      expect(auditEvents.map((event) => event.decision)).not.toContain("APPROVAL_FORWARDED");
    } finally {
      gateway.child.kill("SIGTERM");
      await waitForExit(gateway.child, 5000).catch(() => undefined);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 20000);
});

function startGateway(params: {
  readonly auditFile: string;
  readonly approvalDir: string;
  readonly childCallLog: string;
  readonly approvalWaitMs: number;
  readonly approvalTtlMs: number;
}): { readonly child: ReturnType<typeof spawn>; readonly stdoutLines: string[]; readonly stderrChunks: string[]; readonly stdin: NodeJS.WritableStream } {
  const child = spawn(
    "node",
    [
      "packages/cli/dist/index.js",
      "gateway",
      "--policy",
      "examples/policies/coding-agent.yaml",
      "--mode",
      "balanced",
      "--server-name",
      "approval-child",
      "--audit-file",
      params.auditFile,
      "--approval-dir",
      params.approvalDir,
      "--approval-wait-ms",
      String(params.approvalWaitMs),
      "--approval-poll-ms",
      "25",
      "--approval-ttl-ms",
      String(params.approvalTtlMs),
      "--",
      "node",
      "tests/fixtures/approval-child-mcp-server.mjs",
      params.childCallLog
    ],
    {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    }
  );

  const stdoutLines: string[] = [];
  const stderrChunks: string[] = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdoutLines.push(...chunk.split(/\r?\n/).filter(Boolean));
  });
  child.stderr.on("data", (chunk: string) => {
    stderrChunks.push(chunk);
  });

  return { child, stdoutLines, stderrChunks, stdin: child.stdin };
}

async function initializeGateway(gateway: { readonly stdin: NodeJS.WritableStream; readonly stdoutLines: readonly string[]; readonly stderrChunks: readonly string[] }): Promise<void> {
  gateway.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
  await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 1), 8000, () => gateway.stderrChunks.join(""));
}

function parseMessage(line: string): JsonRpcMessage {
  return JSON.parse(line) as JsonRpcMessage;
}

async function readChildCalls(path: string): Promise<readonly { readonly params: { readonly arguments: { readonly command: string } } }[]> {
  return (await readFile(path, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line) as { readonly params: { readonly arguments: { readonly command: string } } });
}

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
