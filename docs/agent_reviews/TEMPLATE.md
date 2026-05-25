# Agent Review Evidence — PR #<number> <title>

## Agent Work Contract

### Goal

Describe the exact goal of this PR.

### Files Changed

- `<path>`

### Evidence Contract Fields

mode: `<DOCS_ONLY | CONTRACT_ONLY | RUNTIME_CHANGE | SECURITY_RUNTIME_CHANGE>`
candidate_id: `PR_<number>_<SLUG>`
decision: `<short decision name>`
reason: `<why this PR exists>`
is_runtime_change: `<true|false>`
is_security_runtime_change: `<true|false>`
child_mcp_forwarding_changed: `<true|false>`
policy_behavior_changed: `<true|false>`
approval_behavior_changed: `<true|false>`
audit_schema_changed: `<true|false>`
source: `docs/agent_reviews/pr_<number>_<short_slug>.md`

Add additional fields when relevant:

trace_behavior_changed: `<true|false>`
scanner_behavior_changed: `<true|false>`
cli_behavior_changed: `<true|false>`
release_behavior_changed: `<true|false>`

### Non-Goals

- No unrelated runtime behavior.
- No unrelated refactor.
- No test weakening.

Add specific non-goals for the PR.

## Grill Me Review

### Pushback

Describe the strongest objection to this PR.

### Required Proof

- What must be proven?
- What negative case is required?
- What false-positive case is required?
- What bypass must be prevented?

## Hermes Review

### Contract Clarity

Confirm the contract is understandable and stable.

### Naming / Schema / Compatibility

- Naming is precise.
- Schema is explicit if relevant.
- Serialization is safe if relevant.
- Backward compatibility is considered if relevant.
- Docs do not overclaim behavior.

## GSD Review

### Determinism

Explain how behavior is deterministic, or state docs-only.

### Minimality

Explain why this is the smallest useful PR.

### No Fake Progress

Explain why this materially improves product safety, clarity, testability, debuggability, or release readiness.

## Security Review

### Security Impact

State whether this PR changes security runtime behavior.

### Security Checks

Address relevant checks:

- fail-closed behavior
- secret redaction
- approval bypass
- stdout protocol purity
- child server forwarding boundary
- network egress
- tool poisoning
- tool drift
- audit integrity
- tamper behavior

## QA / Failure Review

### Required Tests

List exact tests or explain why product tests are not required for docs-only work.

### Negative Coverage

List malformed, missing, timeout, denial, expiry, tamper, and false-positive cases where relevant.

## Scope Guard

Confirmed not touched:

- `<area>`

Also state any banned areas that remain out of scope.

## Acceptance Proof

Run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- `<expected proof>`

## Runtime Proof Required After Merge

State what runtime proof is required later.

For docs-only PRs, explicitly state that no runtime proof is produced by this PR.

## What This PR Does Not Prove

This PR does not prove:

- `<not proven>`

## Human Approval

Proceed only if:

- Scope is correct.
- Evidence is complete.
- CI is green or docs-only exception is justified.
- Remaining risk is clearly stated.
