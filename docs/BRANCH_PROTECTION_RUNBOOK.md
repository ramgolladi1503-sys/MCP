# Branch protection runbook

This repository must not rely on informal discipline. `main` should be protected so MCP Shield cannot be weakened by accidental direct pushes, skipped CI, or unreviewed release changes.

## Required GitHub settings

Open:

```text
Repository → Settings → Branches → Branch protection rules → Add branch protection rule
```

Use this branch name pattern:

```text
main
```

Enable the following settings.

### Pull request gate

- [ ] Require a pull request before merging
- [ ] Require approvals: `1`
- [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] Require review from Code Owners if `CODEOWNERS` exists
- [ ] Require conversation resolution before merging

### Status-check gate

- [ ] Require status checks to pass before merging
- [ ] Require branches to be up to date before merging

Required status checks:

```text
MCP Shield build, hardening, and release gate
Documentation, architecture, JSON-RPC, policy, audit, and portfolio quality gate
```

These are the job names from:

- `.github/workflows/ci.yml`
- `.github/workflows/portfolio-ci.yml`

Do not use only the workflow names. Protect the concrete job names GitHub exposes in the PR checks UI.

### Direct-push protection

- [ ] Restrict who can push to matching branches
- [ ] Do not allow force pushes
- [ ] Do not allow deletions
- [ ] Include administrators if GitHub allows it for the plan/repo type

### Merge strategy

Recommended repository-level settings:

- [ ] Disable merge commits if you want a linear history
- [ ] Allow squash merging
- [ ] Delete head branches automatically after merge

For this repo, squash or merge commits are acceptable. Rebase merging is riskier for auditability if people rewrite local history carelessly.

## Required manual verification

After enabling the rule, prove it works:

1. Create a test branch.
2. Push a tiny README/doc change.
3. Open a PR.
4. Confirm GitHub blocks merge until both required checks are green.
5. Confirm direct push to `main` is rejected.
6. Confirm force push to `main` is rejected.

## Evidence to capture

Add screenshots to the project notes or issue tracker showing:

- Branch rule targeting `main`.
- Required checks list.
- Pull request requirement.
- Force-push/deletion protection.
- A PR blocked before checks pass.

## Why this matters

MCP Shield is a security gateway. If `main` can be changed without CI and PR review, the project is not production-safe regardless of how strong the code looks.

Two concrete failure modes this prevents:

1. A direct push bypasses `pnpm test:hardening` and breaks approval wait mode.
2. A release workflow change lands without CI and publishes a package missing `dist/index.js`.
