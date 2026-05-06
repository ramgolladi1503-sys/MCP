#!/usr/bin/env node

const command = process.argv[2] ?? "help";

const commands: Record<string, string> = {
  help: "Show available MCP Shield commands",
  scan: "Scan an MCP config for risky servers, metadata, schemas, and drift",
  init: "Rewrite an MCP client config through MCP Shield with backup and rollback state",
  gateway: "Start the stdio MCP gateway",
  doctor: "Run local installation and configuration diagnostics",
  explain: "Explain one audit event decision",
  replay: "Summarize a JSONL audit file",
  rollback: "Restore the previous MCP client config",
  disable: "Emergency restore and stop protected config usage",
  policy: "Check or test policy files"
};

if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (!Object.hasOwn(commands, command)) {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

console.error(`Command '${command}' is planned but not implemented in the foundation branch yet.`);
console.error("Architecture contracts are being created first so feature blocks stay clean and testable.");
process.exit(2);

function printHelp(): void {
  const rows = Object.entries(commands)
    .map(([name, description]) => `  ${name.padEnd(10)} ${description}`)
    .join("\n");

  process.stdout.write(`MCP Shield\n\nUsage:\n  mcp-shield <command> [options]\n\nCommands:\n${rows}\n`);
}
