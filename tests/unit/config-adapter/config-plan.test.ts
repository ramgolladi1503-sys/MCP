import { describe, expect, it } from "vitest";
import {
  createRewritePlan,
  detectClientConfigPath,
  formatConfigStatus,
  rewriteConfigText,
  validateRewritePlan
} from "../../../packages/config-adapter/src/index";

describe("config adapter planning", () => {
  it("detects supported client config filenames", () => {
    expect(detectClientConfigPath("claude-desktop")).toContain("claude_desktop_config.json");
    expect(detectClientConfigPath("cursor")).toContain("mcp.json");
    expect(detectClientConfigPath("custom")).toContain("mcp.json");
  });

  it("creates a protection plan for configured servers", () => {
    const source = JSON.stringify({
      mcpServers: {
        docs: {
          command: "node",
          args: ["docs-server.js"]
        }
      }
    });

    const plan = createRewritePlan(source, {
      client: "custom",
      configPath: "fixtures/demo-config.json",
      shieldCommand: "mcp-shield",
      policyPath: "policy.yaml",
      mode: "strict"
    });

    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]?.serverName).toBe("docs");
    expect(plan.operations[0]?.originalCommand).toBe("node");
    expect(plan.operations[0]?.originalArgs).toEqual(["docs-server.js"]);
    expect(plan.operations[0]?.protectedCommand).toBe("mcp-shield");
    expect(plan.operations[0]?.protectedArgs.slice(0, 7)).toEqual([
      "gateway",
      "--policy",
      "policy.yaml",
      "--mode",
      "strict",
      "--server-name",
      "docs"
    ]);
  });

  it("rejects plans with no server operations", () => {
    const plan = createRewritePlan(JSON.stringify({ mcpServers: {} }), {
      client: "custom",
      configPath: "fixtures/empty-config.json"
    });

    const safety = validateRewritePlan(plan);

    expect(safety.safeToRewrite).toBe(false);
    expect(safety.blockers.length).toBeGreaterThan(0);
  });

  it("rewrites config text while preserving unrelated server fields", () => {
    const source = JSON.stringify({
      mcpServers: {
        docs: {
          command: "node",
          args: ["docs-server.js"],
          label: "keep"
        }
      }
    });

    const plan = createRewritePlan(source, {
      client: "custom",
      configPath: "fixtures/demo-config.json",
      shieldCommand: "mcp-shield"
    });

    const rewritten = JSON.parse(rewriteConfigText(source, plan));

    expect(rewritten.mcpServers.docs.command).toBe("mcp-shield");
    expect(rewritten.mcpServers.docs.args[0]).toBe("gateway");
    expect(rewritten.mcpServers.docs.label).toBe("keep");
    expect(rewritten.mcpServers.docs._mcpShieldProtected).toBe(true);
  });

  it("formats status for humans", () => {
    const text = formatConfigStatus({
      client: "custom",
      configPath: "fixtures/demo-config.json",
      exists: true,
      protected: true,
      serverCount: 1,
      backupPath: "fixtures/backups/demo-config.json.bak",
      mappingPath: "fixtures/config-map.json"
    });

    expect(text).toContain("Client: custom");
    expect(text).toContain("Protected: yes");
    expect(text).toContain("Servers: 1");
  });
});
