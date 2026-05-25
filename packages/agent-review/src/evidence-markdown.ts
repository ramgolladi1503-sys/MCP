import { readFile } from "node:fs/promises";

import type {
  AgentReviewEvidenceContract,
  AgentReviewEvidenceDocument,
  AgentReviewEvidenceSection
} from "./index.js";

interface PendingEvidenceSection {
  readonly heading: string;
  readonly level: number;
  readonly start_line: number;
  readonly heading_line_index: number;
}

interface MarkdownHeading {
  readonly level: number;
  readonly text: string;
}

export async function loadAgentReviewEvidenceDocument(path: string): Promise<AgentReviewEvidenceDocument> {
  const markdown = await readFile(path, "utf8");
  return parseAgentReviewEvidenceMarkdown(markdown, path);
}

export function parseAgentReviewEvidenceMarkdown(markdown: string, path = "agent-review-evidence.md"): AgentReviewEvidenceDocument {
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");
  const lines = normalizedMarkdown.split("\n");
  const sections: AgentReviewEvidenceSection[] = [];
  let title = path;
  let currentSection: PendingEvidenceSection | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = parseMarkdownHeading(lines[index] ?? "");
    if (!heading) {
      continue;
    }

    if (heading.level === 1 && title === path) {
      title = heading.text;
    }

    if (heading.level === 2) {
      if (currentSection) {
        sections.push(buildEvidenceSection(currentSection, lines, index - 1));
      }

      currentSection = {
        heading: heading.text,
        level: heading.level,
        start_line: index + 1,
        heading_line_index: index
      };
    }
  }

  if (currentSection) {
    sections.push(buildEvidenceSection(currentSection, lines, lines.length - 1));
  }

  return {
    path,
    title,
    sections,
    evidence_contract: parseAgentReviewEvidenceContractFields(normalizedMarkdown),
    raw_markdown: normalizedMarkdown
  };
}

export function parseAgentReviewEvidenceContractFields(markdown: string): AgentReviewEvidenceContract | undefined {
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");
  const lines = normalizedMarkdown.split("\n");
  const evidenceContractFieldsStart = lines.findIndex((line) => /^###\s+Evidence Contract Fields\s*$/i.test(line.trim()));

  if (evidenceContractFieldsStart === -1) {
    return undefined;
  }

  const fields: Record<string, string> = {};

  for (let index = evidenceContractFieldsStart + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^#{1,3}\s+/.test(line.trim())) {
      break;
    }

    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (!match) {
      continue;
    }

    fields[match[1]] = match[2].trim();
  }

  if (Object.keys(fields).length === 0) {
    return undefined;
  }

  return fields as unknown as AgentReviewEvidenceContract;
}

function buildEvidenceSection(
  pending: PendingEvidenceSection,
  lines: readonly string[],
  endLineIndex: number
): AgentReviewEvidenceSection {
  const contentLines = lines.slice(pending.heading_line_index + 1, endLineIndex + 1);
  return {
    heading: pending.heading,
    level: pending.level,
    content: contentLines.join("\n").trim(),
    start_line: pending.start_line,
    end_line: endLineIndex + 1
  };
}

function parseMarkdownHeading(line: string): MarkdownHeading | undefined {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (!match) {
    return undefined;
  }

  return {
    level: match[1].length,
    text: match[2].trim()
  };
}
