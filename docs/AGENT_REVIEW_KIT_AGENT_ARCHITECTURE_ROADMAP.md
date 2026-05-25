# Agent Review Kit Agent Architecture Roadmap

## Purpose

This document locks the Tradebot-inspired agentic review architecture as a reusable Agent Review Kit layer.

Do not continue broader adapter or product-scope work without preserving this architecture.

The target chain is:

```text
changed file
  -> area classification
  -> required proof
  -> required review agents
  -> required gates
  -> evidence validation
  -> merge readiness
```

## Locked Rule

After PR #46, future Agent Review Kit work must not treat adapters as simple path classifiers only.

Every project adapter should evolve toward:

- changed-file area classification
- required proof resolution
- required review-agent resolution
- required gate resolution
- evidence validation for required review agents
- CLI reporting for required and missing review agents
- CI enforcement only after local validator behavior is proven

## Reusable Agent Roles

The reusable role catalog must preserve the Tradebot discipline and make it portable to MCP Shield and future adapters.

Required role set:

```text
Scope Lock Agent
Repo Cartographer Agent
Architecture Drift Agent
Safety Boundary Agent
Runtime Boundary Agent
Risk / Gating Agent
Execution Boundary Agent
Data Freshness Agent
Evidence / Replay Agent
QA Failure Agent
Security Review Agent
No-Test-Weakening Agent
CI / Release Guard Agent
Docs / Runbook Agent
Human Approval Gate
Grill Me Reviewer
Hermes Reviewer
GSD Reviewer
```

## MCP Shield Role Mapping

MCP Shield must map the reusable roles to MCP-specific review concerns:

```text
MCP Runtime Boundary Agent
Child Forwarding Boundary Agent
Policy Decision Agent
Approval Lifecycle Agent
Audit Integrity Agent
Redaction Agent
Protocol Purity Agent
Scanner Accuracy Agent
Human Approval Gate
```

## Locked PR Chain

Complete this chain before returning to the broader 200-PR product scope, unless a failing CI or production-blocking correction requires a focused fix PR.

| PR | Title | Scope |
|---|---|---|
| #47 | Agent Architecture Roadmap Lock | Docs-only lock for this sequence |
| #48 | Agent Workflow Schema Contract | Add config type support for review agents |
| #49 | Agent Role Catalog Contract | Define reusable role IDs, labels, and descriptions |
| #50 | Required Review Agent Resolver | Resolve required agents from classified changed files |
| #51 | Agent Evidence Validator | Validate evidence for required agents |
| #52 | Tradebot Agent Workflow Mapping | Add Tradebot role mapping to its adapter config |
| #53 | MCP Shield Agent Workflow Mapping | Add MCP Shield role mapping to its adapter config |
| #54 | Agent Workflow CLI Report | Report required, satisfied, and missing agents |
| #55 | CI Enforces Agent Evidence | Wire proven agent evidence validation into CI |
| #56 | Cross-Adapter Snapshot Tests | Lock mappings across MCP Shield, Tradebot, Algotradify, generic TS, and generic Python |
| #57 | Human Approval Gate Contract | Make human approval a reusable first-class role |
| #58 | No-Test-Weakening Agent | Add reusable evidence expectations for risky test-only changes |
| #59 | Runtime Boundary Agent | Add reusable runtime-boundary proof rules |
| #60 | Adapter Starter Templates With Agents | Add starter templates that include review-agent mapping |
| #61 | Product Roadmap Resume Marker | Mark the handoff back to broader product scope |

## PR #48 Scope Lock

Next implementation PR after this roadmap lock:

```text
PR #48 — Agent Workflow Schema Contract
```

Allowed:

- extend Agent Review config types with optional review-agent declarations
- validate review-agent declaration shape
- add unit tests for valid and invalid declarations
- add evidence file

Not allowed:

- resolver behavior
- CLI report behavior
- CI enforcement
- package extraction
- runtime MCP changes
- adapter expansion unrelated to review agents

## Do Not Deviate Rule

Until PR #61 lands:

- Do not return to generic adapter expansion unless it directly supports this agent workflow layer.
- Do not add package extraction.
- Do not add publishing metadata.
- Do not change runtime MCP behavior.
- Do not change CI enforcement before local validator behavior exists.
- Do not claim runtime security from docs-only or contract-only PRs.
- Do not weaken existing tests.
- Do not skip evidence files.

## Recovery Prompt

```text
Continue MCP Shield Agent Review Kit from PR #47 — Agent Architecture Roadmap Lock.
Use docs/AGENT_REVIEW_KIT_AGENT_ARCHITECTURE_ROADMAP.md as source of truth.
Complete PR #48 through PR #61 before returning to the broader 200-PR product scope.
First verify live GitHub state before choosing the next PR.
```

## What This Roadmap Does Not Prove

This document does not prove schema validation, resolver behavior, evidence validation, CLI behavior, CI enforcement, or runtime MCP security behavior.

It only locks the agent architecture sequence and prevents implementation drift.
