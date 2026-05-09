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
  readonly error?: { readonly code: number; readonly message: string; readonly data?: Readonly<Record<string, unknown>> };
}

describe("real-world Git/Shell/DB demo server through gateway", () => {
  it("forwards safe calls, approval-gates risky calls, and blocks destructive calls", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "mcp-shield-real-world-demo-"));
    const auditFile = join(tempDir, "audit.jsonl");
    const approvalDir = join(tempDir, "approvals");
    const childCallLog = join(tempDir, "child-calls.jsonl");
    const gateway = startGateway({ auditFile, approvalDir, childCallLog });

    try {
      await initializeGateway(gateway);

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "git.status", arguments: { command: "git status --short" } }
        })}\n`
      );
      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 2), 8000, () => gateway.stderrChunks.join(""));
      expect(messageById(gateway.stdoutLines, 2)?.result).toBeDefined();
      expect(await readChildCalls(childCallLog)).toHaveLength(1);

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "git.push", arguments: { command: "git push origin main" } }
        })}\n`
      );
      await waitFor(async () => (await listApprovalRequests(approvalDir)).some((request) => request.rawMessageId === 3), 8000, () => gateway.stderrChunks.join(""));
      expect(messageById(gateway.stdoutLines, 3)).toBeUndefined();
      expect(await readChildCalls(childCallLog)).toHaveLength(1);

      const approval = (await listApprovalRequests(approvalDir)).find((request) => request.rawMessageId === 3);
      expect(approval).toMatchObject({ status: "pending", toolName: "git.push" });
      await approveRequest({ storeDir: approvalDir, id: approval!.id, reason: "demo approved git push" });

      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 3), 8000, () => gateway.stderrChunks.join(""));
      expect(messageById(gateway.stdoutLines, 3)?.result).toBeDefined();
      let childCalls = await readChildCalls(childCallLog);
      expect(childCalls).toHaveLength(2);
      expect(childCalls[1].params.name).toBe("git.push");

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "shell.run", arguments: { command: "rm -rf ./demo-workspace" } }
        })}\n`
      );
      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 4), 8000, () => gateway.stderrChunks.join(""));
      expect(messageById(gateway.stdoutLines, 4)?.error?.data).toMatchObject({ rule_id: "command.blocked" });
      childCalls = await readChildCalls(childCallLog);
      expect(childCalls).toHaveLength(2);

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "db.query", arguments: { query: "select id, email from users limit 5" } }
        })}\n`
      );
      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 5), 8000, () => gateway.stderrChunks.join(""));
      expect(messageById(gateway.stdoutLines, 5)?.result).toBeDefined();
      childCalls = await readChildCalls(childCallLog);
      expect(childCalls).toHaveLength(3);
      expect(childCalls[2].params.name).toBe("db.query");

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "db.query", arguments: { query: "update users set role = 'admin' where id = 1" } }
        })}\n`
      );
      await waitFor(async () => (await listApprovalRequests(approvalDir)).some((request) => request.rawMessageId === 6), 8000, () => gateway.stderrChunks.join(""));
      expect(messageById(gateway.stdoutLines, 6)).toBeUndefined();
      childCalls = await readChildCalls(childCallLog);
      expect(childCalls).toHaveLength(3);
      const sqlApproval = (await listApprovalRequests(approvalDir)).find((request) => request.rawMessageId === 6);
      expect(sqlApproval).toMatchObject({ status: "pending", toolName: "db.query", ruleId: "sql.approval_required" });
      await approveRequest({ storeDir: approvalDir, id: sqlApproval!.id, reason: "demo approved SQL update" });

      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 6), 8000, () => gateway.stderrChunks.join(""));
      expect(messageById(gateway.stdoutLines, 6)?.result).toBeDefined();
      childCalls = await readChildCalls(childCallLog);
      expect(childCalls).toHaveLength(4);
      expect(childCalls[3].params.arguments.query).toContain("update users");

      gateway.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: { name: "db.query", arguments: { query: "drop table users" } }
        })}\n`
      );
      await waitFor(() => gateway.stdoutLines.some((line) => parseMessage(line).id === 7), 8000, () => gateway.stderrChunks.join(""));
      expect(messageById(gateway.stdoutLines, 7)?.error?.data).toMatchObject({ rule_id: "sql.blocked" });
      childCalls = await readChildCalls(childCallLog);
      expect(childCalls).toHaveLength(4);

      const auditEvents = parseAuditJsonl(await readFile(auditFile, "utf8"));
      expect(auditEvents.map((event) => event.ruleId)).toEqual(
        expect.arrayContaining(["default.allow", "approval.required_not_granted", "command.blocked", "sql.approval_required", "sql.blocked"])
      );
      expect(auditEvents.map((event) => event.decision)).toEqual(expect.arrayContaining(["APPROVAL_FORWARDED"]));
    } finally {
      gateway.child.kill("SIGTERM");
      await waitForExit(gateway.child, 5000).catch(() => undefined);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 30000);
});

function startGateway(params: {
  readonly auditFile: string;
  readonly approvalDir: string;
  readonly childCallLog: string;
}): { readonly child: ReturnType<typeof spawn>; readonly stdoutLines: string[]; readonly stderrChunks: string[]; readonly stdin: NodeJS.WritableStream } {
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "@mcp-shield/cli",
      "exec",
      "tsx",
      "src/index.ts",
      "gateway",
      "--policy",
      "../../examples/policies/real-world-demo.yaml",
      "--mode",
      "balanced",
      "--server-name",
      "real-world-demo",
      "--audit-file",
      params.auditFile,
      "--approval-dir",
      params.approvalDir,
      "--approval-wait-ms",
      "5000",
      "--approval-poll-ms",
      "25",
      "--approval-ttl-ms",
      "10000",
      "--",
      "node",
      "../../examples/real-world-mcp-server/index.js",
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

function messageById(lines: readonly string[], id: number): JsonRpcMessage | undefined {
  return lines.map(parseMessage).find((message) => message.id === id);
}

async function readChildCalls(path: string): Promise<readonly { readonly params: { readonly name: string; readonly arguments: Record<string, string> } }[]> {
  if (!existsSync(path)) {
    return [];
  }
  const text = (await readFile(path, "utf8")).trim();
  if (text.length === 0) {
    return [];
  }
  return text.split(/\r?\n/).map((line) => JSON.parse(line) as { readonly params: { readonly name: string; readonly arguments: Record<string, string> } });
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
