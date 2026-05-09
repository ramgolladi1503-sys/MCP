import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  approveRequest,
  denyRequest,
  listApprovalRequests,
  readApprovalRequest
} from "@mcp-shield/gateway";

export interface ApprovalConsoleOptions {
  readonly storeDir: string;
  readonly host?: string;
  readonly port?: number;
}

interface DecisionBody {
  readonly reason?: string;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 6277;
const MAX_BODY_BYTES = 32 * 1024;

export async function startApprovalConsole(options: ApprovalConsoleOptions): Promise<void> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(request, response, options.storeDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown approval console failure";
      writeJson(response, 500, { error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address() as AddressInfo;
  process.stdout.write(`MCP Shield approval console listening on http://${address.address}:${address.port}\n`);
  process.stdout.write(`Approval store: ${options.storeDir}\n`);

  await new Promise<void>((resolve) => {
    const stop = (): void => {
      server.close(() => resolve());
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

async function routeRequest(request: IncomingMessage, response: ServerResponse, storeDir: string): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (method === "GET" && url.pathname === "/") {
    writeHtml(response, renderApprovalConsoleHtml());
    return;
  }

  if (method === "GET" && url.pathname === "/healthz") {
    writeJson(response, 200, { ok: true });
    return;
  }

  if (method === "GET" && url.pathname === "/api/approvals") {
    const approvals = await listApprovalRequests(storeDir);
    writeJson(response, 200, {
      storeDir,
      generatedAt: new Date().toISOString(),
      approvals
    });
    return;
  }

  const decisionMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)\/(approve|deny)$/);
  if (method === "POST" && decisionMatch) {
    const id = decodeURIComponent(decisionMatch[1]);
    const action = decisionMatch[2];
    const body = await readDecisionBody(request);
    const reason = normalizeReason(body.reason);
    const existing = await readApprovalRequest(storeDir, id);
    if (!existing) {
      writeJson(response, 404, { error: `Approval request not found: ${id}` });
      return;
    }

    const decided =
      action === "approve"
        ? await approveRequest({ storeDir, id, reason, decidedBy: "approval-console" })
        : await denyRequest({ storeDir, id, reason, decidedBy: "approval-console" });
    writeJson(response, 200, { approval: decided });
    return;
  }

  if (method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  writeJson(response, 404, { error: "Not found" });
}

async function readDecisionBody(request: IncomingMessage): Promise<DecisionBody> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (text.length === 0) {
    return {};
  }

  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) {
    return {};
  }

  return {
    ...(typeof parsed.reason === "string" ? { reason: parsed.reason } : {})
  };
}

function normalizeReason(reason: string | undefined): string | undefined {
  const normalized = reason?.trim();
  return normalized && normalized.length > 0 ? normalized.slice(0, 500) : undefined;
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function writeHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "http://127.0.0.1",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function renderApprovalConsoleHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MCP Shield Approval Console</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #0b1020; color: #e5e7eb; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 28px; letter-spacing: -0.03em; }
    .subtitle { margin: 8px 0 0; color: #94a3b8; max-width: 720px; line-height: 1.45; }
    .pill { border: 1px solid #334155; border-radius: 999px; padding: 8px 12px; color: #cbd5e1; background: #111827; white-space: nowrap; }
    .grid { display: grid; gap: 16px; }
    .card { border: 1px solid #1f2937; background: #111827; border-radius: 18px; padding: 18px; box-shadow: 0 18px 60px rgb(0 0 0 / 0.25); }
    .row { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .meta { color: #94a3b8; font-size: 13px; }
    .status { font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; }
    .pending { color: #fbbf24; }
    .approved { color: #34d399; }
    .denied, .expired { color: #fb7185; }
    .severity { color: #f97316; }
    pre { margin: 12px 0 0; white-space: pre-wrap; word-break: break-word; background: #020617; border: 1px solid #1e293b; padding: 12px; border-radius: 12px; color: #cbd5e1; }
    button { border: 0; border-radius: 12px; padding: 10px 14px; font-weight: 700; cursor: pointer; color: #020617; margin-left: 8px; }
    button.approve { background: #34d399; }
    button.deny { background: #fb7185; }
    button.refresh { background: #93c5fd; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .empty { text-align: center; color: #94a3b8; padding: 48px 16px; border: 1px dashed #334155; border-radius: 18px; }
    .footer { margin-top: 20px; color: #64748b; font-size: 13px; }
    @media (max-width: 720px) { header, .row { display: block; } button { margin: 8px 8px 0 0; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>MCP Shield Approval Console</h1>
        <p class="subtitle">Review high-risk MCP tool calls before they are forwarded. The gateway stays paused until a side-channel decision is recorded.</p>
      </div>
      <button class="refresh" onclick="loadApprovals()">Refresh</button>
    </header>
    <section class="card">
      <div class="row">
        <div>
          <div class="meta">Approval store</div>
          <div id="store" class="pill">loading...</div>
        </div>
        <div>
          <div class="meta">Last updated</div>
          <div id="updated" class="pill">loading...</div>
        </div>
      </div>
    </section>
    <section id="approvals" class="grid" style="margin-top: 16px;"></section>
    <p class="footer">Hard rule: approve only after reading the tool, args, matched rule, and expected blast radius. When unsure, deny.</p>
  </main>
  <script>
    async function loadApprovals() {
      const response = await fetch('/api/approvals');
      const data = await response.json();
      document.getElementById('store').textContent = data.storeDir;
      document.getElementById('updated').textContent = data.generatedAt;
      render(data.approvals || []);
    }

    function render(approvals) {
      const target = document.getElementById('approvals');
      if (approvals.length === 0) {
        target.innerHTML = '<div class="empty">No approval requests found.</div>';
        return;
      }
      target.innerHTML = approvals.map(renderApproval).join('');
    }

    function renderApproval(item) {
      const isPending = item.status === 'pending';
      const args = escapeHtml(JSON.stringify(item.argumentsSummary || {}, null, 2));
      return '<article class="card">' +
        '<div class="row">' +
          '<div>' +
            '<div class="status ' + escapeHtml(item.status) + '">' + escapeHtml(item.status) + '</div>' +
            '<h2>' + escapeHtml(item.serverName) + ' / ' + escapeHtml(item.toolName) + '</h2>' +
            '<div class="meta">' + escapeHtml(item.id) + '</div>' +
          '</div>' +
          '<div>' +
            '<button class="approve" ' + disabled(isPending) + ' onclick="decide(\'' + escapeJs(item.id) + '\', \'approve\')">Approve</button>' +
            '<button class="deny" ' + disabled(isPending) + ' onclick="decide(\'' + escapeJs(item.id) + '\', \'deny\')">Deny</button>' +
          '</div>' +
        '</div>' +
        '<p><strong>Rule:</strong> ' + escapeHtml(item.ruleId) + ' <span class="severity">' + escapeHtml(item.severity) + '</span></p>' +
        '<p><strong>Reason:</strong> ' + escapeHtml(item.policyReason) + '</p>' +
        (item.suggestedFix ? '<p><strong>Suggested fix:</strong> ' + escapeHtml(item.suggestedFix) + '</p>' : '') +
        '<div class="meta">Created: ' + escapeHtml(item.createdAt) + ' | Expires: ' + escapeHtml(item.expiresAt) + '</div>' +
        (item.reason ? '<p><strong>Decision reason:</strong> ' + escapeHtml(item.reason) + '</p>' : '') +
        '<pre>' + args + '</pre>' +
      '</article>';
    }

    async function decide(id, action) {
      const reason = window.prompt(action === 'approve' ? 'Approval reason' : 'Denial reason', action === 'approve' ? 'Reviewed and approved from approval console' : 'Denied from approval console');
      if (reason === null) return;
      const response = await fetch('/api/approvals/' + encodeURIComponent(id) + '/' + action, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'Decision failed');
      }
      await loadApprovals();
    }

    function disabled(isPending) { return isPending ? '' : 'disabled'; }
    function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function escapeJs(value) { return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
    loadApprovals();
    setInterval(loadApprovals, 2000);
  </script>
</body>
</html>`;
}
