# Agent Review Evidence — PR #36 Required-Proof Resolver

## Agent Work Contract

### Goal

Add deterministic required-proof resolution for Agent Review by using detected areas from the changed-file classifier and parsed evidence documents. Keep this PR limited to aggregating required proof expectations and checking whether evidence mentions those proof strings.

### Files Changed

- `packages/agent-review/src/required-proof.ts`
- `tests/unit/agent-review/required-proof.test.ts`
- `docs/agent_reviews/pr_36_required_proof_resolver.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_36_REQUIRED_PROOF_RESOLVER
decision: REQUIRED_PROOF_RESOLVER
reason: Adds deterministic required-proof resolution so detected areas can be converted into proof expectations before validator CLI or CI enforcement work.
is_runtime_change: false
is_security_runtime_change: false
child_mcp_forwarding_changed: false
policy_behavior_changed: false
approval_behavior_changed: false
audit_schema_changed: false
scanner_behavior_changed: false
cli_behavior_changed: false
release_behavior_changed: false
ci_behavior_changed: false
source: docs/agent_reviews/pr_36_required_proof_resolver.md

### Non-Goals

- No required-section validation changes.
- No evidence field validation changes.
- No mode-specific validation changes.
- No changed-file classifier changes.
- No validator CLI.
- No CI enforcement.
- No package extraction or publishing metadata.
- No runtime MCP gateway changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.

## Grill Me Review

### Pushback

Required-proof resolution can become fake safety if it silently drops duplicate proof, hides unmatched areas, or claims CI enforcement before a CLI exists. This PR must preserve area/file context for proof expectations, emit structured missing-proof issues, and not pretend enforcement exists.

### Required Proof

- Required proof strings are collected from detected areas.
- Duplicate proof across areas is collapsed while preserving all areas and files.
- Evidence containing all proof strings passes.
- Missing proof fails with structured `agent_review.required_proof_missing` issues.
- Proof search normalizes simple Markdown punctuation such as dashes and underscores.
- No detected areas means no required proof and passes.
- PR does not implement validator CLI, CI enforcement, or runtime behavior.

## Hermes Review

### Contract Clarity

The resolver exposes:

- `resolveAgentReviewRequiredProof(input)`
- `evidenceContainsRequiredProof(evidence, proof)`

It returns:

- `passed`
- `expectations`
- `required_proof`
- `satisfied_proof`
- `missing_proof`
- `issues`

### Compatibility

The resolver consumes existing types:

- `AgentReviewAreaClassification`
- `AgentReviewEvidenceDocument`
- `AgentReviewValidationIssue`

## GSD Review

### Determinism

The resolver is deterministic and evidence-local. It does not inspect git, GitHub, workflow state, runtime behavior, external services, or package state.

### Minimality

No dependencies were added. No lockfile churn is expected.

### No Fake Progress

This PR resolves and checks required proof strings only. It does not pretend validator CLI behavior, CI enforcement, package publication, or runtime MCP validation exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR only checks parsed evidence text against required proof strings already provided by detected area classifications. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, CLI behavior, release behavior, or CI enforcement.

## QA / Failure Review

### Required Tests

Added unit tests for:

- all required proof present
- missing proof failures
- structured missing-proof issues
- duplicate proof collapse across multiple areas
- area and file context preservation
- Markdown punctuation normalization
- no-area pass behavior

### Negative Coverage

Covered:

- missing `block before forward proof`
- missing `timeout behavior`
- shared missing `fail-closed test` across gateway and policy areas

Future PRs must cover:

- area-specific evidence section validation
- validator CLI output
- CI integration

## Scope Guard

Confirmed not touched:

- `packages/gateway`
- `packages/policy`
- `packages/scanner`
- `packages/audit`
- `packages/cli`
- `packages/config-adapter`
- `.github/workflows`
- `scripts`
- runtime examples

Banned areas remain out of scope:

- cloud SaaS
- billing
- auth
- dashboard implementation
- agent auto-merge
- agent auto-fix
- runtime MCP behavior

## Acceptance Proof

Run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:unit -- tests/unit/agent-review/required-proof.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the required-proof resolver.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is validator infrastructure only and does not enforce anything in runtime or CI.

Future proof required:

- PR #37 area-specific evidence validator must bind detected areas to required evidence sections.
- PR #38 validator CLI must expose CI-friendly validation output.
- PR #39 CI scope guard must enforce validator output.

## What This PR Does Not Prove

This PR does not prove:

- area-specific evidence validation
- validator CLI behavior
- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic required-proof resolution and does not overclaim validator CLI behavior, CI enforcement, or runtime behavior.
