import { executeInvocation, type ExecutorInvocation, type ExecutorRunResult } from "../../passto-executor/index.ts";
import { getPasstoProjectWorkspaceLayout } from "../../passto-executor/executor-core/project-workspace.ts";
import type { NormalizedBuilderInput } from "../builder/input.ts";

export type BuilderExecutorBridgeRequest = {
  invocation: ExecutorInvocation;
  runId: string;
  agent: string;
  metadata: {
    executorType: "passto-builder";
    projectName: string;
    cwd: string;
    executionEngine: "ralph-loop";
    projectMetadataPath: string;
    plannerDir: string;
    executorDir: string;
    builderDir: string;
  };
};

export function buildExecutorBridgeRequest(input: NormalizedBuilderInput): BuilderExecutorBridgeRequest {
  const runId = `builder-${Date.now()}`;
  const workspace = getPasstoProjectWorkspaceLayout(input.cwd);
  return {
    runId,
    agent: "default",
    metadata: {
      executorType: "passto-builder",
      projectName: "passto-ai-frame",
      cwd: input.cwd,
      executionEngine: input.executionEngine,
      projectMetadataPath: workspace.projectMetadataPath,
      plannerDir: workspace.plannerDir,
      executorDir: workspace.executorDir,
      builderDir: workspace.builderDir,
    },
    invocation: {
      sourceTaskDocPath: `builder:${runId}`,
      caller: {
        type: "workflow-backed-executor",
        name: "passto-builder",
      },
      project: {
        name: "passto-ai-frame",
        cwd: input.cwd,
      },
      stage: "builder",
      executorType: "passto-builder",
      task: {
        title: input.goal,
        description: input.executionPrompt,
      },
      expectedOutput: {
        todolist: input.todolist,
        checklist: input.expectedOutputs,
      },
      constraints: input.constraints ?? [],
      inputs: [],
      hints: {
        preferredRole: "builder",
        preferredModel: input.preferredModel,
        preferredThinking: input.preferredThinking,
      },
      mode: "single",
    },
  };
}

function toExecutorBuilderInput(input: NormalizedBuilderInput): NormalizedBuilderInput {
  return {
    ...input,
    invocationSource: "passto-executor",
  };
}

export type BuilderExecutorInvoker = typeof executeInvocation;

export async function executeBuilderThroughPasstoExecutor(
  input: NormalizedBuilderInput,
  invoker: BuilderExecutorInvoker = executeInvocation,
): Promise<ExecutorRunResult> {
  const executorInput = toExecutorBuilderInput(input);
  const request = buildExecutorBridgeRequest(executorInput);
  return invoker(request.invocation, {
    runId: request.runId,
    agent: request.agent,
    contract: request.metadata.executionEngine,
    extensions: [],
  });
}
