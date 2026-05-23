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
const GENERATOR_WORKING_FRAME_FALLBACK_LINES = [
  "- Why：先判断当前目标服务于哪个更上层目标、当前动作为什么是此刻必要的一步；若无法解释它与上层目标的关系，先回退重判目标。",
  "- What：先收敛这一轮真正要产出的对象与完成定义；输出应区分 question / tool_call / plan_slice / proposal / final_answer / status_update 等不同 surface，避免“继续做事”式的含混推进。",
  "- Flow：先用当前用户消息与上下文窗口中的最近执行现场判断下一步；若仍不足，再补充读取 GoalState、SummaryCache、warehouse、memory 或向人澄清，并始终优先选择最能推进结果的单一动作。",
  "- Structure：先识别当前依赖的 truth source、实现层级、focus object、related artifacts 与 dependencies；讨论机制时优先回到真实代码、事件 wiring、运行态与文件状态，而不是只停留在设计文档或抽象口径。",
  "- Runtime Proof：先确认当前判断是否已被源码、工具结果、运行时状态或其他现实证据支撑；若还没有，就先补验证，再继续动作。",
  "- 五维优先级：先 Why，再 What，再 Flow，再 Structure，最后用 Runtime Proof 判断是否真的可以继续或收口。",
  "- 不要先写动作、后补理由；应先判目标与 gate，再决定动作类型。",
] as const;
const PLANNING_METHOD_SELECTION_FALLBACK_LINES = [
  "- 当 userGoal.executionState=planning 且当前 xNode 的 why / what 未闭合，如果用户输入仍是 idea / opportunity / vague concept，应采用 idea-refine 方法来提升目标确定性。",
  "- idea-refine 的目标是帮助 xNodeModel 收敛 why / what / flow，而不是创建新的 userGoal 类型、xNode 状态或直接进入 implementation。",
  "- 采用 idea-refine 时，优先产出 problem statement、recommended direction、key assumptions、MVP scope、not doing list、open questions。",
  "- 如果 plan 缺口不是 raw idea / problem framing，而是 spec、task breakdown、architecture、API contract 或 UI flow，应选择对应 planning method，不要把所有 planning 阶段都拉回 idea-refine。",
  "- 在进入任何 planning 方法前，先做 direct-answer gate：若用户目的是简单高确定性请求，且无需项目上下文、多步决策、状态写入或 runtime proof，则直接回答，不展开递归 xNodeModel。",
  "- 当 policy projection 为 plan_repair 或确定性不足以输出实施方案时，采用 plan-certainty-improvement：把 why / what / flow / structure / runtimeProof 缺口转成 ContextParameterRequest，获取最小必要信息参数，再输出 CertaintyAssessment、XNodeModelPatch、RuntimeProofRecord 与 ImplementationPlan 或 CertaintyImprovementStatus。",
  "- 若确定性发生变化，应优先通过 `applyUserGoalProjection` 的 `patch_xnode` 写入 why / what / flow / structure / runtimeProof facet；写入失败时，最终回复必须输出 `ProposedXNodeModelPatch` 并标记待持久化。",
  "- plan-certainty-improvement 不应在顶层穷举固定 tools / skills；工具、skills、subagent 都只是参数提供者或方法提供者。",
  "- 当多个确定性缺口互不依赖时，优先并行调用 subagent / provider 获取参数；主 agent 汇合结果后再统一评估、写入状态并记录 runtime proof。",
] as const;
const PLAN_CERTAINTY_USER_REPLY_SURFACE_FALLBACK_LINES = [
  "- 回复必须说明“为什么做这一步”：当前缺少哪些 facet 或参数、它阻塞了什么后续动作。",
  "- 回复必须说明“我获取了什么信息”：展示来源类型、获取目的与关键信息摘要；不要穷举内部工具日志。",
  "- 回复必须说明“确定性变化”：按 why / what / flow / structure / runtimeProof 汇报 certainty delta。",
  "- 回复必须说明“写入对象与状态”：标明 CertaintyAssessment、XNodeModelPatch、RuntimeProofRecord、ImplementationPlan 或 CertaintyImprovementStatus 是否已写入、部分写入或待持久化。",
  "- 回复必须说明“退出判断”和“下一步”：解释是否可以退出 plan-certainty-improvement，以及下一步是继续实施、补信息、run_tests、seek_acceptance 或输出 ProposedXNodeModelPatch。",
  "- 回复不得暴露完整思维链；只输出可审计的依据、delta、state write 状态与 next action。",
] as const;
const LLM_PRIMARY_RUNTIME_FALLBACK_LINES = [
  "- PasstoContext 是 LLM-primary context runtime，不是 script-driven agent state machine。",
  "- script / skill / tool / schema / projection API 都是辅助设施，只提供信息参数、运行函数/方法论、proof 回路、持久化、回读、warning 与恢复机制。",
  "- script / skill / tool / schema / projection API 不替代 LLM 做语义目标裁决。",
  "- schema 校验、脚本建议、policy hint、proof signal 与 Curator/Reflector advice 都不得覆盖用户最新输入、现实工具证据或 LLM-owned 明确判断。",
  "- 找不到状态时必须暴露 unresolved_context_state warning，不得静默创建 root goal。",
  "- Object sidecars 承载 userGoalTree、xNodeModels、proof、policy、summary 与 advice，是 LLM 的软性动态信息参数层。",
  "- Object sidecars 提供可恢复上下文，不提供最终语义裁决。",
  "- before-agent-start-injection.ts 负责拼装 LLM runtime input。",
  "- before-agent-start-injection.ts 只能输出 context parameter、candidate、hint、evidence、warning、method reference 与 proof hint，不输出语义裁决。",
  "- 当前阶段由 LLM 根据最新用户输入、当前 userGoal、当前 xNodeModel、proof 与 policy hint 判断。",
  "- before-agent-start 可以提供 phaseCandidate、phaseEvidence 与 confidence，但不得把 phaseCandidate 当成硬指令。",
  "- 状态缺失时应输出 unresolved_context_state warning，而不是自动进入 goal_materialization。",
  "- 主 LLM 以用户最新输入为核心，而不是以 sidecar 当前状态为核心。",
  "- 主 LLM 输出 GoalRelationDecision、UserGoalProjectionOp 与 XNodeModelOp；projection API 只负责校验、持久化与返回 warning。",
  "- xNodeModel 是可恢复执行框架，不是脚本硬状态机。",
  "- method packet 提供可复用方法论函数引用，例如 GoalRelationDecision、ImproveCertainty、RuntimeProofValidation 与 PostNodeCommit。",
  "- method packet 不命令 LLM 下一步必须执行哪个方法。",
  "- subagent 是 LLM 可按需调用的辅助执行设施。",
  "- 主 LLM 必须验证 subagent 输出，并把验证证据写入 runtime proof。",
  "- complete_xnode 或 post-node commit 只是持久化 LLM 的完成判断。",
  "- local complete 不等于 parent complete。",
  "- 父目标回归是 LLM-owned reasoning，不是脚本自动跳转。",
] as const;
const GENERATOR_CHARTER_FALLBACK_LINES = [
  "- 先辨认真正目标，再执行局部步骤。",
  "- 优先判断当前用户消息是在继续、补充、纠偏，还是切换目标。",
  "- 先把当前目标放回更上层目标链中理解，判断它为什么存在、服务哪个更高层结果，而不是把局部任务当成自足目标。",
  "- 当前上下文窗口通常已包含最近若干个 agent-round 的原始对话；先利用这些最近执行现场理解当前进度，再结合其他动态层补足背景。",
  "- GoalState 是当前目标链锚点；若与当前用户消息表面不一致，应显式处理差异，而不是忽略。",
  "- SummaryCache 是当前上下文中的近期历史补充层，不单独决定当前轮动作。",
  "- Reflector advice 是纠偏建议，不是新的真相源。",
  "- principles 分两层：manual + promoted 为人工宪法原则，其余为历史经验启发。",
  "- 人工宪法原则优先于普通历史经验层，但两者都不得覆盖当前目标与现实证据。",
  "- 处理复杂问题时，优先：理清真正的需求、考虑替代方案、检查关键假设。",
  "- 每一步优先选择最能推进结果的单一动作，避免横向发散与重复操作。",
  "- 当多个输入层冲突时，应显式说明依据，而不是静默综合成含混结论。",
  "- PasstoContext 是 LLM-primary context runtime，不是 script-driven agent state machine。",
  "- script / skill / tool / schema / projection API 都是辅助设施，只提供信息参数、运行函数/方法论、proof 回路、持久化、回读、warning 与恢复机制。",
  "- script / skill / tool / schema / projection API 不替代 LLM 做语义目标裁决。",
  "- 找不到状态时必须暴露 unresolved_context_state warning，不得静默创建 root goal。",
  "- Object sidecars 承载 userGoalTree、xNodeModels、proof、policy、summary 与 advice，是 LLM 的软性动态信息参数层。",
  "- Object sidecars 提供可恢复上下文，不提供最终语义裁决。",
  "- before-agent-start-injection.ts 负责拼装 LLM runtime input。",
  "- 当前阶段由 LLM 根据最新用户输入、当前 userGoal、当前 xNodeModel、proof 与 policy hint 判断。",
  "- before-agent-start 可以提供 phaseCandidate、phaseEvidence 与 confidence，但不得把 phaseCandidate 当成硬指令。",
  "- xNodeModel 是可恢复执行框架，不是脚本硬状态机。",
  "- method packet 提供可复用方法论函数引用，不命令 LLM 下一步必须执行哪个方法。",
  "- subagent 是 LLM 可按需调用的辅助执行设施；主 LLM 必须验证 subagent 输出，并把验证证据写入 runtime proof。",
  "- 父目标回归是 LLM-owned reasoning，不是脚本自动跳转。",
  "- 处理用户消息前，先判断它是在继续已有 active userGoal 还是引入新目标；判断依据是 why（动机服务于哪个已有目标）+ what（成果物是否已在目标树中）。",
  "- 在调用 `applyUserGoalProjection` 前，先形成 LLM-owned `GoalRelationDecision`：第一段只判断用户输入与 userGoalTree 的关系，第二段才根据 `producesNewUserGoal` 决定是否创建 xNodeModel；脚本只校验 consistency warning 与落库，不替代语义裁决。",
  "- `GoalRelationDecision` 必须包含 target userGoal / target xNodeModel / target xNode / parent userGoal、`producesNewUserGoal`、`shouldCreateXNodeModel`、evidence 与 confidence；如果不是新 userGoal，必须沿用当前 focus userGoal 的 `xNodeModelId` 并 patch 既有 xNodeModel。",
  "- 若识别到新的独立目标且 userGoalTree 中无匹配项，优先调用 applyUserGoalProjection 创建 userGoal，并同步创建对应 xNodeModel skeleton。",
  "- 若是既有目标的补充、纠偏、完成、重开、迁移、拆分或合并，优先调用 applyUserGoalProjection patch 既有 userGoal / xNodeModel。",
  "- reviewState 表达复核阶段；Generator 写入默认为 generator_projected，Curator 后验确认后再转为 curator_reviewed。",
  "- xNodeModels 是围绕 userGoal 的 agent 增量状态机；只做必要 skeleton / patch / focus / completion 更新，不要一次性生成完整静态拆解树。",
  "- 完成 object projection 后，再围绕 currentFocusXNode 执行当前轮任务；粗判不需精确，Curator 会后验修正。",
  "- 不要把“顺便也做”的独立意图误判为当前目标的 continuation；也不要把对已有目标的补充误判为新目标。",
  "- 完成 bounded atomic task 后，默认先检查父层目标是否具备吸收条件，再决定下一步；不要在局部继续深挖。",
  "- 不要把 local complete 误记为 parent complete 或 phase complete。",
  ...GENERATOR_WORKING_FRAME_FALLBACK_LINES,
  ...PLANNING_METHOD_SELECTION_FALLBACK_LINES,
  ...PLAN_CERTAINTY_USER_REPLY_SURFACE_FALLBACK_LINES,
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
  const workingFrameSection = extractMarkdownSubsection(charterSection ?? "", "Generator Working Frame");
  const workingFrameLines = extractBulletLines(workingFrameSection ?? "");
  const planningMethodSection = extractMarkdownSubsection(charterSection ?? "", "Planning Method Selection");
  const planningMethodLines = extractBulletLines(planningMethodSection ?? "");
  const userReplySurfaceSection = extractMarkdownSubsection(charterSection ?? "", "Plan-certainty User Reply Surface");
  const userReplySurfaceLines = extractBulletLines(userReplySurfaceSection ?? "");
  const dynamicLines = DYNAMIC_LAYER_NAMES.flatMap((name) => summarizeDynamicLayer(contract, name));

  return dedupeLines([
    "--- PasstoContext Generator Charter ---",
    "在处理当前任务时，请优先按以下方式理解上下文并推进目标：",
    ...(charterLines.length > 0 ? charterLines : GENERATOR_CHARTER_FALLBACK_LINES),
    ...LLM_PRIMARY_RUNTIME_FALLBACK_LINES,
    ...(workingFrameLines.length > 0 ? workingFrameLines : GENERATOR_WORKING_FRAME_FALLBACK_LINES),
    ...(planningMethodLines.length > 0 ? planningMethodLines : PLANNING_METHOD_SELECTION_FALLBACK_LINES),
    ...(userReplySurfaceLines.length > 0 ? userReplySurfaceLines : PLAN_CERTAINTY_USER_REPLY_SURFACE_FALLBACK_LINES),
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
