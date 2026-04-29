// Step 12: Minimal final plan generation module for passto-planner.
// Reads existing planning artifacts, aggregates them into a structured plan,
// and writes passto-plan.md.

import { readTextFile, writeTextFile } from "./file-io.ts";
import * as path from "node:path";

// ── Public Types ────────────────────────────────────────────────────

export interface FinalPlanConfig {
  runId: string;
  planningDir: string;
  goal: string;
  target?: string;
}

export interface FinalPlanOutput {
  filePath: string;
  sectionsGenerated: string[];
  sectionsMissing: string[];
  summary: string;
}

// ── Artifact Definitions ────────────────────────────────────────────

interface PlanArtifactSource {
  name: string;
  file: string;
  section: string;
}

const PLAN_ARTIFACT_SOURCES: PlanArtifactSource[] = [
  { name: "analysis.md", file: "analysis.md", section: "Product Framing" },
  { name: "passto-research.md", file: "passto-research.md", section: "Research Summary" },
  { name: "passto-spec.md", file: "passto-spec.md", section: "Product Framing" },
  { name: "pre-plan.md", file: "pre-plan.md", section: "Proposed Workflow" },
  { name: "passto-integration-notes.md", file: "passto-integration-notes.md", section: "Integration Summary" },
  { name: "review-gate-summary.md", file: "review-gate-summary.md", section: "Review Summary" },
];

// ── Artifact Reading ────────────────────────────────────────────────

interface ReadArtifact {
  source: PlanArtifactSource;
  content: string | null;
}

function readAllArtifacts(planningDir: string): ReadArtifact[] {
  return PLAN_ARTIFACT_SOURCES.map((source) => ({
    source,
    content: readTextFile(path.join(planningDir, source.file)),
  }));
}

// ── Content Extraction ──────────────────────────────────────────────

/**
 * Extract meaningful content from an artifact file.
 * For research files, extracts section content.
 * For integration files, extracts accepted/unresolved findings.
 * For review gate files, extracts gate status and unresolved items.
 * For others, uses a reasonable content subset.
 */
function extractSectionContent(
  source: PlanArtifactSource,
  content: string,
): string {
  const maxContentLen = 2000;

  switch (source.file) {
    case "passto-research.md":
      return extractResearchSummary(content);

    case "passto-integration-notes.md":
      return extractIntegrationSummary(content);

    case "review-gate-summary.md":
      return extractReviewSummary(content);

    case "pre-plan.md":
      return extractPrePlanSummary(content, maxContentLen);

    case "analysis.md":
    case "passto-spec.md":
      return extractAnalysisOrSpecSummary(content, maxContentLen);

    default:
      // Generic fallback: take first maxContentLen chars
      return content.length > maxContentLen
        ? content.substring(0, maxContentLen) + "\n\n*(truncated)*"
        : content;
  }
}

function extractResearchSummary(content: string): string {
  const lines: string[] = [];

  // Extract key sections from research
  const sections = [
    "## Environment / Dependency / External Facts",
    "## Web Topic Research",
    "## Open Questions",
  ];

  for (const section of sections) {
    const idx = content.indexOf(section);
    if (idx === -1) continue;
    const endIdx = content.indexOf("\n## ", idx + 1);
    const sectionContent = endIdx !== -1
      ? content.substring(idx, endIdx).trim()
      : content.substring(idx).trim();
    lines.push(sectionContent);
  }

  return lines.length ? lines.join("\n\n") : content.substring(0, 1500);
}

function extractIntegrationSummary(content: string): string {
  const lines: string[] = [];

  // Extract accepted and unresolved findings
  const sections = ["## Accepted Findings", "## Unresolved Findings"];
  for (const section of sections) {
    const idx = content.indexOf(section);
    if (idx === -1) continue;
    const endIdx = content.indexOf("\n## ", idx + 1);
    const sectionContent = endIdx !== -1
      ? content.substring(idx, endIdx).trim()
      : content.substring(idx).trim();
    lines.push(sectionContent);
  }

  return lines.length ? lines.join("\n\n") : content.substring(0, 1500);
}

