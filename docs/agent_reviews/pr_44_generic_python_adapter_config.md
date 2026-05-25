# Agent Review Evidence — PR #44 Generic Python Adapter Config

## Agent Work Contract

Goal: add a reusable generic Python Agent Review config example and a focused contract test.

Files changed:

- `examples/agent-review/generic-python.agent-review.yaml`
- `tests/unit/agent-review/generic-python-config.test.ts`
- `docs/agent_reviews/pr_44_generic_python_adapter_config.md`

Evidence contract fields:

mode: CONTRACT_ONLY
candidate_id: PR_44_GENERIC_PYTHON_ADAPTER_CONFIG
decision: GENERIC_PYTHON_ADAPTER_CONFIG
reason: Adds a generic Python adapter config example and loader/classifier contract test without changing MCP runtime, CI, release, package metadata, or lockfile behavior.
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
source: docs/agent_reviews/pr_44_generic_python_adapter_config.md

Non-goals:

- No MCP gateway runtime changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.
- No scanner behavior changes.
- No CLI behavior changes.
- No CI enforcement changes.
- No package extraction or publish metadata.
- No Tradebot adapter implementation.
- No Algotradify adapter implementation.
- No generator command.

## Grill Me Review

After the generic TypeScript config, Python support is the next small reusable adapter gap. This keeps the Agent Review Kit from becoming TypeScript-only while avoiding runtime, CI, release, and package extraction work.

Required proof:

- Config loads through `loadAgentReviewConfig`.
- Config validates as `generic_project`.
- Common Python paths classify into source, tests, docs, and config areas.
- The test proves behavior, not just file existence.
- No runtime claims.
- Scope is explicit.
- Future runtime proof stated if relevant.

## Hermes Review

The generic Python adapter config is an example contract, not a published package template or CLI generator.

It defines defaults for Python source changes, pytest-style tests, docs, dependency/config files, and standard commands such as pytest, compileall, ruff, and mypy.

## GSD Review

This PR adds one example config, one focused unit test, and one evidence document.

The unit test uses deterministic changed-file inputs:

- `app/main.py`
- `services/orders.py`
- `tests/test_orders.py`
- `docs/ARCHITECTURE.md`
- `pyproject.toml`
- `requirements.txt`

No fake progress: this PR does not claim package publication, generator support, external repository installation, or runtime MCP validation.

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

The config includes generic safety expectations such as no hidden validation failures, no silently skipped negative paths, and no runtime safety claims without tests. Those are config contract expectations only.

## QA / Failure Review

Added test command:

```bash
pnpm test:unit -- tests/unit/agent-review/generic-python-config.test.ts
```

The test proves:

- config loader can load the generic Python example
- schema/profile/metadata/default command fields validate
- changed-file classifier maps common Python paths into expected areas
- required proof strings attach to expected areas

This PR is contract-only and example-config-only, so no runtime negative test is required.

## Scope Guard

Touched intentionally:

- `examples/agent-review/generic-python.agent-review.yaml`
- `tests/unit/agent-review/generic-python-config.test.ts`
- `docs/agent_reviews/pr_44_generic_python_adapter_config.md`

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
pnpm test:unit -- tests/unit/agent-review/generic-python-config.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Generic Python config loads successfully.
- Classifier maps source, tests, docs, and config paths correctly.
- Existing Agent Review Kit tests remain green.
- Existing CI scope guard remains unchanged.
- Existing release dry-run remains unchanged.

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR is config/example/contract-only.

Future runtime proof is required only if a later PR wires this config into a real external Python repository or generator command.

## What This PR Does Not Prove

This PR does not prove npm publication, adapter generator behavior, external repository installation, Tradebot adapter behavior, Algotradify adapter behavior, MCP Shield runtime behavior, CI enforcement changes, or release changes.

It proves only that a generic Python Agent Review config example can be loaded and used by the current loader/classifier.

## Human Approval

Proceed only if reviewers agree this PR is the next small reusable-adapter step after PR #43 and that it intentionally avoids runtime, CI, release, and package extraction changes.
