# MCP Shield Architecture

## Product boundary

MCP Shield protects MCP-mediated actions only:

```text
AI agent / MCP client -> MCP Shield Gateway -> MCP servers -> local tools/resources
```

It does not sandbox the entire operating system and does not protect manual terminal commands or non-MCP malware.

## Architecture goals

The foundation is optimized for:

- fast local execution
- explainable policy decisions
- small package boundaries
- easy debugging
- deterministic tests
- feature-flagged rollout
- redaction-before-logging
- safe config rollback

## Package ownership

```text
packages/cli
```

User-facing command entrypoint. Owns command routing and console UX. It must not contain deep policy, scanner, gateway, or audit logic.

```text
packages/shared
```

Common contracts used across the product: decision types, audit events, JSON-RPC helpers, timestamps, fingerprints, and protocol-safe blocked responses.

```text
packages/policy
```

Policy schema, feature flags, rule precedence, and deterministic decision engine.

```text
packages/scanner
```

MCP config, tool metadata, schema, supply chain, scope, and drift scanning.

```text
packages/gateway
```

Runtime MCP boundary. Owns JSON-RPC request evaluation, forwarding decisions, and eventually stdio proxy/process lifecycle.

```text
packages/audit
```

Redaction, audit event serialization, append-only JSONL, explain, replay, and tamper-evident hash-chain behavior.

```text
packages/config-adapter
```

Client config discovery, transaction-safe rewrite, mapping files, status, rollback, and disable/emergency restore.

## Runtime flow

```text
1. Client sends JSON-RPC message.
2. Gateway parses message.
3. Lifecycle/resource/prompt/tool method is identified.
4. Tool calls are evaluated by policy before forwarding.
5. BLOCK returns a valid JSON-RPC error response.
6. ALLOW forwards to target server.
7. APPROVE asks for local confirmation when enabled.
8. WARN forwards and logs.
9. Response inspector scans server output where enabled.
10. Audit event is redacted before persistence.
```

## Debugging rules

- Protocol stdout must contain JSON-RPC only.
- Human logs must go to stderr or audit files.
- Every block must include event ID, rule ID, severity, and explain output.
- Every package must expose pure functions where possible before side effects are added.
- Every security feature needs attack and false-positive fixtures.

## Feature flags

Feature flags exist so risky capabilities can be integrated without destabilizing the whole product.

Initial flags:

```text
scanner
gateway
responseInspector
resourcePromptInspector
manifestDrift
tamperEvidentAudit
approvalPrompt
configRewrite
```

Default rule: incomplete features must be off unless they are safe read-only analysis.