function extractReviewSummary(content: string): string {
  const lines: string[] = [];

  const sections = ["## Gate Status", "## Available Artifacts", "## Unresolved Items", "## Recommendation"];
  for (const section of sections) {
    const idx = content.indexOf(section);
    if (idx === -1) continue;
    const endIdx = content.indexOf("\n## ", idx + 1);
    const sectionContent = endIdx !== -1
      ? content.substring(idx, endIdx).trim()
      : content.substring(idx).trim();
    lines.push(sectionContent);
  }

  return lines.length ? lines.join("\n\n") : content.substring(0, 1500);
}

function extractPrePlanSummary(content: string, maxLen: number): string {
  // Pre-plan is typically concise; use most of it
  return content.length > maxLen
    ? content.substring(0, maxLen) + "\n\n*(truncated)*"
    : content;
}

function extractAnalysisOrSpecSummary(content: string, maxLen: number): string {
  // Extract first few sections of analysis or spec
  const sectionEnd = content.indexOf("\n## ", 100);
  if (sectionEnd === -1) {
    return content.length > maxLen
      ? content.substring(0, maxLen) + "\n\n*(truncated)*"
      : content;
  }
  const firstPart = content.substring(0, sectionEnd);
  return firstPart;
}

// ── Output Generation ───────────────────────────────────────────────

