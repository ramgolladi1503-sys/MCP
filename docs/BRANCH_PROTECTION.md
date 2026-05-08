# Branch Protection Policy

This repository treats `main` as the production-ready branch for MCP Shield.

No direct feature, refactor, or emergency work should be committed directly to `main`.

## Required protection for `main`

Enable the following GitHub branch protection rules for `main`:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Block force pushes.
- Block branch deletion.
- Restrict who can push directly to `main`.
- Require linear history if the repository workflow prefers squash/rebase merges.

## Required CI checks

The following checks must pass before merge:

- `CI / MCP Shield build, hardening, and release gate`
- `Portfolio CI / Documentation, architecture, JSON-RPC, policy, audit, and portfolio quality gate`

## Merge policy

Preferred merge method:

- Squash and merge for normal PRs.
- Rebase merge only for clean, linear maintenance changes.
- Avoid merge commits unless preserving branch history is intentionally required.

## PR quality bar

A PR must include:

- Clear summary.
- Validation commands.
- Screenshots or logs when behavior changes.
- Security impact notes when gateway, policy, scanner, audit, or config-adapter behavior changes.
- No unrelated changes.

## Forbidden patterns

Do not merge PRs that:

- Skip `pnpm install --frozen-lockfile`.
- Modify dependency files without explaining why.
- Add generated artifacts such as tarballs, build cache files, logs, or local test output.
- Mix unrelated features, docs, and refactors.
- Weaken security checks without documented reasoning.

## Local pre-merge validation

Before opening or merging a PR, run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test:hardening
```

For CLI or release-related changes, also run:

```bash
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js policy check examples/policies/coding-agent.yaml

package_dir="$(mktemp -d)"
(cd packages/cli && pnpm pack --pack-destination "$package_dir")
package_file="$(find "$package_dir" -name '*.tgz' -print -quit)"
test -n "$package_file"
tar -tf "$package_file" | grep -q '^package/package.json$'
tar -tf "$package_file" | grep -q '^package/dist/index.js$'
tar -tf "$package_file" | grep -q '^package/dist/index.d.ts$'
tar -tf "$package_file" | grep -E 'tsconfig|src/|tsbuildinfo' && echo "BAD: junk included" || echo "OK: package is clean"
```
