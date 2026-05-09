import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

interface JsonRpcMessage {
  readonly jsonrpc: "2.0";
  readonly id?: string | number | null;
  readonly method?: string;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string; readonly data?: unknown };
}

describe("stdio gateway protocol harness", () => {
  it("keeps stdout protocol-only while forwarding safe calls and blocking protected calls", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "mcp-shield-gateway-"));
    const auditFile = join(tempDir, "audit.jsonl");
    const child = spawn(
      "node",
      [
        "packages/cli/dist/index.js",
        "gateway",
        "--policy",
        "examples/policies/coding-agent.yaml",
        "--mode",
        "strict",
        "--server-name",
        "integration-demo",
        "--audit-file",
        auditFile,
        "--",
        "node",
        "examples/malicious-mcp-server/index.js"
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

    try {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
      child.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "filesystem.read_file", arguments: { path: "README.md" } }
        })}\n`
      );
      child.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "filesystem.read_file", arguments: { path: ".env" } }
        })}\n`
      );

      await waitFor(() => stdoutLines.length >= 4, 8000, () => `stdout=${stdoutLines.join("\n")}\nstderr=${stderrChunks.join("")}`);

      const messages = stdoutLines.map((line) => JSON.parse(line) as JsonRpcMessage);
      expect(messages.every((message) => message.jsonrpc === "2.0")).toBe(true);
      expect(messages.find((message) => message.id === 1)?.result).toBeDefined();
      expect(messages.find((message) => message.id === 2)?.result).toBeDefined();
      expect(messages.find((message) => message.id === 3)?.result).toBeDefined();
      expect(messages.find((message) => message.id === 4)?.error?.code).toBe(-32001);

      for (const line of stdoutLines) {
        expect(line.trim().startsWith("{")).toBe(true);
        expect(() => JSON.parse(line)).not.toThrow();
      }

      const auditText = await readFile(auditFile, "utf8");
      expect(auditText).toContain("secret.path.blocked");
      expect(stderrChunks.join("")).not.toContain("Command '");
    } finally {
      child.stdin.end();
      await terminateProcess(child, 5000);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);
});

async function waitFor(assertion: () => boolean, timeoutMs: number, describeState?: () => string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for condition${describeState ? `\n${describeState()}` : ""}`);
}

async function terminateProcess(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  const exited = await waitForProcessExit(child, timeoutMs).catch(() => false);
  if (exited) {
    return;
  }

  child.kill("SIGKILL");
  await waitForProcessExit(child, timeoutMs);
}

async function waitForProcessExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return true;
  }

  return Promise.race([
    new Promise<boolean>((resolve) => child.once("exit", () => resolve(true))),
    new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for process exit")), timeoutMs))
  ]);
}
