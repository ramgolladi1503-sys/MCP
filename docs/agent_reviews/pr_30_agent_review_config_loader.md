# Agent Review Evidence — PR #30 Agent Review Config Loader

## Agent Work Contract

### Goal

Add deterministic config discovery, parsing, and shape validation for the reusable Agent Review Kit without implementing Markdown evidence parsing, section validation, required-proof resolution, validator CLI, CI enforcement, or runtime MCP behavior.

### Files Changed

- `packages/agent-review/src/index.ts`
- `tsconfig.base.json`
- `tests/unit/agent-review/config-loader.test.ts`
- `docs/agent_reviews/pr_30_agent_review_config_loader.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_30_AGENT_REVIEW_CONFIG_LOADER
decision: AGENT_REVIEW_CONFIG_LOADER
reason: Adds fail-closed loading and validation for agent-review YAML/JSON config contracts so future validators and CI gates can consume a trusted config object.
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
source: docs/agent_reviews/pr_30_agent_review_config_loader.md

### Non-Goals

- No Markdown evidence parser.
- No evidence section validator.
- No evidence contract field validator.
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

A custom YAML subset parser can be risky if it silently accepts unsupported YAML features or fails open on malformed config.

### Required Proof

- Config loading must fail closed when no config exists.
- Invalid config shape must throw `AgentReviewConfigError`.
- Required schema fields must be checked.
- Required modes must be checked.
- Area rules must require path patterns and proof lists.
- The loader must not add dependency or lockfile churn.
- The PR must not claim evidence validation or CI enforcement.

## Hermes Review

### Contract Clarity

The loader exposes clear contracts:

- `loadAgentReviewConfig(projectRoot, options)`
- `findAgentReviewConfigPath(projectRoot, options)`
- `parseAgentReviewConfigText(text, sourcePath)`
- `validateAgentReviewConfig(config, sourcePath)`
- `AgentReviewConfigError`
- `DEFAULT_AGENT_REVIEW_CONFIG_FILE_NAMES`

### Naming / Schema / Compatibility

- Existing type names remain stable.
- Schema version remains `1.0`.
- Config file search order keeps MCP Shield first and generic fallback last.
- No runtime package dependency is introduced.
- No lockfile change is expected.

## GSD Review

### Determinism

Config discovery checks explicit path first, then a fixed search order. Config validation uses explicit shape checks and throws deterministic errors.

### Minimality

The PR implements only the config loader layer required before evidence parsing and validation.

### No Fake Progress

This moves the adapter architecture from documentation/type contracts into a test-covered loader that future validators can safely consume.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

This PR supports future security gates by failing closed on missing or invalid agent-review config. It does not affect gateway forwarding, policy decisions, approvals, audit events, or scanner behavior.

## QA / Failure Review

### Required Tests

Added unit tests for:

- loading and validating the real MCP Shield YAML config
- explicit JSON config path loading
- custom config search names
- missing config failure
- invalid config shape failure

### Negative Coverage

Covered:

- no config found
- invalid config shape

Future PRs must cover:

- Markdown parser edge cases
- missing evidence sections
- missing evidence fields
- missing required proof
- changed-file area matching

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
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the agent-review loader.
- Unit tests pass.
- `pnpm-lock.yaml` remains clean after install.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is contract/config-loader only.

Future proof required:

- PR #31 Markdown evidence parser must parse evidence sections deterministically.
- PR #32 section validator must catch missing required sections.
- PR #33 evidence field validator must catch missing/invalid contract fields.
- PR #36 validator CLI must expose CI-friendly results.

## What This PR Does Not Prove

This PR does not prove:

- Markdown parser correctness
- evidence section validation
- evidence contract field validation
- changed-file classification
- required-proof resolution
- validator CLI behavior
- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic config loading and does not overclaim validator or CI behavior.
