---
name: Security hardening
about: Propose or track a security improvement
title: "security: "
labels: security, hardening
assignees: ""
---

## Security concern

What risk are we reducing?

## Attack or failure scenario

Describe the scenario this protects against.

Two concrete examples:

1.
2.

## Affected area

- [ ] Gateway
- [ ] Policy engine
- [ ] Scanner
- [ ] Audit log
- [ ] Config adapter
- [ ] CLI
- [ ] CI/release
- [ ] Documentation

## Proposed control

What should be added or changed?

## Acceptance criteria

- [ ]
- [ ]

## Required validation

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
```

Additional tests:
