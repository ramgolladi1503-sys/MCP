import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  approveRequest,
  createApprovalRequest,
  denyRequest,
  formatApprovalList,
  listApprovalRequests,
  readApprovalRequest
} from "../../../packages/gateway/src/index";
import type { PolicyDecision, ToolCallContext } from "../../../packages/shared/src/index";

const decision: PolicyDecision = {
  decision: "APPROVE",
  severity: "high",
  ruleId: "command.approval_required",
  reason: "Command requires explicit approval",
  suggestedFix: "Approve only after checking command scope."
};

const context: ToolCallContext = {
  sessionId: "sess_test",
  serverName: "shell",
  toolName: "shell.run",
  arguments: {
    command: "git push origin main",
    token: "super-secret-token",
    nested: { password: "do-not-show" }
  },
  rawMessageId: 42,
  timestamp: "2026-05-09T00:00:00.000Z",
  mode: "balanced"
};

async function tempStore(): Promise<string> {
  return mkdtemp(join(tmpdir(), "mcp-shield-approvals-"));
}

describe("approval broker", () => {
  it("creates pending approval requests and redacts sensitive args", async () => {
    const storeDir = await tempStore();
    try {
      const request = await createApprovalRequest({ storeDir, context, decision, ttlMs: 60_000 });
      const readBack = await readApprovalRequest(storeDir, request.id);

      expect(request.id).toMatch(/^apr_/);
      expect(readBack).toMatchObject({
        id: request.id,
        status: "pending",
        serverName: "shell",
        toolName: "shell.run",
        ruleId: "command.approval_required",
        argumentsSummary: {
          command: "git push origin main",
          token: "[REDACTED]",
          nested: "[object]"
        }
      });
    } finally {
      await rm(storeDir, { recursive: true, force: true });
    }
  });

  it("lists and formats approval requests", async () => {
    const storeDir = await tempStore();
    try {
      const request = await createApprovalRequest({ storeDir, context, decision, ttlMs: 60_000 });
      const requests = await listApprovalRequests(storeDir);
      const formatted = formatApprovalList(requests);

      expect(requests).toHaveLength(1);
      expect(formatted).toContain(request.id);
      expect(formatted).toContain("pending");
      expect(formatted).toContain("shell.run");
    } finally {
      await rm(storeDir, { recursive: true, force: true });
    }
  });

  it("approves and denies pending approval requests only once", async () => {
    const approveStore = await tempStore();
    const denyStore = await tempStore();
    try {
      const approval = await createApprovalRequest({ storeDir: approveStore, context, decision, ttlMs: 60_000 });
      const approved = await approveRequest({ storeDir: approveStore, id: approval.id, reason: "Reviewed target branch" });
      expect(approved.status).toBe("approved");
      expect(approved.reason).toBe("Reviewed target branch");
      await expect(denyRequest({ storeDir: approveStore, id: approval.id })).rejects.toThrow("already approved");

      const denial = await createApprovalRequest({ storeDir: denyStore, context, decision, ttlMs: 60_000 });
      const denied = await denyRequest({ storeDir: denyStore, id: denial.id, reason: "Unexpected main branch push" });
      expect(denied.status).toBe("denied");
      expect(denied.reason).toBe("Unexpected main branch push");
      await expect(approveRequest({ storeDir: denyStore, id: denial.id })).rejects.toThrow("already denied");
    } finally {
      await rm(approveStore, { recursive: true, force: true });
      await rm(denyStore, { recursive: true, force: true });
    }
  });
});
