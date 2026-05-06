export type SupportedMcpClient = "claude-desktop" | "cursor" | "custom";

export interface ConfigRewritePlan {
  readonly client: SupportedMcpClient;
  readonly originalConfigPath: string;
  readonly backupPath: string;
  readonly mappingPath: string;
  readonly operations: readonly ConfigRewriteOperation[];
}

export interface ConfigRewriteOperation {
  readonly serverName: string;
  readonly originalCommand: string;
  readonly originalArgs: readonly string[];
  readonly protectedCommand: string;
  readonly protectedArgs: readonly string[];
}

export interface ConfigRewriteSafetyResult {
  readonly safeToRewrite: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export function validateRewritePlan(plan: ConfigRewritePlan): ConfigRewriteSafetyResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (plan.operations.length === 0) {
    blockers.push("No MCP server entries were found to protect.");
  }

  if (!plan.backupPath.includes(".mcp-shield")) {
    blockers.push("Backup path must live under .mcp-shield to keep rollback state discoverable.");
  }

  for (const operation of plan.operations) {
    if (operation.originalCommand.length === 0) {
      blockers.push(`Server ${operation.serverName} has an empty command.`);
    }

    if (operation.protectedCommand === operation.originalCommand) {
      warnings.push(`Server ${operation.serverName} protected command matches original command; verify wrapper arguments.`);
    }
  }

  return {
    safeToRewrite: blockers.length === 0,
    blockers,
    warnings
  };
}
