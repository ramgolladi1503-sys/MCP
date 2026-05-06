# MCP Protocol Conformance Harness

This document defines the minimum protocol checks MCP Shield must pass before the gateway can be called production-safe.

## Current implemented checks

Covered by unit tests:

```text
initialize pass-through
tools/list pass-through
resources/list pass-through
prompts/list pass-through
ping pass-through
tools/call allow path
tools/call block path
resources/read policy evaluation
prompts/get audit hook
invalid tools/call secure denial response
JSON-RPC response parsing
response inspection block/warn/allow
protocol-safe JSON serialization
```

## Required integration harness

The integration harness should run a real stdio child MCP server and verify stdout/stderr behavior.

Required scenarios:

```text
1. initialize request reaches child server and response returns unchanged
2. tools/list request reaches child server and response returns unchanged
3. safe tools/call reaches child server
4. blocked tools/call does not reach child server
5. child stderr is forwarded only to parent stderr
6. no gateway human log appears on stdout
7. malformed client JSON is dropped safely
8. server-initiated roots/list returns only configured workspace roots
9. server-initiated sampling/createMessage is blocked by default
10. server-initiated elicitation/create is blocked by default
11. request timeout returns JSON-RPC timeout error
12. cancellation removes pending request tracking
13. late response after timeout is dropped
```

## Acceptance rule

The gateway cannot be considered production-ready until this harness runs in CI.

Current status:

```text
unit-level protocol coverage exists
full child-process integration harness still required
```

## Stdout rule

For stdio MCP, stdout is protocol-critical.

Allowed on stdout:

```text
valid JSON-RPC messages only
```

Not allowed on stdout:

```text
human logs
stack traces
warnings
debug messages
child stderr
```

Human diagnostics must go to stderr or audit logs.

## Timeout defaults

```text
startup_timeout_ms: 10000
tool_call_timeout_ms: 60000
```

A timed-out request must return a valid JSON-RPC error and must not corrupt the protocol stream.

## Reverse request defaults

```text
roots/list -> return only configured workspace roots
sampling/createMessage -> block by default
elicitation/create -> block by default
```

No gateway path may expose the full home directory by default.
