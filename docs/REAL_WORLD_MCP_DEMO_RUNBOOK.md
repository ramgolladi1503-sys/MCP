# Real-world MCP demo runbook

This runbook proves MCP Shield behavior against a practical Git/Shell/DB MCP server instead of a toy one-off fixture.

## What this demo proves

- Safe Git/Shell/DB calls are forwarded to the child MCP server.
- Risky Git and SQL write calls are approval-gated in balanced mode.
- Blocked shell and SQL calls never reach the child MCP server.
- Side-channel approval uses the approval store and can be watched live.
- Audit replay includes normal decisions plus approval lifecycle events.

## Start the gateway

From the repository root:

```bash
rm -rf /tmp/mcp-shield-real-world-demo
mkdir -p /tmp/mcp-shield-real-world-demo

pnpm --filter @mcp-shield/cli dev -- gateway \
  --policy examples/policies/real-world-demo.yaml \
  --mode balanced \
  --server-name real-world-demo \
  --audit-file /tmp/mcp-shield-real-world-demo/audit.jsonl \
  --approval-dir /tmp/mcp-shield-real-world-demo/approvals \
  --approval-wait-ms 30000 \
  --approval-poll-ms 250 \
  --approval-ttl-ms 60000 \
  -- node examples/real-world-mcp-server/index.js /tmp/mcp-shield-real-world-demo/child-calls.jsonl
```

## Watch approvals in another terminal

```bash
pnpm --filter @mcp-shield/cli dev -- approval watch \
  --dir /tmp/mcp-shield-real-world-demo/approvals \
  --interval-ms 1000
```

## Send JSON-RPC messages manually

Paste one line at a time into the gateway terminal.

### Initialize

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

### Safe Git call — forwarded

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"git.status","arguments":{"command":"git status --short"}}}
```

### Risky Git call — waits for approval, then forwards

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"git.push","arguments":{"command":"git push origin main"}}}
```

Approve from the watcher output, or run:

```bash
pnpm --filter @mcp-shield/cli dev -- approval list --dir /tmp/mcp-shield-real-world-demo/approvals
pnpm --filter @mcp-shield/cli dev -- approval approve <approval_id> \
  --dir /tmp/mcp-shield-real-world-demo/approvals \
  --reason "Reviewed target branch and rollback plan"
```

### Blocked shell call — never forwarded

```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"shell.run","arguments":{"command":"sudo ./demo-workspace/maintenance.sh"}}}
```

### Safe DB read — forwarded

```json
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"db.query","arguments":{"query":"select id, email from users limit 5"}}}
```

### Risky DB write — waits for approval, then forwards

```json
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"db.query","arguments":{"query":"update users set role = 'admin' where id = 1"}}}
```

### Blocked DB schema change — never forwarded

```json
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"db.query","arguments":{"query":"alter table users add column demo_flag boolean"}}}
```

## Prove what reached the child server

```bash
cat /tmp/mcp-shield-real-world-demo/child-calls.jsonl
```

Expected: only forwarded calls appear. Blocked calls should be absent.

## Replay audit

```bash
pnpm --filter @mcp-shield/cli dev -- replay /tmp/mcp-shield-real-world-demo/audit.jsonl
```

Expected decisions include:

- `ALLOW`
- `BLOCK`
- `APPROVAL_REQUESTED`
- `APPROVAL_APPROVED`
- `APPROVAL_FORWARDED`

## Live Claude Desktop / Cursor demo config

The manual JSON-RPC flow above is still useful for deterministic debugging. For a real client demo, generate a ready MCP client config instead of hand-editing one by memory.

### Build first

```bash
pnpm install --frozen-lockfile
pnpm build
```

The generated config points to `packages/cli/dist/index.js`, so using it before `pnpm build` is a bad demo path.

### Generate Cursor config

```bash
rm -rf /tmp/mcp-shield-live-client-demo
mkdir -p /tmp/mcp-shield-live-client-demo

node scripts/generate-live-client-demo-config.mjs \
  --client cursor \
  --demo-dir /tmp/mcp-shield-live-client-demo \
  --output /tmp/mcp-shield-live-client-demo/cursor-mcp.json \
  --server-name mcp-shield-real-world-demo

cat /tmp/mcp-shield-live-client-demo/cursor-mcp.json
```

Copy the generated JSON into Cursor's MCP config, or use it as the exact server entry if you are merging it into an existing config.

### Generate Claude Desktop config

```bash
rm -rf /tmp/mcp-shield-live-client-demo
mkdir -p /tmp/mcp-shield-live-client-demo

node scripts/generate-live-client-demo-config.mjs \
  --client claude-desktop \
  --demo-dir /tmp/mcp-shield-live-client-demo \
  --output /tmp/mcp-shield-live-client-demo/claude-desktop-mcp.json \
  --server-name mcp-shield-real-world-demo

cat /tmp/mcp-shield-live-client-demo/claude-desktop-mcp.json
```

Copy the generated `mcpServers` object into Claude Desktop's config and restart Claude Desktop.

### Watch approvals while the client is running

```bash
pnpm --filter @mcp-shield/cli dev -- approval watch \
  --dir /tmp/mcp-shield-live-client-demo/approvals \
  --interval-ms 1000
```

### Ask the client to trigger the demo tools

Use prompts that map directly to the demo server tools:

1. Safe read path:

```text
Use the MCP Shield real-world demo MCP server to run git status.
```

2. Approval path:

```text
Use the MCP Shield real-world demo MCP server to push to origin main.
```

Approve the generated request from the watcher output:

```bash
pnpm --filter @mcp-shield/cli dev -- approval approve <approval_id> \
  --dir /tmp/mcp-shield-live-client-demo/approvals \
  --reason "Live demo approval after reviewing target branch"
```

3. Block path:

```text
Use the MCP Shield real-world demo MCP server to run sudo ./demo-workspace/maintenance.sh.
```

4. SQL approval path:

```text
Use the MCP Shield real-world demo MCP server to update user 1 to admin.
```

5. SQL block path:

```text
Use the MCP Shield real-world demo MCP server to alter the users table and add a demo_flag column.
```

### Prove the client demo actually worked

The chat answer is not proof. The files are proof.

```bash
cat /tmp/mcp-shield-live-client-demo/child-calls.jsonl
pnpm --filter @mcp-shield/cli dev -- replay /tmp/mcp-shield-live-client-demo/audit.jsonl
```

Expected proof:

1. Safe calls appear in `child-calls.jsonl`.
2. Approved calls appear in `child-calls.jsonl` only after approval.
3. Blocked calls are absent from `child-calls.jsonl`.
4. Audit replay shows `APPROVAL_REQUESTED`, `APPROVAL_APPROVED`, and `APPROVAL_FORWARDED` for approved risky calls.

If the client claims it performed a blocked action but the child call log does not contain that request, MCP Shield did its job. Do not judge the demo by model wording; judge it by the child-call proof log and audit events.
