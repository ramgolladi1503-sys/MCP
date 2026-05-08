# MCP Shield Release Checklist

Use this checklist before tagging or publishing any MCP Shield release.

## 1. Repository state

- [ ] Working tree is clean.
- [ ] Release branch is based on latest `main`.
- [ ] No generated files are staged.
- [ ] No local tarballs are staged.
- [ ] `pnpm-lock.yaml` is committed and current.
- [ ] No unresolved merge conflict markers exist in tracked files.

Commands:

```bash
git checkout main
git pull origin main
git status
```

## 2. Dependency integrity

- [ ] Frozen install succeeds.
- [ ] No dependency drift is introduced accidentally.

Command:

```bash
pnpm install --frozen-lockfile
```

## 3. Build and code quality

- [ ] All packages build.
- [ ] TypeScript project references pass.
- [ ] Lint passes.

Commands:

```bash
pnpm build
pnpm typecheck
pnpm lint
```

## 4. Security and hardening tests

- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Malicious corpus tests pass.
- [ ] Smoke test passes.
- [ ] Gateway stdio protocol behavior is verified.
- [ ] Install/rollback behavior is verified.
- [ ] Audit redaction and hash-chain behavior is verified.

Command:

```bash
pnpm test:hardening
```

## 5. CLI validation

- [ ] Built CLI displays help.
- [ ] Built CLI validates policy files.
- [ ] Unsafe scanner exit contract is preserved.

Commands:

```bash
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js policy check examples/policies/coding-agent.yaml

set +e
node packages/cli/dist/index.js scan examples/mcp-configs/unsafe-demo.json
code=$?
set -e
test "$code" -eq 2
```

## 6. Package validation

- [ ] CLI package tarball can be generated.
- [ ] Tarball includes required runtime files.
- [ ] Tarball excludes source/config/cache junk.

Commands:

```bash
package_dir="$(mktemp -d)"
(cd packages/cli && pnpm pack --pack-destination "$package_dir")
package_file="$(find "$package_dir" -name '*.tgz' -print -quit)"

test -n "$package_file"
tar -tf "$package_file" | grep -q '^package/package.json$'
tar -tf "$package_file" | grep -q '^package/dist/index.js$'
tar -tf "$package_file" | grep -q '^package/dist/index.d.ts$'

tar -tf "$package_file" | grep -E 'tsconfig|src/|tsbuildinfo' && echo "BAD: junk included" || echo "OK: package is clean"
```

## 7. Publish dry-run gate

- [ ] Guarded release dry-run passes.
- [ ] `npm publish --dry-run --access public` succeeds from `packages/cli`.
- [ ] Real publish remains skipped unless `MCP_SHIELD_PUBLISH=1` is explicitly set.

Command:

```bash
pnpm release:dry-run
```

Do not run real publish from CI. The release script deliberately skips real publish unless this variable is set locally and intentionally:

```bash
MCP_SHIELD_PUBLISH=1 pnpm release:dry-run
```

## 8. Documentation review

- [ ] README quickstart commands are real and tested.
- [ ] Demo workflow still matches actual CLI behavior.
- [ ] Real-world Git/Shell/DB demo docs still match policy behavior.
- [ ] Claude Desktop and Cursor live validation status is documented honestly.
- [ ] Branch protection policy is current.
- [ ] Security behavior is documented honestly.
- [ ] Known limitations are not hidden.

## 9. PR readiness

- [ ] PR summary is specific.
- [ ] Validation section includes actual commands run.
- [ ] Security impact is documented.
- [ ] No unrelated changes are mixed in.
- [ ] CI is green.
- [ ] All conversations are resolved.

## 10. Tag and publish decision

Only tag or publish when all checks above pass.

Recommended tag flow:

```bash
git checkout main
git pull origin main
pnpm release:dry-run
git tag -a v0.1.0 -m "MCP Shield v0.1.0"
git push origin v0.1.0
```

Real publish flow:

```bash
MCP_SHIELD_PUBLISH=1 pnpm release:dry-run
```

Abort if any check fails. Fix the issue in a separate commit, rerun the full checklist, and only then tag or publish.
