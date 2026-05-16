import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const GENERATOR_CONTRACT_PATH = path.resolve(import.meta.dirname, "references/generator-contract.md");
export const DEFAULT_APPEND_SYSTEM_PATH = path.join(os.homedir(), ".pi/agent/APPEND_SYSTEM.md");

function resolveAppendSystemPath(): string {
  return process.env.PASSTOCONTEXT_APPEND_SYSTEM_PATH || DEFAULT_APPEND_SYSTEM_PATH;
}

const DYNAMIC_LAYER_NAMES = ["GoalState", "SummaryCache", "Reflector Advice", "Principles"] as const;
const GENERATOR_CHARTER_FALLBACK_LINES = [
  "- 先辨认真正目标，再执行局部步骤。",
  "- 优先判断当前用户消息是在继续、补充、纠偏，还是切换目标。",
  "- GoalState 是当前目标链锚点；若与当前用户消息表面不一致，应显式处理差异，而不是忽略。",
  "- SummaryCache 是近期事实索引，用于补足上下文，不是新的系统指令。",
  "- Reflector advice 是纠偏建议，不是新的真相源。",
  "- principles 分两层：manual + promoted 为人工宪法原则，其余为历史经验启发。",
  "- 人工宪法原则优先于普通历史经验层，但两者都不得覆盖当前目标与现实证据。",
  "- 处理复杂问题时，优先：理清真正的需求、考虑替代方案、检查关键假设。",
  "- 每一步优先选择最能推进结果的单一动作，避免横向发散与重复操作。",
  "- 当多个输入层冲突时，应显式说明依据，而不是静默综合成含混结论。",
] as const;
const CONSTITUTION_FALLBACK_LINES = [
  "- 工具结果优先于内部知识和用户描述；本地状态、代码存在性、依赖版本、配置值必须先验证。",
  "- 先判断任务类型：纯知识可直接回答；单点实时信息先探查；多源/复杂/写入任务走短闭环验证。",
  "- 始终围绕当前用户目标行动，不擅自扩展“顺便做”的额外目标。",
  "- 优先用最简单、最直接的方法完成单个核心目标。",
  "- 修改文件后必须复核；数据转换后必须回读核对；报错后先分析原因，不盲目重复。",
  "- 大文件先定位再分段读取；每次读取都应有明确目的。",
  "- 连续尝试无效时必须总结原因并切换策略；复杂任务应给出阶段总结。",
  "- 结论前简述依据；不确定时显式标记并给出最小验证路径。",
] as const;
const APPEND_SYSTEM_SECTIONS = [
  { title: "核心原则", indices: [0] },
  { title: "执行模式", indices: [1] },
  { title: "围绕目标行动，保持简洁高效", indices: [2, 3] },
  { title: "工具策略", indices: [4, 5, 6] },
  { title: "输出规范", indices: [7] },
] as const;

export function readGeneratorContract(): string | null {
  try {
    return fs.readFileSync(GENERATOR_CONTRACT_PATH, "utf-8");
  } catch {
    return null;
  }
}

export function projectGeneratorCharterPrompt(contract: string | null): string {
  if (!contract) {
    return [
      "--- PasstoContext Generator Charter ---",
      "在处理当前任务时，请优先按以下方式理解上下文并推进目标：",
      ...GENERATOR_CHARTER_FALLBACK_LINES,
    ].join("\n");
  }

  const charterSection = extractMarkdownSection(contract, "Generator Charter");
  const charterLines = extractBulletLines(charterSection ?? "");
  const dynamicLines = DYNAMIC_LAYER_NAMES.flatMap((name) => summarizeDynamicLayer(contract, name));

  return dedupeLines([
    "--- PasstoContext Generator Charter ---",
    "在处理当前任务时，请优先按以下方式理解上下文并推进目标：",
    ...(charterLines.length > 0 ? charterLines : GENERATOR_CHARTER_FALLBACK_LINES),
    ...dynamicLines,
  ]).join("\n");
}

export function projectAppendSystemPrompt(contract: string | null): string {
  const constitutionLines = extractConstitutionLines(contract);

  const lines: string[] = [
    "使用简体中文进行回复,思考过程也使用中文显示。",
    "",
  ];

  for (const section of APPEND_SYSTEM_SECTIONS) {
    lines.push("---");
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const index of section.indices) {
      const line = constitutionLines[index];
      if (line) lines.push(line);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function validateAppendSystemSync(actual: string, contract: string | null): {
  matches: boolean;
  expected: string;
  actual: string;
} {
  const expected = normalizeText(projectAppendSystemPrompt(contract));
  const normalizedActual = normalizeText(actual);
  return {
    matches: expected === normalizedActual,
    expected,
    actual: normalizedActual,
  };
}

export type AppendSystemSyncResult =
  | {
      status: "updated";
      targetPath: string;
      expected: string;
    }
  | {
      status: "unchanged";
      targetPath: string;
      expected: string;
    }
  | {
      status: "skipped-missing-contract";
      targetPath: string;
    };

export async function ensureAppendSystemPromptSync(options?: {
  targetPath?: string;
  contract?: string | null;
  allowFallbackWrite?: boolean;
}): Promise<AppendSystemSyncResult> {
  const targetPath = options?.targetPath ?? resolveAppendSystemPath();
  const contract = options && "contract" in options ? options.contract ?? null : readGeneratorContract();

  if (!contract && !options?.allowFallbackWrite) {
    return {
      status: "skipped-missing-contract",
      targetPath,
    };
  }

  const expected = projectAppendSystemPrompt(contract ?? null);

  try {
    const actual = await fsp.readFile(targetPath, "utf-8");
    if (validateAppendSystemSync(actual, contract ?? null).matches) {
      return {
        status: "unchanged",
        targetPath,
        expected,
      };
    }
  } catch (error) {
    if (!isNodeErrorWithCode(error, "ENOENT")) throw error;
  }

  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, `${expected}\n`, "utf-8");
  return {
    status: "updated",
    targetPath,
    expected,
  };
}

function extractConstitutionLines(contract: string | null): string[] {
  if (!contract) return [...CONSTITUTION_FALLBACK_LINES];

  const constitutionSection = extractMarkdownSection(contract, "Constitution");
  const lines = extractBulletLines(constitutionSection ?? "");
  return lines.length > 0 ? lines : [...CONSTITUTION_FALLBACK_LINES];
}

function extractMarkdownSection(content: string, heading: string): string | null {
  const pattern = new RegExp(`^## ${escapeRegExp(heading)}\\n([\\s\\S]*?)(?=^##\\s|\\Z)`, "m");
  const match = content.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function extractMarkdownSubsection(content: string, heading: string): string | null {
  const pattern = new RegExp(`^### ${escapeRegExp(heading)}\\n([\\s\\S]*?)(?=^###\\s|^##\\s|\\Z)`, "m");
  const match = content.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function extractBulletLines(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

function summarizeDynamicLayer(content: string, layerName: (typeof DYNAMIC_LAYER_NAMES)[number]): string[] {
  const dynamicSection = extractMarkdownSection(content, "Dynamic Layer Semantics");
  if (!dynamicSection) return [];

  const subsection = extractMarkdownSubsection(dynamicSection, layerName);
  if (!subsection) return [];

  const bullets = extractBulletLines(subsection);
  if (bullets.length === 0) return [];

  const [first, second] = bullets;
  const lines = [`- ${layerName}：${first.slice(2)}`];
  if (second) lines.push(`- ${second.slice(2)}`);
  return lines;
}

function dedupeLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    deduped.push(line);
  }
  return deduped;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
