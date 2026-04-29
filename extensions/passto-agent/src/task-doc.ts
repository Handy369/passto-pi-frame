import fs from "node:fs";
import path from "node:path";
import type { PasstoAgentDraftTask } from "./types.ts";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "task";
}

function quote(value: string): string {
  return JSON.stringify(value);
}

export function renderPasstoAgentTaskDoc(draft: PasstoAgentDraftTask): string {
  const lines: string[] = [
    "---",
    `schema_version: ${quote("1")}`,
    `task_id: ${quote(`${draft.stage}-${slugify(draft.taskTitle || draft.goal)}`)}`,
    "",
    "project:",
    `  name: ${quote(path.basename(draft.cwd) || "project")}`,
    `  cwd: ${quote(draft.cwd)}`,
    "",
    `stage: ${quote(draft.stage)}`,
  ];

  if (draft.executorType) {
    lines.push("", "executor:", `  type: ${quote(draft.executorType)}`);
  }

  if (draft.taskTitle) {
    lines.push("", "task:", `  title: ${quote(draft.taskTitle)}`);
  }

  lines.push(
    "",
    "expected_output:",
    "  todolist:",
    ...(draft.todolist.length ? draft.todolist : ["Complete the requested work"]).map((item) => `    - ${quote(item)}`),
    "  checklist:",
    ...(draft.checklist.length ? draft.checklist : ["Keep the task within the requested scope"]).map((item) => `    - ${quote(item)}`),
  );

  if (draft.constraints.length) {
    lines.push("", "constraints:", ...draft.constraints.map((item) => `  - ${quote(item)}`));
  }

  if (draft.inputs.length) {
    lines.push("", "inputs:");
    for (const input of draft.inputs) {
      lines.push(`  - kind: ${quote(input.kind)}`);
      if (input.path) lines.push(`    path: ${quote(input.path)}`);
      if (input.content) lines.push(`    content: ${quote(input.content)}`);
      if (input.label) lines.push(`    label: ${quote(input.label)}`);
      if (typeof input.required === "boolean") lines.push(`    required: ${input.required ? "true" : "false"}`);
    }
  }

  if (draft.preferredModel || draft.preferredThinking || draft.preferredRole) {
    lines.push("", "hints:");
    if (draft.preferredModel) lines.push(`  preferred_model: ${quote(draft.preferredModel)}`);
    if (draft.preferredThinking) lines.push(`  preferred_thinking: ${quote(draft.preferredThinking)}`);
    if (draft.preferredRole) lines.push(`  preferred_role: ${quote(draft.preferredRole)}`);
  }

  lines.push("---", "", draft.goal.trim());
  return lines.join("\n");
}

export function writePasstoAgentTaskDoc(draft: PasstoAgentDraftTask): string {
  const dir = path.join(draft.cwd, ".passto-ai");
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${draft.stage}-${slugify(draft.taskTitle || draft.goal)}.md`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, renderPasstoAgentTaskDoc(draft), "utf-8");
  return filePath;
}
