# Agent Review Evidence — PR #32 Required Section Validator

## Agent Work Contract

### Goal

Add deterministic required-section validation for Agent Review evidence documents using the already-loaded Agent Review config and parsed Markdown evidence document. Keep this PR limited to required section presence only.

### Files Changed

- `packages/agent-review/src/required-sections.ts`
- `tests/unit/agent-review/required-sections.test.ts`
- `docs/agent_reviews/pr_32_required_section_validator.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_32_REQUIRED_SECTION_VALIDATOR
decision: REQUIRED_SECTION_VALIDATOR
reason: Adds fail-closed required-section validation so later validator layers can rely on evidence documents containing all globally configured sections before field and proof validation.
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
source: docs/agent_reviews/pr_32_required_section_validator.md

### Non-Goals

- No evidence contract field validation.
- No field value validation.
- No mode-specific validation.
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

A section validator can become fake safety if it checks only a happy path or silently accepts missing evidence. This PR must explicitly return failed validation and structured error issues when configured sections are absent.

### Required Proof

- Real PR #31 evidence passes against the MCP Shield config.
- Missing configured section fails validation.
- Missing section produces a structured `AgentReviewValidationIssue`.
- Heading matching is deterministic and tolerant of case/whitespace differences.
- PR does not validate fields, values, proof items, changed files, or modes.

## Hermes Review

### Contract Clarity

The validator exposes clear functions:

- `validateAgentReviewRequiredSections(input)`
- `hasAgentReviewEvidenceSection(evidence, heading)`
- `findAgentReviewEvidenceSection(evidence, heading)`

### Compatibility

The validator consumes existing types:

- `AgentReviewConfig`
- `AgentReviewEvidenceDocument`
- `AgentReviewEvidenceSection`
- `AgentReviewValidationIssue`

## GSD Review

### Determinism

The validator normalizes section headings by trimming, collapsing whitespace, and comparing case-insensitively. It returns deterministic `present_sections`, `missing_sections`, and `issues` arrays.

### Minimality

No dependencies were added. No lockfile churn is expected.

### No Fake Progress

This PR only validates globally required sections from `config.required_sections`. It does not pretend field validation, area validation, proof validation, CLI validation, or CI enforcement exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR only inspects local parsed evidence documents. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, CLI behavior, release behavior, or CI enforcement.

## QA / Failure Review

### Required Tests

Added unit tests for:

- real PR #31 evidence passing required-section validation
- missing required section failure
- structured missing-section issue output
- case-insensitive and whitespace-normalized heading matching
- helper lookup functions

### Negative Coverage

Covered:

- missing `Human Approval` section fails validation
- missing section is reported in `missing_sections`
- missing section emits `agent_review.required_section_missing`

Future PRs must cover:

- missing evidence contract fields
- invalid boolean string values
- mode-specific rules
- area-specific section rules
- changed-file area matching
- required-proof resolution

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
pnpm test:unit -- tests/unit/agent-review/required-sections.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the required-section validator.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is validator infrastructure only and does not enforce anything in runtime or CI.

Future proof required:

- PR #33 evidence field validator must catch missing or invalid evidence contract fields.
- PR #34 changed-file classifier must map changed files to configured areas.
- PR #36 validator CLI must expose CI-friendly validation output.

## What This PR Does Not Prove

This PR does not prove:

- evidence contract field validation
- field value validation
- mode-specific validation
- area-specific validation
- changed-file classification
- required-proof resolution
- validator CLI behavior
- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic required-section validation and does not overclaim field validation, proof validation, CLI behavior, or CI enforcement.
