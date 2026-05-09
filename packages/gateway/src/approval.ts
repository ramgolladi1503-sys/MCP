import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { nowIso } from "@mcp-shield/shared";
import type { PolicyDecision, ToolCallContext } from "@mcp-shield/shared";

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export interface ApprovalRequest {
  readonly schemaVersion: "1.0";
  readonly id: string;
  readonly status: ApprovalStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly decidedAt?: string;
  readonly decidedBy?: string;
  readonly reason?: string;
  readonly requestHash: string;
  readonly recordHash?: string;
  readonly sessionId: string;
  readonly serverName: string;
  readonly toolName: string;
  readonly rawMessageId: string | number | null;
  readonly mode: ToolCallContext["mode"];
  readonly ruleId: string;
  readonly severity: PolicyDecision["severity"];
  readonly policyReason: string;
  readonly suggestedFix?: string;
  readonly argumentsSummary: Readonly<Record<string, unknown>>;
}

export interface CreateApprovalRequestInput {
  readonly storeDir: string;
  readonly context: ToolCallContext;
  readonly decision: PolicyDecision;
  readonly ttlMs?: number;
}

export interface ApprovalDecisionInput {
  readonly storeDir: string;
  readonly id: string;
  readonly decidedBy?: string;
  readonly reason?: string;
}

export interface AwaitApprovalInput {
  readonly storeDir: string;
  readonly id: string;
  readonly expectedRequestHash: string;
  readonly timeoutMs: number;
  readonly pollIntervalMs?: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 250;

export async function createApprovalRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString();
  const requestHash = hashApprovalPayload(input.context, input.decision.ruleId);

  const request: ApprovalRequest = withRecordHash({
    schemaVersion: "1.0",
    id: `apr_${randomUUID()}`,
    status: "pending",
    createdAt,
    expiresAt,
    requestHash,
    sessionId: input.context.sessionId,
    serverName: input.context.serverName,
    toolName: input.context.toolName,
    rawMessageId: input.context.rawMessageId,
    mode: input.context.mode,
    ruleId: input.decision.ruleId,
    severity: input.decision.severity,
    policyReason: input.decision.reason,
    ...(input.decision.suggestedFix ? { suggestedFix: input.decision.suggestedFix } : {}),
    argumentsSummary: sanitizeArgs(input.context.arguments)
  });

  await writeApprovalRequest(input.storeDir, request);
  return request;
}

export async function listApprovalRequests(storeDir: string): Promise<readonly ApprovalRequest[]> {
  await ensureStoreDir(storeDir);
  const names = await readdir(storeDir);
  const requests = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => readApprovalRequestFromPath(join(storeDir, name)))
  );

  return requests
    .filter((request): request is ApprovalRequest => request !== null)
    .map(markExpiredIfNeeded)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readApprovalRequest(storeDir: string, id: string): Promise<ApprovalRequest | null> {
  return readApprovalRequestFromPath(approvalPath(storeDir, id));
}

export async function approveRequest(input: ApprovalDecisionInput): Promise<ApprovalRequest> {
  return decideRequest(input, "approved");
}

export async function denyRequest(input: ApprovalDecisionInput): Promise<ApprovalRequest> {
  return decideRequest(input, "denied");
}

export async function awaitApprovalDecision(input: AwaitApprovalInput): Promise<ApprovalRequest> {
  const startedAt = Date.now();
  const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  while (Date.now() - startedAt <= input.timeoutMs) {
    const current = await readApprovalRequest(input.storeDir, input.id);
    if (!current) {
      throw new Error(`Approval request not found: ${input.id}`);
    }

    const normalized = markExpiredIfNeeded(current);
    if (normalized.status === "expired" && current.status !== "expired") {
      await writeApprovalRequest(input.storeDir, normalized);
    }

    if (normalized.status !== "pending") {
      if (normalized.status === "approved" && normalized.requestHash !== input.expectedRequestHash) {
        throw new Error(`Approval request hash mismatch for ${input.id}`);
      }
      return normalized;
    }

    await sleep(pollIntervalMs);
  }

  const current = await readApprovalRequest(input.storeDir, input.id);
  if (!current) {
    throw new Error(`Approval request not found: ${input.id}`);
  }

  return markExpiredIfNeeded(current);
}

export function hashApprovalPayload(context: ToolCallContext, ruleId: string): string {
  return hashStable({
    sessionId: context.sessionId,
    serverName: context.serverName,
    toolName: context.toolName,
    rawMessageId: context.rawMessageId,
    arguments: context.arguments,
    ruleId
  });
}

export function verifyApprovalRecordIntegrity(request: ApprovalRequest): boolean {
  if (!request.recordHash) {
    return true;
  }

  return request.recordHash === hashApprovalRecord(request);
}

