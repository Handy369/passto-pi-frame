import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

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
export * from "./commands/run-builder.ts";
export * from "./commands/run-builder-from-json.ts";

export default function (_pi: ExtensionAPI) {
  // Internal-only extension: passto-builder must not expose command/tool surfaces to LLM.
  // Builder execution is only reachable through passto-executor's internal integration path.
}
