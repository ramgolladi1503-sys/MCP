# Required branch protection checks

Use these exact required status checks for `main` branch protection.

## Required checks

```text
MCP Shield build, hardening, and release gate
Documentation, architecture, JSON-RPC, policy, audit, and portfolio quality gate
```

## Source workflows

| Required check | Workflow file |
| --- | --- |
| `MCP Shield build, hardening, and release gate` | `.github/workflows/ci.yml` |
| `Documentation, architecture, JSON-RPC, policy, audit, and portfolio quality gate` | `.github/workflows/portfolio-ci.yml` |

## Merge rule

Do not merge PRs into `main` unless both required checks are green.

## Direct push rule

Do not push directly to `main`. All changes must go through pull requests.
