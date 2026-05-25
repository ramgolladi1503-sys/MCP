# MCP Shield Agent Architecture

## Purpose

This document adapts the Tradebot-style agent-review discipline to MCP Shield.

The goal is not to add autonomous agents that modify production behavior. The goal is to enforce a strict review architecture for every meaningful PR so MCP Shield grows like an enterprise security product, not a pile of features.

## Agent Roles

## 1. Agent Work Contract

Defines the PR before implementation.

Required fields:

- Goal.
- Files changed.
- Scope.
- Evidence contract.
- Non-goals.
- Runtime safety impact.
- Tests required.

## 2. Grill Me Review

Attacks the idea before it is accepted.

Required questions:

- What can bypass this?
- What can silently fail open?
- What can be overclaimed?
- What negative cases must prove this is real?
- What false positives must be avoided?

## 3. Hermes Review

Checks contract clarity and communication quality.

Required checks:

- Naming is precise.
- Schema is explicit.
- Fields are serializable.
- Backward compatibility is considered.
- Docs do not claim unimplemented behavior.

## 4. GSD Review

Checks execution discipline.

Required checks:

- Minimal implementation.
- Deterministic logic.
- No unrelated abstractions.
- No broad refactor.
- No fake progress.
- Tests prove behavior, not only object shape.

## 5. Security Review

Checks the security model.

Required checks:

- No secret leakage.
- No approval bypass.
- No stdout protocol pollution.
- No unreviewed egress.
- No fail-open policy path.
- No unsafe child process behavior.
- No untrusted tool output promoted to instruction.
- No drifted tool identity trusted silently.

## 6. QA / Failure Review

Checks failure and negative behavior.

Required checks:

- Malformed input.
- Missing fields.
- Timeout behavior.
- Tampering.
- Denial path.
- Expiry path.
- Corrupt file/path/config.
- False-positive safe path.

## 7. Scope Guard

Blocks unrelated work.

A PR must explicitly say what it does not touch.

Examples:

- No cloud SaaS.
- No billing.
- No auth unless scoped.
- No dashboard unless scoped.
- No auto-merge.
- No autonomous code modification.
- No unrelated package refactor.

## 8. Acceptance Proof

Defines exact commands and expected proof.

Must include:

- Test command.
- Expected outcome.
- Evidence file path.
- What is proven.
- What is not proven.

## 9. Runtime Proof Required After Merge

For contract-only or docs-only PRs, state what runtime proof is still required later.

This prevents fake claims.

## 10. Human Approval

Every PR must end with explicit human-approval readiness criteria.

## Required Evidence File

Every non-trivial PR must add a file under:

```text
docs/agent_reviews/
```

Naming convention:

```text
docs/agent_reviews/pr_<number>_<short_slug>.md
```

## Required Sections

Every evidence file must include:

1. Agent Work Contract.
2. Grill Me Review.
3. Hermes Review.
4. GSD Review.
5. Security Review.
6. QA / Failure Review.
7. Scope Guard.
8. Acceptance Proof.
9. Runtime Proof Required After Merge.
10. What This PR Does Not Prove.
11. Human Approval.

## Area-Specific Review Requirements

| Area | Required Extra Proof |
|---|---|
| Gateway | Protocol purity, block/forward proof, timeout behavior |
| Policy | Mode matrix, fail-closed behavior, false positives |
| Audit | Redaction, hash-chain, tamper detection |
| Approval | Create, approve, deny, expire, tamper, hash mismatch |
| Scanner | Attack corpus and false-positive corpus |
| CLI | Built CLI smoke proof |
| Config Adapter | Backup, rewrite, rollback, disable |
| Observability | Trace context, redaction, no protocol pollution |
| Debug Bundle | Bundle contents and no secret leakage |
| Docs-only | No runtime claims |

## Non-Negotiable Rule

No PR should be merged because it sounds good. It should be merged only because the evidence proves the scoped behavior and clearly states the remaining risk.
