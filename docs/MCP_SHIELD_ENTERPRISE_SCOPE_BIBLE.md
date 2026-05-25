# MCP Shield Enterprise Scope Bible

## Version

v1.0 — PR #25 Enterprise Scope Lock

## Product Category

Enterprise Agent Firewall for MCP tools and AI agents.

## One-line Positioning

MCP Shield is the runtime firewall, approval, observability, and evidence layer that blocks unsafe AI-agent tool calls before they touch code, files, credentials, databases, cloud systems, external networks, or production workflows.

## Product Thesis

Generic AI guardrails are not enough. Enterprises need runtime control over agent actions. MCP Shield must control the moment where an agent tries to use a real tool.

Before every risky action, MCP Shield must answer:

> Is this exact agent, acting for this exact user, allowed to perform this exact action, on this exact resource, with this exact data, through this exact tool, at this exact time, with this exact downstream impact?

## Current Foundation

The current repo already has the local-first spine:

- pnpm monorepo.
- CLI package.
- Shared contracts package.
- Policy package.
- Scanner package.
- Gateway package.
- Audit package.
- Config adapter package.
- Runtime stdio gateway.
- Policy evaluation.
- Blocking decisions.
- Approval broker.
- Approval wait mode.
- Local approval console.
- Redacted audit events.
- Hash-chain audit replay.
- Config scanner.
- Metadata and schema poisoning scanner.
- Hardening, integration, corpus, smoke, and release dry-run gates.

This document does not restart the project. It upgrades the existing local-first foundation into an enterprise-grade Agent Firewall product.

---

# Locked Product Scope

## In Scope

MCP Shield Enterprise v1 includes:

1. Runtime MCP gateway firewall.
2. Tool-call interception.
3. Resource-read interception.
4. Prompt-response inspection.
5. Reverse request control.
6. Policy-as-code.
7. Risk scoring.
8. Blast-radius scoring.
9. Tool action taxonomy.
10. Resource sensitivity taxonomy.
11. Agent identity model.
12. User identity model.
13. Tool identity model.
14. Tool manifest hashing.
15. Tool drift detection.
16. Schema poisoning detection.
17. Metadata poisoning detection.
18. Supply-chain launch scanning.
19. Network egress policy.
20. SQL policy.
21. Shell command policy.
22. Filesystem policy.
23. Git and GitHub policy.
24. Approval broker.
25. Approval console.
26. Approval scope and TTL.
27. Two-person approval for critical actions.
28. Audit ledger.
29. Replay and explain.
30. Debug bundle.
31. Observability trace events.
32. Metrics contract.
33. Local APM stack.
34. Agent review architecture.
35. Git workflow enforcement.
36. Security-focused PR templates.
37. Scope Guard CI.
38. Attack corpus.
39. False-positive corpus.
40. Release gates.
41. Local-first enterprise demo scripts.
42. Claude Desktop and Cursor demo compatibility.
43. Git, shell, database, filesystem, and egress enterprise demos.

## Out of Scope Until Enterprise Local v1 Is Strong

The following are intentionally out of scope:

1. Cloud SaaS.
2. Multi-tenant hosted control plane.
3. Billing.
4. Public account signup.
5. SSO/SAML/OIDC login.
6. Kubernetes operator.
7. Browser extension.
8. Mobile app.
9. Agent auto-merge.
10. Agent auto-fix.
11. Agent-triggered production changes without approval.
12. Marketplace integrations.
13. Autonomous code rewriting.
14. AI model training.
15. Heavy dashboard before observability/data contracts.
16. Remote approval service.
17. Enterprise sales website.
18. Plugin marketplace.
19. Policy marketplace.
20. Complex SaaS admin panel.

These are not banned forever. They are blocked until the local enterprise firewall is real.

---

# Enterprise Hard Rules

## Runtime Safety Rules

