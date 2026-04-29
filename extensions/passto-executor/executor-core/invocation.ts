import type { TaskDoc, TaskDocInput, TaskDocStage, TaskDocThinking } from "./task-doc.ts";

export interface ExecutorInvocation {
  invocationId?: string;
  sourceTaskDocPath: string;
  caller?: {
    type?: string;
    name?: string;
  };
  project: {
    name: string;
    cwd: string;
  };
  stage: TaskDocStage;
  executorType?: string;
  task: {
    title?: string;
    description: string;
  };
  expectedOutput: {
    todolist: string[];
    checklist: string[];
  };
  constraints: string[];
  inputs: TaskDocInput[];
  hints?: {
    preferredModel?: string;
    preferredThinking?: TaskDocThinking;
    preferredRole?: string;
  };
  mode?: "single" | "parallel" | "sequential" | "dag";
}

export function taskDocToInvocation(taskDoc: TaskDoc): ExecutorInvocation {
  return {
    sourceTaskDocPath: taskDoc.sourcePath,
    project: { ...taskDoc.frontmatter.project },
    stage: taskDoc.frontmatter.stage,
    executorType: taskDoc.frontmatter.executor?.type,
    task: {
      title: taskDoc.frontmatter.task?.title,
      description: taskDoc.body,
    },
    expectedOutput: {
      todolist: [...taskDoc.frontmatter.expectedOutput.todolist],
      checklist: [...taskDoc.frontmatter.expectedOutput.checklist],
    },
    constraints: [...(taskDoc.frontmatter.constraints ?? [])],
    inputs: [...(taskDoc.frontmatter.inputs ?? [])],
    hints: taskDoc.frontmatter.hints ? { ...taskDoc.frontmatter.hints } : undefined,
  };
}
