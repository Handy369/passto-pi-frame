import fs from "node:fs";
import { getExecutorStageDocPath, listExecutorStageNames, listExecutorStageRegistry } from "../../passto-executor/executor-core/stage-registry.ts";
import type { PasstoAgentStageInfo } from "./types.ts";

function parseScalar(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith(`"`) && trimmed.endsWith(`"`)) || (trimmed.startsWith(`'`) && trimmed.endsWith(`'`))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function countIndent(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function createContainerForUpcomingLine(line: string | undefined): unknown {
  const trimmed = line?.trim() ?? "";
  return trimmed.startsWith("- ") ? [] : {};
}

function parseInlineObject(itemText: string): Record<string, unknown> {
  const idx = itemText.indexOf(":");
  if (idx === -1) throw new Error(`invalid inline object item: ${itemText}`);
  const key = itemText.slice(0, idx).trim();
  const valueText = itemText.slice(idx + 1).trim();
  return { [key]: valueText ? parseScalar(valueText) : {} };
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
      if (!Array.isArray(parent)) throw new Error(`list item has no array parent: ${trimmed}`);
      const itemText = trimmed.slice(2).trim();
      if (!itemText) {
        const nextItem: Record<string, unknown> = {};
        parent.push(nextItem);
        stack.push({ indent, container: nextItem });
        continue;
      }

      if (itemText.includes(":")) {
        const value = parseInlineObject(itemText);
        parent.push(value);
        stack.push({ indent, container: value });
        const firstKey = Object.keys(value)[0];
        if (value[firstKey] && typeof value[firstKey] === "object") {
          stack.push({ indent: indent + 2, container: value[firstKey] });
        }
      } else {
        parent.push(parseScalar(itemText));
      }
      continue;
    }

    const idx = trimmed.indexOf(":");
    if (idx === -1) throw new Error(`invalid line: ${trimmed}`);
    const key = trimmed.slice(0, idx).trim();
    const valueText = trimmed.slice(idx + 1).trim();

    if (!parent || typeof parent !== "object") throw new Error(`invalid parent for key ${key}`);
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

function extractFrontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {};
  return parseSimpleYaml(match[1]);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function readPasstoAgentStageInfo(stageName: string): PasstoAgentStageInfo {
  const stageDocPath = getExecutorStageDocPath(stageName);
  if (!stageDocPath) throw new Error(`Unknown passto-executor stage: ${stageName}`);
  const raw = fs.readFileSync(stageDocPath, "utf-8");
  const frontmatter = extractFrontmatter(raw);
  return {
    name: typeof frontmatter.name === "string" ? frontmatter.name : stageName,
    stageDocPath,
    description: typeof frontmatter.description === "string" ? frontmatter.description : undefined,
    useCases: asStringArray(frontmatter.use_cases),
    requiredParameters: asStringArray(frontmatter.required_parameters),
    optionalParameters: asStringArray(frontmatter.optional_parameters),
    recommendedExecutorType: typeof frontmatter.recommended_executor_type === "string" ? frontmatter.recommended_executor_type : undefined,
    exampleTaskDoc: typeof frontmatter.example_task_doc === "string" ? frontmatter.example_task_doc : undefined,
  };
}

export function listPasstoAgentStages(): PasstoAgentStageInfo[] {
  return listExecutorStageRegistry().map((entry) => readPasstoAgentStageInfo(entry.name));
}

export function listPasstoAgentStageNames(): string[] {
  return listExecutorStageNames();
}