1. Fail closed on malformed policy.
2. Fail closed on malformed tool calls.
3. Fail closed on unknown critical tool identity.
4. Fail closed on approval-required action without valid approval.
5. Fail closed on approval hash mismatch.
6. Never log secrets before redaction.
7. Never pollute MCP stdio stdout with human logs.
8. Never forward blocked calls to child MCP servers.
9. Never silently downgrade a block into a warning.
10. Never allow unknown external egress when deny-unknown-domain policy is enabled.
11. Never treat untrusted tool output as trusted instruction.
12. Never trust tool schema drift without review.
13. Never trust approval files after integrity failure.
14. Never make a policy compile error behave as allow.
15. Never hide audit append failures for security-relevant events.

## Engineering Rules

1. No PR-loop cosmetic work.
2. No fake progress.
3. No unrelated abstractions.
4. No weakening tests.
5. No broad refactors inside scoped PRs.
6. Every security behavior must have negative tests.
7. Every runtime block must have audit evidence.
8. Every approval path must prove non-forwarding before approval.
9. Every gateway change must prove stdout protocol purity.
10. Every policy change must prove mode matrix behavior.
11. Every scanner change must prove attack and false-positive behavior.
12. Every audit change must prove redaction and tamper detection.
13. Every release change must prove package/tarball behavior.
14. Every docs-only PR must not claim runtime behavior it does not implement.
15. Every PR must state what it does not prove.

---

# Architecture Pillars

## Pillar 1 — Runtime Agent Firewall

The gateway intercepts MCP tool calls before execution. It evaluates the request against policy, risk score, tool identity, resource sensitivity, approval state, session history, and taint labels.

Required decisions:

- ALLOW
- WARN
- APPROVE
- BLOCK
- REDACT
- SIMULATE
- QUARANTINE

## Pillar 2 — Policy-as-Code

Policy must be explicit, reviewable, testable, and versioned.

Policy must support:

- tool rules
- action rules
- resource rules
- environment rules
- identity rules
- data sensitivity rules
- egress rules
- approval rules
- risk thresholds
- default action
- mode-specific behavior
- simulation mode
- policy dry-run fixtures

## Pillar 3 — Risk and Blast-Radius Engine

Every tool call receives a structured risk score.

Score dimensions:

- tool danger
- action type
- resource sensitivity
- write/destructive behavior
- external destination
- production environment
- data sensitivity
- credential scope
- tool identity trust
- schema drift
- untrusted context influence
- session history risk
- reversibility
- approval state

## Pillar 4 — Tool Identity and Drift

MCP Shield must track tool identity and detect changes.

Identity fields:

- server name
- transport
- command
- args
- package/version
- tool name
- tool description hash
- input schema hash
- full manifest hash
- first seen timestamp
- last seen timestamp
- trust status

## Pillar 5 — Taint and Multi-Step Data Flow

MCP Shield must track data movement across calls.

Taint labels:

- trusted policy
- user instruction
- untrusted external context
- tool output
- sensitive data
- secret-like data
- customer data
- credential data
- executable instruction
- external destination

The firewall must detect risky chains such as reading internal data and later sending it externally.

## Pillar 6 — Enterprise Approval

Approval must not be a blind button.

Approval must show:

- exact tool
- exact action
- exact resource
- sanitized arguments
- data included
- destination
- risk score
- policy reason
- blast radius
- approval scope
- expiry
- rollback or safe alternative
- request hash
- tool identity hash

Critical actions must support two-person approval later in the roadmap.

## Pillar 7 — Audit, Replay, and Evidence

Every security-relevant event must produce replayable evidence.

Audit must include:

- event ID
- trace ID
- correlation ID
- session ID
- user identity
- agent identity
- tool identity
- policy version
- risk score
- decision
- reason
- redaction state
- approval ID
- request hash
- previous hash
- event hash

## Pillar 8 — Observability and Debugging

MCP Shield must be debuggable like enterprise infrastructure.

Required observability:

- structured debug events
- trace spans
- latency metrics
- decision metrics
- approval metrics
- audit append metrics
- block metrics
- protocol error metrics
- debug bundle export

