## Summary

<!-- What changed? Be specific. -->

## Why this is needed

<!-- What problem does this solve? -->

## Type of change

- [ ] Security hardening
- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Test coverage
- [ ] CI/release
- [ ] Refactor

## Security impact

- [ ] Gateway behavior changed
- [ ] Policy behavior changed
- [ ] Scanner behavior changed
- [ ] Audit behavior changed
- [ ] Config adapter behavior changed
- [ ] No security-sensitive behavior changed

Notes:

## Validation

Commands run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
```

Additional validation:

```bash
# Add CLI, package, smoke, or manual validation here.
```

## Checklist

- [ ] Branch is based on latest `main`
- [ ] Working tree was clean before push
- [ ] No generated artifacts committed
- [ ] No unrelated changes included
- [ ] README/docs updated if behavior changed
- [ ] Tests added or updated where needed
- [ ] CI passes
