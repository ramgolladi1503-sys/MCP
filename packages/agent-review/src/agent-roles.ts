export const AGENT_REVIEW_ROLE_CATALOG_VERSION = "agent_review.role_catalog.v1" as const;

export const AGENT_REVIEW_ROLE_IDS = [
  "scope_lock",
  "repo_cartographer",
  "architecture_drift",
  "safety_boundary",
  "runtime_boundary",
  "risk_gating",
  "execution_boundary",
  "data_freshness",
  "evidence_replay",
  "qa_failure",
  "security_review",
  "no_test_weakening",
  "ci_release_guard",
  "docs_runbook",
  "human_approval_gate",
  "grill_me",
  "hermes",
  "gsd"
] as const;

export type AgentReviewRoleId = (typeof AGENT_REVIEW_ROLE_IDS)[number];

export type AgentReviewRoleCategory =
  | "scope"
  | "architecture"
  | "safety"
  | "runtime"
  | "data"
  | "evidence"
  | "quality"
  | "security"
  | "delivery"
  | "approval"
  | "review";

export interface AgentReviewRoleDefinition {
  readonly id: AgentReviewRoleId;
  readonly label: string;
  readonly category: AgentReviewRoleCategory;
  readonly description: string;
  readonly portable_to: readonly string[];
}

export const AGENT_REVIEW_ROLE_CATALOG: Readonly<Record<AgentReviewRoleId, AgentReviewRoleDefinition>> = {
  scope_lock: {
    id: "scope_lock",
    label: "Scope Lock Agent",
    category: "scope",
    description: "Confirms the change stays inside the declared PR boundary and does not smuggle unrelated work.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  repo_cartographer: {
    id: "repo_cartographer",
    label: "Repo Cartographer Agent",
    category: "architecture",
    description: "Maps changed files to known repository areas before deeper review is applied.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  architecture_drift: {
    id: "architecture_drift",
    label: "Architecture Drift Agent",
    category: "architecture",
    description: "Checks whether a change violates the locked architecture or introduces unrelated abstractions.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  safety_boundary: {
    id: "safety_boundary",
    label: "Safety Boundary Agent",
    category: "safety",
    description: "Reviews whether safety gates, fail-closed behavior, and unsafe-path rejection remain intact.",
    portable_to: ["mcp_shield", "tradebot", "algotradify"]
  },
  runtime_boundary: {
    id: "runtime_boundary",
    label: "Runtime Boundary Agent",
    category: "runtime",
    description: "Reviews runtime boundary claims and requires proof for safe blocked/allowed path separation.",
    portable_to: ["mcp_shield", "tradebot", "algotradify"]
  },
  risk_gating: {
    id: "risk_gating",
    label: "Risk / Gating Agent",
    category: "safety",
    description: "Reviews risk, gating, and decision controls that can reject unsafe actions.",
    portable_to: ["mcp_shield", "tradebot", "algotradify"]
  },
  execution_boundary: {
    id: "execution_boundary",
    label: "Execution Boundary Agent",
    category: "runtime",
    description: "Reviews action execution boundaries and requires proof that unsafe execution paths are not activated accidentally.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "mobile_approval_console"]
  },
  data_freshness: {
    id: "data_freshness",
    label: "Data Freshness Agent",
    category: "data",
    description: "Reviews source freshness, stale input handling, and missing-data behavior.",
    portable_to: ["tradebot", "algotradify", "rti_app", "generic_python"]
  },
  evidence_replay: {
    id: "evidence_replay",
    label: "Evidence / Replay Agent",
    category: "evidence",
    description: "Reviews evidence artifacts, replayability, auditability, and read-only proof claims.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "veriforge"]
  },
  qa_failure: {
    id: "qa_failure",
    label: "QA Failure Agent",
    category: "quality",
    description: "Requires negative-path, failure-path, and regression proof instead of happy-path-only coverage.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  security_review: {
    id: "security_review",
    label: "Security Review Agent",
    category: "security",
    description: "Reviews security-sensitive changes and requires explicit proof for risky or boundary-touching behavior.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  no_test_weakening: {
    id: "no_test_weakening",
    label: "No-Test-Weakening Agent",
    category: "quality",
    description: "Flags evidence expectations for removed, weakened, or fake tests.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  ci_release_guard: {
    id: "ci_release_guard",
    label: "CI / Release Guard Agent",
    category: "delivery",
    description: "Reviews CI, release, package, and lockfile changes for accidental delivery behavior drift.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  docs_runbook: {
    id: "docs_runbook",
    label: "Docs / Runbook Agent",
    category: "delivery",
    description: "Reviews docs and runbooks for accurate scope, no unsupported runtime claims, and useful recovery guidance.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  human_approval_gate: {
    id: "human_approval_gate",
    label: "Human Approval Gate",
    category: "approval",
    description: "Requires explicit human approval proof for approval lifecycle or action-boundary changes.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "mobile_approval_console"]
  },
  grill_me: {
    id: "grill_me",
    label: "Grill Me Reviewer",
    category: "review",
    description: "Challenges whether the PR is real progress, sufficiently scoped, and backed by evidence.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  hermes: {
    id: "hermes",
    label: "Hermes Reviewer",
    category: "review",
    description: "Reviews contract clarity, handoff quality, naming, and whether future agents can continue safely.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  },
  gsd: {
    id: "gsd",
    label: "GSD Reviewer",
    category: "review",
    description: "Checks whether the PR is minimal, deterministic, useful, and not fake progress.",
    portable_to: ["mcp_shield", "tradebot", "algotradify", "generic_typescript", "generic_python"]
  }
} as const;

export function listAgentReviewRoles(): readonly AgentReviewRoleDefinition[] {
  return AGENT_REVIEW_ROLE_IDS.map((roleId) => AGENT_REVIEW_ROLE_CATALOG[roleId]);
}

export function getAgentReviewRole(roleId: AgentReviewRoleId): AgentReviewRoleDefinition {
  return AGENT_REVIEW_ROLE_CATALOG[roleId];
}

export function isAgentReviewRoleId(value: string): value is AgentReviewRoleId {
  return (AGENT_REVIEW_ROLE_IDS as readonly string[]).includes(value);
}
