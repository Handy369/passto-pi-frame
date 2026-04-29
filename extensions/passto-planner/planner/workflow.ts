// Phase 1B.1 (Step 4): Minimal planner workflow skeleton.
// Extracts scaffold execution shaping into the workflow layer.
// This module owns phase progression and returns result + handoff data.
// When currentStep === 4 or research mode is enabled, runs real Step 4 research.

import type {
  PlannerNormalizedInput,
  PlannerResult,
  PlannerArtifactRef,
  PlanningPhase,
} from "./contracts.ts";
import { createInitialPlannerState } from "./state.ts";
import { toPlannerResult } from "./result.ts";
import { createPlannerHandoff } from "./handoff.ts";
import { createNestedExecutionPlaceholderRequest, runNestedPlannerExecution } from "./nested-execution.ts";
import { createPlannerSession, savePlannerSession } from "./session.ts";
import { runStep4Research } from "./research.ts";
import { runStep9Review } from "./review.ts";
import { runStep10Integration } from "./integration.ts";
import { runStep11ReviewGate } from "./review-gate.ts";
import { runStep12FinalPlan } from "./final-plan.ts";
import { runStep13SectionIndex } from "./section-index.ts";
import { runStep14Sections } from "./sections.ts";

export interface PlannerWorkflowOutput {
  result: PlannerResult;
  handoff: ReturnType<typeof createPlannerHandoff>;
  runId: string;
  sessionId: string;
  planningDir?: string;
}

// Ordered macro phases for the scaffold workflow.
const SCAFFOLD_PHASES: PlanningPhase[] = ["intake", "analysis", "synthesis", "output"];

/**
 * Minimal planner workflow entry point.
 *
 * Takes normalized planner input, advances through scaffold phases,
 * and returns a PlannerWorkflowOutput containing the result and handoff.
 *
 * When currentStep === 4 (Execute Research) or metadata.researchMode is set,
 * runs real Step 4 research via the research module.
 */
