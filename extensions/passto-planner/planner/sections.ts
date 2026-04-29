// Step 14: Minimal section files module for passto-planner.
// Reads sections/index.md, parses SECTION_MANIFEST, and generates
// section-*.md files for each manifest entry.

import { readTextFile, writeTextFile } from "./file-io.ts";
import * as path from "node:path";

// ── Public Types ────────────────────────────────────────────────────

export interface SectionsConfig {
  runId: string;
  planningDir: string;
  goal: string;
  target?: string;
}

export interface SectionFileResult {
  id: string;
  title: string;
  filePath: string;
  written: boolean;
}

export interface SectionsOutput {
  files: SectionFileResult[];
  summary: string;
}

// ── Manifest Parsing ────────────────────────────────────────────────

interface ParsedManifestEntry {
  id: string;
  title: string;
  purpose: string;
  filePath: string;
  dependencies: string[];
}

/**
 * Parse SECTION_MANIFEST from sections/index.md content.
 */
function parseSectionManifest(indexContent: string): ParsedManifestEntry[] {
  const entries: ParsedManifestEntry[] = [];

  // Find the SECTION_MANIFEST block
  const manifestStart = indexContent.indexOf("## SECTION_MANIFEST");
  if (manifestStart === -1) {
    return entries;
  }

  // Find the next --- after the manifest header (end of manifest block)
  const afterHeader = indexContent.indexOf("\n", manifestStart);
  if (afterHeader === -1) return entries;

  const manifestBlock = indexContent.substring(afterHeader);
  const manifestEnd = manifestBlock.indexOf("\n---");
  const blockText = manifestEnd !== -1
    ? manifestBlock.substring(0, manifestEnd)
    : manifestBlock;

  // Parse each "### Section N: Title" block
  const sectionRegex = /### Section (\d+): (.+?)\n([\s\S]*?)(?=### Section |\n---|$)/g;
  let match;

  while ((match = sectionRegex.exec(blockText)) !== null) {
    const [, id, title, body] = match;
    const entry: ParsedManifestEntry = {
      id,
      title: title.trim(),
      purpose: extractField(body, "purpose"),
      filePath: extractField(body, "file"),
      dependencies: parseDependencies(extractField(body, "dependencies")),
    };
    entries.push(entry);
  }

  return entries;
}

function extractField(body: string, fieldName: string): string {
  const regex = new RegExp(`-\\s+\\*\\*${fieldName}\\*\\*:\\s*(.+)`, "i");
  const match = body.match(regex);
  return match ? match[1].trim() : "";
}

function parseDependencies(depStr: string): string[] {
  if (!depStr || depStr.toLowerCase() === "none") return [];
  return depStr.split(",").map((d) => d.trim()).filter(Boolean);
}

// ── Section File Generation ─────────────────────────────────────────

/**
 * Build markdown content for a single section file.
 * Sources content from available artifacts in planningDir.
 */
function buildSectionMarkdown(
  entry: ParsedManifestEntry,
  planningDir: string,
  runId: string,
  goal: string,
): string {
  const lines: string[] = [];

  lines.push(`# Section: ${entry.title}`);
  lines.push("");
  lines.push(`**Section ID**: ${entry.id}`);
  lines.push(`**Purpose**: ${entry.purpose}`);
  if (entry.dependencies.length > 0) {
    lines.push(`**Dependencies**: ${entry.dependencies.join(", ")}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Background — try to source from passto-plan.md
  const planContent = readTextFile(path.join(planningDir, "passto-plan.md"));
  const relatedPlanSection = planContent
    ? extractRelatedSectionContent(planContent, entry.title)
    : null;

  lines.push("## Background");
  lines.push("");
  if (relatedPlanSection) {
    lines.push(relatedPlanSection);
  } else {
    lines.push(`*Background for "${entry.title}" is not yet available from upstream artifacts.*`);
    lines.push("");
    lines.push(`This section covers: ${entry.purpose}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Requirements
  lines.push("## Requirements");
  lines.push("");
  lines.push(`*Requirements for "${entry.title}" will be derived during detailed planning.*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Dependencies
  lines.push("## Dependencies");
  lines.push("");
  if (entry.dependencies.length > 0) {
    for (const dep of entry.dependencies) {
      lines.push(`- Section ${dep} (prerequisite)`);
    }
  } else {
    lines.push("- No external section dependencies.");
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Implementation Details
  lines.push("## Implementation Details");
  lines.push("");
  lines.push(`*Implementation details for "${entry.title}" are pending detailed execution planning.*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Acceptance Criteria
  lines.push("## Acceptance Criteria");
  lines.push("");
  lines.push(`- [ ] "${entry.title}" section content is complete and accurate.`);
  lines.push(`- [ ] Dependencies on other sections are satisfied.`);
  lines.push(`- [ ] Content aligns with the overall project goal: ${goal}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Files to Create/Modify
  lines.push("## Files to Create/Modify");
  lines.push("");
  lines.push(`*File-level actions for "${entry.title}" will be determined during execution planning.*`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Try to extract content related to a section title from passto-plan.md.
 */
function extractRelatedSectionContent(
  planContent: string,
  sectionTitle: string,
): string | null {
  const planLower = planContent.toLowerCase();
  const titleLower = sectionTitle.toLowerCase();

  // Try to find a matching ## heading in the plan
  const headingRegex = new RegExp(`##\\s+${escapeRegex(titleLower)}`, "i");
  const headingMatch = planContent.match(headingRegex);

  if (!headingMatch) {
    // Try partial match
    const words = sectionTitle.split(/\s+/).filter((w) => w.length > 3);
    for (const word of words) {
      const partialRegex = new RegExp(`##\\s+[^\\n]*${escapeRegex(word)}[^\\n]*`, "i");
      const partialMatch = planContent.match(partialRegex);
      if (partialMatch) {
        const startIdx = partialMatch.index!;
        const endIdx = planContent.indexOf("\n## ", startIdx + 1);
        const sectionContent = endIdx !== -1
          ? planContent.substring(startIdx, endIdx).trim()
          : planContent.substring(startIdx).trim();
        return sectionContent;
      }
    }
    return null;
  }

  const startIdx = headingMatch.index!;
  const endIdx = planContent.indexOf("\n## ", startIdx + 1);
  const sectionContent = endIdx !== -1
    ? planContent.substring(startIdx, endIdx).trim()
    : planContent.substring(startIdx).trim();

  return sectionContent;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Main Entry ──────────────────────────────────────────────────────

export async function runStep14Sections(config: SectionsConfig): Promise<SectionsOutput> {
  // Read sections/index.md
  const indexPath = path.join(config.planningDir, "sections", "index.md");
  const indexContent = readTextFile(indexPath);

  if (!indexContent) {
    return {
      files: [],
      summary: "No sections/index.md found. Run Step 13 (section index) first.",
    };
  }

  // Parse manifest
  const manifest = parseSectionManifest(indexContent);

  if (manifest.length === 0) {
    return {
      files: [],
      summary: "SECTION_MANIFEST found in index.md but contained no entries.",
    };
  }

  // Generate section files
  const files: SectionFileResult[] = [];
  for (const entry of manifest) {
    const sectionMarkdown = buildSectionMarkdown(entry, config.planningDir, config.runId, config.goal);
    const fullPath = path.join(config.planningDir, entry.filePath);
    writeTextFile(fullPath, sectionMarkdown);
    files.push({
      id: entry.id,
      title: entry.title,
      filePath: fullPath,
      written: true,
    });
  }

  const summary = `Generated ${files.length} section file(s): ${files.map((f) => f.title).join(", ")}.`;

  return { files, summary };
}
