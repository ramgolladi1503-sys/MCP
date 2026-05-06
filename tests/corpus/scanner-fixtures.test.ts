import { describe, expect, it } from "vitest";
import {
  scanMcpConfigJson,
  scanToolMetadata,
  scanToolSchema
} from "../../packages/scanner/src/index";
import {
  scannerAttackFixtures,
  scannerFalsePositiveFixtures
} from "../../packages/scanner/src/attack-fixtures";

describe("scanner attack fixtures", () => {
  for (const fixture of scannerAttackFixtures) {
    it(`${fixture.id}: ${fixture.description}`, () => {
      const result = evaluateFixture(fixture.input);

      if (fixture.expected.issueCountAtLeast !== undefined) {
        expect(result.issueCount).toBeGreaterThanOrEqual(fixture.expected.issueCountAtLeast);
      }

      if (fixture.expected.ruleId) {
        expect(result.ruleIds).toContain(fixture.expected.ruleId);
      }

      if (fixture.expected.overallRisk) {
        expect(result.overallRisk).toBe(fixture.expected.overallRisk);
      }
    });
  }
});

describe("scanner false-positive fixtures", () => {
  for (const fixture of scannerFalsePositiveFixtures) {
    it(`${fixture.id}: ${fixture.description}`, () => {
      const result = evaluateFixture(fixture.input);

      if (fixture.expected.issueCountAtLeast !== undefined) {
        expect(result.issueCount).toBe(fixture.expected.issueCountAtLeast);
      }

      if (fixture.expected.overallRisk) {
        expect(result.overallRisk).toBe(fixture.expected.overallRisk);
      }
    });
  }
});

function evaluateFixture(input: unknown): { readonly issueCount: number; readonly ruleIds: readonly string[]; readonly overallRisk?: string } {
  if (isMetadataInput(input)) {
    const issues = scanToolMetadata(input.toolName, input.description);
    return { issueCount: issues.length, ruleIds: issues.map((issue) => issue.ruleId) };
  }

  if (isSchemaInput(input)) {
    const issues = scanToolSchema(input.toolName, input.inputSchema);
    return { issueCount: issues.length, ruleIds: issues.map((issue) => issue.ruleId) };
  }

  const report = scanMcpConfigJson(JSON.stringify(input), "fixture.json");
  return {
    issueCount: report.issues.length,
    ruleIds: report.issues.map((issue) => issue.ruleId),
    overallRisk: report.overallRisk
  };
}

function isMetadataInput(input: unknown): input is { readonly toolName: string; readonly description: string } {
  return isRecord(input) && typeof input["toolName"] === "string" && typeof input["description"] === "string";
}

function isSchemaInput(input: unknown): input is { readonly toolName: string; readonly inputSchema: unknown } {
  return isRecord(input) && typeof input["toolName"] === "string" && "inputSchema" in input;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
