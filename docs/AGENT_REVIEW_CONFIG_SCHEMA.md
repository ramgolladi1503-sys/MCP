# Agent Review Config Schema

## Purpose

`mcp-shield.agent-review.yaml` is the machine-readable configuration contract for MCP Shield PR evidence expectations.

This PR does not implement validation. It only defines the config shape that future validator and CI guard PRs will consume.

## Schema Version

```yaml
schema_version: "1.0"
```

## Profile

```yaml
profile: enterprise_agent_firewall
```

The profile locks the configuration to the enterprise Agent Firewall scope defined in `docs/MCP_SHIELD_ENTERPRISE_SCOPE_BIBLE.md`.

## Required Sections

The `required_sections` array defines the Markdown sections every agent-review evidence file must include:

```yaml
required_sections:
  - Agent Work Contract
  - Grill Me Review
  - Hermes Review
  - GSD Review
  - Security Review
  - QA / Failure Review
  - Scope Guard
  - Acceptance Proof
  - Runtime Proof Required After Merge
  - What This PR Does Not Prove
  - Human Approval
```

## Evidence Contract Fields

The `required_evidence_contract_fields` array defines the minimum structured fields expected inside the Agent Work Contract.

Required fields:

- `mode`
- `candidate_id`
- `decision`
- `reason`
- `is_runtime_change`
- `is_security_runtime_change`
- `child_mcp_forwarding_changed`
- `policy_behavior_changed`
- `approval_behavior_changed`
- `audit_schema_changed`
- `source`

Optional fields exist for areas such as scanner, CLI, config adapter, release, observability, and CI behavior.

## Modes

The `modes` section defines the expected behavior by PR type.

### DOCS_ONLY

For documentation-only PRs.

Rules:

- Runtime changes are not allowed.
- Product tests are not required.
- The PR must state that it does not prove runtime behavior.

### CONTRACT_ONLY

For schema, architecture, roadmap, or type-contract PRs that do not wire runtime behavior yet.

Rules:

- Runtime changes are not allowed.
- Product tests may not be required.
- Future runtime proof must be stated.

### RUNTIME_CHANGE

For PRs that change runtime behavior.

Rules:

- Product tests are required.
- Negative tests are required.

### SECURITY_RUNTIME_CHANGE

For PRs that change security-sensitive behavior.

Rules:

- Product tests are required.
- Negative tests are required.
- False-positive tests are required.
- Audit or debug evidence is required.

## Hard Rules

The `hard_rules` section captures repo-level delivery restrictions such as:

- no fake progress
- no PR-loop cosmetic work
- no unrelated abstractions
- no test weakening
- no runtime claims from docs-only PRs
- no cloud SaaS before local enterprise v1
- no agent auto-merge
- no agent auto-fix

## Runtime Safety Rules

The `runtime_safety_rules` section captures mandatory fail-closed behavior, redaction behavior, MCP stdio safety, forwarding boundaries, drift handling, and audit failure behavior.

These are not automatically enforced yet. Future PRs must turn them into validator and CI checks.

## Area Rules

The `area_rules` section maps path patterns to required proof.

Examples:

| Area | Path Pattern | Required Proof |
|---|---|---|
| gateway | `packages/gateway/**` | protocol test, stdout purity, block before forward proof |
| policy | `packages/policy/**` | mode matrix, fail-closed test, false-positive test |
| audit | `packages/audit/**` | redaction, hash-chain, tamper/replay |
| approval | approval source paths | create, approve, deny, expire, tamper, hash mismatch |
| scanner | `packages/scanner/**` | attack corpus, false-positive corpus |
| release | release scripts/workflows/package files | tarball proof, publish dry-run proof |

## Default Commands

The config records default repo gates:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

## Future Enforcement

This PR intentionally does not enforce the config.

Future work:

- PR #29 — validator CLI
- PR #32 — Scope Guard CI
- PR #33 — changed-file classifier

## Non-Goals

This schema does not implement:

- validation
- CI enforcement
- PR comment automation
- GitHub labels
- runtime security changes
- gateway behavior changes
- policy behavior changes