function buildFinalPlanMarkdown(
  config: FinalPlanConfig,
  artifacts: ReadArtifact[],
): { markdown: string; sectionsGenerated: string[]; sectionsMissing: string[] } {
  const lines: string[] = [];
  const sectionsGenerated: string[] = [];
  const sectionsMissing: string[] = [];

  // Header
  lines.push("# Passto Plan");
  lines.push("");
  lines.push(`Generated by passto-planner Step 12 · Run: ${config.runId}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Target Summary (always present, based on goal/target)
  lines.push("## Target Summary");
  lines.push("");
  lines.push(`- Goal: ${config.goal}`);
  if (config.target) lines.push(`- Target: ${config.target}`);
  lines.push(`- Run ID: ${config.runId}`);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push("");
  sectionsGenerated.push("Target Summary");
  lines.push("---");
  lines.push("");

  // Product Framing (from analysis.md or passto-spec.md)
  const analysisArtifact = artifacts.find((a) => a.source.file === "analysis.md");
  const specArtifact = artifacts.find((a) => a.source.file === "passto-spec.md");
  const framingContent = analysisArtifact?.content || specArtifact?.content;
  if (framingContent) {
    lines.push("## Product Framing");
    lines.push("");
    if (analysisArtifact?.content) {
      lines.push("### From analysis.md");
      lines.push("");
      lines.push(extractSectionContent(analysisArtifact.source, analysisArtifact.content));
      lines.push("");
    }
    if (specArtifact?.content) {
      lines.push("### From passto-spec.md");
      lines.push("");
      lines.push(extractSectionContent(specArtifact.source, specArtifact.content));
      lines.push("");
    }
    sectionsGenerated.push("Product Framing");
  } else {
    lines.push("## Product Framing");
    lines.push("");
    lines.push("*No analysis.md or passto-spec.md available. Product framing is derived from the goal only.*");
    lines.push("");
    sectionsMissing.push("Product Framing");
  }
  lines.push("---");
  lines.push("");

  // Research Summary (from passto-research.md)
  const researchArtifact = artifacts.find((a) => a.source.file === "passto-research.md");
  if (researchArtifact?.content) {
    lines.push("## Research Summary");
    lines.push("");
    lines.push(extractSectionContent(researchArtifact.source, researchArtifact.content));
    lines.push("");
    sectionsGenerated.push("Research Summary");
  } else {
    lines.push("## Research Summary");
    lines.push("");
    lines.push("*No passto-research.md available. Research findings are not included in this plan.*");
    lines.push("");
    sectionsMissing.push("Research Summary");
  }
  lines.push("---");
  lines.push("");

  // Review Summary (from review-gate-summary.md or review files)
  const reviewGateArtifact = artifacts.find((a) => a.source.file === "review-gate-summary.md");
  if (reviewGateArtifact?.content) {
    lines.push("## Review Summary");
    lines.push("");
    lines.push(extractSectionContent(reviewGateArtifact.source, reviewGateArtifact.content));
    lines.push("");
    sectionsGenerated.push("Review Summary");
  } else {
    // Fallback: check for individual review files
    const gptReview = readTextFile(path.join(config.planningDir, "reviews/gpt-5.4-review.md"));
    const claudeReview = readTextFile(path.join(config.planningDir, "reviews/claude-opus-4-6-review.md"));
    if (gptReview || claudeReview) {
      lines.push("## Review Summary");
      lines.push("");
      if (gptReview) {
        lines.push("### GPT-5.4 Review");
        lines.push("");
        lines.push(gptReview.substring(0, 800));
        lines.push("");
      }
      if (claudeReview) {
        lines.push("### Claude Opus 4.6 Review");
        lines.push("");
        lines.push(claudeReview.substring(0, 800));
        lines.push("");
      }
      sectionsGenerated.push("Review Summary");
    } else {
      lines.push("## Review Summary");
      lines.push("");
      lines.push("*No review artifacts available. Review step was not executed or outputs are missing.*");
      lines.push("");
      sectionsMissing.push("Review Summary");
    }
  }
  lines.push("---");
  lines.push("");

  // Integration Summary (from passto-integration-notes.md)
  const integrationArtifact = artifacts.find((a) => a.source.file === "passto-integration-notes.md");
  if (integrationArtifact?.content) {
    lines.push("## Integration Summary");
    lines.push("");
    lines.push(extractSectionContent(integrationArtifact.source, integrationArtifact.content));
    lines.push("");
    sectionsGenerated.push("Integration Summary");
  } else {
    lines.push("## Integration Summary");
    lines.push("");
    lines.push("*No passto-integration-notes.md available. Integration findings are not included in this plan.*");
    lines.push("");
    sectionsMissing.push("Integration Summary");
  }
  lines.push("---");
  lines.push("");

  // Constraints and Assumptions (derived from available context)
  lines.push("## Constraints and Assumptions");
  lines.push("");
  lines.push("- This plan was generated automatically by passto-planner Step 12.");
  lines.push("- Content is aggregated from available upstream artifacts.");
  lines.push("- Missing sections indicate upstream steps that were not executed.");
  if (config.target) {
    lines.push(`- Target scope: ${config.target}`);
  }
  lines.push("- Any unresolved items from review/integration steps should be addressed before execution.");
  lines.push("");
  sectionsGenerated.push("Constraints and Assumptions");
  lines.push("---");
  lines.push("");

  // Proposed Workflow (from pre-plan.md or goal-derived)
  const prePlanArtifact = artifacts.find((a) => a.source.file === "pre-plan.md");
  if (prePlanArtifact?.content) {
    lines.push("## Proposed Workflow");
    lines.push("");
    lines.push(extractSectionContent(prePlanArtifact.source, prePlanArtifact.content));
    lines.push("");
    sectionsGenerated.push("Proposed Workflow");
  } else {
    lines.push("## Proposed Workflow");
    lines.push("");
    lines.push(`The workflow should address the following goal: ${config.goal}`);
    lines.push("");
    lines.push("*No pre-plan.md available. Detailed workflow steps are not yet defined.*");
    lines.push("");
    sectionsMissing.push("Proposed Workflow");
  }
  lines.push("---");
  lines.push("");

  // Risks and Open Questions (from research open questions + integration unresolved)
  lines.push("## Risks and Open Questions");
  lines.push("");
  let hasRisks = false;

  if (researchArtifact?.content) {
    const openQIdx = researchArtifact.content.indexOf("## Open Questions");
    if (openQIdx !== -1) {
      const endIdx = researchArtifact.content.indexOf("\n## ", openQIdx + 1);
      const openQuestions = endIdx !== -1
        ? researchArtifact.content.substring(openQIdx, endIdx).trim()
        : researchArtifact.content.substring(openQIdx).trim();
      lines.push("### From Research");
      lines.push("");
      lines.push(openQuestions);
      lines.push("");
      hasRisks = true;
    }
  }

  if (integrationArtifact?.content) {
    const unresolvedIdx = integrationArtifact.content.indexOf("## Unresolved Findings");
    if (unresolvedIdx !== -1) {
      const endIdx = integrationArtifact.content.indexOf("\n## ", unresolvedIdx + 1);
      const unresolvedContent = endIdx !== -1
        ? integrationArtifact.content.substring(unresolvedIdx, endIdx).trim()
        : integrationArtifact.content.substring(unresolvedIdx).trim();
      lines.push("### From Integration");
      lines.push("");
      lines.push(unresolvedContent);
      lines.push("");
      hasRisks = true;
    }
  }

  if (reviewGateArtifact?.content) {
    const reviewUnresolvedIdx = reviewGateArtifact.content.indexOf("## Unresolved Items");
    if (reviewUnresolvedIdx !== -1) {
      const endIdx = reviewGateArtifact.content.indexOf("\n## ", reviewUnresolvedIdx + 1);
      const reviewUnresolved = endIdx !== -1
        ? reviewGateArtifact.content.substring(reviewUnresolvedIdx, endIdx).trim()
        : reviewGateArtifact.content.substring(reviewUnresolvedIdx).trim();
      lines.push("### From Review Gate");
      lines.push("");
      lines.push(reviewUnresolved);
      lines.push("");
      hasRisks = true;
    }
  }

  if (!hasRisks) {
    lines.push("*No specific risks or open questions were extracted from upstream artifacts.*");
    lines.push("");
  }

  sectionsGenerated.push("Risks and Open Questions");
  lines.push("---");
  lines.push("");

  // Next Actions
  lines.push("## Next Actions");
  lines.push("");
  lines.push("- [ ] Review this plan for accuracy and completeness.");
  if (sectionsMissing.length) {
    lines.push(`- [ ] Consider running missing upstream steps to populate: ${sectionsMissing.join(", ")}.`);
  }
  lines.push("- [ ] Resolve any open questions in the Risks section.");
  lines.push("- [ ] Proceed to section-by-section execution (Step 13+) after plan approval.");
  lines.push("");
  sectionsGenerated.push("Next Actions");

  return {
    markdown: lines.join("\n"),
    sectionsGenerated,
    sectionsMissing,
  };
}

// ── Main Entry ─────────────────────────────────────────────────────

export async function runStep12FinalPlan(config: FinalPlanConfig): Promise<FinalPlanOutput> {
  // Read all available artifacts
  const artifacts = readAllArtifacts(config.planningDir);

  // Build the final plan
  const { markdown, sectionsGenerated, sectionsMissing } = buildFinalPlanMarkdown(config, artifacts);

  // Write passto-plan.md
  const filePath = path.join(config.planningDir, "passto-plan.md");
  writeTextFile(filePath, markdown);

  const summary = sectionsMissing.length
    ? `Final plan generated with ${sectionsGenerated.length} sections; ${sectionsMissing.length} section(s) missing upstream data: ${sectionsMissing.join(", ")}.`
    : `Final plan generated with all ${sectionsGenerated.length} sections populated from upstream artifacts.`;

  return {
    filePath,
    sectionsGenerated,
    sectionsMissing,
    summary,
  };
}
