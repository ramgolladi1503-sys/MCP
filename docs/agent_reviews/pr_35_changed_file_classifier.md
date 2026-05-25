# Agent Review Evidence — PR #35 Changed-File Classifier

## Agent Work Contract

### Goal

Add deterministic changed-file classification for Agent Review using configured `area_rules`. Keep this PR limited to mapping changed file paths to configured areas, matched patterns, required proof, and required sections.

### Files Changed

- `packages/agent-review/src/changed-files.ts`
- `tests/unit/agent-review/changed-files.test.ts`
- `docs/agent_reviews/pr_35_changed_file_classifier.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_35_CHANGED_FILE_CLASSIFIER
decision: CHANGED_FILE_CLASSIFIER
reason: Adds deterministic changed-file-to-area classification so later proof resolver and validator CLI work can bind changed files to configured area proof expectations.
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
source: docs/agent_reviews/pr_35_changed_file_classifier.md

### Non-Goals

- No required-section validation changes.
- No evidence field validation changes.
- No mode-specific validation changes.
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

Changed-file classification can silently become fake safety if it loses unmatched files, assumes one area per file, or hardcodes MCP-specific behavior outside the config. This PR must preserve unmatched files, allow overlapping area matches, and derive all area proof/section requirements from config.

### Required Proof

- Glob patterns match configured shapes such as `packages/gateway/**`, `.github/workflows/**`, `packages/*/package.json`, `docs/**`, and `*.md`.
- Changed files classify into configured areas.
- One file can classify into multiple configured areas.
- Required proof and required sections are copied from config area rules.
- Unmatched files remain visible in summary output.
- Path normalization handles leading `./`, backslashes, and whitespace.
- PR does not implement proof resolution, validator CLI, CI enforcement, or runtime behavior.

## Hermes Review

### Contract Clarity

The classifier exposes:

- `classifyAgentReviewChangedFiles(files, config)`
- `classifyAgentReviewChangedFilesWithSummary(files, config)`
- `changedFileMatchesPattern(filePath, pattern)`

It returns:

- detected areas
- matched files
- unmatched files
- matched patterns
- required proof
- required sections

### Compatibility

The classifier consumes existing types:

- `AgentReviewConfig`
- `AgentReviewChangedFile`
- `AgentReviewAreaClassification`
- `AgentReviewAreaRule`

## GSD Review

### Determinism

The classifier is deterministic and config-driven. It does not inspect git, GitHub, workflow state, runtime behavior, external services, or evidence content.

### Minimality

No dependencies were added. No lockfile churn is expected. Glob support is implemented only for the patterns used by the config: `*`, `**`, and `?`.

### No Fake Progress

This PR classifies changed files only. It does not pretend required-proof resolution, validator CLI behavior, CI enforcement, or runtime MCP validation exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR only maps local changed-file path metadata to configured areas. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, CLI behavior, release behavior, or CI enforcement.

## QA / Failure Review

### Required Tests

Added unit tests for:

- configured glob pattern matching
- deterministic area classification
- required proof propagation
- required section propagation
- unmatched file preservation
- multi-area classification for overlapping rules
- path normalization before matching

### Negative Coverage

Covered:

- `packages/policy/**` does not match `packages/gateway/**`
- `*.md` does not match nested `docs/README.md`
- unknown files remain unmatched
- overlapping package file rules produce multiple area classifications

Future PRs must cover:

- required-proof resolution from detected areas
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
pnpm test:unit -- tests/unit/agent-review/changed-files.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the changed-file classifier.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is validator infrastructure only and does not enforce anything in runtime or CI.

Future proof required:

- PR #36 required-proof resolver must bind detected areas to required proof expectations.
- PR #37 validator CLI must expose CI-friendly validation output.
- PR #38 CI scope guard must enforce validator output.

## What This PR Does Not Prove

This PR does not prove:

- required-proof resolution
- area-specific evidence validation
- validator CLI behavior
- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic changed-file classification and does not overclaim proof resolution, CLI behavior, CI enforcement, or runtime behavior.
