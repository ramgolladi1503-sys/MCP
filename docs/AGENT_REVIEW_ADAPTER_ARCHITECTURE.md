# Agent Review Adapter Architecture

## Purpose

MCP Shield should not hard-code the agent-review architecture only for this repository.

The agent-review discipline should become a reusable plug-and-play kit that can be adapted to other projects such as Tradebot, Algotradify, Veriforge, RTI App, Mobile Approval Console, or future enterprise products.

This document locks the reusable adapter architecture before implementation.

## Product Boundary

This is not an autonomous agent system.

This is not agent auto-fix.

This is not agent auto-merge.

This is a reusable evidence, governance, and PR-quality framework that projects can install and adapt.

## Target Name

Working name:

```text
MCP Shield Agent Review Kit
```

Alternative future package names:

```text
@mcpshield/agent-review-kit
@mcpshield/project-guard
@mcpshield/enterprise-pr-guard
```

The package name should not be finalized until implementation packaging is scoped.

## Core Idea

Separate the framework into:

1. Core evidence engine.
2. Project adapters.
3. Area rules.
4. Templates.
5. Validator CLI.
6. CI integration.

Architecture:

```text
Project Repo
  -> agent-review config
  -> project adapter
  -> changed-file classifier
  -> evidence validator
  -> PR/CI gate
  -> human-readable evidence report
```

## Core Package Responsibilities

The reusable core should provide:

- evidence section validation
- evidence contract field validation
- mode validation
- required proof validation
- changed-file area mapping
- docs-only runtime-claim guard
- missing evidence detection
- PR body checklist validation later
- CI-friendly exit codes
- Markdown report output
- JSON report output

## Project Adapter Responsibilities

Each project adapter should define project-specific expectations.

Adapter inputs:

- product category
- project profile
- required sections
- required evidence fields
- modes
- hard rules
- runtime safety rules
- area rules
- default commands
- banned scope areas
- future enforcement references

Adapter output:

- normalized validation config
- changed-file area classification rules
- required proof list
- evidence template hints
- project-specific warnings

## Adapter Interface

Future TypeScript interface:

```ts
export interface AgentReviewAdapter {
  readonly id: string;
  readonly product: string;
  readonly category: string;
  readonly configFileNames: string[];
  loadConfig(projectRoot: string): Promise<AgentReviewConfig>;
  classifyChangedFiles(files: string[], config: AgentReviewConfig): AreaClassification[];
  validateEvidence(input: EvidenceValidationInput): EvidenceValidationResult;
  requiredProofForAreas(areas: AreaClassification[], config: AgentReviewConfig): RequiredProof[];
}
```

## Default Adapter

A generic default adapter should work for any repo.

Expected config file:

```text
agent-review.yaml
```

Generic assumptions:

- docs-only PRs must not claim runtime behavior
- runtime PRs need tests
- security runtime PRs need negative tests
- evidence files live under `docs/agent_reviews/`

## MCP Shield Adapter

MCP Shield adapter config file:

```text
mcp-shield.agent-review.yaml
```

MCP Shield-specific areas:

- gateway
- policy
- audit
- approval
- scanner
- CLI
- config adapter
- observability
- release
- docs-only

MCP Shield-specific safety rules:

- never forward blocked calls
- never pollute MCP stdio stdout
- never log secrets before redaction
- fail closed on missing approval
- fail closed on approval hash mismatch
- fail closed on malformed policy
- never silently trust tool drift

## Tradebot Adapter

Future Tradebot adapter config file:

```text
tradebot.agent-review.yaml
```

Tradebot-specific areas may include:

- feed
- ranking
- executable truth
- risk
- strategy
- broker boundary
- dashboard
- runtime evidence
- paper/live mode
- tests
- docs-only

Tradebot-specific safety rules may include:

- no broker calls unless explicitly scoped
- no accidental order placement
- fail closed on stale feed
- fail closed on fallback executable claims
- paper/live boundaries must remain strict
- every executable claim needs evidence

