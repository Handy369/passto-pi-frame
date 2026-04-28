import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runPlannerTask } from "./tools/run-planner-task.ts";

interface PlannerState {
  target: string;
  planningDir: string;
  currentStep: number;
  startedAt: string;
  artifacts: string[];
}

const STEP_NAMES: Record<number, string> = {
  1: "校验目标输入",
  2: "分析目标材料",
  3: "Research Decision",
  4: "Execute Research",
  5: "详细访谈",
  6: "保存访谈记录",
  7: "Spec Synthesis",
  8: "生成初始计划",
  9: "外部审计",
  10: "整合外部反馈",
  11: "用户审阅计划",
  12: "格式化增强",
  13: "创建分段索引",
  14: "编写分段文件",
  15: "生成执行文件",
  16: "最终检查",
  17: "输出总结",
};

const TOTAL_STEPS = Object.keys(STEP_NAMES).length;
const ARTIFACTS = [
  "analysis.md",
  "passto-research.md",
  "passto-interview.md",
  "passto-spec.md",
  "pre-plan.md",
  "passto-integration-notes.md",
  "passto-plan.md",
  "reviews/gpt-5.4-review.md",
  "reviews/claude-opus-4-6-review.md",
  "sections/index.md",
  "passto-ralph-loop-prompt.md",
  "passto-ralphy-prd.md",
];

const ANALYSIS_TEMPLATE = `# Target Overview
[IDENTIFY: target / type / source]

- Target:
- Type:
- Source:

# Product Framing
[IDENTIFY: target nature]
[SELECT: product mode = 独立产品 | PI 生态产品]
[RECORD: mode source = user-confirmed only]

- Target Nature:
- Product Mode:
- Mode Source: user-confirmed

# User Inputs
[EXTRACT: all explicit and implicit user inputs]

| 输入名 | 类型 | 节点 | 必填？ | 影响哪些输出 |
|--------|------|------|--------|--------------|

# Env / Config / Dependencies
[EXTRACT: env / config / dependency inputs]

| 名称 | 类别 | 用途 | 必需？ | 影响节点 |
|------|------|------|--------|----------|

# Runtime Nodes
[TRACE: inputs -> runtime nodes -> outputs]

| 节点 | 输入 | 运行时动作 | 输出 |
|------|------|------------|------|

# Intermediate Inputs and Outputs
[TRACE: non-final outputs reused by later nodes]

| 节点 | 中间输出 | 是否持久化 | 下一步如何使用 |
|------|----------|------------|------------------|

# Final Artifacts
[BACKTRACK: final artifacts -> producer nodes -> required inputs]

| 产物 | 形式 | 位置 | 生成节点 | 依赖输入 |
|------|------|------|----------|----------|

# Environment and Constraints Hypothesis
[INFER: constraints from runtime chain]
[ASK-USER: confirm only if needed]

- 基于当前运行链路推断出的环境依赖：
- 基于当前运行链路推断出的受限条件：
- 需要用户补充确认的项：

# User-confirmed Constraints
[RECORD: only user-confirmed constraints]

- 用户明确确认的环境依赖：
- 用户明确确认的运行约束：
- 用户未确认、但仍需在方案中保守处理的风险：

# Non-negotiable Contracts
[MARK: contracts that must not be simplified]

| 项目 | 为什么不可简化 | 简化后会破坏什么 |
|------|----------------|------------------|
`;

const INPUT_DESIGN_TEMPLATE = `# Input Design

# User Input Mapping
[MAP: analysis/User Inputs -> input handling]

| 输入项 | 原系统输入方式 | 方案中的承载方式 | 使用能力 | 风险 |
|--------|----------------|------------------|----------|------|

# Env / Config Mapping
[MAP: analysis/Env / Config / Dependencies -> target environment handling]

| 名称 | 原系统来源 | 方案中的承载方式 | 是否保留 env | 备注 |
|------|------------|------------------|---------------|------|

# Non-negotiable Input Contracts
[KEEP: input contracts that must not be simplified]

- 
`;

const OUTPUT_DESIGN_TEMPLATE = `# Output Design

[MAP: analysis/Final Artifacts -> persistence plan]

| 产物 | 原系统位置/形式 | 方案中的位置/形式 | 写入者 | 恢复方式 |
|------|------------------|-------------------|--------|----------|

# Persistence Rules
[DEFINE: where outputs live / who writes / how resume reads them]

- 
`;

const RUNTIME_DESIGN_TEMPLATE = `# Runtime Design

[MAP: analysis/Runtime Nodes + analysis/Intermediate Inputs and Outputs -> runtime state model]

| 状态 | 原系统如何体现 | 方案中如何体现 | 承载位置 |
|------|----------------|----------------|----------|

# Resume / Back / Stop
[DEFINE: recoverability and operator control if needed]

- 

# TUI Plan
[DEFINE: what users must see / choose / confirm if applicable]

- 
`;

