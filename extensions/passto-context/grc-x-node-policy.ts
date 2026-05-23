import type { XNode, XNodeModelDocument, XNodePolicyProjection } from "./types.ts";

const CONFIDENCE_SCORE: Record<XNodePolicyProjection["dimensions"]["why"], number> = {
  open: 0.2,
  partial: 0.6,
  closed: 1,
};

export function deriveXNodePolicyProjection(xNodeModel: XNodeModelDocument | null): XNodePolicyProjection | null {
  if (!xNodeModel || xNodeModel.nodes.length === 0) return null;

  const focusNode = selectCurrentXNode(xNodeModel);
  if (!focusNode) return null;

  const dimensions = {
    why: focusNode.why.confidence,
    what: focusNode.what.confidence,
    flow: focusNode.flow.confidence,
    structure: focusNode.structure.confidence,
    runtimeProof: focusNode.runtimeProof.confidence,
  };
  const keyGaps = buildKeyGaps(focusNode, dimensions);
  const nextStepType = deriveNextStepType(focusNode, dimensions);

  return {
    xNodeId: focusNode.id,
    derivedAtRound: xNodeModel.agentRound,
    dimensions,
    keyGaps,
    nextStepType,
    confidence: deriveProjectionConfidence(dimensions),
    guidance: buildPolicyGuidance(nextStepType),
  };
}

export function selectCurrentXNode(xNodeModel: XNodeModelDocument | null): XNode | null {
  if (!xNodeModel || xNodeModel.nodes.length === 0) return null;

  if (xNodeModel.currentFocusXNodeId) {
    return xNodeModel.nodes.find((node) => node.id === xNodeModel.currentFocusXNodeId) ?? xNodeModel.nodes[0] ?? null;
  }

  return xNodeModel.nodes.find((node) => node.status !== "completed") ?? xNodeModel.nodes[0] ?? null;
}

function buildKeyGaps(
  focusNode: XNode,
  dimensions: XNodePolicyProjection["dimensions"],
): string[] {
  const entries: Array<[keyof XNodePolicyProjection["dimensions"], XNode["why"]]> = [
    ["why", focusNode.why],
    ["what", focusNode.what],
    ["flow", focusNode.flow],
    ["structure", focusNode.structure],
    ["runtimeProof", focusNode.runtimeProof],
  ];

  return entries
    .filter(([dimension]) => dimensions[dimension] !== "closed")
    .map(([dimension, facet]) => `${dimension}: ${facet.summary}`);
}

function deriveNextStepType(
  focusNode: XNode,
  dimensions: XNodePolicyProjection["dimensions"],
): XNodePolicyProjection["nextStepType"] {
  if (focusNode.status === "completed" || focusNode.phase === "complete") {
    return "upward_regression";
  }

  if (focusNode.phase === "pending_acceptance") {
    return "seek_acceptance";
  }

  if (focusNode.atomicity === "composite") {
    return "generate_children";
  }

  if (focusNode.phase === "plan" || focusNode.phase === "plan_insufficient") {
    if (dimensions.why !== "closed" || dimensions.what !== "closed" || dimensions.flow !== "closed" || dimensions.structure !== "closed") {
      return "plan_repair";
    }
    return "execute_atomic_work";
  }

  if (
    dimensions.why === "open"
    || dimensions.what === "open"
    || dimensions.flow === "open"
    || dimensions.structure === "open"
  ) {
    return "plan_repair";
  }

  if (focusNode.phase === "testing" || dimensions.runtimeProof !== "closed") {
    return "run_tests";
  }

  return "execute_atomic_work";
}

function deriveProjectionConfidence(dimensions: XNodePolicyProjection["dimensions"]): number {
  const values = Object.values(dimensions);
  const total = values.reduce((sum, item) => sum + CONFIDENCE_SCORE[item], 0);
  return Number((total / values.length).toFixed(2));
}

function buildPolicyGuidance(nextStepType: XNodePolicyProjection["nextStepType"]): string[] {
  switch (nextStepType) {
    case "plan_repair":
      return [
        "先做 direct-answer gate：若用户目的是简单高确定性请求，且无需项目上下文、多步决策、状态写入或 runtime proof，则直接回答，不展开递归 xNodeModel。",
        "否则进入目标确定性提升层（plan-certainty-improvement 节点）：把 why/what/flow/structure/runtimeProof 缺口转成 ContextParameterRequest，再获取最小必要信息参数。",
        "若多个确定性缺口互不依赖，优先并行调用 subagent / provider 获取参数；主 agent 汇合后统一生成 CertaintyAssessment、XNodeModelPatch 与 RuntimeProofRecord。",
        "不要在顶层穷举固定 tools/skills；工具、skills、subagent 都只是参数提供者或方法提供者。",
        "先核对 truth source、完成定义与关键约束，不要在缺口未闭合前继续扩写代码。",
      ];
    case "generate_children":
      return [
        "当前焦点更像 composite；先拆出子目标/检查项，再推进具体实现。",
        "若已有 children，优先推进未完成 child，而不是把父目标直接当成单个实现任务。",
      ];
    case "execute_atomic_work":
      return [
        "将当前焦点视为 bounded atomic task，优先完成一个最小完整切片。",
        "只改完成该 atomic 产物所必需的文件，并立刻补最小验证。",
      ];
    case "run_tests":
      return [
        "本轮主动作优先视为测试/验证/回归，而不是继续扩写实现。",
        "先运行最小相关测试、构建或 runtime proof；只做让验证通过所需的最小修复。",
      ];
    case "seek_acceptance":
      return [
        "当前焦点优先进入验收/确认，而不是新增实现范围。",
        "先整理完成状态、验证证据与剩余风险，必要时请求用户确认或验收。",
      ];
    case "upward_regression":
      return [
        "先把注意力从局部完成项抬升到 parent / sibling，检查父层吸收条件。",
        "不要把 local complete 直接当成 parent complete，也不要继续深挖已完成局部。",
      ];
  }
}
