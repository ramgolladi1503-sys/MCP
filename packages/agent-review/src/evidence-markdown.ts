import { readFile } from "node:fs/promises";

import type {
  AgentReviewEvidenceContract,
  AgentReviewEvidenceDocument,
  AgentReviewEvidenceSection
} from "./index";

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

    if (heading.level < 2) {
      continue;
    }

    if (currentSection) {
      sections.push(materializeEvidenceSection(currentSection, lines, index));
    }

    currentSection = {
      heading: heading.text,
      level: heading.level,
      start_line: index + 1,
      heading_line_index: index
    };
  }

  if (currentSection) {
    sections.push(materializeEvidenceSection(currentSection, lines, lines.length));
  }

  const evidenceContractSection = sections.find((section) => normalizeSectionHeading(section.heading) === "evidence contract fields");
  const evidenceContract = evidenceContractSection
    ? parseAgentReviewEvidenceContractFields(evidenceContractSection.content)
    : undefined;

  return {
    path,
    title,
    sections,
    evidence_contract: evidenceContract,
    raw_markdown: normalizedMarkdown
  };
}

export function parseAgentReviewEvidenceContractFields(content: string): AgentReviewEvidenceContract | undefined {
  const values: Record<string, string> = {};
  let insideFence = false;

  for (const rawLine of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      insideFence = !insideFence;
      continue;
    }

    if (insideFence || line === "" || line.startsWith("- ")) {
      continue;
    }

    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }

    values[match[1]] = match[2].trim();
  }

  if (Object.keys(values).length === 0) {
    return undefined;
  }

  return values as unknown as AgentReviewEvidenceContract;
}

function materializeEvidenceSection(
  pending: PendingEvidenceSection,
  lines: readonly string[],
  endLineExclusive: number
): AgentReviewEvidenceSection {
  const content = lines.slice(pending.heading_line_index + 1, endLineExclusive).join("\n").trim();

  return {
    heading: pending.heading,
    level: pending.level,
    content,
    start_line: pending.start_line,
    end_line: Math.max(pending.start_line, endLineExclusive)
  };
}

function parseMarkdownHeading(line: string): MarkdownHeading | undefined {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line.trimEnd());
  if (!match) {
    return undefined;
  }

  return {
    level: match[1].length,
    text: normalizeSectionHeadingText(match[2])
  };
}

function normalizeSectionHeadingText(value: string): string {
  return value.replace(/\s+#+\s*$/, "").trim();
}

function normalizeSectionHeading(value: string): string {
  return normalizeSectionHeadingText(value).toLowerCase();
}
