# Agent Review Evidence — PR #55 CI Enforces Agent Evidence

## Agent Work Contract

Goal: make the existing Agent Review CI scope guard explicitly require the agent evidence fields added by PR #54.

Files changed:

- `scripts/agent-review-ci-scope-guard.mjs`
- `tests/unit/agent-review/ci-agent-evidence-guard.test.ts`
- `docs/agent_reviews/pr_55_ci_enforces_agent_evidence.md`

Evidence contract fields:

mode: CONTRACT_ONLY
candidate_id: PR_55_CI_ENFORCES_AGENT_EVIDENCE
decision: CI_ENFORCES_AGENT_EVIDENCE
reason: Adds explicit CI guard checks for validator report agent evidence fields without runtime MCP behavior, adapter mapping, package extraction, or release behavior changes.
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
source: docs/agent_reviews/pr_55_ci_enforces_agent_evidence.md

## Grill Me Review

This PR is CI guard enforcement for already-proven agent evidence reporting. It must not change product runtime behavior.

Required proof:

- unit test proof
- typecheck proof
- test proves behavior
- no test weakening
- no runtime claims
- scope is explicit
- future runtime proof stated if relevant

## Hermes Review

The CI scope guard now asserts that the validator report contains:

- top-level `required_review_agents`
- top-level `satisfied_review_agents`
- top-level `missing_review_agents`
- `checks.agent_evidence`
- `checks.agent_evidence.missing_review_agents`

Missing required review-agent evidence fails the CI guard.

## GSD Review

This PR does not create a second enforcement path. It strengthens the existing scope guard that already runs in CI.

## Security Review

No runtime security behavior changes.

Confirmed not touched:

- gateway runtime
- policy runtime
- approval runtime
- audit runtime
- scanner runtime
- package metadata
- release flow
- lockfile

## QA / Failure Review

Added test command:

```bash
pnpm test:unit -- tests/unit/agent-review/ci-agent-evidence-guard.test.ts
```

The test proves complete agent evidence passes and missing agent evidence fails the guard helper.

## Scope Guard

Touched intentionally:

- `scripts/agent-review-ci-scope-guard.mjs`
- `tests/unit/agent-review/ci-agent-evidence-guard.test.ts`
- `docs/agent_reviews/pr_55_ci_enforces_agent_evidence.md`

## Required Review Agents

- Scope Lock Agent: PASS
- Repo Cartographer Agent: PASS
- Docs / Runbook Agent: PASS
- CI / Release Guard Agent: PASS
- GSD Reviewer: PASS

## Acceptance Proof

Required commands:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test:unit -- tests/unit/agent-review/ci-agent-evidence-guard.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected: CI guard fails if required review-agent evidence is missing from the validator report.

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR only changes Agent Review CI guard validation.

## What This PR Does Not Prove

This PR does not prove package publication or runtime MCP security.

## Human Approval

Proceed only if reviewers agree this PR matches PR #55 and does not jump into PR #56 cross-adapter snapshots.
