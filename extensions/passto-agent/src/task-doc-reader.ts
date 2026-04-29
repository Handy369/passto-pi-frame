import fs from "node:fs";
import { isKnownExecutorStage } from "../../passto-executor/executor-core/stage-registry.ts";
import type { PasstoAgentTaskInput } from "./types.ts";

function fail(message: string): never {
  throw new Error(`Invalid task.md: ${message}`);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string, required = true): string | undefined {
  if (value === undefined || value === null) {
    if (required) fail(`${label} is required`);
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value.trim();
}

function asStringArray(value: unknown, label: string, required = true): string[] {
  if (value === undefined || value === null) {
    if (required) fail(`${label} is required`);
    return [];
  }
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((item, index) => asString(item, `${label}[${index}]`) as string);
}

function parseScalar(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith(`"`) && trimmed.endsWith(`"`)) || (trimmed.startsWith(`'`) && trimmed.endsWith(`'`))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function countIndent(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function createContainerForUpcomingLine(line: string | undefined): unknown {
  const trimmed = line?.trim() ?? "";
  return trimmed.startsWith("- ") ? [] : {};
}

function parseInlineObject(itemText: string): { value: Record<string, unknown>; pushValueContainer: boolean } {
  const idx = itemText.indexOf(":");
  if (idx === -1) fail(`invalid inline object item: ${itemText}`);
  const key = itemText.slice(0, idx).trim();
  const valueText = itemText.slice(idx + 1).trim();
  const value: Record<string, unknown> = {};
  value[key] = valueText ? parseScalar(valueText) : {};
  return { value, pushValueContainer: !valueText };
}

function parseSimpleYaml(frontmatter: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; container: unknown }> = [{ indent: -1, container: root }];
  const lines = frontmatter.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;

    const indent = countIndent(rawLine);
    const trimmed = rawLine.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1]?.container;

    if (trimmed.startsWith("- ")) {
      if (!Array.isArray(parent)) fail(`list item has no array parent: ${trimmed}`);
      const itemText = trimmed.slice(2).trim();
      if (!itemText) {
        const nextItem: Record<string, unknown> = {};
        parent.push(nextItem);
        stack.push({ indent, container: nextItem });
        continue;
      }

      if (itemText.includes(":")) {
        const { value, pushValueContainer } = parseInlineObject(itemText);
        parent.push(value);
        stack.push({ indent, container: value });
        if (pushValueContainer) {
          const firstKey = Object.keys(value)[0];
          stack.push({ indent: indent + 2, container: value[firstKey] });
        }
      } else {
        parent.push(parseScalar(itemText));
      }
      continue;
    }

    const idx = trimmed.indexOf(":");
    if (idx === -1) fail(`invalid line: ${trimmed}`);
    const key = trimmed.slice(0, idx).trim();
    const valueText = trimmed.slice(idx + 1).trim();

    if (!parent || typeof parent !== "object") fail(`invalid parent for key ${key}`);
    const record = parent as Record<string, unknown>;

    if (valueText) {
      record[key] = parseScalar(valueText);
      continue;
    }

    const nextContainer = createContainerForUpcomingLine(lines[index + 1]);
    record[key] = nextContainer;
    stack.push({ indent, container: nextContainer });
  }

  return root;
}

export interface PasstoAgentInputTaskDoc {
  frontmatter: {
    project: { name: string; cwd: string };
    stage: string;
    inputs?: PasstoAgentTaskInput[];
    hints?: { preferredRole?: string };
  };
  body: string;
  sourcePath: string;
}

function normalizeInputs(value: unknown): PasstoAgentTaskInput[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry, index) => {
    const item = asRecord(entry, `inputs[${index}]`);
    const kind = asString(item.kind, `inputs[${index}].kind`) as PasstoAgentTaskInput["kind"];
    const path = asString(item.path, `inputs[${index}].path`, false);
    const content = asString(item.content, `inputs[${index}].content`, false);
    return {
      kind,
      path,
      content,
      label: asString(item.label, `inputs[${index}].label`, false),
      required: typeof item.required === "boolean" ? item.required : undefined,
    } satisfies PasstoAgentTaskInput;
  });
}

function normalizeFrontmatter(data: Record<string, unknown>) {
  const schemaVersion = asString(data.schema_version ?? data.schemaVersion, "schema_version");
  if (schemaVersion !== "1") fail(`schema_version must be "1"`);

  const project = asRecord(data.project, "project");
  const expectedOutput = asRecord(data.expected_output ?? data.expectedOutput, "expected_output");
  const hints = data.hints ? asRecord(data.hints, "hints") : undefined;
  const stage = asString(data.stage, "stage") as string;
  if (!isKnownExecutorStage(stage)) fail(`stage must match a registered passto-executor stage`);

  asString(project.name, "project.name");
  asString(project.cwd, "project.cwd");
  asStringArray(expectedOutput.todolist, "expected_output.todolist");
  asStringArray(expectedOutput.checklist, "expected_output.checklist");

  return {
    project: {
      name: asString(project.name, "project.name") as string,
      cwd: asString(project.cwd, "project.cwd") as string,
    },
    stage,
    inputs: normalizeInputs(data.inputs),
    hints: hints
      ? {
          preferredRole: asString(hints.preferred_role ?? hints.preferredRole, "hints.preferred_role", false),
        }
      : undefined,
  };
}

export function readTaskDocForPasstoAgentInput(filePath: string): PasstoAgentInputTaskDoc {
  const raw = fs.readFileSync(filePath, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) fail(`missing YAML frontmatter in ${filePath}`);
  return {
    frontmatter: normalizeFrontmatter(parseSimpleYaml(match[1])),
    body: match[2].trim(),
    sourcePath: filePath,
  };
}
