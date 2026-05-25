# Agent Review Kit Product PR Roadmap

## Purpose

This document is the handoff-safe product PR roadmap for the reusable Agent Review Kit.

It exists so future chats, consultants, reviewers, and implementation agents do not lose track of the agreed direction.

The Agent Review Kit is not a one-off MCP Shield-only workflow. It is a reusable plug-and-play evidence and PR-governance framework with project adapters.

## Current Source-of-Truth Status

Latest confirmed merged PR before this roadmap lock:

```text
PR #40 — Package / Root Export Contract
```

Current roadmap-lock PR:

```text
GitHub PR #41 — Agent Review Kit Product PR Roadmap Lock
```

Because GitHub assigned the roadmap lock as PR #41, the next implementation PR becomes:

```text
PR #42 — Evidence Markdown Parser / Next Scoped Agent Review Kit Work
```

## Continue Prompt For New Chats

Use this exact prompt when continuing work in a new chat:

```text
Continue MCP Shield Agent Review Kit from PR #41 — Agent Review Kit Product PR Roadmap Lock.

Repository: ramgolladi1503-sys/MCP
Latest confirmed merged before roadmap lock: PR #40 — Package / Root Export Contract.

The Agent Review Kit must remain reusable and plug-and-play with project adapters. MCP Shield is the first adapter, but the architecture must support Tradebot, Algotradify, Veriforge, RTI App, Mobile Approval Console, and generic TypeScript/Python repos.

First verify whether PR #41 is merged. If merged, continue with PR #42 as the next scoped Agent Review Kit implementation PR.

Do not jump to new CI behavior, package extraction, or adapter expansion unless the roadmap says that prerequisite parser/validator/classifier/proof layers are already complete and tested.
```

## Locked Product Direction

The agent-review architecture must be implemented as a reusable kit:

```text
Project Repo
  -> agent-review config
  -> project adapter
  -> changed-file classifier
  -> evidence parser
  -> evidence validators
  -> required-proof resolver
  -> CLI report
  -> CI gate
```

MCP Shield must not hard-code this system only for itself.

## Clean Architecture Split

| Layer | Responsibility |
|---|---|
| Core engine | Parse evidence, validate sections, validate fields, classify changed files, resolve required proof, produce reports |
| Project adapter | Project-specific hard rules, paths, required proof, banned scope, safety expectations |
| Config | `mcp-shield.agent-review.yaml`, `tradebot.agent-review.yaml`, `algotradify.agent-review.yaml`, generic `agent-review.yaml` |
| CLI | `mcp-shield agent-review check` |
| CI | Scope Guard / PR evidence gate |

## Target Projects For Adapters

The reusable architecture must support:

- MCP Shield
- Tradebot
- Algotradify
- Veriforge
- RTI App
- Mobile Approval Console
- Generic TypeScript repos
- Generic Python repos
- Documentation-first product repos

## Already Completed Agent Review Kit PRs

| PR | Title | Status | Product Meaning |
|---|---|---|---|
| #25 | Enterprise Scope Lock | Merged | Locked MCP Shield as enterprise-grade local-first Agent Firewall before more implementation |
| #26 | Agent Review Template Contract | Merged | Established reusable PR evidence sections and review discipline |
| #27 | Agent Review Config Schema | Merged | Added machine-readable config shape through `mcp-shield.agent-review.yaml` |
| #28 | Agent Review Adapter Architecture | Merged | Reframed agent-review system as reusable plug-and-play adapter architecture |
| #29 | Agent Review Config Type Contract | Merged | Added TypeScript contracts for config, evidence, adapters, classifications, validation results |
| #30 | Agent Review Config Loader | Merged | Added deterministic config discovery, YAML/JSON parsing, and fail-closed shape validation |
| #31 | Evidence Markdown Parser | Merged | Added deterministic Markdown evidence parser |
| #32 | Required Section Validator | Merged | Added required evidence section validation |
| #33 | Evidence Field Validator | Merged | Added evidence contract field validation |
| #34 | Mode-Specific Validator | Merged | Added mode-specific rules for docs/runtime/security changes |
| #35 | Changed-File Classifier | Merged | Added changed-file area classification |
| #36 | Required Proof Resolver | Merged | Added proof obligation resolution |
| #37 | Area-Specific Evidence Validator | Merged | Added area-specific evidence expectations |
| #38 | Validator CLI | Merged | Added local validator CLI foundation |
| #39 | CI Scope Guard | Merged | Added CI enforcement for PR evidence scope guard |
| #40 | Package / Root Export Contract | Merged | Added package/root export contract |
| #41 | Agent Review Kit Product PR Roadmap Lock | Current | Locks this roadmap so future chats do not lose sequence or product direction |

