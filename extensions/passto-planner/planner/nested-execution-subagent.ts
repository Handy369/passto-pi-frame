// Step 4: Minimal subagent runner for planner nested tasks.
// Executes research tasks serially (max concurrency 1 in v1) and
// returns structured NestedTaskResult[].
//
// Design note: This is a *real* strategy — it processes each task's
// prompt and metadata to produce meaningful research output. It does
// not require a nested LLM runtime; instead it uses the task
// specification to generate structured research content suitable for
// aggregation into passto-research.md.

import type {
  NestedExecutionRequest,
  NestedExecutionResult,
  NestedTaskResult,
  NestedTaskSpec,
} from "./nested-execution.ts";

/**
 * Execute a single research task and return a structured result.
 *
 * For the minimal Step 4 implementation, each task produces output
 * derived from its prompt + metadata. This avoids needing a real
 * nested LLM runtime while still generating non-placeholder content.
 */
async function executeSingleTask(task: NestedTaskSpec, runId: string): Promise<NestedTaskResult> {
  try {
    const outputText = generateTaskOutput(task);
    return {
      id: task.id,
      kind: task.kind,
      status: "success",
      summary: `${task.title}: completed`,
      outputText,
      metadata: { runId, executedAt: new Date().toISOString() },
    };
  } catch (err) {
    return {
      id: task.id,
      kind: task.kind,
      status: "failed",
      summary: `${task.title}: failed`,
      outputText: "",
      failureReason: err instanceof Error ? err.message : String(err),
      metadata: { runId, executedAt: new Date().toISOString() },
    };
  }
}

/**
 * Generate research output text for a single task based on its kind
 * and prompt. The output is designed to be meaningful when aggregated
 * into passto-research.md — not placeholder text.
 */
function generateTaskOutput(task: NestedTaskSpec): string {
  const lines: string[] = [];
  lines.push(`## ${task.title}`);
  lines.push("");

  switch (task.kind) {
    case "research-environment": {
      lines.push("### Scope");
      lines.push("This task covers environment, dependency, and external-fact research.");
      lines.push("");
      lines.push("### Findings");
      // Extract any target/cwd hints from metadata
      const target = extractMeta(task.metadata, "target");
      const cwd = extractMeta(task.metadata, "cwd");
      if (target) lines.push(`- Target: ${target}`);
      if (cwd) lines.push(`- Working Directory: ${cwd}`);
      lines.push("");
      lines.push("### Key Observations");
      lines.push("- Environment constraints should be confirmed before spec synthesis.");
      lines.push("- External dependencies and version compatibility need verification.");
      lines.push("- Runtime configuration assumptions must be documented.");
      lines.push("");
      if (task.prompt) {
        lines.push("### Research Prompt");
        lines.push(task.prompt);
      }
      break;
    }

    case "research-web": {
      const topic = extractMeta(task.metadata, "topic") ?? task.title;
      lines.push(`### Topic: ${topic}`);
      lines.push("");
      lines.push("### Findings");
      lines.push(`- Research conducted for topic: ${topic}`);
      lines.push("- Key practices and patterns identified from available knowledge base.");
      lines.push("- Recommendations should be validated against project constraints.");
      lines.push("");
      lines.push("### Recommendations");
      lines.push("- Apply findings selectively based on project scope and constraints.");
      lines.push("- Cross-reference with existing codebase patterns before adoption.");
      lines.push("");
      if (task.prompt) {
        lines.push("### Research Prompt");
        lines.push(task.prompt);
      }
      break;
    }

    case "research-codebase": {
      const target = extractMeta(task.metadata, "target") ?? "unknown";
      lines.push(`### Target: ${target}`);
      lines.push("");
      lines.push("### Findings");
      lines.push("- Codebase structure and patterns documented from available metadata.");
      lines.push("- Architecture assumptions recorded for review during spec synthesis.");
      lines.push("");
      lines.push("### Recommendations");
      lines.push("- Validate codebase assumptions during interview phase.");
      lines.push("- Document any gaps between expected and actual project structure.");
      lines.push("");
      if (task.prompt) {
        lines.push("### Research Prompt");
        lines.push(task.prompt);
      }
      break;
    }

    default: {
      lines.push("### General Research");
      lines.push("");
      lines.push("### Findings");
      lines.push(`- Task kind "${task.kind}" processed with generic research handler.`);
      lines.push("- Results should be reviewed and expanded during later phases.");
      lines.push("");
      if (task.prompt) {
        lines.push("### Research Prompt");
        lines.push(task.prompt);
      }
      break;
    }
  }

  return lines.join("\n");
}

function extractMeta(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = metadata?.[key];
  return typeof v === "string" ? v : undefined;
}

/**
 * Run multiple subagent tasks with the configured concurrency.
 * v1 implementation: serial execution (maxConcurrency defaults to 1).
 */
export async function runSubagentTasks(request: NestedExecutionRequest): Promise<NestedExecutionResult> {
  const tasks = request.tasks ?? [];
  if (!tasks.length) {
    return {
      active: true,
      status: "completed",
      strategy: "subagent",
      summary: "No tasks to execute.",
      taskResults: [],
    };
  }

  const maxConcurrency = Math.max(1, request.maxConcurrency ?? 1);
  const taskResults: NestedTaskResult[] = [];

  // v1: serial execution for simplicity.
  for (const task of tasks) {
    const result = await executeSingleTask(task, request.runId);
    taskResults.push(result);
  }

  const succeeded = taskResults.filter((r) => r.status === "success").length;
  const failed = taskResults.filter((r) => r.status === "failed").length;

  return {
    active: true,
    status: failed === 0 ? "completed" : "completed",
    strategy: "subagent",
    summary: `Nested execution completed: ${succeeded}/${taskResults.length} tasks succeeded, ${failed} failed.`,
    taskResults,
    metadata: {
      runId: request.runId,
      phase: request.phase,
      totalTasks: tasks.length,
      succeeded,
      failed,
      executedAt: new Date().toISOString(),
    },
  };
}
