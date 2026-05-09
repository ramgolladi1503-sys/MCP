#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import readline from "node:readline";

const callLogPath = process.argv[2] ?? process.env.MCP_SHIELD_DEMO_CALL_LOG;
const rl = readline.createInterface({ input: process.stdin });

const tools = [
  {
    name: "git.status",
    description: "Returns repository status using a read-only git command.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"]
    }
  },
  {
    name: "git.push",
    description: "Pushes commits to a remote branch and must be approval-gated.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"]
    }
  },
  {
    name: "shell.run",
    description: "Runs local shell commands. Destructive commands must be blocked.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"]
    }
  },
  {
    name: "db.query",
    description: "Runs database SQL. SELECT is safe, writes need approval, destructive DDL is blocked.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
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
      serverInfo: { name: "mcp-shield-real-world-demo", version: "0.0.0" }
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
          text: `demo server received ${request.params?.name ?? "unknown"}: ${JSON.stringify(request.params?.arguments ?? {})}`
        }
      ]
    });
    return;
  }

  if (request.method === "ping") {
    respond(request.id, {});
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
