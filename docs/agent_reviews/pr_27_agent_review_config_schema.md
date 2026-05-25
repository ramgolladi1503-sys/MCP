# Agent Review Evidence — PR #27 Agent Review Config Schema

## Agent Work Contract

### Goal

Add a machine-readable agent-review configuration schema and default config that future validator and CI guard PRs can consume.

### Files Changed

- `mcp-shield.agent-review.yaml`
- `docs/AGENT_REVIEW_CONFIG_SCHEMA.md`
- `docs/agent_reviews/pr_27_agent_review_config_schema.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_27_AGENT_REVIEW_CONFIG_SCHEMA
decision: AGENT_REVIEW_CONFIG_SCHEMA
reason: Defines machine-readable evidence expectations for future validator and CI enforcement without implementing enforcement yet.
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
source: docs/agent_reviews/pr_27_agent_review_config_schema.md

### Non-Goals

- No runtime code changes.
- No validator CLI.
- No CI enforcement.
- No changed-file classifier.
- No gateway behavior changes.
- No policy behavior changes.
- No approval behavior changes.
- No scanner behavior changes.
- No audit schema changes.

## Grill Me Review

### Pushback

A YAML config can create a false sense of enforcement if no validator or CI gate consumes it.

### Required Proof

- The config must clearly mark future enforcement PRs.
- The schema doc must state this PR does not validate anything yet.
- The config must include required sections, evidence fields, modes, hard rules, runtime safety rules, area rules, and default commands.
- The PR must not claim automated enforcement.

## Hermes Review

### Contract Clarity

The config is human-readable YAML with stable top-level sections:

- schema_version
- profile
- metadata
- required_sections
- required_evidence_contract_fields
- modes
- hard_rules
- runtime_safety_rules
- area_rules
- required_default_commands
- future_enforcement

### Naming / Schema / Compatibility

- Schema version is explicit.
- Profile is explicit.
- Modes are explicit.
- Area names are stable.
- No existing files are renamed.
- No runtime config is affected.

## GSD Review

### Determinism

Contract-only. No runtime behavior.

### Minimality

This PR adds only the config file, schema documentation, and evidence file. It avoids validator implementation and CI enforcement, which belong to later PRs.

### No Fake Progress

This makes future enforcement possible by creating the source-of-truth config before writing validator code.

## Security Review

### Security Impact

No runtime security behavior changes.

### Security Checks

The config records future mandatory safety rules including:

- fail closed on malformed policy
- fail closed on malformed tool calls
- fail closed on missing required approval
- never log secrets before redaction
- never pollute MCP stdio stdout
- never forward blocked calls
- never silently downgrade block to warn
- never trust tool schema drift without review

These are not automatically enforced yet.

## QA / Failure Review

### Required Tests

No product tests are required because this is contract-only documentation/config.

### Negative Coverage

Future validator PRs must test:

- missing required sections
- missing evidence fields
- invalid mode
- missing source path
- docs-only PR claiming runtime behavior
- gateway path without protocol proof
- policy path without mode matrix proof

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
- tests

Banned areas remain out of scope:

- cloud SaaS
- billing
- auth
- dashboard implementation
- agent auto-merge
- agent auto-fix

## Acceptance Proof

Expected proof:

- `mcp-shield.agent-review.yaml` exists.
- `docs/AGENT_REVIEW_CONFIG_SCHEMA.md` exists.
- Config includes required sections, fields, modes, area rules, hard rules, runtime safety rules, default commands, and future enforcement references.
- Evidence file states this is contract-only.
- No runtime behavior is changed.

Recommended local command:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

## Runtime Proof Required After Merge

None for this PR because it is contract-only.

Future runtime/process proof required:

- PR #29 validator CLI must parse and validate this config.
- PR #32 Scope Guard CI must consume validation results.
- PR #33 changed-file classifier must map changed files to area rules.

## What This PR Does Not Prove

This PR does not prove:

- automated validation
- CI enforcement
- changed-file classification
- runtime security readiness
- gateway behavior
- policy behavior
- approval behavior
- audit behavior

## Human Approval

Proceed only if the config accurately reflects the enterprise scope locked in PR #25 and the evidence template contract from PR #26.
