import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  approveRequest,
  awaitApprovalDecision,
  createApprovalRequest,
  denyRequest,
  formatApprovalList,
  hashApprovalPayload,
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
      expect(request.requestHash).toBe(hashApprovalPayload(context, decision.ruleId));
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

  it("waits for an approval decision and returns approved status", async () => {
    const storeDir = await tempStore();
    try {
      const request = await createApprovalRequest({ storeDir, context, decision, ttlMs: 60_000 });
      const waitPromise = awaitApprovalDecision({
        storeDir,
        id: request.id,
        expectedRequestHash: request.requestHash,
        timeoutMs: 500,
        pollIntervalMs: 10
      });

      await approveRequest({ storeDir, id: request.id, reason: "Approved during wait" });
      await expect(waitPromise).resolves.toMatchObject({ status: "approved", reason: "Approved during wait" });
    } finally {
      await rm(storeDir, { recursive: true, force: true });
    }
  });

  it("returns denied status during wait without forwarding", async () => {
    const storeDir = await tempStore();
    try {
      const request = await createApprovalRequest({ storeDir, context, decision, ttlMs: 60_000 });
      const waitPromise = awaitApprovalDecision({
        storeDir,
        id: request.id,
        expectedRequestHash: request.requestHash,
        timeoutMs: 500,
        pollIntervalMs: 10
      });

      await denyRequest({ storeDir, id: request.id, reason: "Denied during wait" });
      await expect(waitPromise).resolves.toMatchObject({ status: "denied", reason: "Denied during wait" });
    } finally {
      await rm(storeDir, { recursive: true, force: true });
    }
  });

  it("returns pending when wait times out", async () => {
    const storeDir = await tempStore();
    try {
      const request = await createApprovalRequest({ storeDir, context, decision, ttlMs: 60_000 });
      const waited = await awaitApprovalDecision({
        storeDir,
        id: request.id,
        expectedRequestHash: request.requestHash,
        timeoutMs: 10,
        pollIntervalMs: 5
      });

      expect(waited.status).toBe("pending");
    } finally {
      await rm(storeDir, { recursive: true, force: true });
    }
  });

  it("rejects approved decisions when the request hash does not match", async () => {
    const storeDir = await tempStore();
    try {
      const request = await createApprovalRequest({ storeDir, context, decision, ttlMs: 60_000 });
      await approveRequest({ storeDir, id: request.id, reason: "Hash should be checked" });

      await expect(
        awaitApprovalDecision({
          storeDir,
          id: request.id,
          expectedRequestHash: "wrong-hash",
          timeoutMs: 100,
          pollIntervalMs: 10
        })
      ).rejects.toThrow("hash mismatch");
    } finally {
      await rm(storeDir, { recursive: true, force: true });
    }
  });
});
