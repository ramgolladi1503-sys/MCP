# Agent Review Evidence — PR #48 Agent Workflow Schema Contract

## Agent Work Contract

Goal: add the first contract-only schema surface for optional Agent Review Kit review-agent workflow declarations.

Files changed:

- `packages/agent-review/src/review-agent-workflow.ts`
- `tests/unit/agent-review/agent-workflow-schema.test.ts`
- `docs/agent_reviews/pr_48_agent_workflow_schema_contract.md`

Evidence contract fields:

mode: CONTRACT_ONLY
candidate_id: PR_48_AGENT_WORKFLOW_SCHEMA_CONTRACT
decision: AGENT_WORKFLOW_SCHEMA_CONTRACT
reason: Adds review-agent workflow declaration types and validation tests without resolver behavior, evidence validation, CLI reporting, CI enforcement, runtime MCP behavior, package extraction, or adapter mapping.
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
source: docs/agent_reviews/pr_48_agent_workflow_schema_contract.md

Non-goals:

- No required review-agent resolver.
- No agent evidence validator.
- No validator CLI report changes.
- No CI enforcement changes.
- No MCP runtime changes.
- No adapter mapping changes.
- No package extraction or publish metadata.

## Grill Me Review

This PR must not jump ahead. PR #47 locked the sequence. PR #48 is only the schema contract layer.

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

The new `review-agent-workflow` module defines:

- `AgentReviewReviewAgentDeclaration`
- `AgentReviewAgentWorkflowConfig`
- `AgentReviewConfigWithAgentWorkflow`
- `getAgentReviewReviewAgents`
- `validateAgentReviewAgentWorkflowConfig`

The declaration shape supports:

- label
- optional description
- required_for areas
- optional required_sections
- optional required_proof

## GSD Review

This PR is intentionally small and sequenced before resolver work.

It validates shape only. It does not decide which agents are required for a changed file. That belongs to PR #50.

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
pnpm test:unit -- tests/unit/agent-review/agent-workflow-schema.test.ts
```

The test proves:

- valid review-agent declarations are accepted
- missing `review_agents` remains valid and empty
- empty `review_agents` fails closed
- missing `required_for` fails closed
- blank labels fail closed

## Scope Guard

Touched intentionally:

- `packages/agent-review/src/review-agent-workflow.ts`
- `tests/unit/agent-review/agent-workflow-schema.test.ts`
- `docs/agent_reviews/pr_48_agent_workflow_schema_contract.md`

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
pnpm test:unit -- tests/unit/agent-review/agent-workflow-schema.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- valid workflow declarations pass validation
- malformed workflow declarations fail closed
- existing Agent Review Kit tests remain green
- no resolver, CLI, CI, runtime, package, or adapter behavior changes

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR is contract-only.

Future runtime proof is required only if a later PR wires this workflow layer into CLI/CI or runtime behavior.

## What This PR Does Not Prove

This PR does not prove review-agent resolution, agent evidence validation, CLI reporting, CI enforcement, adapter mappings, package publication, or runtime MCP security.

It proves only the review-agent workflow declaration contract and validator shape.

## Human Approval

Proceed only if reviewers agree this PR matches the PR #47 locked scope for PR #48 and does not jump into PR #49 or later behavior.
