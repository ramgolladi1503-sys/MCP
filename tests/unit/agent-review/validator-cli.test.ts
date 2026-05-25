import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseAgentReviewValidatorCliArgs,
  runAgentReviewValidatorCli
} from "../../../packages/agent-review/src/validator-cli";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function writeEvidence(markdown: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agent-review-cli-"));
  tempDirs.push(dir);
  const path = join(dir, "evidence.md");
  await writeFile(path, markdown, "utf8");
  return path;
}

function validContractFields(): string[] {
  return [
    "mode: CONTRACT_ONLY",
    "candidate_id: CLI_VALID",
    "decision: VALIDATOR_CLI",
    "reason: Proves the CLI can run existing validators.",
    "is_runtime_change: false",
    "is_security_runtime_change: false",
    "child_mcp_forwarding_changed: false",
    "policy_behavior_changed: false",
    "approval_behavior_changed: false",
    "audit_schema_changed: false",
    "source: docs/cli-valid.md"
  ];
}

function buildEvidence(extraAcceptanceProof = ""): string {
  return [
    "# Evidence",
    "",
    "## Agent Work Contract",
    "",
    "### Evidence Contract Fields",
    ...validContractFields(),
    "",
    "## Grill Me Review",
    "Review exists.",
    "",
    "## Hermes Review",
    "Review exists.",
    "",
    "## GSD Review",
    "Review exists.",
    "",
    "## Security Review",
    "Security review exists.",
    "",
    "## QA / Failure Review",
    "Failure review exists.",
    "",
    "## Scope Guard",
    "Scope guard exists.",
    "",
    "## Acceptance Proof",
    extraAcceptanceProof || "No changed-file proof required.",
    "",
    "## Runtime Proof Required After Merge",
    "Future runtime proof is required after merge if runtime enforcement is added.",
    "",
    "## What This PR Does Not Prove",
    "This does not prove runtime MCP behavior.",
    "",
    "## Human Approval",
    "Human approval required."
  ].join("\n");
}

describe("agent-review validator CLI", () => {
  it("parses CLI arguments deterministically", () => {
    const parsed = parseAgentReviewValidatorCliArgs([
      "--project-root",
      "/repo",
      "--evidence=docs/evidence.md",
      "--changed-file",
      "packages/gateway/src/index.ts",
      "--changed-file=docs/readme.md"
    ]);

    expect(parsed.project_root).toBe("/repo");
    expect(parsed.evidence_path).toBe("docs/evidence.md");
    expect(parsed.changed_files.map((file) => file.path)).toEqual([
      "packages/gateway/src/index.ts",
      "docs/readme.md"
    ]);
  });

  it("returns help without requiring evidence", async () => {
    const result = await runAgentReviewValidatorCli(["--help"]);

    expect(result.exit_code).toBe(0);
    expect(result.stdout).toContain("Agent Review validator CLI");
    expect(result.stderr).toBe("");
  });

  it("returns usage error when evidence is missing", async () => {
    const result = await runAgentReviewValidatorCli([]);

    expect(result.exit_code).toBe(2);
    expect(result.stderr).toContain("Missing required --evidence");
  });

  it("returns a passing report for valid evidence with no changed files", async () => {
    const evidencePath = await writeEvidence(buildEvidence());

    const result = await runAgentReviewValidatorCli(["--project-root", process.cwd(), "--evidence", evidencePath]);

    expect(result.exit_code).toBe(0);
    expect(result.report?.passed).toBe(true);
    expect(result.report?.issues).toEqual([]);
    expect(result.report?.detected_areas).toEqual([]);
    expect(JSON.parse(result.stdout).schema_version).toBe("agent_review.validator_cli.v1");
  });

  it("returns failing report when changed-file area proof is missing", async () => {
    const evidencePath = await writeEvidence(buildEvidence("protocol test completed"));

    const result = await runAgentReviewValidatorCli([
      "--project-root",
      process.cwd(),
      "--evidence",
      evidencePath,
      "--changed-file",
      "packages/gateway/src/index.ts"
    ]);

    expect(result.exit_code).toBe(1);
    expect(result.report?.passed).toBe(false);
    expect(result.report?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule_id: "agent_review.required_proof_missing", field: "stdout purity" })
      ])
    );
    expect(result.report?.checks.area_sections.passed).toBe(true);
    expect(result.report?.checks.required_proof.passed).toBe(false);
  });
});
