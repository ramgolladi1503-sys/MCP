# MCP Shield Five-Minute Demo

This demo proves the local MVP loop:

```text
scan -> policy check -> gateway strict mode -> block .env read -> block rm -rf -> replay audit -> explain decision
```

## 1. Install

```bash
pnpm install
pnpm build
```

## 2. Scan unsafe MCP config

```bash
pnpm --filter @mcp-shield/cli dev -- scan examples/mcp-configs/unsafe-demo.json
```

Expected result:

```text
Overall risk: CRITICAL
```

The scanner should flag broad filesystem scope, shell launchers, sensitive env exposure, remote endpoints, and supply-chain risks.

## 3. Check policy

```bash
pnpm --filter @mcp-shield/cli dev -- policy check examples/policies/coding-agent.yaml
```

Expected result:

```text
Policy valid: yes
```

Warnings are acceptable only when they are intentional and documented.

## 4. Start gateway with malicious demo server

```bash
pnpm --filter @mcp-shield/cli dev -- gateway \
  --policy examples/policies/coding-agent.yaml \
  --mode strict \
  --server-name malicious-demo \
  --audit-file .mcp-shield/audit.jsonl \
  -- node examples/malicious-mcp-server/index.js
```

The gateway uses stdio. Keep protocol messages on stdout only. Human logs go to stderr.

## 5. Send initialize

Paste this into gateway stdin:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

Expected result: forwarded initialize response from demo server.

## 6. Send tools/list

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

Expected result: tools list is forwarded.

## 7. Block .env read

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"filesystem.read_file","arguments":{"path":".env"}}}
```

Expected result:

```json
{"jsonrpc":"2.0","id":3,"error":{"code":-32001,"message":"MCP Shield blocked this tool call",...}}
```

The malicious server must not receive this tool call.

## 8. Block destructive command

```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"shell.run","arguments":{"command":"rm -rf ./src"}}}
```

Expected result: blocked JSON-RPC error.

## 9. Replay audit

Stop the gateway, then run:

```bash
pnpm --filter @mcp-shield/cli dev -- replay .mcp-shield/audit.jsonl
```

Expected result:

```text
Total events: 2
By decision:
- BLOCK: 2
```

## 10. Explain one decision

Copy an event ID from the audit log or replay output:

```bash
pnpm --filter @mcp-shield/cli dev -- explain .mcp-shield/audit.jsonl evt_xxx
```

Expected result:

```text
Decision: BLOCK
Rule: secret.path.blocked
Reason: Attempted access to a blocked sensitive path
Fix: Use a safer input, adjust policy intentionally, or run audit-only mode to inspect behavior before enforcement.
```

## What this demo proves

- Scanner catches risky MCP setup before connection.
- Policy can be loaded and validated.
- Gateway can run a stdio MCP server.
- JSON-RPC pass-through works for initialize and tools/list.
- tools/call enforcement blocks secret reads and destructive commands.
- Block responses are protocol-safe.
- Audit logs are written locally.
- Replay and explain make decisions understandable.

## What this demo does not prove yet

- Full MCP protocol conformance.
- Production-grade process sandboxing.
- Response/resource/prompt poisoning controls.
- Lockfile drift detection.
- Multi-client compatibility.
- Windows support.

Those are next hardening blocks.
