import type {
  RuntimeProofRecord,
  RuntimeProofSignal,
  UserGoalNode,
  UserGoalTreeDocument,
  XNode,
  XNodeFacet,
  XNodeModelDocument,
  XNodePolicyProjection,
} from "./types.ts";

export type PlanCertaintyFacet = "why" | "what" | "flow" | "structure" | "runtimeProof";
export type PlanCertaintyExpectedShape = "facts" | "decisions" | "constraints" | "unknowns" | "evidence" | "mixed";

export interface PlanCertaintyContextRequest {
  targetUserGoalId?: string | null;
  targetXNodeId?: string | null;
  targetFacet: PlanCertaintyFacet;
  blockingQuestion: string;
  requiredParameter: string;
  expectedShape?: PlanCertaintyExpectedShape;
  preferredProviderType?: string;
  reason?: string;
}

export interface PlanCertaintyContextPacket {
  request: PlanCertaintyContextRequest;
  targetUserGoal: {
    id: string;
    assertion: string;
    executionState?: string;
    reviewState?: string;
  } | null;
  targetXNode: {
    id: string;
    assertion: string;
    phase: string;
    atomicity: string;
    facetStatus: Record<PlanCertaintyFacet, XNodeFacet["confidence"]>;
  } | null;
  policyProjection: XNodePolicyProjection | null;
  latestRuntimeProof: RuntimeProofRecord | null;
  proofSignals: RuntimeProofSignal[];
  facts: string[];
  decisions: string[];
  constraints: string[];
  unknowns: string[];
  evidence: string[];
}

export interface CollectPlanCertaintyContextInput {
  request: PlanCertaintyContextRequest;
  userGoalTree?: UserGoalTreeDocument | null;
  xNodeModels?: XNodeModelDocument[] | null;
  latestPolicyProjection?: XNodePolicyProjection | null;
  latestRuntimeProof?: RuntimeProofRecord | null;
  latestProofSignals?: RuntimeProofSignal[] | null;
}

export function collectPlanCertaintyContext(input: CollectPlanCertaintyContextInput): PlanCertaintyContextPacket {
  const userGoal = selectUserGoal(input.userGoalTree ?? null, input.request.targetUserGoalId ?? null);
  const model = selectXNodeModel(input.xNodeModels ?? [], userGoal?.id ?? input.request.targetUserGoalId ?? null, input.request.targetXNodeId ?? null);
  const xNode = selectXNode(model, input.request.targetXNodeId ?? null);
  const policyProjection = model?.latestPolicyProjection ?? input.latestPolicyProjection ?? null;
  const latestRuntimeProof = model?.latestRuntimeProof ?? input.latestRuntimeProof ?? null;
  const proofSignals = model?.latestProofSignals ?? input.latestProofSignals ?? [];

  const unknowns = buildUnknowns(input.request, userGoal, xNode);
  const evidence = buildEvidence(input.request, userGoal, xNode, model, latestRuntimeProof, proofSignals);

  return {
    request: input.request,
    targetUserGoal: userGoal ? summarizeUserGoal(userGoal) : null,
    targetXNode: xNode ? summarizeXNode(xNode) : null,
    policyProjection,
    latestRuntimeProof,
    proofSignals: [...proofSignals],
    facts: buildFacts(input.request, userGoal, xNode, policyProjection, latestRuntimeProof, proofSignals),
    decisions: buildDecisions(policyProjection),
    constraints: buildConstraints(input.request),
    unknowns,
    evidence,
  };
}

export function mergePlanCertaintyContextPackets(
  request: PlanCertaintyContextRequest,
  packets: readonly PlanCertaintyContextPacket[],
): PlanCertaintyContextPacket {
  const targetUserGoal = packets.find((packet) => packet.targetUserGoal)?.targetUserGoal ?? null;
  const targetXNode = packets.find((packet) => packet.targetXNode)?.targetXNode ?? null;
  const policyProjection = packets.find((packet) => packet.policyProjection)?.policyProjection ?? null;
  const latestRuntimeProof = packets.find((packet) => packet.latestRuntimeProof)?.latestRuntimeProof ?? null;
  const proofSignals = dedupeBy(packets.flatMap((packet) => packet.proofSignals), (signal) => signal.id);

  return {
    request,
    targetUserGoal,
    targetXNode,
    policyProjection,
    latestRuntimeProof,
    proofSignals,
    facts: dedupeStrings(packets.flatMap((packet) => packet.facts)),
    decisions: dedupeStrings(packets.flatMap((packet) => packet.decisions)),
    constraints: dedupeStrings([
      "merged packet preserves source packets and does not decide exit state",
      ...packets.flatMap((packet) => packet.constraints),
    ]),
    unknowns: dedupeStrings(packets.flatMap((packet) => packet.unknowns)),
    evidence: dedupeStrings([
      `merged ${packets.length} plan-certainty context packet(s)`,
      ...packets.flatMap((packet) => packet.evidence),
    ]),
  };
}

function selectUserGoal(userGoalTree: UserGoalTreeDocument | null, targetUserGoalId: string | null): UserGoalNode | null {
  if (!userGoalTree) return null;

  if (targetUserGoalId) {
    return userGoalTree.userGoals.find((goal) => goal.id === targetUserGoalId) ?? null;
  }

  if (userGoalTree.currentFocusUserGoalId) {
    return userGoalTree.userGoals.find((goal) => goal.id === userGoalTree.currentFocusUserGoalId) ?? null;
  }

  return userGoalTree.userGoals.find((goal) => goal.status !== "completed") ?? userGoalTree.userGoals[0] ?? null;
}