const PLAN_TEMPLATE = `# Target Summary
[MAP: analysis/Target Overview]

# Product Framing
[MAP: analysis/Product Framing]

# Environment and Constraints Summary
[MAP: analysis/Environment and Constraints Hypothesis + analysis/User-confirmed Constraints]

# Hypothesis vs Confirmed Constraints
[MAP: analysis/Environment and Constraints Hypothesis + analysis/User-confirmed Constraints]

## Hypothesized Constraints
- 

## User-confirmed Constraints
- 

## Conservative Assumptions
- 

# User Inputs
[MAP: analysis/User Inputs]

# Env / Config / Dependencies
[MAP: analysis/Env / Config / Dependencies]

# Runtime Nodes and Intermediate States
[MAP: analysis/Runtime Nodes + analysis/Intermediate Inputs and Outputs]

# Final Artifacts
[MAP: analysis/Final Artifacts]

# Architecture Plan
[MAP: analysis/Non-negotiable Contracts]

# Workflow Plan
[MAP: analysis/Runtime Nodes + analysis/Non-negotiable Contracts]

# Commands and Tools Plan
[MAP: analysis/User Inputs + analysis/Env / Config / Dependencies]

# State and TUI Plan
[MAP: analysis/Runtime Nodes + analysis/Intermediate Inputs and Outputs + analysis/User-confirmed Constraints]

# Persistence Plan
[MAP: analysis/Final Artifacts + analysis/Intermediate Inputs and Outputs]

# Review Framework Findings
[CHECK: inputs -> runtime nodes -> outputs -> final artifacts]

# Risks and Open Questions
[CHECK: unresolved constraints / weak assumptions / missing confirmations]

# Validation Checklist

- [ ] 已明确 target nature
- [ ] 已明确 product mode
- [ ] 已记录 mode source
- [ ] 用户输入完整覆盖
- [ ] 最终产物完整覆盖
- [ ] 环境变量 / 配置 / 依赖完整覆盖
- [ ] 中间态完整承载
- [ ] 运行时状态完整承载
- [ ] 不可简化节点未被错误简化
- [ ] 环境依赖和受限条件已显式纳入方案
- [ ] 已区分推断约束、用户确认约束与保守假设
`;

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function tryRead(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function statePath(planningDir: string): string {
  return path.join(planningDir, ".passto-planner-state.json");
}

function loadState(planningDir: string): PlannerState | null {
  const content = tryRead(statePath(planningDir));
  return content ? JSON.parse(content) : null;
}

function saveState(planningDir: string, state: PlannerState): void {
  writeJson(statePath(planningDir), state);
}

function removeState(planningDir: string): void {
  const sp = statePath(planningDir);
  if (fs.existsSync(sp)) fs.unlinkSync(sp);
}

function scanArtifacts(planningDir: string): string[] {
  const artifacts = ARTIFACTS.filter((f) => fs.existsSync(path.join(planningDir, f)));
  const sectionsDir = path.join(planningDir, "sections");
  if (fs.existsSync(sectionsDir)) {
    for (const entry of fs.readdirSync(sectionsDir)) {
      if (/^section-\d{2}-.*\.md$/.test(entry)) artifacts.push(path.join("sections", entry));
    }
  }
  return Array.from(new Set(artifacts));
}

function parseSectionManifest(indexContent: string): string[] {
  const match = indexContent.match(/<!--\s*SECTION_MANIFEST\n([\s\S]*?)\nEND_MANIFEST\s*-->/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function areAllSectionsPresent(planningDir: string): boolean {
  const indexPath = path.join(planningDir, "sections", "index.md");
  const content = tryRead(indexPath);
  if (!content) return false;
  const manifest = parseSectionManifest(content);
  if (!manifest.length) return false;
  return manifest.every((name) => fs.existsSync(path.join(planningDir, "sections", `${name}.md`)));
}

function detectResumePoint(planningDir: string): number {
  const has = (relativePath: string) => fs.existsSync(path.join(planningDir, relativePath));
  if (!has("analysis.md")) return 2;
  if (!has("passto-research.md")) return 3;
  if (!has("passto-interview.md")) return 5;
  if (!has("passto-spec.md")) return 7;
  if (!has("pre-plan.md")) return 8;
  if (!has("reviews/gpt-5.4-review.md") && !has("reviews/claude-opus-4-6-review.md")) return 9;
  if (!has("passto-integration-notes.md")) return 10;
  if (!has("passto-plan.md")) return 11;
  if (!has("sections/index.md")) return 13;
  if (!areAllSectionsPresent(planningDir)) return 14;
  if (!has("passto-ralph-loop-prompt.md") || !has("passto-ralphy-prd.md")) return 15;
  return 17;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "target";
}

function targetToDir(ctx: ExtensionContext, target: string): string {
  const isUrl = /^https?:\/\//i.test(target);
  if (!isUrl) {
    const resolved = path.resolve(ctx.cwd, target.replace(/^@/, ""));
    if (fs.existsSync(resolved)) {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) return resolved;
      return path.dirname(resolved);
    }
    return path.dirname(resolved);
  }
  const slug = sanitize(target.replace(/^https?:\/\//i, ""));
  return path.join(ctx.cwd, "passto-planner", slug);
}

function buildPrompt(state: PlannerState, step: number): string {
  const stepName = STEP_NAMES[step] ?? "?";
  const skillPath = path.join(__dirname, "SKILL.md");
  const referencesPath = path.join(__dirname, "references");
  return `═══════════════════════════════════════════════════════════════
PASSTO-PLANNER：产品规划工作流
═══════════════════════════════════════════════════════════════
目标：${state.target}
规划目录：${state.planningDir}
步骤：${step}/${TOTAL_STEPS} — ${stepName}

已发现产物：
${state.artifacts.map((a) => `  - ${a}`).join("\n") || "  （无）"}

只允许使用以下定义：
- SKILL: ${skillPath}
- References: ${referencesPath}

严格要求：
- 不要搜索其他同名 skill
- 不要搜索其他外部手册
- 先读取 SKILL.md
- references 是目录；不要直接读取整个 references 目录
- 先确定当前步骤需要哪些 references/*.md，再逐个读取具体文件
- 调用任何 research / review subagent 前，必须先读取 references/subagent-prompt-contracts.md
- Research / Review 阶段必须直接使用官方 Agent(...) / get_subagent_result(...) / steer_subagent(...)
- Execute Research 与 Review 都必须由主模型直接启动并管理 subagents
- 本 workflow 的目标是输出 passto-plan.md，而不是立即实现代码
- 不要跳过 Research Decision / Execute Research / 详细访谈 / Spec Synthesis
- Research 固定分为 3 个方向：
  1. 本地代码仓库研究（若用户已确认无代码，则禁止启动）
  2. 关键环境 / 依赖 / 外部事实限制研究（固定执行）
  3. Web Search 最佳实践研究（固定执行）
- Web Search research 必须按 topic split 成多个 web-search subagents，不能只起一个泛 web-search subagent
- 每个 web topic 对应一个 Agent(subagent_type="Explore")
- Web Search subagents 最多同时并行 2 个，超过 2 个 topic 时分批执行
- 每个 Web Search subagent 必须设置 run_in_background: true
- 每个 Web Search subagent 只使用 turn 阀门：max_turns = 15
- 当 web-search subagent 到达第 13 turn 时，必须调用 steer_subagent(...)，要求其立即总结当前发现、不要继续扩展搜索范围，并在剩余 turn 内完成输出
- 每个 research subagent 完成自己的结果后必须立即停止，禁止继续推进到后续步骤
- product mode 不能只靠 inferred 决定，必须在第一轮访谈中显式询问用户确认
- environment / dependency / external facts 必须在 research decision 中显式处理
- 详细访谈必须使用 references/interview-protocol.md，且优先使用 passto_planner_interview_round(...)
- 除产品模式确认外，其余所有选择型互动一律使用 passto_planner_multiselect(...)
- 必要时可以在多选后追加 passto_planner_prompt(...) 收集补充说明，但不能把选择题退化成空白输入框
- 外部审计后必须先写 passto-integration-notes.md，再进入用户审阅 gate
- 用户审阅计划步骤必须使用 references/review-gate-protocol.md 与 passto_planner_review_gate(...)
- 先产出 pre-plan.md，再进行结构化增强得到 passto-plan.md
- sections/index.md 必须以 SECTION_MANIFEST 开头；编写分段文件前必须先读取 references/section-index.md 与 references/section-splitting.md
- 生成执行文件（Step 15）时：
  - passto-ralph-loop-prompt.md 必须**内联嵌入所有 section-*.md 的完整内容**，不得仅放引用链接
  - passto-ralphy-prd.md 必须按**依赖顺序列出任务清单**，明确每个任务的依赖关系
- 只有当 SECTION_MANIFEST 中列出的全部 section-*.md 都已存在后，才能进入执行文件生成
- 输出必须与分析清单闭环，不能丢用户输入、最终产物、环境输入和运行时状态

完成当前步骤后，调用 passto_planner_next({ planningDir }) 进入下一步。`;
}

function updateUI(ctx: ExtensionContext, planningDir: string): void {
  if (!ctx.hasUI) return;
  const state = loadState(planningDir);
  if (!state) {
    ctx.ui.setStatus("passto-planner", undefined);
    ctx.ui.setWidget("passto-planner", undefined);
    return;
  }
  ctx.ui.setStatus("passto-planner", `🧭 passto-planner · 第 ${state.currentStep}/${TOTAL_STEPS} 步：${STEP_NAMES[state.currentStep] ?? "?"}`);
  ctx.ui.setWidget("passto-planner", undefined);
}

function findPlannerStateDirs(root: string, maxDepth = 4): string[] {
  const results: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === ".passto-planner-state.json") results.push(dir);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return results;
}

export default function (pi: ExtensionAPI) {
  const activePlanningDirs = new Set<string>();

  pi.registerCommand("passto-planner", {
    description: "为需求构想 / 文档 / skill / CLI / script 生成分阶段产品规划与 passto-plan.md",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      const target = args.trim();
      if (!target) {
        ctx.ui.notify("用法：/passto-planner <目标描述 | 本地路径 | URL>", "warning");
        return;
      }
      const planningDir = targetToDir(ctx, target);
      const currentStep = detectResumePoint(planningDir);
      const artifacts = scanArtifacts(planningDir);
      const state: PlannerState = { target, planningDir, currentStep, startedAt: new Date().toISOString(), artifacts };
      saveState(planningDir, state);
      activePlanningDirs.add(planningDir);
      updateUI(ctx, planningDir);
      ctx.ui.notify(`Passto Planner 已启动\n目标：${target}\n目录：${planningDir}\n从第 ${currentStep}/${TOTAL_STEPS} 步开始`, "info");
      pi.sendUserMessage(buildPrompt(state, currentStep), { deliverAs: "steer" });
    },
  });

  pi.registerCommand("passto-planner-stop", {
    description: "停止当前 passto-planner 会话并清理 UI 状态",
    handler: async (args, ctx) => {
      const rest = args.trim();
      let planningDir = rest ? path.resolve(ctx.cwd, rest.replace(/^@/, "").trim()) : "";
      if (!planningDir) {
        if (activePlanningDirs.size === 1) planningDir = [...activePlanningDirs][0];
        else {
          const found = findPlannerStateDirs(ctx.cwd);
          if (found.length === 1) planningDir = found[0];
        }
      }
      if (!planningDir) {
        ctx.ui.notify("未找到唯一的 passto-planner 活跃会话。", "warning");
        return;
      }
      removeState(planningDir);
      activePlanningDirs.delete(planningDir);
      updateUI(ctx, planningDir);
      ctx.ui.notify(`已停止 passto-planner：${planningDir}`, "info");
    },
  });

  pi.registerTool({
    name: "passto_planner_start",
    label: "启动 Passto Planner",
    description: "初始化或恢复 passto-planner 产品规划会话。",
    parameters: Type.Object({
      target: Type.String({ description: "Local path or URL to the planning target" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const planningDir = targetToDir(ctx, params.target);
      const currentStep = detectResumePoint(planningDir);
      const artifacts = scanArtifacts(planningDir);
      const state: PlannerState = { target: params.target, planningDir, currentStep, startedAt: new Date().toISOString(), artifacts };
      saveState(planningDir, state);
      activePlanningDirs.add(planningDir);
      updateUI(ctx, planningDir);
      return { content: [{ type: "text", text: `已启动 passto-planner\n目标：${params.target}\n目录：${planningDir}\n从第 ${currentStep}/${TOTAL_STEPS} 步开始` }], details: { planningDir, currentStep, artifacts } };
    },
  });

  pi.registerTool({
    name: "passto_planner_next",
    label: "推进 Passto Planner 步骤",
    description: "推进到下一个 passto-planner 规划步骤。",
    parameters: Type.Object({
      planningDir: Type.String({ description: "Absolute path to the planning directory" }),
      stepSummary: Type.Optional(Type.String({ description: "Summary of completed work" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "未找到活跃的 passto-planner 会话。" }], details: {} };
      if (state.currentStep >= TOTAL_STEPS) return { content: [{ type: "text", text: "所有步骤已完成。" }], details: { done: true } };
      state.currentStep += 1;
      state.artifacts = scanArtifacts(params.planningDir);
      saveState(params.planningDir, state);
      updateUI(ctx, params.planningDir);
      pi.sendUserMessage(`${buildPrompt(state, state.currentStep)}\n\n上一步完成：${params.stepSummary ?? "✓"}`, { deliverAs: "steer" });
      return { content: [{ type: "text", text: `已推进到第 ${state.currentStep}/${TOTAL_STEPS} 步。` }], details: { currentStep: state.currentStep } };
    },
  });

  pi.registerTool({
    name: "passto_planner_back",
    label: "返回 Passto Planner 步骤",
    description: "回到上一步或指定步骤，以便重做或修改当前规划。",
    parameters: Type.Object({
      planningDir: Type.String({ description: "Absolute path to the planning directory" }),
      step: Type.Optional(Type.Number({ description: "Optional step number to rewind to" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "未找到活跃的 passto-planner 会话。" }], details: {} };
      const requested = typeof params.step === "number" ? Math.floor(params.step) : state.currentStep - 1;
      const nextStep = Math.max(2, Math.min(requested, state.currentStep - 1));
      state.currentStep = nextStep;
      state.artifacts = scanArtifacts(params.planningDir);
      saveState(params.planningDir, state);
      updateUI(ctx, params.planningDir);
      pi.sendUserMessage(`${buildPrompt(state, state.currentStep)}\n\n已回退到第 ${state.currentStep} 步，请在当前步骤中修改并重新执行。`, { deliverAs: "steer" });
      return { content: [{ type: "text", text: `已回退到第 ${state.currentStep}/${TOTAL_STEPS} 步。` }], details: { currentStep: state.currentStep } };
    },
  });

  pi.registerTool({
    name: "passto_planner_status",
    label: "Passto Planner 状态",
    description: "检查当前活跃的 passto-planner 规划会话状态。",
    parameters: Type.Object({ planningDir: Type.String({ description: "Absolute path to the planning directory" }) }),
    async execute(_id, params) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "未找到活跃状态。" }], details: {} };
      return {
        content: [{ type: "text", text: `目标：${state.target}\n目录：${state.planningDir}\n步骤：${state.currentStep}/${TOTAL_STEPS} — ${STEP_NAMES[state.currentStep] ?? "?"}\n产物：${state.artifacts.join(", ") || "（无）"}` }],
        details: state,
      };
    },
  });

  pi.registerTool({
    name: "passto_planner_fetch_target",
    label: "读取规划目标",
    description: "读取本地路径或 URL 指向的目标内容，返回给主上下文用于分析。",
    parameters: Type.Object({
      target: Type.String({ description: "Local path or URL to the planning target" }),
    }),
    async execute(_id, params) {
      const target = params.target.trim();
      const isUrl = /^https?:\/\//i.test(target);
      if (isUrl) {
        return {
          content: [{ type: "text", text: `URL 目标：${target}\n\n请使用联网能力读取该 URL 的入口内容，并把提取结果整理进 analysis.md。` }],
          details: { target, kind: "url", fetchRequired: true },
        };
      }
      const resolved = path.resolve(target.replace(/^@/, ""));
      if (!fs.existsSync(resolved)) {
        return { content: [{ type: "text", text: `未找到本地目标：${resolved}` }], details: { target, kind: "local", exists: false } };
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(resolved).slice(0, 200);
        return {
          content: [{ type: "text", text: `本地目录目标：${resolved}\n\n目录项：\n${entries.map((e) => `- ${e}`).join("\n")}` }],
          details: { target: resolved, kind: "directory", entries },
        };
      }
      const content = tryRead(resolved) ?? "";
      return {
        content: [{ type: "text", text: `本地文件目标：${resolved}\n\n${content.slice(0, 12000)}` }],
        details: { target: resolved, kind: "file", content },
      };
    },
  });

  pi.registerTool({
    name: "passto_planner_scaffold",
    label: "生成规划骨架文件",
    description: "在规划目录生成 analysis / passto-research / passto-interview / passto-spec / pre-plan / passto-plan 的初始模板。",
    parameters: Type.Object({
      planningDir: Type.String({ description: "Absolute path to the planning directory" }),
      force: Type.Optional(Type.Boolean({ description: "Overwrite existing scaffold files when true" })),
    }),
    async execute(_id, params) {
      const files = [
        ["analysis.md", ANALYSIS_TEMPLATE],
        ["passto-research.md", "# Passto Research\n\n[COLLECT: codebase / web / workflow / environment / external facts research]\n"],
        ["passto-interview.md", "# Passto Interview\n\n[RECORD: detailed interview transcript based on spec + research]\n"],
        ["passto-spec.md", "# Passto Spec\n\n[SYNTHESIZE: raw spec + research + interview]\n"],
        ["pre-plan.md", "# Pre-Plan\n\n[DRAFT: first complete plan before structural enhancement]\n"],
        ["passto-integration-notes.md", "# Passto Integration Notes\n\n[RECORD: which review findings were accepted or rejected, and why]\n"],
        ["passto-plan.md", PLAN_TEMPLATE],
        ["reviews/gpt-5.4-review.md", "# GPT-5.4 Review\n\n[EXTERNAL REVIEW OUTPUT]\n"],
        ["reviews/claude-opus-4-6-review.md", "# Claude Opus 4.6 Review\n\n[EXTERNAL REVIEW OUTPUT]\n"],
        ["sections/index.md", "<!-- SECTION_MANIFEST\nsection-01-foundation\nEND_MANIFEST -->\n\n# 实施分段索引\n\n[DEFINE: dependencies, order, section summaries]\n"],
        ["passto-ralph-loop-prompt.md", `# Ralph 循环开发提示

## 任务目标
你是一个资深全栈工程师。请按照以下分段计划实施代码开发。

## 规则
1. **严格遵循依赖顺序**：只有当前面所有依赖 section 完成后，才能开始当前 section。
2. **完全自包含**：每个 section 的内容已经完整提供，不需要阅读其他文件。
3. **逐步验证**：每完成一个 section，运行验收标准确认通过后再继续。

---

{在此处按顺序内联嵌入 sections/ 目录下所有 section-*.md 的完整内容}
`],
        ["passto-ralphy-prd.md", `# 产品需求文档 (PRD)

## 项目概览
[简述项目目标]

## 开发任务清单
请按以下顺序依次执行开发任务：

### 任务 1: section-01-<name>
- 文件: sections/section-01-<name>.md
- 依赖: 无

### 任务 2: section-02-<name>
- 文件: sections/section-02-<name>.md
- 依赖: section-01

... (依此类推，列出所有 section 及其依赖)

## 验收标准
所有 section 完成后，需满足:
- [ ] 整体功能闭环
- [ ] 通过所有测试用例
- [ ] 符合 passto-plan.md 中的架构约束
`],
      ] as const;
      const created: string[] = [];
      const overwritten: string[] = [];
      const skipped: string[] = [];
      const force = params.force === true;
      for (const [name, content] of files) {
        const fp = path.join(params.planningDir, name);
        const exists = fs.existsSync(fp);
        if (!exists) {
          ensureDir(fp);
          fs.writeFileSync(fp, content, "utf-8");
          created.push(name);
          continue;
        }
        if (force) {
          fs.writeFileSync(fp, content, "utf-8");
          overwritten.push(name);
        } else {
          skipped.push(name);
        }
      }
      const parts: string[] = [];
      if (created.length) parts.push(`已创建：${created.join(", ")}`);
      if (overwritten.length) parts.push(`已覆盖：${overwritten.join(", ")}`);
      if (skipped.length) parts.push(`已跳过：${skipped.join(", ")}`);
      return {
        content: [{ type: "text", text: parts.length ? parts.join("\n") : "没有可处理的骨架文件。" }],
        details: { created, overwritten, skipped, force },
      };
    },
  });

  pi.registerTool({
    name: "passto_planner_select",
    label: "Passto Planner 选择",
    description: "在 passto-planner 工作流中让用户从选项列表中选择一项。",
    parameters: Type.Object({
      title: Type.String({ description: "Dialog title" }),
      options: Type.Array(Type.String({ description: "Selectable option" }), { description: "List of options" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "Interactive UI required." }], details: {} };
      const choice = await ctx.ui.select(params.title, params.options);
      return { content: [{ type: "text", text: choice ? `已选择：${choice}` : "已取消选择。" }], details: { choice: choice ?? null } };
    },
  });

  pi.registerTool({
    name: "passto_planner_multiselect",
    label: "Passto Planner 多选",
    description: "在 passto-planner 工作流中让用户从多个选项中选择若干项，并可手动补充其他项；手动输入支持用 | 分隔多项。",
    parameters: Type.Object({
      title: Type.String({ description: "Dialog title" }),
      options: Type.Array(Type.String({ description: "Selectable option" }), { description: "List of options" }),
      allowOther: Type.Optional(Type.Boolean({ description: "Whether to allow a custom option" })),
      otherPrompt: Type.Optional(Type.String({ description: "Prompt shown when custom option is selected" })),
      placeholder: Type.Optional(Type.String({ description: "Placeholder for custom option input" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "Interactive UI required." }], details: {} };
      const selected = new Set<string>();
      let customOther: string | null = null;
      const normalizedOptions = params.allowOther ? params.options.filter((opt: string) => !/^其他(?:（.*?）)?$/.test(opt.trim())) : [...params.options];
      while (true) {
        const title = `${params.title}\n\n当前已选：${selected.size ? Array.from(selected).join("、") : "（暂无）"}`;
        const rendered = normalizedOptions.map((opt: string) => `${selected.has(opt) ? "[x]" : "[ ]"} ${opt}`);
        const otherLabel = customOther ? `其他（手动输入）：${customOther}` : "其他（手动输入）";
        const renderedOther = params.allowOther ? `${customOther ? "[x]" : "[ ]"} ${otherLabel}` : null;
        const action = selected.size ? "完成选择" : "跳过";
        const options = params.allowOther && renderedOther ? [...rendered, renderedOther, action] : [...rendered, action];
        const choice = await ctx.ui.select(title, options);
        if (!choice || choice === action) break;
        const raw = choice.replace(/^\[(?: |x)\]\s*/, "");
        if (params.allowOther && raw.startsWith("其他（手动输入）")) {
          const value = await ctx.ui.input(params.otherPrompt ?? params.title, params.placeholder ?? customOther ?? "");
          if (!value) continue;
          if (customOther) {
            for (const part of customOther.split("|").map((s) => s.trim()).filter(Boolean)) selected.delete(part);
          }
          customOther = value;
          for (const part of value.split("|").map((s) => s.trim()).filter(Boolean)) selected.add(part);
          continue;
        }
        if (selected.has(raw)) selected.delete(raw); else selected.add(raw);
      }
      const choices = Array.from(selected);
      return { content: [{ type: "text", text: choices.length ? `已选择：${choices.join("、")}` : "未选择任何项。" }], details: { choices, customOther } };
    },
  });

  pi.registerTool({
    name: "passto_planner_question",
    label: "Passto Planner 结构化问题",
    description: "在 passto-planner 工作流中向用户提出带选项的问题，并支持其他输入。",
    parameters: Type.Object({
      title: Type.String({ description: "Question title" }),
      options: Type.Array(Type.String({ description: "Selectable option" }), { description: "List of options" }),
      allowOther: Type.Optional(Type.Boolean({ description: "Whether to allow a custom answer" })),
      otherPrompt: Type.Optional(Type.String({ description: "Prompt shown when custom answer is selected" })),
      placeholder: Type.Optional(Type.String({ description: "Placeholder for custom answer input" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "Interactive UI required." }], details: {} };
      const normalizedOptions = params.allowOther ? params.options.filter((opt: string) => !/^其他(?:（.*?）)?$/.test(opt.trim())) : [...params.options];
      const options = params.allowOther ? [...normalizedOptions, "其他（手动输入）"] : normalizedOptions;
      const choice = await ctx.ui.select(params.title, options);
      if (!choice) return { content: [{ type: "text", text: "已取消选择。" }], details: { choice: null } };
      if (choice === "其他（手动输入）") {
        const value = await ctx.ui.input(params.otherPrompt ?? params.title, params.placeholder ?? "");
        return { content: [{ type: "text", text: value ? `已输入：${value}` : "已取消输入。" }], details: { choice: value ?? null, usedOther: true } };
      }
      return { content: [{ type: "text", text: `已选择：${choice}` }], details: { choice, usedOther: false } };
    },
  });

  pi.registerTool({
    name: "passto_planner_prompt",
    label: "Passto Planner 输入",
    description: "在 passto-planner 工作流中向用户请求文本输入。",
    parameters: Type.Object({
      title: Type.String({ description: "Dialog title" }),
      placeholder: Type.Optional(Type.String({ description: "Optional placeholder text" })),
      prefill: Type.Optional(Type.String({ description: "Optional prefilled text" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "Interactive UI required." }], details: {} };
      const value = await ctx.ui.input(params.title, params.placeholder ?? params.prefill ?? "");
      return { content: [{ type: "text", text: value !== undefined ? "已收到输入。" : "已取消输入。" }], details: { value: value ?? null } };
    },
  });

  pi.registerTool({
    name: "passto_planner_confirm",
    label: "Passto Planner 确认",
    description: "在 passto-planner 工作流中向用户请求确认。",
    parameters: Type.Object({
      title: Type.String({ description: "Dialog title" }),
      message: Type.String({ description: "Confirmation message" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "Interactive UI required." }], details: {} };
      const confirmed = await ctx.ui.confirm(params.title, params.message);
      return { content: [{ type: "text", text: confirmed ? "已确认。" : "已取消。" }], details: { confirmed } };
    },
  });

  pi.registerTool({
    name: "passto_planner_interview_round",
    label: "Passto Planner 访谈轮次",
    description: "一次呈现多道访谈问题，允许在题目之间切换并回改答案。",
    parameters: Type.Object({
      title: Type.String({ description: "Round title" }),
      questions: Type.Array(Type.Object({
        id: Type.String({ description: "Stable question id" }),
        prompt: Type.String({ description: "Question text" }),
        options: Type.Optional(Type.Array(Type.String({ description: "Selectable option" }))),
        allowOther: Type.Optional(Type.Boolean({ description: "Whether custom answer is allowed" })),
        otherPrompt: Type.Optional(Type.String({ description: "Prompt for custom answer" })),
        placeholder: Type.Optional(Type.String({ description: "Placeholder for freeform answer" })),
      }), { description: "Questions for this round" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "Interactive UI required." }], details: {} };
      const answers = new Map<string, string[]>();
      let index = 0;
      const summarize = (values?: string[]) => values && values.length ? values.join("、") : "（未回答）";
      while (true) {
        const q = params.questions[index];
        const current = answers.get(q.id) ?? [];
        const title = `${params.title}\n\n问题 ${index + 1}/${params.questions.length}\n${q.prompt}\n\n当前答案：${summarize(current)}`;
        const actions = [
          current.length ? "编辑当前答案" : "回答当前问题",
          ...(index < params.questions.length - 1 ? ["下一题"] : []),
          ...(index > 0 ? ["上一题"] : []),
          ...(params.questions.every((item) => (answers.get(item.id) ?? []).length > 0) ? ["完成本轮"] : []),
        ];
        const choice = await ctx.ui.select(title, actions);
        if (!choice) return { content: [{ type: "text", text: "已取消访谈轮次。" }], details: { answers: Object.fromEntries(answers) } };
        if (choice === "上一题") { index -= 1; continue; }
        if (choice === "下一题") { index += 1; continue; }
        if (choice === "完成本轮") break;
        if (q.options?.length) {
          const normalizedOptions = (q.options ?? []).filter((opt) => !(q.allowOther && /^其他(?:（.*?）)?$/.test(opt.trim())));
          const selected = new Set<string>(current.filter((v) => normalizedOptions.includes(v)));
          let customValue = current.find((v) => !normalizedOptions.includes(v)) ?? "";
          while (true) {
            const innerTitle = `${q.prompt}\n\n当前答案：${summarize(Array.from(selected).concat(customValue ? [customValue] : []))}`;
            const rendered = normalizedOptions.map((opt) => `${selected.has(opt) ? "[x]" : "[ ]"} ${opt}`);
            if (q.allowOther) rendered.push(`${customValue ? "[x]" : "[ ]"} 其他（手动输入）${customValue ? `：${customValue}` : ""}`);
            const doneLabel = selected.size > 0 || customValue ? "保存当前答案" : "暂不作答";
            const pick = await ctx.ui.select(innerTitle, [...rendered, doneLabel]);
            if (!pick || pick === doneLabel) {
              const result = [...Array.from(selected), ...(customValue ? customValue.split("|").map((s) => s.trim()).filter(Boolean) : [])];
              answers.set(q.id, result);
              break;
            }
            const raw = pick.replace(/^\[(?: |x)\]\s*/, "");
            if (raw.startsWith("其他（手动输入）")) {
              const input = await ctx.ui.input(q.otherPrompt ?? q.prompt, customValue || q.placeholder || "");
              customValue = input?.trim() ?? "";
              continue;
            }
            if (selected.has(raw)) selected.delete(raw); else selected.add(raw);
          }
        } else {
          const input = await ctx.ui.input(q.prompt, current[0] ?? q.placeholder ?? "");
          const normalized = input?.trim() ?? "";
          answers.set(q.id, normalized ? [normalized] : []);
        }
      }
      const result = Object.fromEntries(params.questions.map((q) => [q.id, answers.get(q.id) ?? []]));
      const transcript = params.questions.map((q, i) => {
        const values = result[q.id] ?? [];
        return `Q${i + 1}. ${q.prompt}\nA${i + 1}. ${values.length ? values.join("；") : "（未回答）"}`;
      }).join("\n\n");
      return { content: [{ type: "text", text: `已完成访谈轮次。\n\n${transcript}` }], details: { answers: result, transcript } };
    },
  });

  pi.registerTool({
    name: "passto_planner_review_gate",
    label: "Passto Planner 审阅门控",
    description: "在继续后续步骤前，等待用户完成对计划的人工审阅或手动编辑。",
    parameters: Type.Object({
      title: Type.String({ description: "Dialog title" }),
      message: Type.String({ description: "Review guidance message" }),
      filePath: Type.Optional(Type.String({ description: "Optional plan file path to mention" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "Interactive UI required." }], details: {} };
      while (true) {
        const choice = await ctx.ui.select(params.title, ["我将直接修改 MD，请等待", "审阅通过，继续"]);
        if (!choice) return { content: [{ type: "text", text: "已取消审阅确认。" }], details: { approved: false } };
        if (choice === "审阅通过，继续") {
          return { content: [{ type: "text", text: "审阅通过，继续后续步骤。" }], details: { approved: true, edited: false } };
        }
        const fileHint = params.filePath ? `\n\n请自行修改：${params.filePath}` : "";
        ctx.ui.notify(`${params.message}${fileHint}`, "info");
        await ctx.ui.select(params.title, ["已完成修改，继续"]);
        return { content: [{ type: "text", text: `用户已完成手动修改${params.filePath ? `：${params.filePath}` : ""}，继续后续步骤。` }], details: { approved: true, edited: true } };
      }
    },
  });

  pi.registerTool({
    name: "passto_planner_done",
    label: "完成 Passto Planner",
    description: "完成 passto-planner 会话并清理状态。",
    parameters: Type.Object({ planningDir: Type.String({ description: "Absolute path to the planning directory" }) }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const state = loadState(params.planningDir);
      removeState(params.planningDir);
      activePlanningDirs.delete(params.planningDir);
      updateUI(ctx, params.planningDir);
      return { content: [{ type: "text", text: `passto-planner 已完成。产物目录：${params.planningDir}` }], details: { planningDir: params.planningDir, artifacts: state?.artifacts ?? scanArtifacts(params.planningDir) } };
    },
  });

  pi.registerTool({
    name: "run_planner_task",
    label: "Run Planner Task",
    description: "Run the Phase 1A passto-planner scaffold entry point and return planner result plus handoff data.",
    parameters: Type.Object({
      goal: Type.String({ description: "Planner goal" }),
      cwd: Type.String({ description: "Working directory for the planner task" }),
      constraints: Type.Optional(Type.Array(Type.String({ description: "Planner constraint" }))),
      expectedOutputs: Type.Optional(Type.Array(Type.String({ description: "Expected planner output" }))),
      todolist: Type.Optional(Type.Array(Type.String({ description: "Planner task step" }))),
      stage: Type.Optional(Type.String({ description: "Planner stage label" })),
    }),
    async execute(_id, params) {
      const response = await runPlannerTask(params);
      return {
        content: [{ type: "text", text: response.result.resultSummary }],
        details: response,
      };
    },
  });
}

// Phase 1A: Planner core scaffold exports
export * from "./planner/contracts.ts";
export * from "./planner/planning-types.ts";
export * from "./planner/input.ts";
export * from "./planner/state.ts";
export * from "./planner/result.ts";
export * from "./planner/handoff.ts";
export * from "./tools/run-planner-task.ts";
