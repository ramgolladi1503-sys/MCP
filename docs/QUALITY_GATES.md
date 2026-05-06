# MCP Shield Quality Gates

This file is the engineering guardrail for keeping MCP Shield fast, debuggable, explainable, and production-safe.

## Global gates

A pull request cannot be considered healthy unless these pass:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:corpus
```

During early foundation work, some commands may be skeletons. That is acceptable only if the PR states what is still missing and the next feature block closes it.

## Architecture gate

Every package must have one job:

```text
cli              command routing and terminal UX only
shared           contracts and protocol-safe helpers only
policy           deterministic decisions only
scanner          pre-connect scanning only
gateway          JSON-RPC/MCP runtime enforcement only
audit            redaction, audit serialization, explain/replay only
config-adapter   config discovery, rewrite, rollback, disable only
```

Bad signs:

- CLI directly implements policy logic.
- Gateway writes raw logs without audit package.
- Scanner mutates config files.
- Policy reads process environment.
- Shared package imports feature packages.

## Debuggability gate

Every runtime feature must expose enough information to debug without leaking secrets:

- event ID
- rule ID
- severity
- decision
- matched summary
- suggested safe fix
- feature flag state where relevant

Never print secrets, full tool responses, private key blocks, raw authorization headers, or full `.env` contents.

## Security gate

Security behavior must be fail-safe:

- redaction before logging
- BLOCK beats APPROVE
- malformed high-risk tool calls do not forward
- strict mode blocks when policy state is uncertain
- audit-only mode can warn without blocking
- config rewrite never proceeds without backup
- stdout remains protocol-only for stdio gateway

## Test gate

Every meaningful feature needs at least two concrete test examples:

### Attack examples

- `.env` read is blocked.
- `rm -rf ./src` is blocked.

### False-positive examples

- `.env.example` read is allowed.
- `README.md` read is allowed.

More examples are required as each feature grows, but these are the minimum style standard.

## Feature flag gate

Incomplete runtime features must be behind feature flags.

Required behavior:

```text
off -> no side effects
audit-only -> observe and log what would happen
balanced -> block critical, approve high-risk, warn medium
strict -> block critical/high, approve medium, warn low
```

## Performance gate

Targets for the local MVP:

```text
simple policy decision     under 50ms
small config scan          under 2s
gateway startup demo       under 3s
audit write overhead       under 20ms target
```

Do not add heavy dependencies unless there is a direct reason.

## Done definition

A feature is done only when it has:

- implementation
- unit test
- integration/protocol test where relevant
- attack fixture where relevant
- false-positive fixture where relevant
- audit behavior
- redaction behavior
- error behavior
- docs/help update

If a feature cannot explain its decision, it is not done.