## Locked Next PR Sequence

| PR | Title | Scope |
|---|---|---|
| #42 | Next Scoped Agent Review Kit Work | Continue from the latest merged code state only after PR #41 is merged; do not assume stale roadmap numbering. |
| #43 | Markdown and JSON Report Output | Human-readable and machine-readable validation reports if not already fully covered. |
| #44 | MCP Shield Adapter Hardening | Tighten MCP Shield-specific rules and fixtures. |
| #45 | Generic Adapter Example | Add generic `agent-review.yaml` example for non-MCP Shield projects. |
| #46 | Tradebot Adapter Contract | Add Tradebot adapter config contract only, no Tradebot repo coupling. |
| #47 | Algotradify Adapter Contract | Add Algotradify adapter config contract only, no Algotradify repo coupling. |
| #48 | Adapter Template Generator | Generate starter config/template files for new projects. |
| #49 | Package Extraction Decision | Decide whether to publish/extract `@mcp-shield/agent-review` and intentionally handle package metadata/lockfile changes. |

## PR Boundaries

### PR #42 — Next Scoped Agent Review Kit Work

Allowed:

- First inspect the latest main branch.
- Identify the exact next missing layer from code, tests, and docs.
- Keep the PR single-purpose.
- Include exactly one correctly numbered evidence file for the real GitHub PR number.

Not allowed:

- Re-implement already merged PRs.
- Touch runtime MCP behavior unless explicitly scoped.
- Add package publishing metadata casually.
- Change CI behavior unless the PR is specifically a CI PR.

## Hard Rules For All Agent Review Kit PRs

- Do not weaken existing tests.
- Do not add fake happy-path-only tests.
- Do not skip evidence files.
- Do not claim runtime security behavior from docs-only or contract-only PRs.
- Do not jump ahead to unrelated CLI/CI/package work.
- Do not add package publishing metadata casually; package extraction must be an explicit PR.
- Do not mutate `pnpm-lock.yaml` unless the PR intentionally changes dependencies or workspace package metadata.
- Do not touch MCP runtime gateway, policy, scanner, audit, approval, or config-adapter behavior unless the PR explicitly scopes it.

## Package Extraction Rule

PR #29 intentionally avoided a publishable workspace package manifest after CI showed lockfile churn from adding package metadata.

Therefore:

- Keep `packages/agent-review` as a build-referenced module until package extraction is explicitly scoped.
- Do not add `packages/agent-review/package.json` casually.
- If package extraction is needed, create a dedicated package-extraction PR with lockfile changes and release-gate proof.

## Adapter Rules

Project-specific adapters must not dilute project safety requirements.

Examples:

| Adapter | Must Preserve |
|---|---|
| MCP Shield | blocked MCP calls are never forwarded; stdout protocol purity; fail-closed policy/config/approval behavior; redaction-first audit expectations |
| Tradebot | no broker calls unless explicitly scoped; stale feed fail-closed; strict paper/live boundary; executable claims require evidence |
| Algotradify | journal is truth; reducer derives state; no live execution before approved roadmap phase; every PR includes acceptance proof |
| RTI App | official-source data trust; RTI is information/records request, not complaint-resolution framing; auditability and citizen trust |
| Mobile Approval Console | approval lifecycle integrity; side-channel approval proof; audit evidence; no approval bypass |

## New Chat Recovery Checklist

When a future chat resumes this work, first verify:

1. Latest merged PR in `ramgolladi1503-sys/MCP`.
2. Whether GitHub PR #41 roadmap lock is merged.
3. If PR #41 is merged, inspect main and start the next scoped PR from current code, not stale memory.
4. If PR #41 is not merged, finish/merge it before continuing implementation.
5. Do not rebuild roadmap from memory; use this document and live GitHub state.

## What This Roadmap Does Not Prove

This document does not prove parser behavior, validator correctness, CLI behavior, CI enforcement, or runtime MCP security behavior.

It only locks the product PR sequence and continuation contract.
