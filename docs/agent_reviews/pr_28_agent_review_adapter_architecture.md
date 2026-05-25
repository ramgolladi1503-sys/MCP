# Agent Review Evidence — PR #28 Agent Review Adapter Architecture

## Agent Work Contract

### Goal

Lock the reusable plug-and-play Agent Review Kit architecture so MCP Shield's agent-review discipline can be adapted to other projects instead of being hard-coded only for MCP Shield.

### Files Changed

- `docs/AGENT_REVIEW_ADAPTER_ARCHITECTURE.md`
- `docs/agent_reviews/pr_28_agent_review_adapter_architecture.md`

### Evidence Contract Fields

mode: DOCS_ONLY
candidate_id: PR_28_AGENT_REVIEW_ADAPTER_ARCHITECTURE
decision: AGENT_REVIEW_ADAPTER_ARCHITECTURE_LOCK
reason: Defines reusable adapter architecture for project-specific agent-review governance before implementation.
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
source: docs/agent_reviews/pr_28_agent_review_adapter_architecture.md

### Non-Goals

- No runtime code changes.
- No package extraction.
- No validator CLI.
- No parser implementation.
- No CI enforcement.
- No changed-file classifier implementation.
- No project adapters in code.
- No gateway behavior changes.
- No policy behavior changes.

## Grill Me Review

### Pushback

Reusable architecture can become overengineering if it delays the actual validator or makes MCP Shield weaker by becoming too generic.

### Required Proof

- The architecture must separate reusable core from project-specific adapters.
- The MCP Shield adapter must keep MCP-specific safety rules.
- The design must not claim implementation exists.
- The roadmap must remain incremental.
- Project-specific hard rules must remain configurable, not watered down.

## Hermes Review

### Contract Clarity

The document defines:

- target name
- core responsibilities
- adapter responsibilities
- future TypeScript interface
- default adapter
- MCP Shield adapter
- Tradebot adapter
- Algotradify adapter
- config search order
- CLI direction
- CI direction
- output model
- plug-and-play install model
- implementation roadmap adjustment

### Naming / Schema / Compatibility

- Does not rename existing config.
- Keeps `mcp-shield.agent-review.yaml` as the MCP Shield adapter config.
- Allows generic `agent-review.yaml` for other projects.
- Does not invalidate PR #25, #26, or #27.

## GSD Review

### Determinism

Docs-only. No runtime behavior.

### Minimality

This PR adds only the adapter architecture and evidence file. It does not implement the validator, parser, or CI gate.

### No Fake Progress

This materially improves product direction by preventing MCP Shield from building a one-off governance system that cannot be reused across the user's other enterprise projects.

## Security Review

### Security Impact

No runtime security behavior changes.

### Security Checks

The architecture preserves MCP Shield-specific safety rules instead of replacing them with generic weak rules.

The reusable kit must allow project-specific rules such as:

- MCP Shield: never forward blocked MCP calls, never pollute stdio, never log secrets before redaction.
- Tradebot: no broker calls unless scoped, fail closed on stale feed, strict paper/live boundaries.
- Algotradify: no live execution before roadmap phase, journal is truth, reducer derives state.

## QA / Failure Review

### Required Tests

No product tests are required because this is docs-only.

### Negative Coverage

Future implementation PRs must test:

- missing config
- invalid config
- unknown adapter
- missing evidence sections
- missing evidence fields
- docs-only PR claiming runtime behavior
- changed files requiring proof that is absent
- generic adapter fallback
- MCP Shield adapter-specific rules

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
- tests

Banned areas remain out of scope:

- cloud SaaS
- billing
- auth
- dashboard implementation
- agent auto-merge
- agent auto-fix
- runtime MCP behavior

## Acceptance Proof

Expected proof:

- `docs/AGENT_REVIEW_ADAPTER_ARCHITECTURE.md` exists.
- It defines reusable core vs project adapters.
- It defines MCP Shield, Tradebot, and Algotradify adapter direction.
- It defines future CLI and CI direction.
- It updates the roadmap sequence to avoid hard-coding MCP-only validation.
- This evidence file states the PR is docs-only.

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

None for PR #28 because it is docs-only.

Future proof required:

- Config type contract.
- Config loader.
- Markdown evidence parser.
- Section validator.
- Evidence field validator.
- Changed-file area classifier.
- Validator CLI.
- CI integration.

## What This PR Does Not Prove

This PR does not prove:

- reusable package implementation
- parser correctness
- validator correctness
- CI enforcement
- project adapter runtime behavior
- gateway behavior
- policy behavior
- approval behavior
- audit behavior

## Human Approval

Proceed only if the reusable adapter direction is accepted and reviewers agree MCP Shield should implement the agent-review architecture as a plug-and-play kit rather than a one-off repo-only system.