export function formatApprovalRequest(request: ApprovalRequest): string {
  const lines = [
    `Approval: ${request.id}`,
    `Status: ${request.status}`,
    `Created: ${request.createdAt}`,
    `Expires: ${request.expiresAt}`,
    `Server: ${request.serverName}`,
    `Tool: ${request.toolName}`,
    `Rule: ${request.ruleId}`,
    `Severity: ${request.severity}`,
    `Reason: ${request.policyReason}`,
    `Args: ${JSON.stringify(request.argumentsSummary)}`
  ];

  if (request.recordHash) {
    lines.push(`Record hash: ${request.recordHash}`);
  }
  if (request.suggestedFix) {
    lines.push(`Suggested fix: ${request.suggestedFix}`);
  }
  if (request.decidedAt) {
    lines.push(`Decided: ${request.decidedAt}`);
  }
  if (request.decidedBy) {
    lines.push(`Decided by: ${request.decidedBy}`);
  }
  if (request.reason) {
    lines.push(`Decision reason: ${request.reason}`);
  }

  return lines.join("\n");
}

export function formatApprovalList(requests: readonly ApprovalRequest[]): string {
  if (requests.length === 0) {
    return "No approval requests found.";
  }

  return requests
    .map((request) => `${request.id}\t${request.status}\t${request.severity}\t${request.serverName}\t${request.toolName}\t${request.createdAt}`)
    .join("\n");
}

export function defaultApprovalStoreDir(): string {
  return process.env["MCP_SHIELD_APPROVAL_DIR"] ?? ".mcp-shield/approvals";
}

async function decideRequest(input: ApprovalDecisionInput, status: "approved" | "denied"): Promise<ApprovalRequest> {
  const existing = await readApprovalRequest(input.storeDir, input.id);
  if (!existing) {
    throw new Error(`Approval request not found: ${input.id}`);
  }

  const current = markExpiredIfNeeded(existing);
  if (current.status !== "pending") {
    throw new Error(`Approval request ${input.id} is already ${current.status}`);
  }

  const decided: ApprovalRequest = withRecordHash({
    ...stripRecordHash(current),
    status,
    decidedAt: nowIso(),
    decidedBy: input.decidedBy ?? "local-user",
    ...(input.reason ? { reason: input.reason } : {})
  });
  await writeApprovalRequest(input.storeDir, decided);
  return decided;
}

async function readApprovalRequestFromPath(path: string): Promise<ApprovalRequest | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (!isApprovalRequest(parsed)) {
      return null;
    }
    if (!verifyApprovalRecordIntegrity(parsed)) {
      throw new Error(`Approval request integrity check failed: ${parsed.id}`);
    }
    return parsed;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { readonly code?: unknown }).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeApprovalRequest(storeDir: string, request: ApprovalRequest): Promise<void> {
  await ensureStoreDir(storeDir);
  const path = approvalPath(storeDir, request.id);
  const tempPath = `${path}.${process.pid}.tmp`;
  const signed = withRecordHash(stripRecordHash(request));
  await writeFile(tempPath, `${JSON.stringify(signed, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(tempPath, path);
}

async function ensureStoreDir(storeDir: string): Promise<void> {
  await mkdir(storeDir, { recursive: true, mode: 0o700 });
}

function approvalPath(storeDir: string, id: string): string {
  return join(storeDir, `${id}.json`);
}

function markExpiredIfNeeded(request: ApprovalRequest): ApprovalRequest {
  if (request.status !== "pending") {
    return request;
  }

  if (Date.parse(request.expiresAt) <= Date.now()) {
    return withRecordHash({ ...stripRecordHash(request), status: "expired", decidedAt: nowIso(), reason: "Approval request expired before decision." });
  }

  return request;
}

function sanitizeArgs(args: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    output[key] = shouldRedactKey(key) ? "[REDACTED]" : summarizeValue(value);
  }
  return output;
}

function shouldRedactKey(key: string): boolean {
  return /token|secret|password|credential|api[_-]?key|authorization/i.test(key);
}

function summarizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length <= 200 ? value : `${value.slice(0, 197)}...`;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map(summarizeValue);
  }
  if (value && typeof value === "object") {
    return "[object]";
  }
  return value;
}

function withRecordHash(request: Omit<ApprovalRequest, "recordHash">): ApprovalRequest {
  return {
    ...request,
    recordHash: hashApprovalRecord(request)
  };
}

function stripRecordHash(request: ApprovalRequest): Omit<ApprovalRequest, "recordHash"> {
  const { recordHash: _recordHash, ...unsigned } = request;
  return unsigned;
}

function hashApprovalRecord(request: Omit<ApprovalRequest, "recordHash"> | ApprovalRequest): string {
  return hashStable(stripRecordHashIfPresent(request));
}

function stripRecordHashIfPresent(request: Omit<ApprovalRequest, "recordHash"> | ApprovalRequest): Omit<ApprovalRequest, "recordHash"> {
  const { recordHash: _recordHash, ...unsigned } = request as ApprovalRequest;
  return unsigned;
}

function hashStable(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isApprovalRequest(value: unknown): value is ApprovalRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly schemaVersion?: unknown }).schemaVersion === "1.0" &&
    typeof (value as { readonly id?: unknown }).id === "string" &&
    typeof (value as { readonly status?: unknown }).status === "string" &&
    isApprovalStatus((value as { readonly status?: unknown }).status) &&
    typeof (value as { readonly requestHash?: unknown }).requestHash === "string" &&
    (typeof (value as { readonly recordHash?: unknown }).recordHash === "undefined" || typeof (value as { readonly recordHash?: unknown }).recordHash === "string")
  );
}

function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return value === "pending" || value === "approved" || value === "denied" || value === "expired";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
