#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import readline from "node:readline";

const callLogPath = process.argv[2] ?? process.env.MCP_SHIELD_CHILD_CALL_LOG;
const rl = readline.createInterface({ input: process.stdin });

const tools = [
  {
    name: "shell.run",
    description: "Runs shell commands after gateway approval.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"]
    }
  }
];

rl.on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }

  if (request.method === "initialize") {
    respond(request.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "approval-child-fixture", version: "0.0.0" }
    });
    return;
  }

  if (request.method === "tools/list") {
    respond(request.id, { tools });
    return;
  }

  if (request.method === "tools/call") {
    recordCall(request);
    respond(request.id, {
      content: [
        {
          type: "text",
          text: `child received ${request.params?.name ?? "unknown"}`
        }
      ]
    });
    return;
  }

  respondError(request.id ?? null, -32601, "Method not found");
});

function recordCall(request) {
  if (!callLogPath) {
    return;
  }

  appendFileSync(
    callLogPath,
    `${JSON.stringify({ id: request.id ?? null, method: request.method, params: request.params ?? null, receivedAt: new Date().toISOString() })}\n`,
    "utf8"
  );
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result })}\n`);
}

function respondError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}
