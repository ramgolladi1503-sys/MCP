# Agent Review Evidence — PR #40 Package Root Export Contract

## Agent Work Contract

### Goal

Expose the Agent Review Kit public API from the package root so consumers can import config loading, evidence parsing, changed-file classification, validation helpers, required-proof resolution, and validator CLI helpers from one stable root module.

### Files Changed

- `packages/agent-review/src/index.ts`
- `tests/unit/agent-review/root-export-contract.test.ts`
- `docs/agent_reviews/pr_40_package_root_export_contract.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_40_PACKAGE_ROOT_EXPORT_CONTRACT
decision: PACKAGE_ROOT_EXPORT_CONTRACT
reason: Adds package-root exports and contract tests for Agent Review Kit APIs without changing MCP runtime gateway, policy, approval, audit, scanner, CLI command behavior, CI enforcement, or release publishing behavior.
is_runtime_change: false
is_security_runtime_change: false
child_mcp_forwarding_changed: false
policy_behavior_changed: false
approval_behavior_changed: false
audit_schema_changed: false
trace_behavior_changed: false
scanner_behavior_changed: false
cli_behavior_changed: false
config_adapter_behavior_changed: false
release_behavior_changed: false
ci_behavior_changed: false
source: docs/agent_reviews/pr_40_package_root_export_contract.md

### Non-Goals

- No MCP gateway runtime behavior changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.
- No scanner behavior changes.
- No CLI command behavior changes.
- No CI enforcement changes.
- No release publish flow changes.
- No package-lock or dependency changes.
- No package publication claim.

## Grill Me Review

### Pushback

The useful contract is not "some exports exist." The useful contract is that Agent Review Kit consumers can import the relevant public functions from `packages/agent-review/src/index.ts` without reaching into internal module paths. This PR must not pretend npm package publication is complete; it only proves root module export shape inside the current workspace.

### Required Proof

- Root module exports config loader APIs.
- Root module exports evidence parser APIs.
- Root module exports evidence validation APIs.
- Root module exports changed-file classification APIs.
- Root module exports required-proof resolver APIs.
- Root module exports validator CLI helper APIs.
- Unit test imports only from the package root module.
- No runtime claims.
- Scope is explicit.
- Future runtime proof stated if relevant.

## Hermes Review

### Contract Clarity

The root contract is `packages/agent-review/src/index.ts`.

External workspace consumers should be able to import from the package root path instead of internal files for the Agent Review Kit surface:

- config loading and validation
- evidence markdown loading and parsing
- evidence field validation
- required section validation
- mode rule validation
- area section validation
- changed-file classification
- required proof resolution
- validator CLI helpers

### Compatibility

Existing internal modules remain in place. This PR adds exports; it does not move files or change existing import paths.

## GSD Review

### Minimality

This PR intentionally avoids package metadata churn and lockfile churn. The current workspace already builds `packages/agent-review` through the project references. The root export contract is strengthened in the existing source root.

### Determinism

The new test checks exported symbols and one real behavior check for `changedFileMatchesPattern` from the root import.

### No Fake Progress

This is not package publication. This is not npm readiness. This is not runtime MCP readiness. It is only the package/root export contract for Agent Review Kit APIs.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

Confirmed no changes to:

- child MCP forwarding
- policy decisions
- approval lifecycle
- audit schema or hash-chain behavior
- scanner behavior
- config adapter behavior
- CLI command behavior
- CI enforcement behavior

## QA / Failure Review

### Required Tests

Added:

```bash
pnpm test:unit -- tests/unit/agent-review/root-export-contract.test.ts
```

The test proves:

- config loader exports exist at root
- evidence parser and validator exports exist at root
- changed-file classifier exports exist at root
- CLI helper exports exist at root
- `changedFileMatchesPattern` works through the root import

### Negative Coverage

This PR is contract-only. It does not add runtime negative tests because it does not alter runtime MCP behavior.

Failure risk covered by TypeScript and the root export contract test:

- missing root export
- broken root import
- broken changed-file helper export behavior

## Scope Guard

Touched intentionally:

- `packages/agent-review/src/index.ts`
- `tests/unit/agent-review/root-export-contract.test.ts`
- `docs/agent_reviews/pr_40_package_root_export_contract.md`

Confirmed not touched:

- `packages/gateway`
- `packages/policy`
- `packages/scanner`
- `packages/audit`
- `packages/cli`
- `packages/config-adapter`
- `.github/workflows/ci.yml`
- `scripts/release*`
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

Required commands:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test:unit -- tests/unit/agent-review/root-export-contract.test.ts
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Root export contract test passes.
- Typecheck catches any invalid public declaration export.
- Existing hardening suite remains green.
- Release dry-run remains unchanged.

## Runtime Proof Required After Merge

No MCP runtime proof is required after merge because this PR is contract-only.

Future runtime proof required only if a future PR uses Agent Review Kit exports from an external consumer or published package boundary.

## What This PR Does Not Prove

This PR does not prove:

- npm package publication readiness
- tarball contents for an Agent Review package
- external package manager installation
- MCP gateway runtime behavior
- policy behavior
- approval behavior
- audit behavior
- scanner behavior
- CI enforcement behavior

## Human Approval

Proceed only if reviewers agree this PR is limited to Agent Review Kit root exports and contract tests, with no runtime MCP behavior changes.
