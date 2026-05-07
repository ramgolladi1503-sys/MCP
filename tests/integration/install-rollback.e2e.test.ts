import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConfigStatus, initProtectedConfig, restoreLatestBackup } from "../../packages/config-adapter/src/index";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "mcp-shield-install-rollback-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("install / rollback end-to-end", () => {
  it("rewrites a custom MCP config through the shield wrapper and restores the exact original", async () => {
    const dir = await makeTempDir();
    const configPath = join(dir, "mcp.json");
    const originalConfig = {
      mcpServers: {
        filesystem: {
          command: "node",
          args: ["server.js"],
          env: { PATH: "/usr/bin:/bin" }
        },
        shell: {
          command: "python",
          args: ["server.py"]
        }
      }
    };
    const originalText = `${JSON.stringify(originalConfig, null, 2)}\n`;
    await writeFile(configPath, originalText, "utf8");

    const plan = await initProtectedConfig({
      client: "custom",
      configPath,
      shieldCommand: "mcp-shield",
      policyPath: "examples/policies/coding-agent.yaml",
      mode: "strict"
    });

    expect(plan.operations).toHaveLength(2);
    expect(plan.backupPath).toContain(".mcp-shield");

    const protectedText = await readFile(configPath, "utf8");
    const protectedConfig = JSON.parse(protectedText) as {
      mcpServers: Record<string, { command: string; args: string[]; _mcpShieldProtected?: boolean }>;
    };

    expect(protectedConfig.mcpServers.filesystem.command).toBe("mcp-shield");
    expect(protectedConfig.mcpServers.filesystem.args).toEqual([
      "gateway",
      "--policy",
      "examples/policies/coding-agent.yaml",
      "--mode",
      "strict",
      "--server-name",
      "filesystem",
      "--",
      "node",
      "server.js"
    ]);
    expect(protectedConfig.mcpServers.filesystem._mcpShieldProtected).toBe(true);

    const status = await getConfigStatus("custom", configPath);
    expect(status.exists).toBe(true);
    expect(status.protected).toBe(true);
    expect(status.serverCount).toBe(2);
    expect(status.backupPath).toBe(plan.backupPath);
    expect(status.mappingPath).toBe(plan.mappingPath);

    await restoreLatestBackup("custom", configPath);
    expect(await readFile(configPath, "utf8")).toBe(originalText);

    const restoredStatus = await getConfigStatus("custom", configPath);
    expect(restoredStatus.protected).toBe(false);
  });

  it("refuses to rewrite configs with no protectable MCP servers", async () => {
    const dir = await makeTempDir();
    const configPath = join(dir, "mcp.json");
    await writeFile(configPath, "{\"mcpServers\":{}}\n", "utf8");

    await expect(initProtectedConfig({ client: "custom", configPath })).rejects.toThrow(
      "No MCP server entries were found to protect"
    );
  });
});
