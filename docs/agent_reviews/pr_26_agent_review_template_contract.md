# Agent Review Evidence — PR #26 Agent Review Template Contract

## Agent Work Contract

### Goal

Add the reusable agent-review evidence contract and template for all future MCP Shield PRs.

### Files Changed

- `docs/agent_reviews/README.md`
- `docs/agent_reviews/TEMPLATE.md`
- `docs/agent_reviews/pr_26_agent_review_template_contract.md`

### Evidence Contract Fields

mode: DOCS_ONLY
candidate_id: PR_26_AGENT_REVIEW_TEMPLATE_CONTRACT
decision: AGENT_REVIEW_TEMPLATE_CONTRACT
reason: Establishes reusable evidence expectations and a standard template so future PRs follow the enterprise scope locked in PR #25.
is_runtime_change: false
is_security_runtime_change: false
child_mcp_forwarding_changed: false
policy_behavior_changed: false
approval_behavior_changed: false
audit_schema_changed: false
scanner_behavior_changed: false
cli_behavior_changed: false
release_behavior_changed: false
source: docs/agent_reviews/pr_26_agent_review_template_contract.md

### Non-Goals

- No runtime code changes.
- No validator CLI yet.
- No CI enforcement yet.
- No policy behavior changes.
- No gateway behavior changes.
- No approval behavior changes.
- No scanner behavior changes.
- No audit schema changes.

## Grill Me Review

### Pushback

A template alone does not enforce behavior. Future PRs could ignore it until validator and CI enforcement exist.

### Required Proof

- The README must clearly state when evidence is required.
- The template must include all sections locked by PR #25.
- The template must include explicit evidence contract fields.
- The PR must not claim automated enforcement.
- The PR must identify validator/CI enforcement as future work.

## Hermes Review

### Contract Clarity

The README explains required files, naming, sections, area-specific proof, and default repo gates.

### Naming / Schema / Compatibility

- Template uses stable section names.
- Evidence fields are explicit and simple.
- Docs remain Markdown-only.
- No existing evidence files are renamed or invalidated.

## GSD Review

### Determinism

Docs-only. No runtime behavior.

### Minimality

This PR adds only the contract README, reusable template, and PR-specific evidence. It does not implement validation or CI, which belongs to later scoped PRs.

### No Fake Progress

This improves enterprise delivery discipline by making future evidence expectations reusable and reviewable before automation is added.

## Security Review

### Security Impact

No runtime security behavior changes.

### Security Checks

This PR strengthens process expectations for future security changes by requiring sections for:

- fail-closed behavior
- secret redaction
- approval bypass prevention
- stdout protocol purity
- child server forwarding boundaries
- network egress
- tool poisoning
- tool drift
- audit integrity
- tamper behavior

## QA / Failure Review

### Required Tests

No product tests are required because this is docs-only.

### Negative Coverage

Future runtime PRs must define negative coverage in their evidence file. This PR only defines the template.

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
- autonomous agent execution
- agent auto-merge

## Acceptance Proof

Expected proof:

- `docs/agent_reviews/README.md` exists.
- `docs/agent_reviews/TEMPLATE.md` exists.
- Template includes all PR #25 required sections.
- Evidence file states this PR is docs-only.
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

None for PR #26 because it is docs-only.

Future work:

- PR #27 or PR #28 must add machine-readable agent-review config/schema.
- PR #29 must add validator CLI.
- PR #32 must add Scope Guard CI enforcement.

## What This PR Does Not Prove

This PR does not prove:

- automated enforcement
- CI scope guarding
- validator correctness
- runtime security readiness
- gateway behavior
- policy behavior
- approval behavior
- audit behavior

## Human Approval

Proceed only if the template matches the PR #25 enterprise scope lock and reviewers agree future PRs should use this evidence contract.
