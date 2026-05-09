# Guarded release publish runbook

This runbook describes the production npm publish path for MCP Shield packages.

## What this release flow protects against

- Publishing version `0.0.0` by accident.
- Publishing only the CLI while its workspace dependencies are unpublished.
- Publishing without build, typecheck, lint, hardening tests, and package surface validation.
- Publishing from an unreviewed local machine command.
- Publishing without explicit manual confirmation.

## Packages published together

The release workflow publishes all publishable `packages/*` workspaces:

- `@mcp-shield/shared`
- `@mcp-shield/policy`
- `@mcp-shield/scanner`
- `@mcp-shield/audit`
- `@mcp-shield/gateway`
- `@mcp-shield/config-adapter`
- `@mcp-shield/cli`

Do not publish only `@mcp-shield/cli`. The CLI depends on the workspace packages.

## Required GitHub setup

### 1. Add npm token

Open:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Create:

```text
NPM_TOKEN
```

Use an npm automation token with publish access for the `@mcp-shield` scope.

### 2. Create release environment

Open:

```text
Repository → Settings → Environments → New environment
```

Create:

```text
npm-production
```

Recommended environment protection:

- Required reviewers: at least repository owner/maintainer.
- Prevent self-review if available.
- Deployment branches: restrict to `main`.

## Required version bump before publish

Before publishing, bump all package versions together. Every publishable package under `packages/*` must have the same version.

Example target version:

```text
0.1.0
```

The release verification script rejects mismatched versions and rejects `0.0.0` unless explicitly allowed for dry-run-only scenarios.

## Dry-run release rehearsal

Open:

```text
GitHub → Actions → Guarded Release Publish → Run workflow
```

Inputs:

```text
expected_version: 0.1.0
publish: false
confirmation: anything
```

This runs:

- locked install
- release metadata verification
- build
- typecheck
- lint
- hardening tests
- workspace publish dry-run
- CLI tarball install smoke check

## Real publish

Only after the dry-run passes:

```text
GitHub → Actions → Guarded Release Publish → Run workflow
```

Inputs:

```text
expected_version: 0.1.0
publish: true
confirmation: PUBLISH_MCP_SHIELD
```

The workflow then requires approval through the `npm-production` environment before publishing.

## Post-publish checks

The workflow verifies published npm metadata for every expected package:

```bash
npm view @mcp-shield/cli@0.1.0 version
npm view @mcp-shield/shared@0.1.0 version
npm view @mcp-shield/policy@0.1.0 version
npm view @mcp-shield/gateway@0.1.0 version
npm view @mcp-shield/audit@0.1.0 version
npm view @mcp-shield/scanner@0.1.0 version
npm view @mcp-shield/config-adapter@0.1.0 version
```

Also test a clean install locally:

```bash
npm install -g @mcp-shield/cli@0.1.0
mcp-shield --help
mcp-shield policy check examples/policies/coding-agent.yaml
```

## Do not bypass this workflow

Do not publish with local ad-hoc commands unless the GitHub release workflow is broken and the failure is documented in an issue.

Two concrete bad paths:

1. Running `pnpm publish` from your laptop without the hardening test suite.
2. Publishing the CLI before publishing `@mcp-shield/gateway`, `@mcp-shield/policy`, and other workspace dependencies.
