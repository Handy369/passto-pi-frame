// Step 13: Minimal section index module for passto-planner.
// Reads passto-plan.md, extracts section structure, and writes sections/index.md
// with a SECTION_MANIFEST block.

import { readTextFile, writeTextFile } from "./file-io.ts";
import * as path from "node:path";

// ── Public Types ────────────────────────────────────────────────────

export interface SectionIndexConfig {
  runId: string;
  planningDir: string;
  goal: string;
  target?: string;
}

export interface SectionManifestEntry {
  id: string;
  title: string;
  purpose: string;
  filePath: string;
  dependencies: string[];
}

export interface SectionIndexOutput {
  filePath: string;
  manifest: SectionManifestEntry[];
  summary: string;
}

// ── Section Definitions ─────────────────────────────────────────────

/**
 * Derive a minimal section list from the final plan structure.
 * These sections mirror the logical blocks in passto-plan.md.
 */
function deriveSections(
  planContent: string | null,
  _goal: string,
  _target: string | undefined,
): SectionManifestEntry[] {
  const sections: SectionManifestEntry[] = [];

  if (!planContent) {
    // If no plan file exists yet, derive from goal only (fallback mode).
    sections.push({
      id: "1",
      title: "Overview & Target",
      purpose: "Summarize the project goal, scope, and intended outcomes.",
      filePath: "sections/section-1-overview-target.md",
      dependencies: [],
    });
    sections.push({
      id: "2",
      title: "Research & Findings",
      purpose: "Document research results, environment facts, and discovered constraints.",
      filePath: "sections/section-2-research-findings.md",
      dependencies: ["1"],
    });
    sections.push({
      id: "3",
      title: "Constraints & Assumptions",
      purpose: "List technical constraints, assumptions, and known risks.",
      filePath: "sections/section-3-constraints-assumptions.md",
      dependencies: ["1"],
    });
    sections.push({
      id: "4",
      title: "Workflow & Implementation",
      purpose: "Define the implementation workflow, step-by-step actions, and file changes.",
      filePath: "sections/section-4-workflow-implementation.md",
      dependencies: ["2", "3"],
    });
    sections.push({
      id: "5",
      title: "Risks & Next Actions",
      purpose: "Catalog open questions, unresolved items, and recommended next steps.",
      filePath: "sections/section-5-risks-next-actions.md",
      dependencies: ["4"],
    });
    return sections;
  }

  // Extract actual section headings from passto-plan.md
  const sectionHeadings = extractSectionHeadings(planContent);

  if (sectionHeadings.length > 0) {
    let idx = 0;
    for (const heading of sectionHeadings) {
      idx++;
      sections.push({
        id: String(idx),
        title: heading,
        purpose: deriveSectionPurpose(heading),
        filePath: `sections/section-${idx}-${slugify(heading)}.md`,
        dependencies: idx > 1 ? [String(idx - 1)] : [],
      });
    }
  } else {
    // Fallback: use default sections if no headings found
    return deriveSections(null, _goal, _target);
  }

  return sections;
}

/**
 * Extract ##-level section headings from passto-plan.md content.
 * Only captures top-level ## headings that appear after --- delimiters
 * (the convention used by Step 12 final-plan output).
 */
function extractSectionHeadings(content: string): string[] {
  const headings: string[] = [];
  const blocks = content.split(/\n---\n/);

  for (const block of blocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      const match = line.match(/^##\s+(.+)$/);
      if (match) {
        headings.push(match[1].trim());
        break; // Only take the first ## heading per block (top-level section)
      }
    }
  }

  return headings;
}

/**
 * Derive a purpose string for a section based on its title.
 */
function deriveSectionPurpose(title: string): string {
  const purposeMap: Record<string, string> = {
    "Target Summary": "Summarize the project goal, scope, and intended outcomes.",
    "Product Framing": "Define product context, user problems, and value proposition.",
    "Research Summary": "Document research findings, environment facts, and technical context.",
    "Review Summary": "Summarize review findings, feedback, and quality assessments.",
    "Integration Summary": "Document how findings from different sources are integrated and reconciled.",
    "Constraints and Assumptions": "List technical constraints, assumptions, and known limitations.",
    "Proposed Workflow": "Define the implementation workflow and step-by-step execution plan.",
    "Risks and Open Questions": "Catalog risks, unresolved items, and open questions.",
    "Next Actions": "Define concrete next steps and action items for execution.",
  };

  for (const [key, value] of Object.entries(purposeMap)) {
    if (title.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return `Cover the ${title} topic with relevant details from the planning context.`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Manifest Generation ─────────────────────────────────────────────

function buildSectionManifestMarkdown(
  config: SectionIndexConfig,
  manifest: SectionManifestEntry[],
): string {
  const lines: string[] = [];

  lines.push("# Sections Index");
  lines.push("");
  lines.push(`Generated by passto-planner Step 13 · Run: ${config.runId}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## SECTION_MANIFEST");
  lines.push("");

  for (const entry of manifest) {
    lines.push(`### Section ${entry.id}: ${entry.title}`);
    lines.push("");
    lines.push(`- **id**: ${entry.id}`);
    lines.push(`- **title**: ${entry.title}`);
    lines.push(`- **purpose**: ${entry.purpose}`);
    lines.push(`- **file**: ${entry.filePath}`);
    lines.push(`- **dependencies**: ${entry.dependencies.length ? entry.dependencies.join(", ") : "none"}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`Total sections: ${manifest.length}`);
  lines.push("");

  return lines.join("\n");
}

// ── Main Entry ──────────────────────────────────────────────────────

export async function runStep13SectionIndex(config: SectionIndexConfig): Promise<SectionIndexOutput> {
  // Read passto-plan.md
  const planPath = path.join(config.planningDir, "passto-plan.md");
  const planContent = readTextFile(planPath);

  // Derive sections from plan
  const manifest = deriveSections(planContent, config.goal, config.target);

  // Build and write index
  const markdown = buildSectionManifestMarkdown(config, manifest);
  const sectionsDir = path.join(config.planningDir, "sections");
  const indexPath = path.join(sectionsDir, "index.md");
  writeTextFile(indexPath, markdown);

  const summary = `Section index generated with ${manifest.length} entries: ${manifest.map((m) => m.title).join(", ")}.`;

  return {
    filePath: indexPath,
    manifest,
    summary,
  };
}
