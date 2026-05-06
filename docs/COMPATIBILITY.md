# MCP Shield Compatibility Verification

This document defines what MCP Shield currently verifies for local MCP client compatibility.

## Supported verification level

Current status:

```text
Claude Desktop config shape: fixture verified
Cursor config shape: fixture verified
stdio gateway: basic protocol pass-through implemented
real app end-to-end verification: still manual
```

## Claude Desktop fixture

Fixture:

```text
examples/mcp-configs/claude-desktop-compatible.json
```

Expected shape:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

## Cursor fixture

Fixture:

```text
examples/mcp-configs/cursor-compatible.json
```

Expected shape:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@package@version", "./workspace"]
    }
  }
}
```

## Config adapter commands

Custom config dry run style:

```bash
pnpm --filter @mcp-shield/cli dev -- status --client custom --config examples/mcp-configs/claude-desktop-compatible.json
```

Rewrite test on a copied config only:

```bash
cp examples/mcp-configs/claude-desktop-compatible.json /tmp/mcp-shield-claude-demo.json
pnpm --filter @mcp-shield/cli dev -- init --client custom --config /tmp/mcp-shield-claude-demo.json --policy examples/policies/coding-agent.yaml --mode strict
pnpm --filter @mcp-shield/cli dev -- status --client custom --config /tmp/mcp-shield-claude-demo.json
pnpm --filter @mcp-shield/cli dev -- rollback --client custom --config /tmp/mcp-shield-claude-demo.json
```

## Manual real-client verification

Do not run rewrite directly against a real user config until the copied-config flow passes.

Required manual checks:

1. Close the MCP client.
2. Back up the real config manually.
3. Run `mcp-shield init`.
4. Reopen the MCP client.
5. Confirm tools still list.
6. Trigger safe read.
7. Trigger blocked unsafe request through demo.
8. Confirm audit file exists.
9. Run rollback.
10. Confirm original config is restored.

## Known limitations

- Windows path behavior is not fully verified.
- Real Claude Desktop and Cursor behavior must be checked manually before release.
- Config adapter currently focuses on JSON config shapes with `mcpServers` or object-style `servers`.
- Multi-profile client configs are not supported yet.
