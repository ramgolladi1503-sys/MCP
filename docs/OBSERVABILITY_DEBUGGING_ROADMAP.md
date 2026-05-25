# MCP Shield Observability and Debugging Roadmap

## Purpose

MCP Shield must be debuggable like enterprise infrastructure.

When an agent action is blocked, approved, denied, expired, forwarded, redacted, or inspected, the operator should be able to answer:

1. What happened?
2. Which tool/action/resource was involved?
3. Which policy decided it?
4. What was the risk?
5. Was approval required?
6. Was the request forwarded to the child MCP server?
7. Were secrets redacted?
8. Can the incident be replayed?

## Locked Direction

Observability must support the Agent Firewall product. It must not become a dashboard-first distraction.

## Required Signals

### Traces

Required spans:

- `mcp_shield.gateway.request`
- `mcp_shield.policy.decide`
- `mcp_shield.risk.score`
- `mcp_shield.approval.create`
- `mcp_shield.approval.wait`
- `mcp_shield.approval.decide`
- `mcp_shield.child.forward`
- `mcp_shield.response.inspect`
- `mcp_shield.audit.append`
- `mcp_shield.debug.bundle`

### Metrics

Required metrics:

- `mcp_shield_gateway_requests_total`
- `mcp_shield_policy_decisions_total`
- `mcp_shield_blocked_calls_total`
- `mcp_shield_approval_requests_total`
- `mcp_shield_approval_wait_seconds`
- `mcp_shield_audit_append_failures_total`
- `mcp_shield_response_poisoning_blocks_total`
- `mcp_shield_stdout_protocol_errors_total`
- `mcp_shield_gateway_request_duration_ms`
- `mcp_shield_policy_decision_duration_ms`

### Logs / Debug Events

Security audit events and debug events must be separate.

Audit events answer:

- What security decision was made?
- What policy/rule/risk produced it?
- What evidence proves it?

Debug events answer:

- How did runtime behave?
- What latency or failure occurred?
- Which step failed?

## Redaction Rule

No observability export may leak secrets.

Redaction must happen before persistence or export.

## Debug Bundle

Future command:

```bash
mcp-shield debug bundle \
  --audit .mcp-shield/audit.jsonl \
  --approvals .mcp-shield/approvals \
  --out .mcp-shield/debug-bundle.zip
```

Required bundle contents:

- `audit.jsonl`
- `approval-summary.json`
- `policy-effective.json`
- `scanner-report.json`
- `trace-summary.json`
- `incident-timeline.md`
- `blocked-events.md`
- `approval-events.md`
- `manifest.json`

## Local APM Stack

The local-first enterprise stack should use open standards and free tooling:

- OpenTelemetry for trace/metric/log signal conventions.
- Prometheus for metrics.
- Grafana for dashboards.
- Loki for logs if log aggregation is needed.
- Tempo or Jaeger for traces.

This must remain optional. The core firewall must work without the APM stack.

## Roadmap

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

## Non-Goals For PR #25

This document does not implement tracing, metrics, dashboards, or debug bundle code.

It only locks the future observability and debugging architecture.
