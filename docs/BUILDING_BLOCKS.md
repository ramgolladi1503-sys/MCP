# MCP Shield Building Blocks

This document defines how MCP Shield must be built feature by feature without turning into a fragile demo.

## Build rule

Every feature block must ship with:

- clear package ownership
- feature flag entry
- deterministic decision behavior
- unit tests
- integration or protocol tests where relevant
- attack fixture where relevant
- false-positive fixture where relevant
- audit behavior
- redaction behavior
- error behavior
- README or command help update

If any of these are missing, the feature is not done.

## Feature richness bar

A feature is considered production-safe only when it reaches at least 9/10 on this checklist:

1. The user problem is clear.
2. The security boundary is explicit.
3. The policy behavior is deterministic.
4. Failure behavior is defined.
5. Debug output is useful without leaking secrets.
6. Tests cover happy path, attack path, and false-positive path.
7. The feature can be disabled with a flag.
8. The CLI output explains what happened.
9. The implementation is small enough to review.
10. The feature integrates with audit and explain flows.

## Feature flag strategy

Feature flags protect the architecture while features are added in slices.

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

Default behavior:

```text
safe read-only analysis -> can be enabled early
runtime blocking -> off until tests prove it
config rewriting -> off until rollback is proven
response/resource/prompt mutation -> off until protocol tests pass
```

## Build sequence

### Block 0 — Foundation

Goal:

```text
Make the repository clean, typed, testable, and easy to debug.
```

Must include:

- TypeScript monorepo
- package boundaries
- shared contracts
- CLI shell
- policy skeleton
- scanner skeleton
- gateway evaluator skeleton
- audit/redaction skeleton
- config adapter skeleton
- architecture docs
- unit-test spine

Exit gate:

```text
pnpm install
pnpm typecheck
pnpm test
mcp-shield help
```

### Block 1 — Scanner v1

Goal:

```text
Detect risky MCP configs and malicious tool metadata before connection.
```

Features:

- MCP config parser
- metadata poisoning scanner
- dangerous capability scanner
- supply-chain launch scanner
- human + JSON report

Exit gate:

```text
mcp-shield scan examples/mcp-configs/unsafe-demo.json
```

must produce deterministic issues.

### Block 2 — Policy compiler

Goal:

```text
Make YAML policies safe, valid, and explainable before runtime.
```

Features:

- policy schema validation
- policy check command
- rule precedence
- unsafe config warnings
- dry-run fixture testing

Exit gate:

```text
mcp-shield policy check examples/policies/coding-agent.yaml
mcp-shield policy test --fixture attack-corpus/secret-env-read.json
```

### Block 3 — Gateway evaluator

Goal:

```text
Evaluate MCP tools/call requests before forwarding.
```

Features:

- JSON-RPC request parser
- tools/call context builder
- secure denial response
- audit event creation
- audit-only, balanced, strict modes

Exit gate:

```text
.env read -> BLOCK
rm -rf -> BLOCK
git push -> APPROVE or BLOCK depending mode
README read -> ALLOW
```

### Block 4 — stdio proxy

Goal:

```text
Run real MCP servers through MCP Shield without breaking protocol.
```

Features:

- child process launch
- stdout/stderr isolation
- line/framing handling
- lifecycle pass-through
- process cleanup
- timeout defaults

Exit gate:

```text
initialize passes
tools/list passes
tools/call safe path forwards
tools/call unsafe path blocks
```

### Block 5 — Audit, redaction, explain, replay

Goal:

```text
Make every decision inspectable without leaking secrets.
```

Features:

- redaction before logging
- JSONL event format
- hash-chained audit events
- explain command
- replay command
- log rotation basics

Exit gate:

```text
no raw secret appears in audit logs
mcp-shield explain evt_x shows rule, reason, matched input, and safe fix
```

### Block 6 — Config adapter

Goal:

```text
Wrap existing local MCP client configs safely.
```

Features:

- client config discovery
- transaction-safe backup
- protected config rewrite
- status command
- rollback command
- disable command

Exit gate:

```text
init -> protected config written
rollback -> exact original restored
disable -> last known good config restored
```

### Block 7 — Response/resource/prompt protection

Goal:

```text
Detect obvious poisoning outside direct tool calls.
```

Features:

- response inspector
- resources/list and resources/read inspection hooks
- prompts/list and prompts/get inspection hooks
- roots/sampling/elicitation safe defaults

Exit gate:

```text
response asking agent to read .env is warned or blocked
malicious prompt metadata is flagged
roots/list never exposes full home directory by default
```

### Block 8 — Attack corpus and compatibility harness

Goal:

```text
Prove the system blocks attacks and does not break safe workflows.
```

Minimum corpus:

- 20 attack fixtures
- 10 false-positive fixtures
- 5 manifest drift fixtures
- 5 response poisoning fixtures
- 5 config rewrite fixtures

Exit gate:

```text
100% critical attack block rate
0 raw secret leakage in logs
balanced false-positive rate below 10% on safe fixtures
strict false-positive rate below 20% on safe fixtures
```

## Hard cut rule

Safe to delay:

```text
Cursor support
Windows support
GitHub MCP support
fancy replay UI
SBOM
npm provenance
```

Not safe to delay:

```text
redaction
rollback
env scrubbing
secure denial response
path normalization
policy checker
audit-only mode
attack corpus
stdout/stderr isolation
process cleanup
```

## Final local MVP loop

The MVP is ready only when this loop works:

```text
install -> scan -> wrap -> audit-only -> strict mode -> block -> explain -> rollback
```

Anything less is a demo, not MCP Shield.
