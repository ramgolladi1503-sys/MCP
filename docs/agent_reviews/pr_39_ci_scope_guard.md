# Agent Review Evidence — PR #39 CI Scope Guard

## Agent Work Contract

### Goal

Add CI enforcement for Agent Review evidence validation on pull requests by running the local validator CLI from CI after Typecheck. Keep this PR limited to CI scope guard behavior, local validator runtime compatibility, and a small guard script.

### Files Changed

- `.github/workflows/ci.yml`
- `scripts/agent-review-ci-scope-guard.mjs`
- `tests/unit/agent-review/ci-scope-guard-script.test.ts`
- `packages/agent-review/src/validator-cli.ts`
- `packages/agent-review/src/area-sections.ts`
- `packages/agent-review/src/changed-files.ts`
- `packages/agent-review/src/evidence-fields.ts`
- `packages/agent-review/src/evidence-markdown.ts`
- `packages/agent-review/src/mode-rules.ts`
- `docs/agent_reviews/pr_39_ci_scope_guard.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_39_CI_SCOPE_GUARD
decision: CI_SCOPE_GUARD
reason: Adds guarded CI enforcement for Agent Review evidence so future PRs must include a matching evidence document and pass the local validator CLI before lint and hardening continue.
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
source: docs/agent_reviews/pr_39_ci_scope_guard.md

### Non-Goals

- No runtime MCP gateway changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.
- No scanner behavior changes.
- No runtime MCP CLI behavior changes.
- No package extraction or publishing metadata.
- No validator rule changes.
- No auto-fix or auto-merge behavior.

## Grill Me Review

### Pushback

CI enforcement must fail closed without making push-to-main workflows unusable. This PR must enforce only on pull-request events, skip safely on non-PR events, require a single PR-specific evidence file, and run the existing validator against actual changed files.

### Required Proof

- CI checkout fetches enough history to diff the PR merge commit.
- CI runs Typecheck before the Agent Review validator CLI so `packages/agent-review/dist` exists.
- CI runs `node scripts/agent-review-ci-scope-guard.mjs` on pull requests.
- Guard skips safely for non-pull-request events.
- Guard fails closed for pull-request events without event payload context.
- Guard requires exactly one `docs/agent_reviews/pr_<number>_*.md` file.
- Guard sends actual changed files into the validator CLI.
- Agent Review local CLI imports are runtime-safe for Node ESM.
- PR does not change runtime MCP behavior.

## Hermes Review

### Contract Clarity

The guard script behavior is:

- skip with exit code `0` for non-PR events
- fail with exit code `2` for missing PR context or evidence discovery errors
- otherwise execute `packages/agent-review/dist/validator-cli.js`
- return the validator CLI exit code

### CI Placement

The guard runs after `pnpm typecheck`, because Typecheck emits `packages/agent-review/dist/validator-cli.js` for the local Agent Review package.

## GSD Review

### Determinism

The guard uses the checked-out PR merge commit diff first:

```bash
git diff --name-only HEAD^1 HEAD^2
```

It falls back to event base/head SHAs if available. It does not call GitHub APIs or external services.

### Minimality

No dependencies were added. No lockfile churn is expected.

### No Fake Progress

This PR provides CI enforcement only for Agent Review evidence validation. It does not pretend package publication, runtime MCP validation, auto-fix, or auto-merge exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR only changes CI validation and local Agent Review CLI import compatibility. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, release publishing behavior, or runtime examples.

## QA / Failure Review

### Required Tests

Added unit tests for:

- non-pull-request event safe skip
- pull-request event without event payload fail-closed behavior

CI itself proves:

- the guard can run after Typecheck
- current PR evidence passes the validator
- package or tarball proof remains covered by existing release tarball validation
- publish dry-run proof remains covered by existing guarded publish dry-run
- no accidental real publish proof remains covered by guarded dry-run behavior
- existing typecheck/lint/hardening/release gates remain intact

### Negative Coverage

Covered:

- missing `GITHUB_EVENT_PATH`
- non-PR event skip

Future PRs must cover:

- full temporary git merge-diff fixture if needed
- package/root export contract if external Agent Review Kit consumers are added

## Scope Guard

Touched intentionally:

- `.github/workflows/ci.yml`
- `scripts/agent-review-ci-scope-guard.mjs`
- Agent Review validator CLI runtime imports
- Agent Review unit test
- PR evidence document

Confirmed not touched:

- `packages/gateway`
- `packages/policy`
- `packages/scanner`
- `packages/audit`
- `packages/cli`
- `packages/config-adapter`
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
node scripts/agent-review-ci-scope-guard.mjs
pnpm lint
pnpm test:unit -- tests/unit/agent-review/ci-scope-guard-script.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Pull-request CI runs the Agent Review scope guard after Typecheck.
- Current PR evidence passes the validator.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR changes CI validation only.

Future proof required:

- PR #40 package/root export contract must support external Agent Review Kit consumers if needed.
- Future PRs must include evidence that satisfies this CI gate.

## What This PR Does Not Prove

This PR does not prove:

- runtime MCP security behavior
- reusable package publication readiness
- external package consumer behavior
- auto-fix or auto-merge behavior

## Human Approval

Proceed only if reviewers agree this PR intentionally adds CI enforcement for Agent Review evidence while avoiding runtime MCP behavior changes.
