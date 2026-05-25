# Agent Review Evidence — PR #33 Evidence Field Validator

## Agent Work Contract

### Goal

Add deterministic evidence contract field validation for Agent Review evidence documents using the already-loaded Agent Review config and parsed Markdown evidence document. Keep this PR limited to field presence and basic field value checks.

### Files Changed

- `packages/agent-review/src/evidence-fields.ts`
- `tests/unit/agent-review/evidence-fields.test.ts`
- `docs/agent_reviews/pr_33_evidence_field_validator.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_33_EVIDENCE_FIELD_VALIDATOR
decision: EVIDENCE_FIELD_VALIDATOR
reason: Adds fail-closed evidence contract field validation so later validator layers can rely on required fields, configured mode values, and strict boolean-string fields before mode-specific and proof validation.
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
source: docs/agent_reviews/pr_33_evidence_field_validator.md

### Non-Goals

- No required-section validation changes.
- No mode-specific rule validation.
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

A field validator that only checks a happy path is weak. This PR must fail when the evidence contract block is absent, when configured required fields are missing, when `mode` is outside configured modes, and when boolean-string fields are not exactly `true` or `false`.

### Required Proof

- Real PR #32 evidence passes field validation.
- Missing evidence contract block fails validation.
- Missing required fields fail validation.
- Invalid mode fails validation.
- Invalid required boolean-string field fails validation.
- Invalid optional boolean-string field fails validation.
- PR does not enforce mode-specific rules, proof rules, changed-file rules, CLI behavior, or CI behavior.

## Hermes Review

### Contract Clarity

The validator exposes clear functions:

- `validateAgentReviewEvidenceFields(input)`
- `hasAgentReviewEvidenceField(evidence, field)`
- `getAgentReviewEvidenceFieldValue(evidence, field)`

### Compatibility

The validator consumes existing types:

- `AgentReviewConfig`
- `AgentReviewEvidenceDocument`
- `AgentReviewEvidenceContract`
- `AgentReviewValidationIssue`

## GSD Review

### Determinism

The validator returns deterministic `present_fields`, `missing_fields`, `invalid_fields`, and `issues` arrays. It does not infer missing values or silently downgrade invalid field values.

### Minimality

No dependencies were added. No lockfile churn is expected.

### No Fake Progress

This PR validates field presence and basic allowed values only. It does not pretend mode-specific validation, area validation, proof validation, CLI validation, or CI enforcement exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR only inspects parsed local evidence metadata. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, CLI behavior, release behavior, or CI enforcement.

## QA / Failure Review

### Required Tests

Added unit tests for:

- real PR #32 evidence passing field validation
- missing required fields
- missing evidence contract block
- invalid mode
- invalid required boolean-string field
- invalid optional boolean-string field
- helper field lookup functions

### Negative Coverage

Covered:

- missing `decision` and `source` fail validation
- absent contract block emits `agent_review.evidence_contract_missing`
- invalid mode emits `agent_review.evidence_field_invalid_mode`
- invalid boolean strings emit `agent_review.evidence_field_invalid_boolean_string`

Future PRs must cover:

- mode-specific rules
- area-specific section rules
- changed-file area matching
- required-proof resolution
- validator CLI output

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
pnpm test:unit -- tests/unit/agent-review/evidence-fields.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the evidence field validator.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is validator infrastructure only and does not enforce anything in runtime or CI.

Future proof required:

- PR #34 mode-specific validator must enforce mode rules.
- PR #35 changed-file classifier must map changed files to configured areas.
- PR #36 validator CLI must expose CI-friendly validation output.

## What This PR Does Not Prove

This PR does not prove:

- required-section validator behavior beyond existing PR #32 tests
- mode-specific validation
- area-specific validation
- changed-file classification
- required-proof resolution
- validator CLI behavior
- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic evidence contract field validation and does not overclaim mode validation, proof validation, CLI behavior, or CI enforcement.
