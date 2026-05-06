# MCP Shield MVP Release Checklist

This checklist is the hard gate before calling MCP Shield a real local MVP.

## Automated gates

Run all of these locally and in CI:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:corpus
pnpm test:integration
pnpm --filter @mcp-shield/cli dev -- scan examples/mcp-configs/unsafe-demo.json
pnpm --filter @mcp-shield/cli dev -- policy check examples/policies/coding-agent.yaml
```

Expected scanner behavior:

```text
unsafe-demo.json exits with code 2 because high/critical findings are expected
safe-demo.json exits with code 0
```

## Protocol gates

The stdio gateway must prove:

- stdout contains JSON-RPC messages only
- stderr contains human diagnostics only
- initialize passes through
- tools/list passes through
- safe tools/call forwards
- blocked tools/call does not reach the child server
- audit file records allowed and blocked calls
- late responses after timeout are dropped
- cancellation clears pending request tracking
- server-initiated sampling and elicitation are blocked by default
- roots/list only returns configured workspace roots

## Security gates

The product must prove:

- `.env` reads are blocked
- private key patterns are blocked by policy or redacted in audit
- destructive command patterns are blocked
- response poisoning is blocked or warned
- prompt retrieval is audited
- resource reads are policy checked
- audit logs never contain raw authorization headers, database URLs, private keys, or obvious tokens
- config rewrite always creates a backup before replacing the config
- rollback restores the original config exactly

## Compatibility gates

Run against copied configs first:

```bash
cp examples/mcp-configs/claude-desktop-compatible.json ./claude-copy.json
pnpm --filter @mcp-shield/cli dev -- init --client custom --config ./claude-copy.json --policy examples/policies/coding-agent.yaml --mode strict
pnpm --filter @mcp-shield/cli dev -- status --client custom --config ./claude-copy.json
pnpm --filter @mcp-shield/cli dev -- rollback --client custom --config ./claude-copy.json
```

Repeat the same flow with:

```text
examples/mcp-configs/cursor-compatible.json
```

Do not rewrite a real Claude Desktop or Cursor config until copied-config validation passes.

## Demo gates

Follow:

```text
docs/DEMO.md
```

The demo must show:

- scanner catches unsafe config
- policy check passes
- gateway starts malicious demo server
- initialize passes through
- tools/list passes through
- safe call forwards
- protected call blocks
- audit replay summarizes blocked decision
- explain prints rule, reason, and fix

## MVP definition

MCP Shield reaches MVP only when this loop works end to end:

```text
install -> scan -> policy check -> wrap copied config -> gateway -> audit-only -> strict -> block -> explain -> replay -> rollback
```

Anything less is not the MVP; it is a partial slice.
