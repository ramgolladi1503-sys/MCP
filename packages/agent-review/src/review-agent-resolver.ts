import type { AgentReviewAreaClassification, AgentReviewChangedFile, AgentReviewConfig } from "./index.js";
import {
  getAgentReviewReviewAgents,
  type AgentReviewReviewAgentDeclaration
} from "./review-agent-workflow.js";

export interface AgentReviewResolvedReviewAgent {
  readonly agent: string;
  readonly label: string;
  readonly areas: readonly string[];
  readonly files: readonly AgentReviewChangedFile[];
  readonly required_sections: readonly string[];
  readonly required_proof: readonly string[];
}

export interface AgentReviewRequiredReviewAgentResolutionResult {
  readonly required_review_agents: readonly string[];
  readonly resolved_review_agents: readonly AgentReviewResolvedReviewAgent[];
}

export function resolveAgentReviewRequiredReviewAgents(
  detectedAreas: readonly AgentReviewAreaClassification[],
  config: AgentReviewConfig
): AgentReviewRequiredReviewAgentResolutionResult {
  const reviewAgents = getAgentReviewReviewAgents(config);
  const resolvedByAgent = new Map<string, MutableResolvedReviewAgent>();

  for (const [agentId, declaration] of Object.entries(reviewAgents)) {
    const matchingAreas = detectedAreas.filter((area) => declarationMatchesArea(declaration, area.area));

    if (matchingAreas.length === 0) {
      continue;
    }

    const mutable = getOrCreateResolvedAgent(resolvedByAgent, agentId, declaration);

    for (const area of matchingAreas) {
      mutable.areas.push(area.area);
      mutable.files.push(...area.files);
    }
  }

  const resolvedReviewAgents = Array.from(resolvedByAgent.entries()).map(([agentId, agent]) => ({
    agent: agentId,
    label: agent.label,
    areas: dedupePreservingOrder(agent.areas),
    files: dedupeChangedFiles(agent.files),
    required_sections: dedupePreservingOrder(agent.required_sections),
    required_proof: dedupePreservingOrder(agent.required_proof)
  }));

  return {
    required_review_agents: resolvedReviewAgents.map((agent) => agent.agent),
    resolved_review_agents: resolvedReviewAgents
  };
}

interface MutableResolvedReviewAgent {
  readonly label: string;
  readonly areas: string[];
  readonly files: AgentReviewChangedFile[];
  readonly required_sections: string[];
  readonly required_proof: string[];
}

function getOrCreateResolvedAgent(
  resolvedByAgent: Map<string, MutableResolvedReviewAgent>,
  agentId: string,
  declaration: AgentReviewReviewAgentDeclaration
): MutableResolvedReviewAgent {
  const existing = resolvedByAgent.get(agentId);
  if (existing !== undefined) {
    return existing;
  }

  const created: MutableResolvedReviewAgent = {
    label: declaration.label,
    areas: [],
    files: [],
    required_sections: [...(declaration.required_sections ?? [])],
    required_proof: [...(declaration.required_proof ?? [])]
  };

  resolvedByAgent.set(agentId, created);
  return created;
}

function declarationMatchesArea(declaration: AgentReviewReviewAgentDeclaration, area: string): boolean {
  return declaration.required_for.includes(area) || declaration.required_for.includes("*");
}

function dedupeChangedFiles(files: readonly AgentReviewChangedFile[]): readonly AgentReviewChangedFile[] {
  const seen = new Set<string>();
  const deduped: AgentReviewChangedFile[] = [];

  for (const file of files) {
    if (seen.has(file.path)) {
      continue;
    }

    seen.add(file.path);
    deduped.push(file);
  }

  return deduped;
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