export async function runPlannerWorkflow(
  input: PlannerNormalizedInput,
): Promise<PlannerWorkflowOutput> {
  const runId = `planner-${Date.now()}`;
  const planningDir = typeof input.metadata.planningDir === "string" ? input.metadata.planningDir : undefined;
  const target = typeof input.metadata.target === "string" ? input.metadata.target : input.goal;
  const totalSteps = typeof input.metadata.totalSteps === "number" ? input.metadata.totalSteps : undefined;
  const currentStep = typeof input.metadata.currentStep === "number" ? input.metadata.currentStep : undefined;
  const researchMode = input.metadata.researchMode === true || input.metadata.step4Research === true;
  const session = planningDir
    ? createPlannerSession({
        target,
        planningDir,
        currentStep: currentStep ?? 1,
        totalSteps: totalSteps ?? SCAFFOLD_PHASES.length,
        artifacts: [],
        runId,
        metadata: { source: "runPlannerWorkflow" },
      })
    : undefined;
  const state = createInitialPlannerState(runId, "phase-1b-workflow", input, {
    sessionId: session?.sessionId,
    planningDir,
    currentStep: session?.currentStep,
    totalSteps: session?.totalSteps,
  });

  // Advance through scaffold phases.
  for (const phase of SCAFFOLD_PHASES) {
    state.phase = phase;
    state.completedSteps.push(phase);
  }

  state.status = "completed";

  if (session) {
    session.runId = runId;
    session.currentStep = session.totalSteps;
    session.artifacts = ["planner-workflow-scaffold"];
    session.status = "active";
    session.history.push({ step: session.currentStep, at: new Date().toISOString(), action: "next", summary: "Workflow scaffold completed" });
    savePlannerSession(session);
  }

  const producedArtifacts: PlannerArtifactRef[] = [];
  const remainingWork: string[] = [];

  // ── Step 4: Real research path ────────────────────────────────
  // Triggered when currentStep === 4 or researchMode is explicitly set
  // AND a planningDir is available (we need somewhere to write the file).
  const isStep4 = currentStep === 4;
  let ranRealResearch = false;
  if ((isStep4 || researchMode) && planningDir) {
    try {
      const researchOutput = await runStep4Research({
        runId,
        planningDir,
        goal: input.goal,
        target: typeof target === "string" ? target : undefined,
        cwd: input.cwd,
      });

      producedArtifacts.push({
        type: "passto-research",
        path: researchOutput.researchFilePath,
        summary: `Step 4 research completed: ${researchOutput.succeeded}/${researchOutput.taskCount} tasks succeeded.`,
        metadata: {
          taskCount: researchOutput.taskCount,
          succeeded: researchOutput.succeeded,
          failed: researchOutput.failed,
        },
      });

      if (session) {
        session.artifacts.push("passto-research");
        session.history.push({
          step: session.currentStep,
          at: new Date().toISOString(),
          action: "next",
          summary: `Step 4 research completed: ${researchOutput.summary}`,
        });
        savePlannerSession(session);
      }

      ranRealResearch = true;
    } catch (err) {
      producedArtifacts.push({
        type: "passto-research",
        summary: `Step 4 research failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { error: true },
      });
      remainingWork.push("Re-run Step 4 research after resolving errors");
    }
  }

  // ── Step 9: Real review path ──────────────────────────────────
  // Triggered when currentStep === 9 or metadata.reviewMode is set
  // AND a planningDir is available.
  const isStep9 = currentStep === 9;
  const reviewMode = input.metadata.reviewMode === true || input.metadata.step9Review === true;
  let ranRealReview = false;
  if ((isStep9 || reviewMode) && planningDir) {
    try {
      const reviewOutput = await runStep9Review({
        runId,
        planningDir,
        goal: input.goal,
        target: typeof target === "string" ? target : undefined,
        cwd: input.cwd,
      });

      for (const artifact of reviewOutput.artifacts) {
        producedArtifacts.push({
          type: `review-${artifact.reviewerId}`,
          path: artifact.filePath,
          summary: `Step 9 review by ${artifact.reviewerId} completed.`,
          metadata: {
            reviewerId: artifact.reviewerId,
          },
        });
      }

      if (session) {
        session.artifacts.push("gpt-5.4-review", "claude-opus-4-6-review");
        session.history.push({
          step: session.currentStep,
          at: new Date().toISOString(),
          action: "next",
          summary: `Step 9 review completed: ${reviewOutput.summary}`,
        });
        savePlannerSession(session);
      }

      ranRealReview = true;
    } catch (err) {
      producedArtifacts.push({
        type: "review-error",
        summary: `Step 9 review failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { error: true },
      });
      remainingWork.push("Re-run Step 9 review after resolving errors");
    }
  }

  // ── Step 10: Real integration path ────────────────────────────
  // Triggered when currentStep === 10 or metadata.integrationMode is set
  // AND a planningDir is available.
  const isStep10 = currentStep === 10;
  const integrationMode = input.metadata.integrationMode === true || input.metadata.step10Integration === true;
  let ranRealIntegration = false;
  if ((isStep10 || integrationMode) && planningDir) {
    try {
      const integrationOutput = await runStep10Integration({
        runId,
        planningDir,
        goal: input.goal,
        target: typeof target === "string" ? target : undefined,
      });

      producedArtifacts.push({
        type: "passto-integration",
        path: integrationOutput.filePath,
        summary: `Step 10 integration completed: ${integrationOutput.summary}`,
        metadata: {
          accepted: integrationOutput.accepted,
          rejected: integrationOutput.rejected,
          unresolved: integrationOutput.unresolved,
        },
      });

      if (session) {
        session.artifacts.push("passto-integration-notes");
        session.history.push({
          step: session.currentStep,
          at: new Date().toISOString(),
          action: "next",
          summary: `Step 10 integration completed: ${integrationOutput.summary}`,
        });
        savePlannerSession(session);
      }

      ranRealIntegration = true;
    } catch (err) {
      producedArtifacts.push({
        type: "integration-error",
        summary: `Step 10 integration failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { error: true },
      });
      remainingWork.push("Re-run Step 10 integration after resolving errors");
    }
  }

  // ── Step 11: Real review gate path ────────────────────────────────
  // Triggered when currentStep === 11 or metadata.reviewGateMode is set
  // AND a planningDir is available.
  const isStep11 = currentStep === 11;
  const reviewGateMode = input.metadata.reviewGateMode === true || input.metadata.step11ReviewGate === true;
  let ranRealReviewGate = false;
  if ((isStep11 || reviewGateMode) && planningDir) {
    try {
      const reviewGateOutput = await runStep11ReviewGate({
        runId,
        planningDir,
        goal: input.goal,
        target: typeof target === "string" ? target : undefined,
      });

      producedArtifacts.push({
        type: "review-gate",
        path: reviewGateOutput.filePath,
        summary: `Step 11 review gate completed: ${reviewGateOutput.summary}`,
        metadata: {
          reviewGateReady: reviewGateOutput.reviewGateReady,
          artifactsFound: reviewGateOutput.availableArtifacts.filter((a) => a.exists).length,
          unresolvedCount: reviewGateOutput.unresolvedItems.length,
        },
      });

      if (session) {
        session.artifacts.push("review-gate-summary");
        session.history.push({
          step: session.currentStep,
          at: new Date().toISOString(),
          action: "next",
          summary: `Step 11 review gate completed: ${reviewGateOutput.summary}`,
        });
        savePlannerSession(session);
      }

      ranRealReviewGate = true;
    } catch (err) {
      producedArtifacts.push({
        type: "review-gate-error",
        summary: `Step 11 review gate failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { error: true },
      });
      remainingWork.push("Re-run Step 11 review gate after resolving errors");
    }
  }

  // ── Step 12: Real final plan generation path ──────────────────────
  // Triggered when currentStep === 12 or metadata.finalPlanMode is set
  // AND a planningDir is available.
  const isStep12 = currentStep === 12;
  const finalPlanMode = input.metadata.finalPlanMode === true || input.metadata.step12FinalPlan === true;
  let ranRealFinalPlan = false;
  if ((isStep12 || finalPlanMode) && planningDir) {
    try {
      const finalPlanOutput = await runStep12FinalPlan({
        runId,
        planningDir,
        goal: input.goal,
        target: typeof target === "string" ? target : undefined,
      });

      producedArtifacts.push({
        type: "passto-plan",
        path: finalPlanOutput.filePath,
        summary: `Step 12 final plan completed: ${finalPlanOutput.summary}`,
        metadata: {
          sectionsGenerated: finalPlanOutput.sectionsGenerated.length,
          sectionsMissing: finalPlanOutput.sectionsMissing.length,
        },
      });

      if (session) {
        session.artifacts.push("passto-plan");
        session.history.push({
          step: session.currentStep,
          at: new Date().toISOString(),
          action: "next",
          summary: `Step 12 final plan completed: ${finalPlanOutput.summary}`,
        });
        savePlannerSession(session);
      }

      ranRealFinalPlan = true;
    } catch (err) {
      producedArtifacts.push({
        type: "final-plan-error",
        summary: `Step 12 final plan failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { error: true },
      });
      remainingWork.push("Re-run Step 12 final plan after resolving errors");
    }
  }

  // ── Step 13: Real section index path ──────────────────────────────
  // Triggered when currentStep === 13 or metadata.sectionIndexMode is set
  // AND a planningDir is available.
  const isStep13 = currentStep === 13;
  const sectionIndexMode = input.metadata.sectionIndexMode === true || input.metadata.step13SectionIndex === true;
  let ranRealSectionIndex = false;
  if ((isStep13 || sectionIndexMode) && planningDir) {
    try {
      const sectionIndexOutput = await runStep13SectionIndex({
        runId,
        planningDir,
        goal: input.goal,
        target: typeof target === "string" ? target : undefined,
      });

      producedArtifacts.push({
        type: "section-index",
        path: sectionIndexOutput.filePath,
        summary: `Step 13 section index completed: ${sectionIndexOutput.summary}`,
        metadata: {
          sectionCount: sectionIndexOutput.manifest.length,
        },
      });

      if (session) {
        session.artifacts.push("section-index");
        session.history.push({
          step: session.currentStep,
          at: new Date().toISOString(),
          action: "next",
          summary: `Step 13 section index completed: ${sectionIndexOutput.summary}`,
        });
        savePlannerSession(session);
      }

      ranRealSectionIndex = true;
    } catch (err) {
      producedArtifacts.push({
        type: "section-index-error",
        summary: `Step 13 section index failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { error: true },
      });
      remainingWork.push("Re-run Step 13 section index after resolving errors");
    }
  }

  // ── Step 14: Real section files path ──────────────────────────────
  // Triggered when currentStep === 14 or metadata.sectionsMode is set
  // AND a planningDir is available.
  const isStep14 = currentStep === 14;
  const sectionsMode = input.metadata.sectionsMode === true || input.metadata.step14Sections === true;
  let ranRealSections = false;
  if ((isStep14 || sectionsMode) && planningDir) {
    try {
      const sectionsOutput = await runStep14Sections({
        runId,
        planningDir,
        goal: input.goal,
        target: typeof target === "string" ? target : undefined,
      });

      for (const file of sectionsOutput.files) {
        producedArtifacts.push({
          type: `section-file-${file.id}`,
          path: file.filePath,
          summary: `Section ${file.id} (${file.title}) generated.`,
          metadata: { sectionId: file.id, sectionTitle: file.title },
        });
      }

      if (session) {
        for (const file of sectionsOutput.files) {
          session.artifacts.push(`section-${file.id}`);
        }
        session.history.push({
          step: session.currentStep,
          at: new Date().toISOString(),
          action: "next",
          summary: `Step 14 section files completed: ${sectionsOutput.summary}`,
        });
        savePlannerSession(session);
      }

      ranRealSections = true;
    } catch (err) {
      producedArtifacts.push({
        type: "sections-error",
        summary: `Step 14 section files failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { error: true },
      });
      remainingWork.push("Re-run Step 14 section files after resolving errors");
    }
  }

  // ── Nested execution (non-Step 4/9/10/11/12/13/14 path) ────────────
  // If we didn't run any real step, keep the placeholder seam active.
  const ranAnyRealStep = ranRealResearch || ranRealReview || ranRealIntegration || ranRealReviewGate || ranRealFinalPlan || ranRealSectionIndex || ranRealSections;
  if (!ranAnyRealStep) {
    const nestedExecution = await runNestedPlannerExecution(
      createNestedExecutionPlaceholderRequest({
        runId,
        goal: input.goal,
        phase: "analysis",
      }),
    );

    producedArtifacts.push(
      {
        type: "planner-workflow-scaffold",
        summary: "Phase 1B planner workflow skeleton executed",
      },
      {
        type: "nested-execution-seam",
        summary: nestedExecution.summary,
        metadata: {
          active: nestedExecution.active,
          status: nestedExecution.status,
          strategy: nestedExecution.strategy,
        },
      },
    );
  }

  const result = toPlannerResult({
    finalStatus: "success",
    resultSummary: ranAnyRealStep
      ? buildStepSummary(ranRealResearch, ranRealReview, ranRealIntegration, ranRealReviewGate, ranRealFinalPlan, ranRealSectionIndex, ranRealSections)
      : "Phase 1B planner workflow skeleton initialized.",
    producedArtifacts,
    remainingWork: ranAnyRealStep
      ? [
          ...(ranRealResearch ? [] : ["Step 4 research path (not executed in this run)"]),
          ...(ranRealReview ? [] : ["Step 9 review path (not executed in this run)"]),
          ...(ranRealIntegration ? [] : ["Step 10 integration path (not executed in this run)"]),
          ...(ranRealReviewGate ? [] : ["Step 11 review gate path (not executed in this run)"]),
          ...(ranRealFinalPlan ? [] : ["Step 12 final plan path (not executed in this run)"]),
          ...(ranRealSectionIndex ? [] : ["Step 13 section index path (not executed in this run)"]),
          ...(ranRealSections ? [] : ["Step 14 section files path (not executed in this run)"]),
          ...remainingWork,
        ]
      : [
          "Implement real nested-execution orchestration",
          "Refine planner workflow behavior",
          "Build planner test suite",
        ],
    handoffNote: ranAnyRealStep
      ? buildHandoffNote(ranRealResearch, ranRealReview, ranRealIntegration, ranRealReviewGate, ranRealFinalPlan, ranRealSectionIndex, ranRealSections)
      : "Phase 1B runtime scaffold complete. Nested execution seam is defined for a later implementation phase.",
    primaryRunId: runId,
  });

  const handoff = createPlannerHandoff({
    from: "planner-workflow",
    to: ranRealResearch
      ? "planner-research-complete"
      : ranRealReview
      ? "planner-review-complete"
      : ranRealIntegration
      ? "planner-integration-complete"
      : ranRealReviewGate
      ? "planner-review-gate-complete"
      : ranRealFinalPlan
      ? "planner-final-plan-complete"
      : ranRealSectionIndex
      ? "planner-section-index-complete"
      : ranRealSections
      ? "planner-sections-complete"
      : "planner-nested-execution",
    runId,
    resultSummary: result.resultSummary,
    artifacts: producedArtifacts,
    nextSteps: result.remainingWork,
  });

  return { result, handoff, runId, sessionId: session?.sessionId ?? runId, planningDir };
}

// ── Helper: build step summary string ──────────────────────────────
function buildStepSummary(
  research: boolean,
  review: boolean,
  integration: boolean,
  reviewGate: boolean,
  finalPlan: boolean,
  sectionIndex: boolean,
  sections: boolean,
): string {
  const parts: string[] = [];
  if (research) parts.push("Step 4 research");
  if (review) parts.push("Step 9 review");
  if (integration) parts.push("Step 10 integration");
  if (reviewGate) parts.push("Step 11 review gate");
  if (finalPlan) parts.push("Step 12 final plan");
  if (sectionIndex) parts.push("Step 13 section index");
  if (sections) parts.push("Step 14 section files");
  return `Planner step(s) executed: ${parts.join(", ")}.`;
}

// ── Helper: build handoff note ─────────────────────────────────────
function buildHandoffNote(
  research: boolean,
  review: boolean,
  integration: boolean,
  reviewGate: boolean,
  finalPlan: boolean,
  sectionIndex: boolean,
  sections: boolean,
): string {
  const parts: string[] = [];
  if (research) parts.push("research");
  if (review) parts.push("review");
  if (integration) parts.push("integration");
  if (reviewGate) parts.push("review gate");
  if (finalPlan) parts.push("final plan");
  if (sectionIndex) parts.push("section index");
  if (sections) parts.push("section files");
  return `Planner steps complete: ${parts.join(", ")}. Remaining steps for later phases.`;
}
