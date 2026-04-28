import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { formatBuilderCommandResult, runBuilderCommand } from "./commands/run-builder.ts";
import { formatBuilderToolResult, runBuilderTask } from "./tools/run-builder-task.ts";

export * from "./builder/contracts.ts";
export * from "./builder/input.ts";
export * from "./builder/phases.ts";
export * from "./builder/state.ts";
export * from "./builder/status.ts";
export * from "./builder/result.ts";
export * from "./builder/workflow.ts";
export * from "./builder/runner.ts";
export * from "./builder/artifacts.ts";
export * from "./builder/provenance.ts";
export * from "./loop-engine/index.ts";
export * from "./executor-bridge/index.ts";
export * from "./commands/run-builder.ts";
export * from "./commands/run-builder-from-json.ts";
export * from "./tools/run-builder-task.ts";

const BuilderInputSchema = Type.Object({
  mission: Type.String({ description: "High-level implementation mission for the builder run." }),
  objective: Type.String({ description: "Concrete build objective or target deliverable." }),
  workingDirectory: Type.String({ description: "Absolute working directory for the builder run." }),
  outputDir: Type.String({ description: "Directory where builder artifacts and summaries should be written." }),
  executionMode: Type.Optional(Type.Union([
    Type.Literal("single"),
    Type.Literal("sequential"),
    Type.Literal("parallel"),
    Type.Literal("dag"),
  ], { description: "Execution mode for builder perspectives." })),
  perspectives: Type.Optional(Type.Array(Type.String(), { description: "Optional perspective names to run." })),
  requiredArtifacts: Type.Optional(Type.Array(Type.String(), { description: "Artifacts the builder must produce or verify." })),
  acceptanceCriteria: Type.Optional(Type.Array(Type.String(), { description: "Acceptance criteria for the builder run." })),
  bootstrapContext: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Optional bootstrap context metadata." })),
});

export default function (pi: ExtensionAPI) {
  pi.registerCommand("passto-builder", {
    description: "Run the frame-native passto-builder bootstrap workflow.",
    handler: async (args, ctx) => {
      const raw = args.trim();
      if (!raw) {
        ctx.ui?.notify("Usage: /passto-builder <JSON BuilderInput>", "warning");
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const result = await runBuilderCommand(parsed);
        const formatted = formatBuilderCommandResult(result);
        ctx.ui?.notify(`Builder completed: ${formatted.finalStatus}`, formatted.finalStatus === "completed" ? "info" : "warning");
        pi.sendUserMessage(JSON.stringify(formatted, null, 2), { deliverAs: "assistant" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui?.notify(`passto-builder failed: ${message}`, "error");
      }
    },
  });

  pi.registerTool({
    name: "run_builder_task",
    label: "Run builder task",
    description: "Execute the frame-native passto-builder workflow and return structured results.",
    parameters: BuilderInputSchema,
    async execute(_id, params) {
      const result = await runBuilderTask(params);
      return {
        content: [{ type: "text", text: JSON.stringify(formatBuilderToolResult(result), null, 2) }],
        details: formatBuilderToolResult(result),
      };
    },
  });
}
