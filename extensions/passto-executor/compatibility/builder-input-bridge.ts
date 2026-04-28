import type { BuilderInput } from "../../passto-builder/builder/contracts.ts";
import type { TaskDocInput } from "../executor-core/task-doc.ts";
import type { TaskDocThinking } from "../executor-core/task-doc.ts";

export interface ExecutorCallerRequest {
  goal: string;
  cwd?: string;
  todolist?: string[];
  outputs?: string[];
  prompts?: string[];
  constraints?: string[];
  stage?: string;
  agent?: string;
  extensions?: string[];
  preferredModel?: string;
  preferredThinking?: TaskDocThinking;
  mode?: "single" | "parallel" | "sequential" | "dag";
  maxConcurrency?: number;
  idleTimeoutMs?: number;
  timeoutMs?: number;
  terminateGraceMs?: number;
  inputs?: TaskDocInput[];
  acceptanceCriteria?: string[];
}

export function buildBuilderExecutionPrompt(request: ExecutorCallerRequest): string {
  const goal = request.goal.trim();
  const stage = request.stage ?? "builder";
  const prompts = (request.prompts?.length ? request.prompts : [goal]).map((item) => `- ${item}`);
  const todolist = (request.todolist ?? []).map((item) => `- ${item}`);
  const outputs = (request.outputs ?? []).map((item) => `- ${item}`);
  const constraints = (request.constraints ?? []).map((item) => `- ${item}`);
  const inputRefs = (request.inputs ?? []).map((item) => {
    if (item.path) return `- ${item.kind}: ${item.path}`;
    if (item.label) return `- ${item.kind}: ${item.label}`;
    return `- ${item.kind}`;
  });

  return [
    `Goal:\n${goal}`,
    `Stage:\n${stage}`,
    `Todo list:\n${todolist.length ? todolist.join("\n") : "- (none provided)"}`,
    `Expected outputs:\n${outputs.length ? outputs.join("\n") : "- (none specified)"}`,
    `Constraints:\n${constraints.length ? constraints.join("\n") : "- (none)"}`,
    `Additional prompts:\n${prompts.join("\n")}`,
    `Input references:\n${inputRefs.length ? inputRefs.join("\n") : "- (none)"}`,
  ].join("\n\n");
}

export function buildBuilderDriverContext(request: ExecutorCallerRequest): string {
  const cwd = request.cwd ?? process.cwd();
  const lines = [
    `cwd: ${cwd}`,
    `stage: ${request.stage ?? "builder"}`,
  ];
  if (request.preferredModel) lines.push(`preferredModel: ${request.preferredModel}`);
  if (request.preferredThinking) lines.push(`preferredThinking: ${request.preferredThinking}`);
  if (request.acceptanceCriteria?.length) {
    lines.push("acceptanceCriteria:");
    lines.push(...request.acceptanceCriteria.map((item) => `- ${item}`));
  }
  return lines.join("\n");
}

export function callerRequestToBuilderInput(request: ExecutorCallerRequest): BuilderInput {
  const cwd = request.cwd ?? process.cwd();
  return {
    goal: request.goal,
    cwd,
    executionPrompt: buildBuilderExecutionPrompt(request),
    expectedOutputs: [...(request.outputs ?? [])],
    todolist: [...(request.todolist ?? [])],
    constraints: [...(request.constraints ?? [])],
    acceptanceCriteria: [...(request.acceptanceCriteria ?? [])],
    driverContext: buildBuilderDriverContext(request),
    stage: request.stage,
    executionEngine: "ralph-loop",
    projectMetadataPath: `${cwd}/.passto-ai/project.md`,
    plannerDir: `${cwd}/.passto-ai/planner`,
    executorDir: `${cwd}/.passto-ai/executor`,
    builderDir: `${cwd}/.passto-ai/builder`,
  };
}
