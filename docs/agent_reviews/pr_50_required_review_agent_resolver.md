# Agent Review Evidence — PR #50 Required Review Agent Resolver

## Agent Work Contract

Goal: add the required review-agent resolver layer locked by the agent architecture roadmap.

Files changed:

- `packages/agent-review/src/review-agent-resolver.ts`
- `tests/unit/agent-review/review-agent-resolver.test.ts`
- `docs/agent_reviews/pr_50_required_review_agent_resolver.md`

Evidence contract fields:

mode: CONTRACT_ONLY
candidate_id: PR_50_REQUIRED_REVIEW_AGENT_RESOLVER
decision: REQUIRED_REVIEW_AGENT_RESOLVER
reason: Adds resolver logic that maps detected areas and review-agent declarations to required review agents, without evidence validation, CLI reporting, CI enforcement, runtime MCP behavior, package extraction, or adapter mapping.
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
source: docs/agent_reviews/pr_50_required_review_agent_resolver.md

Non-goals:

- No agent evidence validator.
- No validator CLI report changes.
- No CI enforcement changes.
- No MCP runtime changes.
- No adapter mapping changes.
- No package extraction or publish metadata.

## Grill Me Review

This PR must remain PR #50 resolver only. It resolves required agents from already-classified areas and config workflow declarations.

Required proof:

- unit test proof
- typecheck proof
- failure-path proof
- test proves behavior
- no test weakening
- no runtime claims
- scope is explicit
- future runtime proof stated if relevant

## Hermes Review

The new resolver module defines:

- `AgentReviewResolvedReviewAgent`
- `AgentReviewRequiredReviewAgentResolutionResult`
- `resolveAgentReviewRequiredReviewAgents`

Resolver input:

- detected area classifications
- Agent Review config with optional `review_agents`

Resolver output:

- ordered required review-agent IDs
- resolved agent records containing label, matched areas, files, required sections, and required proof

## GSD Review

This PR is intentionally small and sequenced after PR #49 role catalog and before PR #51 evidence validation.

It does not parse evidence and does not enforce anything in CI.

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
pnpm test:unit -- tests/unit/agent-review/review-agent-resolver.test.ts
```

The test proves:

- required agents resolve from detected areas
- wildcard agents apply to all detected areas
- repeated areas/files/metadata dedupe while preserving order
- configs without `review_agents` resolve to empty output

## Scope Guard

Touched intentionally:

- `packages/agent-review/src/review-agent-resolver.ts`
- `tests/unit/agent-review/review-agent-resolver.test.ts`
- `docs/agent_reviews/pr_50_required_review_agent_resolver.md`

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
pnpm test:unit -- tests/unit/agent-review/review-agent-resolver.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- resolver maps detected areas to configured review agents
- resolver supports wildcard `*`
- resolver dedupes repeated files and metadata
- resolver returns empty output when no workflow is configured
- no evidence validator, CLI, CI, runtime, package, or adapter behavior changes

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR is contract-only.

Future runtime proof is required only if a later PR wires these results into evidence validation, CLI, CI, or runtime behavior.

## What This PR Does Not Prove

This PR does not prove agent evidence validation, CLI reporting, CI enforcement, adapter mappings, package publication, or runtime MCP security.

It proves only required review-agent resolution from detected area classifications and config declarations.

## Human Approval

Proceed only if reviewers agree this PR matches the PR #47 locked scope for PR #50 and does not jump into PR #51 or later behavior.
