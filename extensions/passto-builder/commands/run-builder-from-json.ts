import { readFile } from "node:fs/promises";
import type { BuilderInput } from "../builder/contracts.ts";
import { runBuilder } from "../builder/runner.ts";
import { formatBuilderCommandResult } from "./run-builder.ts";

export async function runBuilderFromJsonFile(path: string) {
  const content = await readFile(path, "utf8");
  const input = JSON.parse(content) as BuilderInput;
  const response = await runBuilder(input);
  const formatted = formatBuilderCommandResult(response);
  return {
    input,
    response,
    formatted,
    bootstrapReport: response.result.bootstrapReport,
    bootstrapReportText: formatted.bootstrapReportText,
    handoffText: formatted.handoffText,
  };
}
