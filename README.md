# MCP Shield

Local-first runtime security gateway for MCP tools and AI agents — block unsafe tool calls, secret access, prompt-injected tools, destructive commands, and suspicious MCP behavior before execution.

MCP Shield sits between AI agents and MCP servers so unsafe actions can be scanned, audited, approved, or blocked before execution.

## Build philosophy

This repository will be built from the MCP Shield project bible with a strict engineering rule: clean architecture first, feature blocks second.

The goal is not a fragile demo. The goal is a fast, debuggable, local-first security gateway that can grow feature by feature without becoming messy.

## Core principles

- Explainable decisions over black-box blocking.
- Local-first execution and audit by default.
- Feature flags for risky or incomplete capabilities.
- Small packages with clear ownership.
- Deterministic policy behavior.
- Redaction before logging.
- Tests and attack fixtures for every security feature.

## Planned foundation

```text
packages/
  cli/              Command entrypoint and user-facing commands
  shared/           Shared types, JSON-RPC helpers, errors, hashing, time utilities
  policy/           Policy schema, compiler, decision engine, rule precedence
  scanner/          MCP config, manifest, metadata, schema, and drift scanning
  gateway/          stdio MCP proxy, protocol router, enforcement hooks
  audit/            redaction, append-only audit events, explain/replay support
  config-adapter/   client detection, config rewrite, status, rollback, disable
  attack-corpus/    attack and false-positive fixtures

examples/
  policies/
  mcp-configs/
  poisoned-repo/

docs/
  ARCHITECTURE.md
  THREAT_MODEL.md
  RUNBOOK.md
  KNOWN_LIMITATIONS.md
```

## MVP cut line

The first build target is a production-safe local developer MVP:

```text
install -> scan -> wrap -> audit-only -> strict mode -> block -> explain -> rollback
```

Anything that does not support this loop is not part of the first implementation wave.

## Current status

Architecture foundation is being created first. Implementation will follow in small, testable feature slices.
