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

## Claude Desktop / Cursor validation shape

Use the same `examples/policies/real-world-demo.yaml` policy and wrap the demo MCP server through MCP Shield in the client config. Then ask the client to perform the same safe, approval-gated, and blocked actions.

The key proof is not the chat answer. The proof is:

1. Approval appears in `approval watch`.
2. Approved requests appear in the child call log only after approval.
3. Blocked requests never appear in the child call log.
4. Audit replay shows the full decision chain.
