#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function main() {
  const projectRoot = process.cwd();
  const eventName = process.env.GITHUB_EVENT_NAME ?? "";

  if (eventName !== "pull_request") {
    console.log(`Agent Review CI scope guard skipped for event: ${eventName || "unknown"}`);
    process.exit(0);
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    fail("GITHUB_EVENT_PATH is required for pull_request scope guard validation.");
  }

  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const pullRequestNumber = event?.pull_request?.number;
  if (!Number.isInteger(pullRequestNumber)) {
    fail("pull_request.number is required for Agent Review evidence lookup.");
  }

  const changedFiles = getChangedFiles(projectRoot, event);
  if (changedFiles.length === 0) {
    fail("No changed files detected for pull_request scope guard validation.");
  }

  const evidenceCandidates = changedFiles.filter((file) => new RegExp(`^docs/agent_reviews/pr_${pullRequestNumber}_[^/]+\\.md$`).test(file));

  if (evidenceCandidates.length !== 1) {
    fail(
      `Expected exactly one Agent Review evidence file for PR #${pullRequestNumber}; found ${evidenceCandidates.length}: ${evidenceCandidates.join(", ") || "<none>"}`
    );
  }

  const evidencePath = evidenceCandidates[0];
  const validatorPath = join(projectRoot, "packages/agent-review/dist/validator-cli.js");
  if (!existsSync(validatorPath)) {
    fail(`Built Agent Review validator CLI not found: ${validatorPath}. Run pnpm typecheck first.`);
  }

  const validatorArgs = [
    "--experimental-specifier-resolution=node",
    validatorPath,
    "--project-root",
    projectRoot,
    "--evidence",
    evidencePath,
    ...changedFiles.flatMap((file) => ["--changed-file", file])
  ];

  const result = spawnSync(process.execPath, validatorArgs, {
    cwd: projectRoot,
    encoding: "utf8"
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    fail(result.error.message);
  }

  if (result.stdout.trim() !== "") {
    assertAgentEvidenceEnforced(parseValidatorReport(result.stdout));
  }

  process.exit(result.status ?? 1);
}

export function parseValidatorReport(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Agent Review validator CLI emitted invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function assertAgentEvidenceEnforced(report) {
  const agentEvidence = report?.checks?.agent_evidence;
  if (!agentEvidence) {
    throw new Error("Agent Review CI scope guard requires checks.agent_evidence in validator report.");
  }

  if (!Array.isArray(report.required_review_agents)) {
    throw new Error("Agent Review CI scope guard requires top-level required_review_agents in validator report.");
  }

  if (!Array.isArray(report.satisfied_review_agents)) {
    throw new Error("Agent Review CI scope guard requires top-level satisfied_review_agents in validator report.");
  }

  if (!Array.isArray(report.missing_review_agents)) {
    throw new Error("Agent Review CI scope guard requires top-level missing_review_agents in validator report.");
  }

  if (!Array.isArray(agentEvidence.missing_review_agents)) {
    throw new Error("Agent Review CI scope guard requires checks.agent_evidence.missing_review_agents in validator report.");
  }

  const missingAgents = dedupePreservingOrder([...report.missing_review_agents, ...agentEvidence.missing_review_agents]);
  if (missingAgents.length > 0) {
    throw new Error(`Agent Review CI scope guard failed required review-agent evidence: ${missingAgents.join(", ")}`);
  }
}

function getChangedFiles(projectRoot, event) {
  const mergeDiff = runGit(projectRoot, ["diff", "--name-only", "HEAD^1", "HEAD^2"]);
  if (mergeDiff.status === 0 && mergeDiff.stdout.trim() !== "") {
    return normalizeChangedFiles(mergeDiff.stdout);
  }

  const baseSha = event?.pull_request?.base?.sha;
  const headSha = event?.pull_request?.head?.sha;
  if (baseSha && headSha) {
    const explicitDiff = runGit(projectRoot, ["diff", "--name-only", baseSha, headSha]);
    if (explicitDiff.status === 0 && explicitDiff.stdout.trim() !== "") {
      return normalizeChangedFiles(explicitDiff.stdout);
    }
  }

  fail(
    [
      "Unable to determine changed files for Agent Review scope guard.",
      mergeDiff.stderr?.trim() ? `merge diff error: ${mergeDiff.stderr.trim()}` : "",
      baseSha && headSha ? `fallback compared ${baseSha}..${headSha}` : "fallback unavailable: missing base/head sha"
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function runGit(projectRoot, args) {
  return spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8"
  });
}

function normalizeChangedFiles(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function dedupePreservingOrder(values) {
  const seen = new Set();
  const deduped = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}

function fail(message) {
  console.error(`Agent Review CI scope guard failed: ${message}`);
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
