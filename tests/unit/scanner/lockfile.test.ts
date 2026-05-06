import { describe, expect, it } from "vitest";
import {
  createLockfileFromManifests,
  diffLockfile,
  formatManifestDiff,
  scanManifestDrift,
  updateLockfile
} from "../../../packages/scanner/src/lockfile";

describe("manifest lockfile drift", () => {
  it("creates deterministic lockfiles from server manifests", () => {
    const lockfile = createLockfileFromManifests(
      [
        {
          serverName: "docs",
          command: "node",
          args: ["server.js"],
          cwd: "./project",
          tools: [
            {
              serverName: "docs",
              toolName: "docs.read_file",
              description: "Read a project document",
              inputSchema: { type: "object", properties: { path: { type: "string" } } }
            }
          ]
        }
      ],
      "2026-05-07T00:00:00.000Z"
    );

    expect(lockfile.lockfileVersion).toBe("1.0");
    expect(lockfile.servers).toHaveLength(1);
    expect(lockfile.servers[0]?.tools[0]?.fullManifestHash).toMatch(/^sha256:/);
  });

  it("detects changed tool manifests", () => {
    const first = createLockfileFromManifests(
      [
        {
          serverName: "docs",
          command: "node",
          args: ["server.js"],
          tools: [
            {
              serverName: "docs",
              toolName: "docs.reader",
              description: "Reads project documents.",
              inputSchema: { type: "object", properties: { path: { type: "string" } } }
            }
          ]
        }
      ],
      "2026-05-07T00:00:00.000Z"
    );
    const second = updateLockfile(
      first,
      [
        {
          serverName: "docs",
          command: "node",
          args: ["server.js"],
          tools: [
            {
              serverName: "docs",
              toolName: "docs.reader",
              description: "Reads project documents and includes additional instructions.",
              inputSchema: { type: "object", properties: { path: { type: "string" } } }
            }
          ]
        }
      ],
      "2026-05-07T01:00:00.000Z"
    );

    const diffs = diffLockfile(first, second);

    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ type: "tool_changed", severity: "high" });
    expect(scanManifestDrift(diffs)[0]?.ruleId).toBe("scanner.manifest_drift.tool_changed");
    expect(formatManifestDiff(diffs)).toContain("Tool docs.reader manifest changed");
  });

  it("detects new servers and launch command drift", () => {
    const first = createLockfileFromManifests(
      [{ serverName: "docs", command: "node", args: ["server.js"], tools: [] }],
      "2026-05-07T00:00:00.000Z"
    );
    const second = updateLockfile(
      first,
      [
        { serverName: "docs", command: "node", args: ["server-v2.js"], tools: [] },
        { serverName: "reports", command: "node", args: ["reports-server.js"], tools: [] }
      ],
      "2026-05-07T01:00:00.000Z"
    );

    const diffs = diffLockfile(first, second);

    expect(diffs.map((diff) => diff.type)).toEqual(expect.arrayContaining(["server_changed", "server_added"]));
  });
});
