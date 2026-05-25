# Agent Review Evidence Contract

## Purpose

This directory contains the required agent-review evidence for MCP Shield pull requests.

The evidence system exists to prevent fake progress, unclear scope, unsafe runtime changes, and unreviewed security behavior. It is adapted from the Tradebot-style delivery discipline but scoped specifically for MCP Shield as an enterprise Agent Firewall.

## When Evidence Is Required

An agent-review evidence file is required for every non-trivial PR.

Evidence is mandatory when a PR changes any of the following:

- gateway behavior
- policy behavior
- scanner behavior
- audit behavior
- approval behavior
- CLI behavior
- config adapter behavior
- observability/debug behavior
- release behavior
- CI workflow behavior
- enterprise scope, roadmap, security model, or process rules

Evidence is also required for docs-only PRs when the document locks architecture, scope, roadmap, quality gates, threat model, or workflow rules.

## File Naming

Use this naming convention:

```text
docs/agent_reviews/pr_<number>_<short_slug>.md
```

Examples:

```text
docs/agent_reviews/pr_25_enterprise_scope_lock.md
docs/agent_reviews/pr_26_agent_review_template_contract.md
docs/agent_reviews/pr_40_gateway_trace_context_propagation.md
```

## Required Sections

Every evidence file must include these sections exactly:

1. Agent Work Contract
2. Grill Me Review
3. Hermes Review
4. GSD Review
5. Security Review
6. QA / Failure Review
7. Scope Guard
8. Acceptance Proof
9. Runtime Proof Required After Merge
10. What This PR Does Not Prove
11. Human Approval

## Section Purpose

### Agent Work Contract

Defines the PR before implementation.

Must include:

- Goal.
- Files changed.
- Evidence contract fields.
- Non-goals.
- Safety impact.

### Grill Me Review

Attacks assumptions.

Must answer:

- What can bypass this?
- What can silently fail open?
- What can be overclaimed?
- What negative cases are required?
- What false positives must be avoided?

### Hermes Review

Checks clarity.

Must confirm:

- Naming is clear.
- Schema is explicit.
- Serialization is safe where relevant.
- Documentation does not overclaim behavior.
- Compatibility is considered.

### GSD Review

Checks delivery discipline.

Must confirm:

- Minimal implementation.
- Deterministic logic.
- No unrelated abstractions.
- No broad refactor.
- No test weakening.
- Tests prove behavior, not only shapes.

### Security Review

Checks security behavior.

Must cover relevant items:

- fail-closed behavior
- secret redaction
- approval bypass prevention
- MCP stdio stdout purity
- child server forwarding boundaries
- network egress
- tool poisoning
- tool drift
- audit integrity
- tamper behavior

### QA / Failure Review

Checks negative and failure coverage.

Must include relevant cases:

- malformed input
- missing fields
- timeout
- corrupt file/config
- approval denial
- approval expiry
- tamper
- false-positive safe case

### Scope Guard

States what the PR does not touch.

This prevents architecture creep.

### Acceptance Proof

Defines exact commands and expected proof.

### Runtime Proof Required After Merge

States runtime proof still required later, especially for docs-only or contract-only PRs.

### What This PR Does Not Prove

Prevents fake claims.

### Human Approval

Defines when a human should approve the PR.

## Area-Specific Required Proof

| Changed Area | Required Extra Proof |
|---|---|
| `packages/gateway` | Protocol test, stdout purity, block/forward proof, timeout behavior |
| `packages/policy` | Mode matrix, fail-closed test, false-positive test |
| `packages/audit` | Redaction, hash-chain, tamper/replay test |
| `packages/gateway/src/approval.ts` | Create, approve, deny, expire, tamper, hash mismatch |
| `packages/scanner` | Attack corpus and false-positive corpus |
| `packages/cli` | Built CLI smoke proof |
| `packages/config-adapter` | Backup, rewrite, rollback, disable proof |
| `.github/workflows` | Workflow safety and release gate explanation |
| `scripts/release*` | Package/tarball/publish dry-run proof |
| `docs/` only | No runtime claims |

## Default Repo Gates

Every PR should be able to pass:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Docs-only PRs may state that product tests are not required, but they must not claim runtime behavior.

## Hard Rule

No PR should be merged because it sounds good. It should be merged only when the evidence proves the scoped behavior and clearly states the remaining risk.
