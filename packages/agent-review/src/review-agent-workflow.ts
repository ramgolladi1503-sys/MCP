import type { AgentReviewConfig } from "./index.js";
import { AgentReviewConfigError } from "./index.js";

export interface AgentReviewReviewAgentDeclaration {
  readonly label: string;
  readonly description?: string;
  readonly required_for: readonly string[];
  readonly required_sections?: readonly string[];
  readonly required_proof?: readonly string[];
}

export interface AgentReviewAgentWorkflowConfig {
  readonly review_agents?: Readonly<Record<string, AgentReviewReviewAgentDeclaration>>;
}

export type AgentReviewConfigWithAgentWorkflow = AgentReviewConfig & AgentReviewAgentWorkflowConfig;

export function getAgentReviewReviewAgents(
  config: AgentReviewConfig
): Readonly<Record<string, AgentReviewReviewAgentDeclaration>> {
  const workflowConfig = config as AgentReviewConfigWithAgentWorkflow;
  validateAgentReviewAgentWorkflowConfig(workflowConfig);
  return workflowConfig.review_agents ?? {};
}

export function validateAgentReviewAgentWorkflowConfig(
  config: AgentReviewConfigWithAgentWorkflow,
  sourcePath = "agent-review.yaml"
): readonly string[] {
  const issues: string[] = [];
  const reviewAgents = config.review_agents;

  if (reviewAgents === undefined) {
    return [];
  }

  if (!isPlainRecord(reviewAgents)) {
    throw new AgentReviewConfigError(`Invalid agent-review config: ${sourcePath}`, ["review_agents must be an object"]);
  }

  if (Object.keys(reviewAgents).length === 0) {
    issues.push("review_agents must not be empty when provided");
  }

  for (const [agentId, declaration] of Object.entries(reviewAgents)) {
    if (agentId.trim() === "") {
      issues.push("review_agents keys must be non-empty agent IDs");
      continue;
    }

    if (!isPlainRecord(declaration)) {
      issues.push(`review_agents.${agentId} must be an object`);
      continue;
    }

    requireNonEmptyString(declaration.label, `review_agents.${agentId}.label`, issues);
    requireStringArray(declaration.required_for, `review_agents.${agentId}.required_for`, issues);

    if (declaration.description !== undefined) {
      requireNonEmptyString(declaration.description, `review_agents.${agentId}.description`, issues);
    }

    if (declaration.required_sections !== undefined) {
      requireStringArray(declaration.required_sections, `review_agents.${agentId}.required_sections`, issues);
    }

    if (declaration.required_proof !== undefined) {
      requireStringArray(declaration.required_proof, `review_agents.${agentId}.required_proof`, issues);
    }
  }

  if (issues.length > 0) {
    throw new AgentReviewConfigError(`Invalid agent-review config: ${sourcePath}`, issues);
  }

  return [];
}

function requireNonEmptyString(value: unknown, field: string, issues: string[]): void {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`${field} must be a non-empty string`);
  }
}

function requireStringArray(value: unknown, field: string, issues: string[]): void {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    issues.push(`${field} must be a non-empty string array`);
  }
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
