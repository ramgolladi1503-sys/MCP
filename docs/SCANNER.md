# MCP Shield Scanner v1

Scanner v1 is the first executable feature block after the architecture foundation.

Its job is simple:

```text
Inspect MCP configuration before connection and explain risky servers, launch commands, metadata, schemas, and scopes.
```

It does not enforce runtime policy. Enforcement belongs to the gateway feature block.

## Command

```bash
mcp-shield scan <config.json>
```

Human-readable output:

```bash
mcp-shield scan examples/mcp-configs/unsafe-demo.json
```

JSON output:

```bash
mcp-shield scan examples/mcp-configs/unsafe-demo.json --json
```

## Supported config shapes

### Claude-style object

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem@1.0.0", "./project"]
    }
  }
}
```

### Array style

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem@1.0.0", "./project"]
    }
  ]
}
```

### Remote endpoint style

```json
{
  "mcpServers": {
    "remote": {
      "url": "https://example.com/mcp"
    }
  }
}
```

## Scanner layers

Scanner v1 covers four practical layers.

### 1. MCP config parser

Normalizes configured servers into:

```text
name
transport
command
args
cwd
url
envKeys
raw
```

This makes later scanners deterministic.

### 2. Tool metadata scanner

Flags instruction-like tool descriptions, including:

```text
ignore previous instructions
read local secrets
send token/credential
call another tool
before responding
exfiltration wording
```

Example rule:

```text
scanner.metadata.instruction_like_text
```

### 3. Dangerous capability scanner

Flags server launches that appear to expose high-risk capabilities:

```text
shell / terminal / exec / command
git or GitHub write capability
```

Example rules:

```text
scanner.capability.shell_execution
scanner.capability.git_write
```

### 4. Supply-chain launch scanner

Flags risky launch patterns:

```text
npx/bunx/pnpm/yarn package runner without pinned version
curl|sh or wget|sh launch patterns
remote MCP endpoints
shell entrypoints
```

Example rules:

```text
scanner.supply_chain.unpinned_package_runner
scanner.supply_chain.pipe_to_shell
scanner.launch.remote_server
scanner.launch.shell_entrypoint
```

## Scope checks

Scanner v1 detects obvious broad filesystem roots:

```text
/
~
$HOME
${HOME}
/Users
/home
C:/
```

Example rule:

```text
scanner.scope.filesystem_broad_root
```

## Sensitive environment exposure

Scanner v1 flags sensitive-looking environment variable names passed into MCP server processes:

```text
TOKEN
SECRET
KEY
PASSWORD
AWS_*
GITHUB_*
```

Example rule:

```text
scanner.launch.sensitive_env_exposed
```

## Output contract

JSON report shape:

```json
{
  "reportVersion": "1.0",
  "sourcePath": "examples/mcp-configs/unsafe-demo.json",
  "scannedServers": 4,
  "overallRisk": "critical",
  "issues": [
    {
      "type": "scope_creep",
      "severity": "critical",
      "ruleId": "scanner.scope.filesystem_broad_root",
      "detail": "Filesystem server filesystem-wide-open appears to expose a broad filesystem root.",
      "evidence": {
        "server": "filesystem-wide-open",
        "broadRoots": ["/"]
      },
      "recommendedFix": "Restrict filesystem MCP roots to the project workspace and block home/root traversal."
    }
  ]
}
```

## Exit codes

```text
0   scan completed with info/low/medium risk only
1   scan failed, invalid input, or missing file
2   scan completed and found high/critical risk
```

This is intentional so CI can fail on risky MCP config.

## Current limitations

Scanner v1 is intentionally conservative and JSON-first.

Not included yet:

```text
live tools/list manifest fetching
lockfile drift comparison
YAML config support
full package manager resolution
semantic LLM-based classification
runtime blocking
```

Those belong to later feature blocks.

## Quality bar

Scanner v1 includes:

- parser tests
- metadata scanner tests
- schema poisoning tests
- dangerous launch tests
- human report tests
- JSON report tests
- attack fixture corpus
- false-positive fixture corpus

If a scanner rule is added without tests and fixtures, it is not done.
