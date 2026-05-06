# Test Reports — MCP Shield

## Current CI gate

The repository includes a GitHub Actions workflow:

```text
.github/workflows/portfolio-ci.yml
```

This workflow validates the project as a recruiter-facing AI security portfolio.

## What the CI checks today

- README exists.
- Architecture SVG exists.
- AI security one-pager exists.
- GitHub profile README template exists.
- README includes problem statement, architecture, test strategy, failure modes, and roadmap.
- A Markdown CI report artifact is generated on each run.

## Why this matters

At the current MVP planning stage, claiming full runtime security tests would be fake. The honest gate validates that the project has the minimum documentation and portfolio assets expected before implementation begins.

## Next test-report upgrades

- Policy engine unit test report.
- Redaction test report.
- MCP JSON-RPC contract test report.
- Attack corpus regression report.
- False-positive regression report.
- End-to-end audit-only / strict / block / explain report.