## Pillar 9 — Agent Review and Git Workflow

The repo must enforce serious delivery discipline.

Required review sections:

- Agent Work Contract
- Grill Me Review
- Hermes Review
- GSD Review
- Security Review
- QA / Failure Review
- Scope Guard
- Acceptance Proof
- Runtime Proof Required
- What This PR Does Not Prove
- Human Approval

---

# Enterprise Quality Gates

Every PR must pass:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
pnpm release:dry-run
```

Area-specific gates:

| Area | Required Proof |
|---|---|
| Gateway | Protocol test, stdout purity, block/forward proof |
| Policy | Mode matrix, fail-closed test, false-positive test |
| Audit | Redaction, hash-chain, tamper test |
| Approval | Create, approve, deny, expire, tamper, hash mismatch |
| Scanner | Attack corpus and false-positive corpus |
| CLI | Built CLI smoke test |
| Config Adapter | Backup, rewrite, rollback, disable |
| Observability | Trace context and redaction proof |
| Debug Bundle | Bundle contents and no secret leakage |
| Docs-only | Scope lock and no runtime claims |
| Release | Tarball contents and publish dry-run |

---

# 200-PR Enterprise Roadmap

## Wave 1 — Enterprise Scope, Process, and Guardrails

- PR 25 — Enterprise Scope Lock
- PR 26 — Agent Architecture Contract
- PR 27 — Agent Review Evidence Template
- PR 28 — Agent Review Config Schema
- PR 29 — Agent Review Validator CLI
- PR 30 — Git Workflow Contract
- PR 31 — PR Template and Security Checklist
- PR 32 — Scope Guard CI v1
- PR 33 — Changed-File Scope Classification
- PR 34 — Scope-Specific Evidence Rules
- PR 35 — Docs-Only PR Guard
- PR 36 — Enterprise Roadmap Index

## Wave 2 — Observability and Debugging Foundation

- PR 37 — Observability Architecture Contract
- PR 38 — Trace Context Contract
- PR 39 — Debug Event Schema v1
- PR 40 — Gateway Trace Context Propagation
- PR 41 — Policy Decision Trace Events
- PR 42 — Approval Trace Events
- PR 43 — Audit Append Trace Events
- PR 44 — Response Inspection Trace Events
- PR 45 — Metrics Contract v1
- PR 46 — Metrics Exporter Local v1
- PR 47 — Local APM Docker Compose
- PR 48 — Debug Bundle CLI v1
- PR 49 — Incident Timeline Generator
- PR 50 — Debug Bundle Redaction Proof

## Wave 3 — Risk Engine Foundation

- PR 51 — Risk Score Contract
- PR 52 — Action Taxonomy Contract
- PR 53 — Tool Capability Classifier
- PR 54 — Resource Sensitivity Contract
- PR 55 — Environment Classifier
- PR 56 — Data Sensitivity Classifier v1
- PR 57 — Destination Risk Classifier
- PR 58 — Reversibility Classifier
- PR 59 — Blast-Radius Calculator v1
- PR 60 — Risk Decision Integration v1
- PR 61 — Risk Threshold Policy
- PR 62 — Risk-Aware Approval Context
- PR 63 — Risk Score Tests Matrix
- PR 64 — Risk False-Positive Suite
- PR 65 — Risk Evidence in Audit

## Wave 4 — Semantic Authorization

- PR 66 — Semantic Decision Contract
- PR 67 — Tool Argument Normalizer
- PR 68 — Filesystem Semantic Rules
- PR 69 — Shell Semantic Rules
- PR 70 — SQL Semantic Rules v1
- PR 71 — Git Semantic Rules v1
- PR 72 — GitHub Semantic Rules v1
- PR 73 — Messaging Semantic Rules v1
- PR 74 — Network Semantic Rules v1
- PR 75 — Semantic Policy YAML v1
- PR 76 — Semantic Policy Compiler Tests
- PR 77 — Semantic Decision Audit Evidence
- PR 78 — Semantic Approval Display
- PR 79 — Semantic Authorization Negative Corpus
- PR 80 — Semantic Authorization False-Positive Corpus

## Wave 5 — Tool Identity, Registry, and Drift

- PR 81 — Tool Identity Contract v1
- PR 82 — Tool Manifest Snapshot Format
- PR 83 — Tool Manifest Capture CLI
- PR 84 — Tool Hash Computation
- PR 85 — Trusted Tool Registry v1
- PR 86 — Tool Registry Policy Integration
- PR 87 — Manifest Drift Detection v1
- PR 88 — Drift Gate Gateway Integration
- PR 89 — Drift Audit Evidence
- PR 90 — Drift Approval Flow
- PR 91 — Schema Poisoning Depth Upgrade
- PR 92 — Metadata Poisoning Depth Upgrade
- PR 93 — Package Runner Provenance v1
- PR 94 — Server Launch Identity Hash
- PR 95 — Tool Identity Corpus

## Wave 6 — Approval Governance

- PR 96 — Approval Context v2
- PR 97 — Approval Console v2 Layout
- PR 98 — Approval Scope Contract
- PR 99 — Approval Scope Enforcement
- PR 100 — Approval Identity Contract
- PR 101 — Approval Signature v1
- PR 102 — Approval Reason Requirements
- PR 103 — Approval Denial Evidence
- PR 104 — Approval Race Tests
- PR 105 — Approval Tamper Hardening v2
- PR 106 — Approval Expiry Policy
- PR 107 — Two-Person Approval Contract
- PR 108 — Two-Person Approval Enforcement v1
- PR 109 — Approval Replay Timeline
- PR 110 — Approval Governance Tests

## Wave 7 — Taint Tracking and Multi-Step Defense

- PR 111 — Session State Contract
- PR 112 — Taint Label Contract
- PR 113 — Taint Assignment for Tool Outputs
- PR 114 — Taint Assignment for Inputs
- PR 115 — Sensitive Output Detection v1
- PR 116 — External Destination Chain Detection
- PR 117 — Multi-Step Chain Risk Score
- PR 118 — Chain-Level Block Decision
- PR 119 — Chain-Level Approval Decision
- PR 120 — Taint Audit Evidence
- PR 121 — Taint Timeline Replay
- PR 122 — Prompt Injection Chain Corpus
- PR 123 — Internal-to-External Exfiltration Corpus
- PR 124 — Taint False-Positive Corpus
- PR 125 — Session State Persistence Decision

## Wave 8 — Audit Ledger and Evidence v2

- PR 126 — Audit Schema v2 Contract
- PR 127 — Audit Schema Backward Compatibility
- PR 128 — Event Correlation Contract
- PR 129 — Signed Evidence Bundle v1
- PR 130 — Audit Bundle Export CLI
- PR 131 — Audit Bundle Verification CLI
- PR 132 — Redaction Coverage Expansion
- PR 133 — Redaction Regression Corpus
- PR 134 — Audit Delete/Tamper Warning Docs
- PR 135 — Immutable Local Ledger Contract
- PR 136 — Immutable Local Ledger v1
- PR 137 — Audit Replay v2
- PR 138 — Explain v2
- PR 139 — SIEM Export Contract
- PR 140 — SIEM Export v1 Local

## Wave 9 — Scanner and Supply-Chain Hardening

- PR 141 — Scanner Report v2
- PR 142 — Remote MCP Server Risk Model
- PR 143 — HTTP MCP Config Scanner
- PR 144 — Env Exposure Depth Upgrade
- PR 145 — Broad Filesystem Scope Upgrade
- PR 146 — Command Launch Risk Upgrade
- PR 147 — Tool Description Injection Corpus v2
- PR 148 — Tool Schema Poisoning Corpus v2
- PR 149 — Scanner False-Positive Suite v2
- PR 150 — Scanner Policy Recommendation Engine
- PR 151 — Scanner to Policy Dry Run
- PR 152 — Scanner Baseline Lockfile v2
- PR 153 — Scanner CI Mode
- PR 154 — Scanner SARIF Export
- PR 155 — Scanner Enterprise Report Markdown

## Wave 10 — Transport and Protocol Hardening

- PR 156 — MCP Protocol Compliance Matrix
- PR 157 — JSON-RPC Fuzz Corpus v1
- PR 158 — Large Payload Handling
- PR 159 — Request Timeout Policy
- PR 160 — Child Process Crash Handling
- PR 161 — Startup Failure Handling
- PR 162 — Cancellation Handling Hardening
- PR 163 — Late Response Handling Evidence
- PR 164 — Stdio Backpressure Handling
- PR 165 — Stdout Pollution Guard v2
- PR 166 — Reverse Request Policy v2
- PR 167 — HTTP Transport Architecture Contract
- PR 168 — HTTP Transport Minimal Proxy v1
- PR 169 — HTTP Transport Policy Integration
- PR 170 — HTTP Transport Tests

## Wave 11 — Enterprise Demos and Product Proof

- PR 171 — Enterprise Demo Scenario Contract
- PR 172 — GitHub Agent Demo v1
- PR 173 — Shell Agent Demo v2
- PR 174 — DB Agent Demo v2
- PR 175 — Filesystem Demo v2
- PR 176 — Network Egress Demo v2
- PR 177 — Tool Drift Demo
- PR 178 — Multi-Step Exfiltration Demo
- PR 179 — Approval Governance Demo
- PR 180 — Debug Bundle Demo
- PR 181 — Local APM Demo
- PR 182 — Claude Desktop Demo Refresh
- PR 183 — Cursor Demo Refresh
- PR 184 — Enterprise Demo Runbook
- PR 185 — Demo CI Smoke

## Wave 12 — Release, Docs, and Enterprise v1 Hardening

- PR 186 — Documentation Site Structure
- PR 187 — Installation Guide v1
- PR 188 — Policy Authoring Guide
- PR 189 — Security Model Guide
- PR 190 — Troubleshooting Guide
- PR 191 — Enterprise Evaluation Guide
- PR 192 — Release Versioning Contract
- PR 193 — Release Workflow v2
- PR 194 — Package Metadata Polish
- PR 195 — Security Policy and Responsible Disclosure
- PR 196 — Threat Model v1
- PR 197 — Enterprise Readiness Checklist
- PR 198 — Final Enterprise v1 Audit
- PR 199 — Enterprise v1 Release Candidate
- PR 200 — Enterprise v1 Launch Release

---

# Enterprise v1 Completion Criteria

MCP Shield Enterprise v1 is complete only if it proves all of the following:

1. It intercepts real MCP tool calls.
2. It blocks unsafe calls before execution.
3. It never forwards blocked calls.
4. It preserves MCP stdio protocol purity.
5. It supports policy-as-code.
6. It supports risk scoring.
7. It supports semantic authorization.
8. It detects tool identity drift.
9. It detects schema and metadata poisoning.
10. It requires approval for risky calls.
11. It validates approval integrity.
12. It supports scoped approval.
13. It detects multi-step exfiltration risk.
14. It tracks tainted data movement.
15. It redacts secrets before persistence.
16. It emits replayable audit events.
17. It produces debug bundles.
18. It has local observability.
19. It has attack corpus tests.
20. It has false-positive tests.
21. It has release gates.
22. It has agent-review evidence gates.
23. It has scope guard CI.
24. It has enterprise demo runbooks.
25. It clearly documents limitations.

---

# Final Product Boundary

MCP Shield Enterprise v1 is not a generic AI safety app, chatbot, dashboard-first product, or cloud SaaS.

It is an enterprise-grade local-first Agent Firewall for MCP and AI-agent tool execution.

The product wins if it proves one thing better than generic guardrails:

> AI agents can be allowed to work with real tools only when every risky action is controlled, explained, approved, traced, and auditable before execution.
