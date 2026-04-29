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

  // ── Nested execution (non-Step 4/9/10 path) ───────────────────
  // If we didn't run any real step, keep the placeholder seam active.
  const ranAnyRealStep = ranRealResearch || ranRealReview || ranRealIntegration;
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
      ? `Planner step(s) executed: ${ranRealResearch ? "Step 4 research" : ""}${ranRealResearch && ranRealReview ? ", " : ""}${ranRealReview ? "Step 9 review" : ""}${(ranRealResearch || ranRealReview) && ranRealIntegration ? ", " : ""}${ranRealIntegration ? "Step 10 integration" : ""}`
      : "Phase 1B planner workflow skeleton initialized.",
    producedArtifacts,
    remainingWork: ranAnyRealStep
      ? [
          ...(ranRealResearch ? [] : ["Step 4 research path (not executed in this run)"]),
          ...(ranRealReview ? [] : ["Step 9 review path (not executed in this run)"]),
          ...(ranRealIntegration ? [] : ["Step 10 integration path (not executed in this run)"]),
          ...remainingWork,
        ]
      : [
          "Implement real nested-execution orchestration",
          "Refine planner workflow behavior",
          "Build planner test suite",
        ],
    handoffNote: ranAnyRealStep
      ? `Planner steps complete: ${ranRealResearch ? "research" : ""}${ranRealResearch && ranRealReview ? ", " : ""}${ranRealReview ? "review" : ""}${(ranRealResearch || ranRealReview) && ranRealIntegration ? ", " : ""}${ranRealIntegration ? "integration" : ""}. Remaining steps for later phases.`
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
      : "planner-nested-execution",
    runId,
    resultSummary: result.resultSummary,
    artifacts: producedArtifacts,
    nextSteps: result.remainingWork,
  });

  return { result, handoff, runId, sessionId: session?.sessionId ?? runId, planningDir };
}
