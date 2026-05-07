# MCP Shield Demo Workflow

This is the script-ready workflow for a short demo video or live walkthrough.

It proves the local MVP loop:

```text
install -> scan -> policy check -> install/wrap -> strict gateway -> block -> replay -> explain -> rollback
```

## Demo promise

By the end of this demo, the viewer should see MCP Shield do four concrete things:

1. Detect a risky MCP setup before connection.
2. Block unsafe runtime tool calls before the server receives them.
3. Persist redacted, tamper-evident audit events.
4. Restore the original MCP client config through rollback.

## 0. Clean starting point

```bash
rm -rf .mcp-shield
pnpm install
pnpm build
pnpm test:hardening
```

Expected result:

```text
MCP Shield smoke test passed.
```

Narration:

> First, I prove this is not just a README demo. The hardening suite runs unit tests, integration tests, malicious corpus tests, and smoke tests against actual commands.

---

## 1. Scan unsafe MCP config

```bash
pnpm --filter @mcp-shield/cli dev -- scan examples/mcp-configs/unsafe-demo.json
```

Expected result:

```text
Overall risk: CRITICAL
```

Narration:

> This config is intentionally unsafe. The scanner flags broad filesystem scope, shell entrypoints, sensitive environment exposure, remote endpoints, and supply-chain risks before anything is connected.

Note: this command may exit with code `2`. That is intentional for high/critical findings.

---

## 2. Validate policy

```bash
pnpm --filter @mcp-shield/cli dev -- policy check examples/policies/coding-agent.yaml
```

Expected result:

```text
Policy valid: yes
Default action: allow
```

Narration:

> The policy is checked before runtime. Bad policy shape should fail before the gateway starts.

---

## 3. Create a temporary MCP client config

```bash
cat > /tmp/mcp-shield-demo-mcp.json <<'JSON'
{
  "mcpServers": {
    "malicious-demo": {
      "command": "node",
      "args": ["examples/malicious-mcp-server/index.js"]
    }
  }
}
JSON

cat /tmp/mcp-shield-demo-mcp.json
```

Narration:

> This simulates a local MCP client config before MCP Shield protects it.

---

## 4. Install protection / wrap the config

```bash
pnpm --filter @mcp-shield/cli dev -- init \
  --client custom \
  --config /tmp/mcp-shield-demo-mcp.json \
  --policy examples/policies/coding-agent.yaml \
  --mode strict
```

Expected result:

```text
Protected 1 MCP server(s).
Backup: /tmp/.mcp-shield/backups/mcp-shield-demo-mcp.json.bak
Mapping: /tmp/.mcp-shield/config-map.json
```

Show the rewritten config:

```bash
cat /tmp/mcp-shield-demo-mcp.json
```

Expected proof:

```text
"command": "mcp-shield"
"gateway"
"--mode"
"strict"
"--server-name"
"malicious-demo"
```

Narration:

> The original server is now wrapped through MCP Shield. A backup and mapping file are created before rewriting, so rollback is possible.

---

## 5. Verify protected status

```bash
pnpm --filter @mcp-shield/cli dev -- status \
  --client custom \
  --config /tmp/mcp-shield-demo-mcp.json
```

Expected result:

```text
Protected: yes
Servers: 1
```

Narration:

> The status command shows whether the config is protected and whether rollback state exists.

---

## 6. Start strict gateway

```bash
pnpm --filter @mcp-shield/cli dev -- gateway \
  --policy examples/policies/coding-agent.yaml \
  --mode strict \
  --server-name malicious-demo \
  --audit-file .mcp-shield/audit.jsonl \
  -- node examples/malicious-mcp-server/index.js
```

The gateway uses stdio. Keep protocol messages on stdout only. Human logs go to stderr.

Narration:

> Now the gateway sits between the client and the MCP server. Safe lifecycle calls pass through. Dangerous tool calls are evaluated before forwarding.

---

## 7. Send safe lifecycle messages

Paste into gateway stdin:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

Then:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

Expected result: both are forwarded to the demo server and return JSON-RPC responses.

Narration:

> MCP Shield is not blindly blocking everything. It preserves normal MCP protocol flow.

---

## 8. Block `.env` read

Paste:

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"filesystem.read_file","arguments":{"path":".env"}}}
```

Expected result:

```json
{"jsonrpc":"2.0","id":3,"error":{"code":-32001,"message":"MCP Shield blocked this tool call"}}
```

Narration:

> The `.env` read is blocked before the malicious server receives it.

---

## 9. Block destructive shell command

Paste:

```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"shell.run","arguments":{"command":"rm -rf ./src"}}}
```

Expected result: blocked JSON-RPC error.

Narration:

> Strict mode blocks destructive commands. This is the core runtime security value.

Stop the gateway with `Ctrl+C`.

---

## 10. Replay audit

```bash
pnpm --filter @mcp-shield/cli dev -- replay .mcp-shield/audit.jsonl
```

Expected result:

```text
Total events: 2
By decision:
- BLOCK: 2
```

Narration:

> The audit replay shows what happened without exposing secrets.

---

## 11. Explain a blocked decision

Find an event ID:

```bash
cat .mcp-shield/audit.jsonl
```

Then run:

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

Narration:

> Every block is explainable: decision, severity, rule, reason, matched context, mode, and a safe fix.

---

## 12. Roll back config

```bash
pnpm --filter @mcp-shield/cli dev -- rollback \
  --client custom \
  --config /tmp/mcp-shield-demo-mcp.json

cat /tmp/mcp-shield-demo-mcp.json
```

Expected result:

```text
Restored: /tmp/mcp-shield-demo-mcp.json
```

The restored config should again contain:

```json
"command": "node"
```

Narration:

> Rollback restores the original config. Without this, config rewrite is too risky for a real developer tool.

---

## Final closing line

> MCP Shield is not a chatbot wrapper. It is a local runtime security gateway for MCP tools: scan before connection, enforce before execution, audit without leaking secrets, and roll back safely.

## What this demo proves

- Scanner catches risky MCP setup before connection.
- Policy can be loaded and validated.
- Config rewrite creates rollback state before modifying user config.
- Gateway can run a stdio MCP server.
- JSON-RPC pass-through works for initialize and tools/list.
- tools/call enforcement blocks secret reads and destructive commands.
- Block responses are protocol-safe.
- Audit logs are redacted and replayable.
- Explain output makes decisions understandable.
- Rollback restores the original config.

## What this demo does not prove yet

- Full MCP protocol conformance across all clients.
- Production-grade OS process sandboxing.
- Lockfile drift detection.
- Multi-client compatibility beyond current config-adapter support.
- Windows support.

Those are next hardening blocks.
