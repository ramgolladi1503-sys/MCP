# Agent Review Evidence — PR #49 Agent Role Catalog Contract

## Agent Work Contract

Goal: add the reusable Agent Review Kit role catalog contract locked by the agent architecture roadmap.

Files changed:

- `packages/agent-review/src/agent-roles.ts`
- `tests/unit/agent-review/agent-roles.test.ts`
- `docs/agent_reviews/pr_49_agent_role_catalog_contract.md`

Evidence contract fields:

mode: CONTRACT_ONLY
candidate_id: PR_49_AGENT_ROLE_CATALOG_CONTRACT
decision: AGENT_ROLE_CATALOG_CONTRACT
reason: Adds reusable role IDs, labels, categories, descriptions, lookup helpers, and tests without resolver behavior, evidence validation, CLI reporting, CI enforcement, runtime MCP behavior, package extraction, or adapter mapping.
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
source: docs/agent_reviews/pr_49_agent_role_catalog_contract.md

Non-goals:

- No required review-agent resolver.
- No agent evidence validator.
- No validator CLI report changes.
- No CI enforcement changes.
- No MCP runtime changes.
- No adapter mapping changes.
- No package extraction or publish metadata.

## Grill Me Review

This PR must remain the PR #49 role catalog only. It names the reusable roles and makes them testable, but it does not yet decide which roles are required for a PR.

Required proof:

- unit test proof
- typecheck proof
- test proves behavior
- no test weakening
- no runtime claims
- scope is explicit
- future runtime proof stated if relevant

## Hermes Review

The new `agent-roles` module defines:

- `AGENT_REVIEW_ROLE_CATALOG_VERSION`
- `AGENT_REVIEW_ROLE_IDS`
- `AgentReviewRoleId`
- `AgentReviewRoleCategory`
- `AgentReviewRoleDefinition`
- `AGENT_REVIEW_ROLE_CATALOG`
- `listAgentReviewRoles`
- `getAgentReviewRole`
- `isAgentReviewRoleId`

The catalog locks these roles:

- Scope Lock Agent
- Repo Cartographer Agent
- Architecture Drift Agent
- Safety Boundary Agent
- Runtime Boundary Agent
- Risk / Gating Agent
- Execution Boundary Agent
- Data Freshness Agent
- Evidence / Replay Agent
- QA Failure Agent
- Security Review Agent
- No-Test-Weakening Agent
- CI / Release Guard Agent
- Docs / Runbook Agent
- Human Approval Gate
- Grill Me Reviewer
- Hermes Reviewer
- GSD Reviewer

## GSD Review

This PR is intentionally small and sequenced before resolver work.

It defines the catalog. It does not apply roles to changed files. That belongs to PR #50.

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

## QA / Failure Review

Added test command:

```bash
pnpm test:unit -- tests/unit/agent-review/agent-roles.test.ts
```

The test proves:

- role catalog version is locked
- role IDs are deterministic
- every role has complete metadata
- lookup behavior is deterministic
- invalid role IDs are rejected
- core roles remain portable to MCP Shield, Tradebot, and Algotradify

## Scope Guard

Touched intentionally:

- `packages/agent-review/src/agent-roles.ts`
- `tests/unit/agent-review/agent-roles.test.ts`
- `docs/agent_reviews/pr_49_agent_role_catalog_contract.md`

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
pnpm test:unit -- tests/unit/agent-review/agent-roles.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- role catalog metadata is deterministic
- role lookup and ID guard behave correctly
- existing Agent Review Kit tests remain green
- no resolver, CLI, CI, runtime, package, or adapter behavior changes

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR is contract-only.

Future runtime proof is required only if a later PR wires these roles into resolver, CLI/CI, or runtime behavior.

## What This PR Does Not Prove

This PR does not prove review-agent resolution, agent evidence validation, CLI reporting, CI enforcement, adapter mappings, package publication, or runtime MCP security.

It proves only the reusable role catalog contract.

## Human Approval

Proceed only if reviewers agree this PR matches the PR #47 locked scope for PR #49 and does not jump into PR #50 or later behavior.
