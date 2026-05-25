# MCP Shield Git Workflow

## Purpose

This workflow keeps MCP Shield from becoming a PR loop or a cosmetic project. Every PR must improve one of the following:

- safety
- runtime correctness
- policy correctness
- approval integrity
- audit evidence
- observability/debuggability
- test coverage
- release readiness
- enterprise documentation

## Branch Naming

Allowed prefixes:

- `docs/`
- `feature/`
- `hardening/`
- `fix/`
- `observability/`
- `agent-arch/`
- `policy/`
- `gateway/`
- `audit/`
- `scanner/`
- `approval/`
- `release/`

Examples:

```text
docs/pr-25-enterprise-scope-lock
agent-arch/pr-28-agent-review-config-schema
observability/pr-39-debug-event-schema
policy/pr-61-risk-threshold-policy
gateway/pr-88-drift-gate-gateway-integration
```

## PR Body Requirements

Every PR body must include:

1. Summary.
2. Changed files.
3. Scope.
4. Safety impact.
5. Tests.
6. Agent review evidence path.
7. What this PR does not prove.
8. Next PR.

## Evidence File Requirement

Every non-trivial PR must include:

```text
docs/agent_reviews/pr_<number>_<short_slug>.md
```

Docs-only PRs still need evidence when they lock scope, architecture, roadmap, or process.

## Required Gates

Every PR must pass:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

## Area-Specific Gates

| Changed Area | Required Proof |
|---|---|
| `packages/gateway` | Protocol test, stdout purity, block/forward proof |
| `packages/policy` | Mode matrix, fail-closed test, false-positive test |
| `packages/audit` | Redaction, hash-chain, tamper test |
| `packages/gateway/src/approval.ts` | Approve, deny, expire, tamper, hash mismatch |
| `packages/scanner` | Attack corpus and false-positive corpus |
| `packages/cli` | Built CLI smoke test |
| `packages/config-adapter` | Backup, rewrite, rollback, disable proof |
| `.github/workflows` | Workflow safety and release gate explanation |
| `scripts/release*` | Package/tarball/publish dry-run proof |
| Docs-only | No runtime claims |

## Merge Rules

A PR must not merge unless:

1. CI is green.
2. Scope is clear.
3. Evidence file exists when required.
4. Tests match changed area.
5. No unrelated behavior was changed.
6. PR body states what is not proven.
7. Next PR is stated.

## What Is Not Allowed

- Cosmetic PRs that do not improve product value.
- Broad refactors hidden inside feature PRs.
- Test weakening.
- Silent fail-open behavior.
- Runtime behavior changes in docs-only PRs.
- Dashboard/cloud/auth/billing work before enterprise local v1 foundations.
- Agent auto-merge or auto-fix features inside the enterprise local roadmap.

## PR Size Rule

PRs should be small and reviewable, but not meaningless.

Good PR shape:

- one contract
- one module
- one behavior gate
- one CLI command
- one corpus expansion
- one CI enforcement slice
- one demo/runbook slice

Bad PR shape:

- mixed architecture and runtime behavior
- mixed UI and policy engine changes
- mixed release workflow and gateway behavior
- broad rename with product logic
- sweeping refactor without new safety proof

## Release Discipline

Release-related PRs must prove:

- locked dependency install
- build
- typecheck
- lint
- hardening tests
- built CLI smoke
- tarball contents
- dry-run publish
- no accidental real publish

## Human Approval

Human approval must be based on evidence, not confidence.

A PR should be approved only when the scoped behavior is proven and the remaining risk is explicitly stated.
