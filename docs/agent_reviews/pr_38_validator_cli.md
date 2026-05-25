# Agent Review Evidence — PR #38 Validator CLI

## Agent Work Contract

### Goal

Add a local Agent Review validator CLI entrypoint that wires together the existing config loader, evidence parser, changed-file classifier, required-section validator, evidence-field validator, mode-rule validator, area-section validator, and required-proof resolver. Keep this PR limited to local CLI/report behavior only.

### Files Changed

- `packages/agent-review/src/validator-cli.ts`
- `tests/unit/agent-review/validator-cli.test.ts`
- `docs/agent_reviews/pr_38_validator_cli.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_38_VALIDATOR_CLI
decision: VALIDATOR_CLI
reason: Adds a deterministic local validator CLI report so Agent Review evidence can be checked manually before future CI enforcement work.
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
source: docs/agent_reviews/pr_38_validator_cli.md

### Non-Goals

- No CI enforcement.
- No workflow changes.
- No root package script changes.
- No runtime MCP CLI changes.
- No package extraction or publishing metadata.
- No required-section validation changes.
- No evidence field validation changes.
- No mode-specific validation changes.
- No changed-file classifier changes.
- No required-proof resolver changes.
- No area-specific evidence validator changes.
- No runtime MCP gateway changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.

## Grill Me Review

### Pushback

A validator CLI can become fake progress if it only prints success or hides issues. This PR must return deterministic JSON, preserve issue details from every validator layer, and return non-zero exit codes for validation failures and usage errors.

### Required Proof

- CLI parses `--project-root`, `--evidence`, and repeatable `--changed-file` arguments.
- CLI returns help without requiring evidence.
- Missing evidence returns usage error exit code `2`.
- Valid evidence with no changed files returns exit code `0` and a passing JSON report.
- Changed gateway file with incomplete proof returns exit code `1` and structured required-proof issues.
- CLI does not modify CI, workflows, package scripts, runtime CLI, or MCP runtime behavior.

## Hermes Review

### Contract Clarity

The CLI module exposes:

- `runAgentReviewValidatorCli(args)`
- `parseAgentReviewValidatorCliArgs(args)`
- `getAgentReviewValidatorCliHelp()`

It returns:

- `exit_code`
- `stdout`
- `stderr`
- optional structured report

The report schema version is:

```text
agent_review.validator_cli.v1
```

### Compatibility

The CLI consumes existing validator modules and types from the Agent Review package. It does not add package publishing metadata or root scripts in this PR.

## GSD Review

### Determinism

The CLI is deterministic for the provided project root, evidence path, and changed files. It does not call GitHub, inspect workflow state, mutate files, or enforce CI.

### Minimality

No dependencies were added. No lockfile churn is expected.

### No Fake Progress

This PR creates local validator CLI behavior only. It does not pretend CI enforcement, package publication, or runtime MCP validation exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR only runs local validation against evidence/config/file-path inputs. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, release behavior, or CI enforcement.

## QA / Failure Review

### Required Tests

Added unit tests for:

- CLI argument parsing
- help output
- missing evidence usage error
- passing valid evidence report
- failing changed-file proof report
- JSON report schema
- exit-code behavior

### Negative Coverage

Covered:

- missing `--evidence`
- gateway changed file with incomplete required proof
- required-proof issue propagation into CLI report

Future PRs must cover:

- CI integration
- root script wiring if desired
- package/root export contract for external Agent Review Kit consumers

## Scope Guard

Confirmed not touched:

- `packages/gateway`
- `packages/policy`
- `packages/scanner`
- `packages/audit`
- `packages/cli`
- `packages/config-adapter`
- `.github/workflows`
- root `package.json`
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
pnpm test:unit -- tests/unit/agent-review/validator-cli.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the local validator CLI.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is validator infrastructure only and does not enforce anything in runtime or CI.

Future proof required:

- PR #39 CI scope guard must enforce validator output.
- PR #40 package export contract must support external Agent Review Kit consumers if needed.

## What This PR Does Not Prove

This PR does not prove:

- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness
- root package script behavior

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic local validator CLI behavior and does not overclaim CI enforcement, package publication, or runtime behavior.
