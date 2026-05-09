import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface McpClientConfig {
  readonly mcpServers: Record<string, { readonly command: string; readonly args: readonly string[] }>;
}

describe("live client demo config generator", () => {
  it("creates a reproducible Claude/Cursor-ready MCP config for the real-world demo", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "mcp-shield-live-client-config-"));
    const outputPath = join(tempDir, "mcp.json");
    const demoDir = join(tempDir, "runtime-proof");

    try {
      const result = await runNode([
        "scripts/generate-live-client-demo-config.mjs",
        "--client",
        "cursor",
        "--demo-dir",
        demoDir,
        "--output",
        outputPath,
        "--server-name",
        "mcp-shield-demo"
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Wrote cursor MCP demo config");
      expect(result.stderr).toContain(join(demoDir, "approvals"));
      expect(result.stderr).toContain(join(demoDir, "audit.jsonl"));
      expect(result.stderr).toContain(join(demoDir, "child-calls.jsonl"));
      expect(existsSync(outputPath)).toBe(true);
      expect(existsSync(demoDir)).toBe(true);

      const config = JSON.parse(await readFile(outputPath, "utf8")) as McpClientConfig;
      const server = config.mcpServers["mcp-shield-demo"];
      expect(server.command).toBe("node");
      expect(server.args).toEqual(
        expect.arrayContaining([
          "gateway",
          "--policy",
          expect.stringContaining("examples/policies/real-world-demo.yaml"),
          "--mode",
          "balanced",
          "--approval-wait-ms",
          "30000",
          "--approval-poll-ms",
          "250",
          "--approval-ttl-ms",
          "60000",
          "--audit-file",
          join(demoDir, "audit.jsonl"),
          "--approval-dir",
          join(demoDir, "approvals"),
          expect.stringContaining("examples/real-world-mcp-server/index.js"),
          join(demoDir, "child-calls.jsonl")
        ])
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);

  it("prints JSON to stdout when no output file is provided", async () => {
    const result = await runNode(["scripts/generate-live-client-demo-config.mjs", "--server-name", "stdout-demo"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const config = JSON.parse(result.stdout) as McpClientConfig;
    expect(config.mcpServers["stdout-demo"].args).toContain("gateway");
  }, 15000);
});

async function runNode(args: readonly string[]): Promise<{ readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }> {
  const child = spawn("node", [...args], {
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
