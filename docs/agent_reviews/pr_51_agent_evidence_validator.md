# Agent Review Evidence — PR #51 Agent Evidence Validator

## Agent Work Contract

Goal: add the review-agent evidence validator layer locked by the agent architecture roadmap.

Files changed:

- `packages/agent-review/src/review-agent-evidence.ts`
- `tests/unit/agent-review/review-agent-evidence.test.ts`
- `docs/agent_reviews/pr_51_agent_evidence_validator.md`

Evidence contract fields:

mode: CONTRACT_ONLY
candidate_id: PR_51_AGENT_EVIDENCE_VALIDATOR
decision: AGENT_EVIDENCE_VALIDATOR
reason: Adds validation for Required Review Agents evidence against already-resolved review agents, without CLI reporting, CI enforcement, runtime MCP behavior, package extraction, or adapter mapping.
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
source: docs/agent_reviews/pr_51_agent_evidence_validator.md

Non-goals:

- No validator CLI report changes.
- No CI enforcement changes.
- No MCP runtime changes.
- No adapter mapping changes.
- No package extraction or publish metadata.

## Grill Me Review

This PR must remain PR #51 evidence validator only. It checks evidence text for already-resolved required review agents.

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

The new validator module defines:

- `AGENT_REVIEW_REQUIRED_REVIEW_AGENTS_SECTION`
- `AgentReviewAgentEvidenceValidationInput`
- `AgentReviewAgentEvidenceValidationResult`
- `validateAgentReviewAgentEvidence`

Expected evidence section:

```markdown
## Required Review Agents

- Scope Lock Agent: PASS
- QA Failure Agent: PASS
```

The validator accepts either the review-agent label or agent ID as the PASS evidence key.

## GSD Review

This PR is intentionally small and sequenced after PR #50 resolver and before CLI or CI wiring.

It does not change validator CLI output and does not enforce anything in CI.

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
pnpm test:unit -- tests/unit/agent-review/review-agent-evidence.test.ts
```

The test proves:

- all required review agents with PASS evidence pass
- missing Required Review Agents section fails closed
- missing agent PASS evidence fails closed
- agent IDs can be used as PASS evidence keys
- no required agents means no section is required

## Scope Guard

Touched intentionally:

- `packages/agent-review/src/review-agent-evidence.ts`
- `tests/unit/agent-review/review-agent-evidence.test.ts`
- `docs/agent_reviews/pr_51_agent_evidence_validator.md`

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
pnpm test:unit -- tests/unit/agent-review/review-agent-evidence.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- evidence validator passes when every required agent has PASS evidence
- evidence validator fails when the section is missing
- evidence validator fails when a required PASS line is missing
- evidence validator accepts agent IDs as PASS keys
- no CLI, CI, runtime, package, or adapter behavior changes

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR is contract-only.

Future runtime proof is required only if a later PR wires agent evidence validation into CLI, CI, or runtime behavior.

## What This PR Does Not Prove

This PR does not prove CLI reporting, CI enforcement, adapter mappings, package publication, or runtime MCP security.

It proves only evidence validation for already-resolved required review agents.

## Human Approval

Proceed only if reviewers agree this PR matches the PR #47 locked scope for PR #51 and does not jump into PR #52 or later behavior.