function selectXNodeModel(
  xNodeModels: readonly XNodeModelDocument[],
  targetUserGoalId: string | null,
  targetXNodeId: string | null,
): XNodeModelDocument | null {
  if (targetUserGoalId) {
    const byGoal = xNodeModels.find((model) => model.userGoalId === targetUserGoalId);
    if (byGoal) return byGoal;
  }

  if (targetXNodeId) {
    const byNode = xNodeModels.find((model) => model.nodes.some((node) => node.id === targetXNodeId));
    if (byNode) return byNode;
  }

  return xNodeModels[0] ?? null;
}

function selectXNode(model: XNodeModelDocument | null, targetXNodeId: string | null): XNode | null {
  if (!model) return null;

  if (targetXNodeId) {
    return model.nodes.find((node) => node.id === targetXNodeId) ?? null;
  }

  if (model.currentFocusXNodeId) {
    return model.nodes.find((node) => node.id === model.currentFocusXNodeId) ?? model.nodes[0] ?? null;
  }

  return model.nodes.find((node) => node.status !== "completed") ?? model.nodes[0] ?? null;
}

function summarizeUserGoal(userGoal: UserGoalNode): PlanCertaintyContextPacket["targetUserGoal"] {
  return {
    id: userGoal.id,
    assertion: userGoal.assertion,
    executionState: userGoal.executionState,
    reviewState: userGoal.reviewState,
  };
}

function summarizeXNode(xNode: XNode): NonNullable<PlanCertaintyContextPacket["targetXNode"]> {
  return {
    id: xNode.id,
    assertion: xNode.assertion,
    phase: xNode.phase,
    atomicity: xNode.atomicity,
    facetStatus: {
      why: xNode.why.confidence,
      what: xNode.what.confidence,
      flow: xNode.flow.confidence,
      structure: xNode.structure.confidence,
      runtimeProof: xNode.runtimeProof.confidence,
    },
  };
}

function buildFacts(
  request: PlanCertaintyContextRequest,
  userGoal: UserGoalNode | null,
  xNode: XNode | null,
  policyProjection: XNodePolicyProjection | null,
  latestRuntimeProof: RuntimeProofRecord | null,
  proofSignals: readonly RuntimeProofSignal[],
): string[] {
  return [
    userGoal ? `targetUserGoal=${userGoal.id}: ${userGoal.assertion}` : null,
    userGoal?.executionState ? `targetUserGoal.executionState=${userGoal.executionState}` : null,
    xNode ? `targetXNode=${xNode.id}: ${xNode.assertion}` : null,
    xNode ? `targetFacet.${request.targetFacet}.confidence=${xNode[request.targetFacet].confidence}` : null,
    xNode ? `targetFacet.${request.targetFacet}.summary=${xNode[request.targetFacet].summary}` : null,
    policyProjection ? `policyProjection.nextStepType=${policyProjection.nextStepType}` : null,
    latestRuntimeProof ? `latestRuntimeProof.proofStatus=${latestRuntimeProof.proofStatus}` : null,
    proofSignals.length > 0 ? `proofSignals.count=${proofSignals.length}` : null,
  ].filter(isString);
}

function buildDecisions(policyProjection: XNodePolicyProjection | null): string[] {
  if (!policyProjection) return [];
  return [
    `policy guidance recommends ${policyProjection.nextStepType}`,
    ...policyProjection.guidance.map((guidance) => `policy guidance: ${guidance}`),
  ];
}

function buildConstraints(request: PlanCertaintyContextRequest): string[] {
  return [
    "provider only assembles context parameters; it must not modify object state",
    "provider does not decide whether to exit plan-certainty-improvement",
    `expectedShape=${request.expectedShape ?? "mixed"}`,
    request.preferredProviderType ? `preferredProviderType=${request.preferredProviderType}` : null,
  ].filter(isString);
}

function buildUnknowns(
  request: PlanCertaintyContextRequest,
  userGoal: UserGoalNode | null,
  xNode: XNode | null,
): string[] {
  return [
    userGoal ? null : `target userGoal not found: ${request.targetUserGoalId ?? "<focus>"}`,
    xNode ? null : `target xNode not found: ${request.targetXNodeId ?? "<focus>"}`,
    request.blockingQuestion ? null : "blockingQuestion is empty",
    request.requiredParameter ? null : "requiredParameter is empty",
  ].filter(isString);
}

function buildEvidence(
  request: PlanCertaintyContextRequest,
  userGoal: UserGoalNode | null,
  xNode: XNode | null,
  model: XNodeModelDocument | null,
  latestRuntimeProof: RuntimeProofRecord | null,
  proofSignals: readonly RuntimeProofSignal[],
): string[] {
  return [
    "source: PlanCertaintyContextProvider object-state snapshot",
    `request.targetFacet=${request.targetFacet}`,
    userGoal ? `source:userGoalTree.userGoals[id=${userGoal.id}]` : null,
    model ? `source:xNodeModels[userGoalId=${model.userGoalId}]` : null,
    xNode ? `source:xNodeModels.nodes[id=${xNode.id}]` : null,
    latestRuntimeProof ? `source:latestRuntimeProof[targetXNodeId=${latestRuntimeProof.targetXNodeId}]` : null,
    proofSignals.length > 0 ? `source:latestProofSignals[count=${proofSignals.length}]` : null,
  ].filter(isString);
}

function dedupeStrings(items: readonly string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))];
}

function dedupeBy<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function isString(value: string | null | undefined): value is string {
  return typeof value === "string";
}
