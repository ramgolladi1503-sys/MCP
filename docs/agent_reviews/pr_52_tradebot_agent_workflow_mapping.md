# Agent Review Evidence — PR #52 Tradebot Agent Workflow Mapping

## Agent Work Contract

Goal: update the Tradebot adapter example to declare its review-agent workflow mapping and prove the current resolver/evidence validator can consume it.

Files changed:

- `examples/agent-review/tradebot.agent-review.yaml`
- `tests/unit/agent-review/tradebot-agent-workflow.test.ts`
- `docs/agent_reviews/pr_52_tradebot_agent_workflow_mapping.md`

Evidence contract fields:

mode: CONTRACT_ONLY
candidate_id: PR_52_TRADEBOT_AGENT_WORKFLOW_MAPPING
decision: TRADEBOT_AGENT_WORKFLOW_MAPPING
reason: Adds Tradebot review-agent mappings to the existing adapter config and tests the mapping without CLI reporting, CI enforcement, runtime MCP behavior, package extraction, or Tradebot repo coupling.
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
source: docs/agent_reviews/pr_52_tradebot_agent_workflow_mapping.md

Non-goals:

- No validator CLI report changes.
- No CI enforcement changes.
- No MCP runtime changes.
- No Tradebot repository changes.
- No broker behavior changes.
- No package extraction or publish metadata.

## Grill Me Review

This PR must remain PR #52 Tradebot mapping only. It maps existing Tradebot areas to the reusable role catalog and proves the mapping can be resolved.

Required proof:

- unit test proof
- typecheck proof
- test proves behavior
- no test weakening
- no runtime claims
- scope is explicit
- future runtime proof stated if relevant

## Hermes Review

The Tradebot config now declares review-agent mappings for:

- scope lock
- evidence/replay
- QA failure
- GSD review
- risk/gating
- safety boundary
- security review
- data freshness
- runtime boundary
- execution boundary
- human approval
- no-test-weakening
- docs/runbook
- CI/release guard

## GSD Review

This PR is intentionally small and sequenced after PR #51 evidence validator and before PR #53 MCP Shield mapping.

It updates one existing adapter config and adds one focused test.

## Security Review

No runtime security behavior changes.

Confirmed not touched:

- gateway runtime
- policy behavior
- approval behavior
- audit schema
- scanner behavior
- CLI behavior
- CI workflow
- release flow
- package metadata
- lockfile
- Tradebot repository
- broker behavior

## QA / Failure Review

Added test command:

```bash
pnpm test:unit -- tests/unit/agent-review/tradebot-agent-workflow.test.ts
```

The test proves:

- Tradebot config loads declared review agents
- representative Tradebot paths resolve to expected required review agents
- execution-area evidence can satisfy the required review agents

## Scope Guard

Touched intentionally:

- `examples/agent-review/tradebot.agent-review.yaml`
- `tests/unit/agent-review/tradebot-agent-workflow.test.ts`
- `docs/agent_reviews/pr_52_tradebot_agent_workflow_mapping.md`

Confirmed not touched:

- `packages/gateway`
- `packages/policy`
- `packages/scanner`
- `packages/audit`
- `packages/cli`
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
pnpm test:unit -- tests/unit/agent-review/tradebot-agent-workflow.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Tradebot review-agent mappings load successfully
- representative Tradebot changes resolve required review agents correctly
- evidence validation accepts complete PASS evidence for execution mapping
- no CLI, CI, runtime, package, or broker behavior changes

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR is contract-only adapter mapping.

Future runtime proof is required only if a later PR wires agent workflow validation into CLI, CI, or runtime behavior.

## What This PR Does Not Prove

This PR does not prove CLI reporting, CI enforcement, package publication, runtime MCP security, broker safety, or live execution safety.

It proves only the Tradebot adapter review-agent mapping contract.

## Human Approval

Proceed only if reviewers agree this PR matches the PR #47 locked scope for PR #52 and does not jump into PR #53 or later behavior.
