# Agent Review Evidence — PR #37 Area-Specific Evidence Validator

## Agent Work Contract

### Goal

Add deterministic area-specific evidence section validation for Agent Review by using detected areas from the changed-file classifier and parsed evidence documents. Keep this PR limited to checking configured area-required sections are present and non-empty.

### Files Changed

- `packages/agent-review/src/area-sections.ts`
- `tests/unit/agent-review/area-sections.test.ts`
- `docs/agent_reviews/pr_37_area_specific_evidence_validator.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_37_AREA_SPECIFIC_EVIDENCE_VALIDATOR
decision: AREA_SPECIFIC_EVIDENCE_VALIDATOR
reason: Adds deterministic area-specific evidence section validation so detected areas can require focused evidence sections before validator CLI or CI enforcement work.
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
source: docs/agent_reviews/pr_37_area_specific_evidence_validator.md

### Non-Goals

- No required-section validation changes.
- No evidence field validation changes.
- No mode-specific validation changes.
- No changed-file classifier changes.
- No required-proof resolver changes.
- No validator CLI.
- No CI enforcement.
- No package extraction or publishing metadata.
- No runtime MCP gateway changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.

## Grill Me Review

### Pushback

Area-specific validation can become fake safety if it only checks global sections or loses which area required a section. This PR must preserve area/file context, fail when area-required sections are absent, and fail when they are present but empty.

### Required Proof

- Detected areas produce section expectations from `required_sections`.
- Evidence containing all area-required sections with non-empty content passes.
- Missing area-required sections fail with structured `agent_review.area_section_missing` issues.
- Empty area-required sections fail with structured `agent_review.area_section_empty` issues.
- Duplicate required sections across areas collapse while preserving all areas and files.
- No detected areas means no area-specific section requirements and passes.
- PR does not implement validator CLI, CI enforcement, or runtime behavior.

## Hermes Review

### Contract Clarity

The validator exposes:

- `validateAgentReviewAreaSections(input)`
- `evidenceHasNonEmptyAreaSection(evidence, section)`

It returns:

- `passed`
- `expectations`
- `required_sections`
- `satisfied_sections`
- `missing_sections`
- `empty_sections`
- `issues`

### Compatibility

The validator consumes existing types:

- `AgentReviewAreaClassification`
- `AgentReviewEvidenceDocument`
- `AgentReviewValidationIssue`

## GSD Review

### Determinism

The validator is deterministic and evidence-local. It does not inspect git, GitHub, workflow state, runtime behavior, external services, or package state.

### Minimality

No dependencies were added. No lockfile churn is expected.

### No Fake Progress

This PR checks area-specific required evidence sections only. It does not pretend validator CLI behavior, CI enforcement, package publication, or runtime MCP validation exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR only checks parsed evidence sections against required sections already provided by detected area classifications. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, CLI behavior, release behavior, or CI enforcement.

## QA / Failure Review

### Required Tests

Added unit tests for:

- all area-required sections present and non-empty
- missing area-required section failures
- empty area-required section failures
- duplicate required section collapse across multiple areas
- area and file context preservation
- no-area pass behavior

### Negative Coverage

Covered:

- missing `QA / Failure Review`
- missing `Scope Guard`
- empty `QA / Failure Review`
- shared `Security Review` context across gateway and observability areas

Future PRs must cover:

- validator CLI output
- CI integration
- package/root export contract if needed for external consumption

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
pnpm test:unit -- tests/unit/agent-review/area-sections.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the area-specific evidence validator.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is validator infrastructure only and does not enforce anything in runtime or CI.

Future proof required:

- PR #38 validator CLI must expose CI-friendly validation output.
- PR #39 CI scope guard must enforce validator output.
- PR #40 package export contract must support external Agent Review Kit consumers if needed.

## What This PR Does Not Prove

This PR does not prove:

- validator CLI behavior
- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic area-specific evidence section validation and does not overclaim validator CLI behavior, CI enforcement, or runtime behavior.
