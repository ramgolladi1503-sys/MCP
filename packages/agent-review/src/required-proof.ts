import type {
  AgentReviewAreaClassification,
  AgentReviewEvidenceDocument,
  AgentReviewValidationIssue
} from "./index";

export interface AgentReviewRequiredProofResolutionInput {
  readonly evidence: AgentReviewEvidenceDocument;
  readonly detected_areas: readonly AgentReviewAreaClassification[];
}

export interface AgentReviewRequiredProofExpectation {
  readonly area: string;
  readonly proof: string;
  readonly files: readonly string[];
}

export interface AgentReviewResolvedRequiredProof {
  readonly proof: string;
  readonly areas: readonly string[];
  readonly files: readonly string[];
  readonly satisfied: boolean;
}

export interface AgentReviewRequiredProofResolutionResult {
  readonly passed: boolean;
  readonly expectations: readonly AgentReviewRequiredProofExpectation[];
  readonly required_proof: readonly AgentReviewResolvedRequiredProof[];
  readonly satisfied_proof: readonly string[];
  readonly missing_proof: readonly string[];
  readonly issues: readonly AgentReviewValidationIssue[];
}

export function resolveAgentReviewRequiredProof(
  input: AgentReviewRequiredProofResolutionInput
): AgentReviewRequiredProofResolutionResult {
  const expectations = buildRequiredProofExpectations(input.detected_areas);
  const requiredProof = collapseRequiredProofExpectations(expectations, input.evidence);
  const missingProof = requiredProof.filter((proof) => !proof.satisfied);
  const issues = missingProof.flatMap((proof) => buildMissingProofIssues(input.evidence, proof));

  return {
    passed: issues.length === 0,
    expectations,
    required_proof: requiredProof,
    satisfied_proof: requiredProof.filter((proof) => proof.satisfied).map((proof) => proof.proof),
    missing_proof: missingProof.map((proof) => proof.proof),
    issues
  };
}

export function evidenceContainsRequiredProof(evidence: AgentReviewEvidenceDocument, proof: string): boolean {
  return normalizeProofText(evidence.raw_markdown).includes(normalizeProofText(proof));
}

function buildRequiredProofExpectations(
  detectedAreas: readonly AgentReviewAreaClassification[]
): readonly AgentReviewRequiredProofExpectation[] {
  const expectations: AgentReviewRequiredProofExpectation[] = [];

  for (const area of detectedAreas) {
    for (const proof of area.required_proof) {
      expectations.push({
        area: area.area,
        proof,
        files: area.files.map((file) => file.path)
      });
    }
  }

  return expectations;
}

function collapseRequiredProofExpectations(
  expectations: readonly AgentReviewRequiredProofExpectation[],
  evidence: AgentReviewEvidenceDocument
): readonly AgentReviewResolvedRequiredProof[] {
  const byProof = new Map<string, AgentReviewResolvedRequiredProof>();

  for (const expectation of expectations) {
    const existing = byProof.get(expectation.proof);
    if (existing) {
      byProof.set(expectation.proof, {
        proof: expectation.proof,
        areas: dedupePreservingOrder([...existing.areas, expectation.area]),
        files: dedupePreservingOrder([...existing.files, ...expectation.files]),
        satisfied: existing.satisfied
      });
      continue;
    }

    byProof.set(expectation.proof, {
      proof: expectation.proof,
      areas: [expectation.area],
      files: dedupePreservingOrder(expectation.files),
      satisfied: evidenceContainsRequiredProof(evidence, expectation.proof)
    });
  }

  return Array.from(byProof.values());
}

function buildMissingProofIssues(
  evidence: AgentReviewEvidenceDocument,
  proof: AgentReviewResolvedRequiredProof
): readonly AgentReviewValidationIssue[] {
  return proof.areas.map((area) => ({
    severity: "error",
    rule_id: "agent_review.required_proof_missing",
    message: `Missing required proof for ${area}: ${proof.proof}`,
    path: evidence.path,
    section: "Acceptance Proof",
    field: proof.proof,
    suggested_fix: `Add evidence for "${proof.proof}" covering ${proof.files.join(", ")}.`
  }));
}

function normalizeProofText(value: string): string {
  return value.trim().replace(/[_`*\-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
}

function dedupePreservingOrder(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}