## Algotradify Adapter

Future Algotradify adapter config file:

```text
algotradify.agent-review.yaml
```

Algotradify-specific areas may include:

- paper event journal
- reducer
- replay
- evidence bundle
- strategy provider
- live execution boundary
- dashboard
- tests
- docs-only

Hard rules may include:

- no live execution before approved roadmap phase
- journal is truth
- reducer derives state
- every PR includes acceptance proof

## Other Project Adapters

Future adapters can support:

- Veriforge evidence system
- RTI app government data trust workflow
- Mobile Approval Console approval lifecycle
- generic Node/TypeScript repo
- generic Python repo
- generic documentation-first product repo

## Configuration Search Order

A future validator should look for configs in this order:

1. Explicit `--config` argument.
2. Known project-specific config names.
3. Generic `agent-review.yaml`.
4. Built-in default profile.

Known config names:

```text
mcp-shield.agent-review.yaml
tradebot.agent-review.yaml
algotradify.agent-review.yaml
agent-review.yaml
```

## CLI Direction

Future command:

```bash
mcp-shield agent-review check \
  --config mcp-shield.agent-review.yaml \
  --evidence docs/agent_reviews/pr_29_validator_cli_foundation.md \
  --changed-files changed-files.txt \
  --format markdown
```

Generic project command:

```bash
mcp-shield agent-review check \
  --config agent-review.yaml \
  --evidence docs/agent_reviews/pr_10_security_gate.md
```

## CI Direction

Future CI gate:

```bash
pnpm mcp-shield agent-review check \
  --config mcp-shield.agent-review.yaml \
  --evidence docs/agent_reviews/pr_${PR_NUMBER}_*.md \
  --changed-files .runtime/changed-files.txt \
  --format github
```

## Output Model

Validator output should include:

- status: pass/fail
- project profile
- detected areas
- required sections present/missing
- required evidence fields present/missing
- required proof present/missing
- hard-rule warnings
- docs-only runtime-claim warnings
- next required action

## Plug-and-Play Install Model

Future package should support:

```bash
pnpm add -D @mcpshield/agent-review-kit
```

or local workspace usage:

```bash
pnpm --filter @mcpshield/cli agent-review check
```

The same architecture should work for any project by adding:

```text
agent-review.yaml
docs/agent_reviews/TEMPLATE.md
docs/agent_reviews/pr_<number>_<slug>.md
```

## What Must Remain Project-Specific

The reusable kit must not pretend every project has the same risk model.

Project-specific:

- hard rules
- runtime safety rules
- area names
- changed-file patterns
- required proofs
- banned scope areas
- product terminology
- acceptance commands

Reusable:

- evidence parser
- section validator
- field validator
- changed-file matcher
- report generator
- CLI contract
- CI exit behavior
- template rendering

## Implementation Roadmap Adjustment

This reusable adapter direction changes the next implementation sequence:

- PR #28 — Agent Review Adapter Architecture
- PR #29 — Agent Review Config Type Contract
- PR #30 — Agent Review Config Loader
- PR #31 — Evidence Markdown Parser
- PR #32 — Evidence Section Validator
- PR #33 — Evidence Contract Field Validator
- PR #34 — Changed-File Area Classifier
- PR #35 — Required Proof Resolver
- PR #36 — Validator CLI Foundation
- PR #37 — Markdown and JSON Report Output
- PR #38 — Scope Guard CI Integration
- PR #39 — MCP Shield Adapter Hardening
- PR #40 — Generic Adapter Example

This replaces the earlier direct validator jump with a reusable package-friendly sequence.

## Non-Goals For This PR

This PR does not implement:

- package extraction
- validator CLI
- parser
- CI gate
- changed-file classifier
- reusable npm package
- project adapters in code
- runtime MCP gateway behavior

This PR only locks the reusable adapter architecture.
