# Agent Review Evidence — PR #34 Mode-Specific Validator

## Agent Work Contract

### Goal

Add deterministic mode-specific validation for Agent Review evidence documents using the already-loaded Agent Review config, parsed Markdown evidence document, and validated evidence fields. Keep this PR limited to mode rule checks only.

### Files Changed

- `packages/agent-review/src/mode-rules.ts`
- `tests/unit/agent-review/mode-rules.test.ts`
- `docs/agent_reviews/pr_34_mode_specific_validator.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_34_MODE_SPECIFIC_VALIDATOR
decision: MODE_SPECIFIC_VALIDATOR
reason: Adds fail-closed mode-specific validation so contract-only, runtime, and security-runtime evidence claims are checked against configured mode rules before classifier, proof resolver, CLI, or CI work.
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
source: docs/agent_reviews/pr_34_mode_specific_validator.md

### Non-Goals

- No required-section validation changes.
- No evidence field validation changes.
- No area-specific section validation.
- No changed-file classifier.
- No required-proof resolver.
- No validator CLI.
- No CI enforcement.
- No package extraction or publishing metadata.
- No runtime MCP gateway changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.

## Grill Me Review

### Pushback

Mode rules are only useful if they reject contradictory evidence. A CONTRACT_ONLY document must not claim runtime changes. Runtime and security-runtime modes must carry proof signals, but this PR must not pretend to classify changed files or enforce CI.

### Required Proof

- Real PR #33 evidence passes CONTRACT_ONLY mode rules.
- CONTRACT_ONLY fails if runtime-change fields are true.
- CONTRACT_ONLY fails if future runtime proof section does not include future/after-merge/required language.
- RUNTIME_CHANGE fails when configured product-test proof is missing.
- RUNTIME_CHANGE passes when configured product-test proof and negative-test language exist.
- SECURITY_RUNTIME_CHANGE fails when false-positive and audit/debug evidence are missing.
- PR does not implement changed-file classification, required-proof resolution, CLI behavior, or CI enforcement.

## Hermes Review

### Contract Clarity

The validator exposes:

- `validateAgentReviewModeRules(input)`

It returns:

- `passed`
- `mode`
- `evaluated_rules`
- `issues`

### Compatibility

The validator consumes existing types:

- `AgentReviewConfig`
- `AgentReviewEvidenceDocument`
- `AgentReviewModeRule`
- `AgentReviewValidationIssue`

## GSD Review

### Determinism

The validator returns deterministic issues based only on the parsed evidence document and configured mode rules. It does not inspect git, PR diffs, workflow state, runtime behavior, or external services.

### Minimality

No dependencies were added. No lockfile churn is expected.

### No Fake Progress

This PR validates configured mode-level evidence rules only. It does not pretend changed-file classification, area proof resolution, CLI validation, CI enforcement, or runtime MCP validation exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR only inspects local parsed evidence metadata and evidence sections. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, CLI behavior, release behavior, or CI enforcement.

## QA / Failure Review

### Required Tests

Added unit tests for:

- real PR #33 evidence satisfying CONTRACT_ONLY mode rules
- non-runtime mode rejecting runtime-change claims
- CONTRACT_ONLY requiring future-runtime-proof language
- RUNTIME_CHANGE requiring configured product-test proof
- RUNTIME_CHANGE requiring negative-test language
- SECURITY_RUNTIME_CHANGE requiring false-positive and audit/debug evidence

### Negative Coverage

Covered:

- `agent_review.mode_rule_runtime_change_not_allowed`
- `agent_review.mode_rule_future_runtime_proof_missing`
- `agent_review.mode_rule_product_tests_missing`
- `agent_review.mode_rule_false_positive_tests_missing`
- `agent_review.mode_rule_audit_or_debug_evidence_missing`

Future PRs must cover:

- changed-file area matching
- area-specific section rules
- required-proof resolution
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
pnpm test:unit -- tests/unit/agent-review/mode-rules.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the mode-specific validator.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is validator infrastructure only and does not enforce anything in runtime or CI.

Future proof required:

- PR #35 changed-file classifier must map changed files to configured areas.
- PR #36 required-proof resolver must bind detected areas to required proof.
- PR #37 validator CLI must expose CI-friendly validation output.

## What This PR Does Not Prove

This PR does not prove:

- changed-file classification
- area-specific validation
- required-proof resolution
- validator CLI behavior
- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic mode-specific evidence validation and does not overclaim changed-file classification, proof resolution, CLI behavior, or CI enforcement.
