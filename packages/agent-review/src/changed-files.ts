import type {
  AgentReviewAreaClassification,
  AgentReviewAreaRule,
  AgentReviewChangedFile,
  AgentReviewConfig
} from "./index";

export interface AgentReviewChangedFileClassificationResult {
  readonly detected_areas: readonly AgentReviewAreaClassification[];
  readonly matched_files: readonly AgentReviewChangedFile[];
  readonly unmatched_files: readonly AgentReviewChangedFile[];
}

export function classifyAgentReviewChangedFiles(
  files: readonly AgentReviewChangedFile[],
  config: AgentReviewConfig
): readonly AgentReviewAreaClassification[] {
  return classifyAgentReviewChangedFilesWithSummary(files, config).detected_areas;
}

export function classifyAgentReviewChangedFilesWithSummary(
  files: readonly AgentReviewChangedFile[],
  config: AgentReviewConfig
): AgentReviewChangedFileClassificationResult {
  const normalizedFiles = files.map(normalizeChangedFile);
  const matchedFilePaths = new Set<string>();
  const detectedAreas: AgentReviewAreaClassification[] = [];

  for (const [areaName, areaRule] of Object.entries(config.area_rules)) {
    const matchedFiles = normalizedFiles.filter((file) => fileMatchesAreaRule(file.path, areaRule));
    if (matchedFiles.length === 0) {
      continue;
    }

    for (const matchedFile of matchedFiles) {
      matchedFilePaths.add(matchedFile.path);
    }

    detectedAreas.push({
      area: areaName,
      matched_patterns: getMatchedAreaPatterns(matchedFiles, areaRule),
      files: matchedFiles,
      required_proof: dedupePreservingOrder(areaRule.required_proof),
      required_sections: dedupePreservingOrder(areaRule.required_sections ?? [])
    });
  }

  return {
    detected_areas: detectedAreas,
    matched_files: normalizedFiles.filter((file) => matchedFilePaths.has(file.path)),
    unmatched_files: normalizedFiles.filter((file) => !matchedFilePaths.has(file.path))
  };
}

export function changedFileMatchesPattern(filePath: string, pattern: string): boolean {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedPattern = normalizePath(pattern);
  return globPatternToRegExp(normalizedPattern).test(normalizedFilePath);
}

function fileMatchesAreaRule(filePath: string, areaRule: AgentReviewAreaRule): boolean {
  return areaRule.path_patterns.some((pattern) => changedFileMatchesPattern(filePath, pattern));
}

function getMatchedAreaPatterns(
  files: readonly AgentReviewChangedFile[],
  areaRule: AgentReviewAreaRule
): readonly string[] {
  const matchedPatterns: string[] = [];

  for (const pattern of areaRule.path_patterns) {
    if (files.some((file) => changedFileMatchesPattern(file.path, pattern))) {
      matchedPatterns.push(pattern);
    }
  }

  return dedupePreservingOrder(matchedPatterns);
}

function globPatternToRegExp(pattern: string): RegExp {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const nextChar = pattern[index + 1];

    if (char === "*" && nextChar === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegExp(char);
  }

  source += "$";
  return new RegExp(source);
}

function normalizeChangedFile(file: AgentReviewChangedFile): AgentReviewChangedFile {
  return {
    ...file,
    path: normalizePath(file.path)
  };
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
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

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
