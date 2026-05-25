# Agent Review Evidence — PR #45 Tradebot Adapter Config

## Agent Work Contract

Goal: add a Tradebot Agent Review config example and a focused contract test without coupling this repo to the Tradebot repository.

Files changed:

- `examples/agent-review/tradebot.agent-review.yaml`
- `tests/unit/agent-review/tradebot-config.test.ts`
- `docs/agent_reviews/pr_45_tradebot_adapter_config.md`

Evidence contract fields:

mode: CONTRACT_ONLY
candidate_id: PR_45_TRADEBOT_ADAPTER_CONFIG
decision: TRADEBOT_ADAPTER_CONFIG
reason: Adds a Tradebot adapter config example and loader/classifier contract test without changing MCP runtime, CI, release, package metadata, lockfile behavior, or any broker/execution behavior.
is_runtime_change: false
is_security_runtime_change: false
child_mcp_forwarding_changed: false
policy_behavior_changed: false
approval_behavior_changed: false
audit_schema_changed: false
trace_behavior_changed: false
scanner_behavior_changed: false
cli_behavior_changed: false
config_adapter_behavior_changed: false
release_behavior_changed: false
ci_behavior_changed: false
source: docs/agent_reviews/pr_45_tradebot_adapter_config.md

Non-goals:

- No MCP gateway runtime changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.
- No scanner behavior changes.
- No CLI behavior changes.
- No CI enforcement changes.
- No package extraction or publish metadata.
- No Tradebot repository changes.
- No broker adapter behavior changes.
- No live order behavior changes.
- No profitability claims.

## Grill Me Review

Tradebot support is useful only if it preserves trading-system safety boundaries. This PR adds config-level proof expectations for strategy, risk, market data, execution, tests, docs, and config paths.

Required proof:

- Config loads through `loadAgentReviewConfig`.
- Config validates as `tradebot`.
- Tradebot-style paths classify into expected areas.
- Strategy changes require evidence-backed behavior proof.
- Risk changes require rejection and fail-closed proof.
- Market data changes require stale/missing-data proof.
- Execution changes require paper/live boundary proof.
- No runtime claims.
- Scope is explicit.
- Future runtime proof stated if relevant.

## Hermes Review

The Tradebot adapter config is an example contract only. It does not inspect, import, or execute the Tradebot repository.

It defines defaults for:

- strategy files
- risk and gating files
- market-data files
- execution/order files
- tests and fixtures
- docs and runbooks
- configuration and dependency files

## GSD Review

This PR adds one example config, one focused unit test, and one evidence document.

The unit test uses deterministic changed-file inputs:

- `strategies/nifty_intraday.py`
- `core/risk/limits.py`
- `core/feed/market_feed.py`
- `core/execution/orders.py`
- `tests/test_risk_limits.py`
- `docs/RUNBOOK_LIVE.md`
- `config/config.py`

No fake progress: this PR does not claim broker safety, execution safety, profitability, external repo installation, or runtime validation.

## Security Review

No runtime MCP security behavior changes.

Confirmed not touched:

- child MCP forwarding
- policy decisions
- approval lifecycle
- audit events
- scanner rules
- config adapter behavior
- CLI runtime behavior
- CI scope guard behavior
- Tradebot broker behavior
- live execution behavior

The config includes trading-system safety expectations such as stale-feed fail-closed proof, strict paper/live boundary proof, risk rejection proof, and no profitability claim without evidence. Those are config contract expectations only.

## QA / Failure Review

Added test command:

```bash
pnpm test:unit -- tests/unit/agent-review/tradebot-config.test.ts
```

The test proves:

- config loader can load the Tradebot example
- schema/profile/metadata/default command fields validate
- changed-file classifier maps Tradebot-style paths into expected areas
- required proof strings attach to expected areas

This PR is contract-only and example-config-only, so no runtime negative test is required.

## Scope Guard

Touched intentionally:

- `examples/agent-review/tradebot.agent-review.yaml`
- `tests/unit/agent-review/tradebot-config.test.ts`
- `docs/agent_reviews/pr_45_tradebot_adapter_config.md`

Confirmed not touched:

- `packages/gateway`
- `packages/policy`
- `packages/scanner`
- `packages/audit`
- `packages/cli`
- `packages/config-adapter`
- `.github/workflows/ci.yml`
- `scripts/release*`
- `package.json`
- `pnpm-lock.yaml`

## Acceptance Proof

Required commands:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test:unit -- tests/unit/agent-review/tradebot-config.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Tradebot config loads successfully.
- Classifier maps strategy, risk, market data, execution, tests, docs, and config paths correctly.
- Existing Agent Review Kit tests remain green.
- Existing CI scope guard remains unchanged.
- Existing release dry-run remains unchanged.

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR is config/example/contract-only.

Future runtime proof is required only if a later PR wires this config into a real Tradebot repository or generator command.

## What This PR Does Not Prove

This PR does not prove broker safety, live execution safety, profitability, external repository installation, adapter generator behavior, MCP Shield runtime behavior, CI enforcement changes, or release changes.

It proves only that a Tradebot Agent Review config example can be loaded and used by the current loader/classifier.

## Human Approval

Proceed only if reviewers agree this PR is the next small reusable-adapter step after PR #44 and that it intentionally avoids runtime, CI, release, broker, and package extraction changes.
