# Agent Review Evidence — PR #31 Evidence Markdown Parser

## Agent Work Contract

### Goal

Add deterministic Markdown evidence parsing for the reusable Agent Review Kit without validating required sections, validating required fields, classifying changed files, resolving required proof, adding a validator CLI, adding CI enforcement, or changing runtime MCP behavior.

### Files Changed

- `packages/agent-review/src/evidence-markdown.ts`
- `tests/unit/agent-review/evidence-markdown-parser.test.ts`
- `docs/agent_reviews/pr_31_evidence_markdown_parser.md`

### Evidence Contract Fields

mode: CONTRACT_ONLY
candidate_id: PR_31_EVIDENCE_MARKDOWN_PARSER
decision: EVIDENCE_MARKDOWN_PARSER
reason: Adds parse-only Markdown evidence document extraction so later validator PRs can consume deterministic titles, sections, line ranges, raw markdown, and key/value evidence contract fields.
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
source: docs/agent_reviews/pr_31_evidence_markdown_parser.md

### Non-Goals

- No required-section validation.
- No required evidence field validation.
- No field value validation beyond parse-only extraction.
- No changed-file classifier.
- No required-proof resolver.
- No validator CLI.
- No CI enforcement.
- No package extraction or publishing metadata.
- No runtime MCP gateway changes.
- No policy behavior changes.
- No approval behavior changes.
- No audit schema changes.

## Grill Me Review

### Pushback

A parser that silently becomes a validator would create fake safety. PR #31 must only extract structure and key/value fields. Missing sections or missing fields belong to later validator PRs.

### Required Proof

- Parser extracts the real PR #30 evidence title.
- Parser extracts Markdown sections deterministically.
- Parser extracts evidence contract key/value fields.
- Parser remains permissive when contract fields are incomplete.
- Parser can load an explicit evidence file path.
- PR does not claim CI enforcement or runtime security proof.

## Hermes Review

### Contract Clarity

The parser exposes clear functions:

- `loadAgentReviewEvidenceDocument(path)`
- `parseAgentReviewEvidenceMarkdown(markdown, path)`
- `parseAgentReviewEvidenceContractFields(content)`

### Compatibility

The parser returns the existing `AgentReviewEvidenceDocument`, `AgentReviewEvidenceSection`, and `AgentReviewEvidenceContract` shapes already introduced by the Agent Review Kit type contract.

## GSD Review

### Determinism

The parser normalizes CRLF to LF, reads Markdown headings, records heading text, section level, content, start line, end line, and raw markdown.

### Minimality

No dependencies were added. No lockfile churn is expected.

### No Fake Progress

This PR only prepares the parser layer. It does not pretend missing-section or missing-field validation exists.

## Security Review

### Security Impact

No runtime MCP security behavior changes.

### Security Checks

The PR is read-only parsing logic for local evidence documents. It does not touch gateway forwarding, policy decisions, approvals, audit events, scanner behavior, CLI behavior, or release behavior.

## QA / Failure Review

### Required Tests

Added unit tests for:

- real PR #30 evidence Markdown parsing
- heading and section extraction
- evidence contract key/value extraction
- permissive incomplete contract parsing
- explicit evidence file loading

### Negative Coverage

Covered:

- incomplete evidence contract remains parse-only and does not become validation
- malformed non-key/value lines are ignored by the field parser
- bullet lines are ignored by the field parser

Future PRs must cover:

- missing required sections
- missing required evidence fields
- invalid boolean string values
- mode-specific rules
- changed-file area matching
- required-proof resolution

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

Banned areas remain out of scope:

- cloud SaaS
- billing
- auth
- dashboard implementation
- agent auto-merge
- agent auto-fix
- runtime MCP behavior

## Acceptance Proof

Run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:unit -- tests/unit/agent-review/evidence-markdown-parser.test.ts
pnpm test:hardening
pnpm release:dry-run
```

Expected:

- Typecheck compiles the parser.
- Unit tests pass.
- Existing hardening tests remain green.
- Existing runtime behavior remains unchanged.

## Runtime Proof Required After Merge

None for MCP runtime because this PR is parse-only Agent Review Kit infrastructure.

Future proof required:

- PR #32 section validator must catch missing required sections.
- PR #33 evidence field validator must catch missing or invalid contract fields.
- PR #36 validator CLI must expose CI-friendly parse and validation results.

## What This PR Does Not Prove

This PR does not prove:

- required-section validation
- required evidence contract field validation
- field value validation
- changed-file classification
- required-proof resolution
- validator CLI behavior
- CI enforcement
- runtime MCP security behavior
- reusable package publication readiness

## Human Approval

Proceed only if reviewers agree this PR remains limited to deterministic Markdown evidence parsing and does not overclaim validator or CI behavior.
