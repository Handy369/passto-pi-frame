import fs from "node:fs";

export type TaskDocStage = "planner" | "builder" | "reviewer" | "operator";
export type TaskDocThinking = "none" | "low" | "medium" | "high";
export type TaskDocInputKind = "file" | "doc" | "artifact" | "inline";

export interface TaskDocProject {
  name: string;
  cwd: string;
}

export interface TaskDocExpectedOutput {
  todolist: string[];
  checklist: string[];
}

export interface TaskDocInput {
  kind: TaskDocInputKind;
  path?: string;
  content?: string;
  label?: string;
  required?: boolean;
}

export interface TaskDocFrontmatter {
  schemaVersion: "1";
  taskId?: string;
  project: TaskDocProject;
  stage: TaskDocStage;
  executor?: {
    type?: string;
  };
  task?: {
    title?: string;
  };
  expectedOutput: TaskDocExpectedOutput;
  constraints?: string[];
  inputs?: TaskDocInput[];
  hints?: {
    preferredModel?: string;
    preferredThinking?: TaskDocThinking;
    preferredRole?: string;
  };
}

export interface TaskDoc {
  frontmatter: TaskDocFrontmatter;
  body: string;
  sourcePath: string;
}

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

function parseInlineObject(itemText: string, indent: number): { value: Record<string, unknown>; pushValueContainer: boolean } {
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
        const { value, pushValueContainer } = parseInlineObject(itemText, indent);
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

function normalizeFrontmatter(data: Record<string, unknown>): TaskDocFrontmatter {
  const schemaVersion = (data.schema_version ?? data.schemaVersion) as unknown;
  const parsedSchemaVersion = asString(schemaVersion, "schema_version");
  if (parsedSchemaVersion !== "1") fail(`schema_version must be "1"`);

  const project = asRecord(data.project, "project");
  const expectedOutput = asRecord(data.expected_output ?? data.expectedOutput, "expected_output");
  const executor = data.executor ? asRecord(data.executor, "executor") : undefined;
  const task = data.task ? asRecord(data.task, "task") : undefined;
  const hints = data.hints ? asRecord(data.hints, "hints") : undefined;

  const stage = asString(data.stage, "stage") as TaskDocStage;
  if (!["planner", "builder", "reviewer", "operator"].includes(stage)) fail(`stage must be planner|builder|reviewer|operator`);

  const parsedInputs = Array.isArray(data.inputs)
    ? data.inputs.map((entry, index) => {
        const item = asRecord(entry, `inputs[${index}]`);
        const kind = asString(item.kind, `inputs[${index}].kind`) as TaskDocInputKind;
        if (!["file", "doc", "artifact", "inline"].includes(kind)) fail(`inputs[${index}].kind is invalid`);

        const path = asString(item.path, `inputs[${index}].path`, false);
        const content = asString(item.content, `inputs[${index}].content`, false);
        if (kind === "inline" && !content) fail(`inputs[${index}].content is required for inline inputs`);
        if (kind !== "inline" && !path) fail(`inputs[${index}].path is required for non-inline inputs`);

        return {
          kind,
          path,
          content,
          label: asString(item.label, `inputs[${index}].label`, false),
          required: typeof item.required === "boolean" ? item.required : undefined,
        } satisfies TaskDocInput;
      })
    : undefined;

  const preferredThinking = hints
    ? (asString(hints.preferred_thinking ?? hints.preferredThinking, "hints.preferred_thinking", false) as TaskDocThinking | undefined)
    : undefined;
  if (preferredThinking && !["none", "low", "medium", "high"].includes(preferredThinking)) {
    fail(`hints.preferred_thinking must be none|low|medium|high`);
  }

  return {
    schemaVersion: "1",
    taskId: asString(data.task_id ?? data.taskId, "task_id", false),
    project: {
      name: asString(project.name, "project.name") as string,
      cwd: asString(project.cwd, "project.cwd") as string,
    },
    stage,
    executor: executor ? { type: asString(executor.type, "executor.type", false) } : undefined,
    task: task ? { title: asString(task.title, "task.title", false) } : undefined,
    expectedOutput: {
      todolist: asStringArray(expectedOutput.todolist, "expected_output.todolist"),
      checklist: asStringArray(expectedOutput.checklist, "expected_output.checklist"),
    },
    constraints: asStringArray(data.constraints, "constraints", false),
    inputs: parsedInputs,
    hints: hints
      ? {
          preferredModel: asString(hints.preferred_model ?? hints.preferredModel, "hints.preferred_model", false),
          preferredThinking,
          preferredRole: asString(hints.preferred_role ?? hints.preferredRole, "hints.preferred_role", false),
        }
      : undefined,
  };
}

export function parseTaskDoc(raw: string, sourcePath: string): TaskDoc {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) fail(`missing YAML frontmatter in ${sourcePath}`);
  const frontmatter = normalizeFrontmatter(parseSimpleYaml(match[1]));
  return {
    frontmatter,
    body: match[2].trim(),
    sourcePath,
  };
}

export function readTaskDoc(filePath: string): TaskDoc {
  return parseTaskDoc(fs.readFileSync(filePath, "utf-8"), filePath);
}
