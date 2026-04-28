import { randomUUID } from "node:crypto";
import type { ExecutorRunResult } from "./result.ts";
import { executeInvocation, type ExecuteInvocationOptions } from "./execute.ts";
import { taskDocToInvocation } from "./invocation.ts";
import { readTaskDoc, type TaskDoc } from "./task-doc.ts";

export interface ExecuteTaskDocOptions extends Omit<ExecuteInvocationOptions, "runId"> {
  runId?: string;
}

export function loadTaskDocInvocation(taskDocPath: string): { taskDoc: TaskDoc; invocation: ReturnType<typeof taskDocToInvocation> } {
  const taskDoc = readTaskDoc(taskDocPath);
  const invocation = taskDocToInvocation(taskDoc);
  return { taskDoc, invocation };
}

export async function executeTaskDoc(taskDocPath: string, options: ExecuteTaskDocOptions): Promise<ExecutorRunResult> {
  const { invocation } = loadTaskDocInvocation(taskDocPath);
  return executeInvocation(invocation, {
    ...options,
    runId: options.runId ?? randomUUID(),
  });
}
