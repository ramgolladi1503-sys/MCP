# Agent Review Evidence — PR #29 Agent Review Config Type Contract

## Agent Work Contract

### Goal

Add the first implementation-facing type contract for the reusable Agent Review Kit without implementing parsing, validation, CLI, CI enforcement, or runtime MCP behavior.

### Files Changed

- `packages/agent-review/package.json`
- `packages/agent-review/tsconfig.json`
- `packages/agent-review/src/index.ts`
- `tsconfig.build.json`
- `docs/agent_reviews/pr_29_agent_review_config_type_contract.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_29_AGENT_REVIEW_CONFIG_TYPE_CONTRACT
decision: AGENT_REVIEW_CONFIG_TYPE_CONTRACT
reason: Defines reusable TypeScript contracts for agent-review config, evidence documents, adapter identity, changed-file classification, and validation results.
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
source: docs/agent_reviews/pr_29_agent_review_config_type_contract.md

### Non-Goals

- No config loading.
- No YAML parsing.
- No Markdown parsing.
- No validation logic.
- No validator CLI.
- No CI enforcement.
- No changed-file matcher implementation.
- No runtime MCP gateway changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.

## Grill Me Review

### Pushback

Adding a new package could look like architecture creep if it does not remain focused on type contracts.

### Required Proof

- The package must contain contracts only.
- The package must not import runtime gateway/policy/audit code.
- No validator behavior should be implemented.
- No CLI command should be added.
- The build graph may include the package so typecheck catches contract errors.

## Hermes Review

### Contract Clarity

The type contract names are explicit:

- `AgentReviewConfig`
- `AgentReviewEvidenceContract`
- `AgentReviewEvidenceDocument`
- `AgentReviewAdapterIdentity`
- `AgentReviewAreaClassification`
- `AgentReviewValidationIssue`
- `AgentReviewValidationResult`
- `AgentReviewAdapter`

### Naming / Schema / Compatibility

- Schema version constant is explicit.
- Modes match the YAML config introduced in PR #27.
- No existing exports are changed.
- No runtime package dependency is introduced.

## GSD Review

### Determinism

Contract-only TypeScript types. No runtime behavior.

### Minimality

This PR adds a focused package with types only and wires it into `tsconfig.build.json` so future changes are typechecked.

### No Fake Progress

This creates the foundation needed before config loader, parser, validator, and CLI implementation. It avoids jumping directly into CLI without stable contracts.

## Security Review

### Security Impact

No runtime security behavior changes.

### Security Checks

The contracts preserve security-relevant fields:

- runtime change flag
- security runtime change flag
- child MCP forwarding flag
- policy behavior flag
- approval behavior flag
- audit schema flag
- changed-file area classification
- validation issues and severity

## QA / Failure Review

### Required Tests

No product tests are required because this is contract-only.

Typecheck should cover exported TypeScript contract correctness once the package is included in the build graph.

### Negative Coverage

Future PRs must test:

- invalid config loading
- missing required sections
- missing fields
- changed-file area rule matching
- missing proof resolution
- markdown parser edge cases

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

- `@mcp-shield/agent-review` builds.
- Root `tsconfig.build.json` includes the new package.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for PR #29 because it is contract-only.

Future proof required:

- PR #30 config loader must load config safely.
- PR #31 Markdown parser must parse evidence sections deterministically.
- PR #32 section validator must catch missing required sections.
- PR #36 validator CLI must expose CI-friendly results.

## What This PR Does Not Prove

This PR does not prove:

- config loader correctness
- parser correctness
- validator correctness
- CLI behavior
- CI enforcement
- MCP Shield runtime security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree the reusable Agent Review Kit should have a dedicated package and this PR remains limited to type contracts and build graph wiring.
