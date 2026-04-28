import type { ResolvedExecutorRunContext, ExecutorMemoryRef, ExecutorPerspectiveSpec, ExecutorRuntimePolicy } from "./context.ts";
import type { ExecutorInvocation } from "./invocation.ts";

export interface ExecutorAssemblyOptions {
  runId: string;
  defaultRuntimePolicy?: Partial<ExecutorRuntimePolicy>;
}

function toMemoryRef(input: ExecutorInvocation["inputs"][number]): ExecutorMemoryRef {
  return {
    kind: input.kind === "artifact" ? "doc" : input.kind,
    path: input.path,
    content: input.content,
    label: input.label,
    required: input.required,
  };
}

export function assembleExecutorContext(invocation: ExecutorInvocation, options: ExecutorAssemblyOptions): ResolvedExecutorRunContext {
  const perspective: ExecutorPerspectiveSpec = {
    name: invocation.executorType || invocation.stage,
    role: invocation.hints?.preferredRole,
    task: invocation.task.description,
    memory: invocation.inputs.map(toMemoryRef),
    constraints: [...invocation.constraints],
  };

  return {
    runId: options.runId,
    invocation,
    role: invocation.hints?.preferredRole,
    memory: invocation.inputs.map(toMemoryRef),
    skills: [],
    extensions: [],
    modelPolicy: {
      primary: invocation.hints?.preferredModel,
      thinking: invocation.hints?.preferredThinking,
    },
    outputPolicy: {
      format: "markdown",
      instructions: [...invocation.expectedOutput.checklist],
    },
    runtimePolicy: {
      ...options.defaultRuntimePolicy,
      mode: invocation.mode ?? options.defaultRuntimePolicy?.mode ?? "single",
      completionPolicy: "process-exit",
    },
    workspace: {
      projectRoot: invocation.project.cwd,
    },
    perspectives: [perspective],
  };
}
