import { buildContextMethodProofPacketInjection, buildContextMethodProofPackets, buildGeneratorCharterPrompt, buildGoalStateInjection, buildGoalStateInjectionFromObjectSidecars, buildNextStepPolicyInjection, buildReflectorInjection, buildRuntimeProofInjection, buildSummaryCacheInjection, buildUserGoalTreeInjection, buildXNodeModelInjection } from "./grc-prompts.ts";
import { getEffectiveGoalState, getEffectiveObjectState } from "./grc-state.ts";
import { formatPrinciplesForInjection } from "./grc-principles.ts";
import { injectSessionSummarySearchGuidance } from "./runtime-summary-search.ts";
import type { GRCState, MemoryItem, PasstoContextConfig, PrincipleItem } from "./types.ts";
import { deriveUserGoalTreeFromGoalState } from "./grc-user-goal-tree.ts";
import { deriveXNodeModelsFromGoalState, selectCurrentXNodeModel } from "./grc-x-node-model.ts";
import { applyCompletionClosure } from "./grc-completion-closure.ts";
import { buildGoalViewModelFromObjectSidecars } from "./grc-goal-view.ts";

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
}

interface SessionManagerLike {
  getBranch(): BranchEntryLike[];
}

interface SummarySearchContextLike {
  sessionManager: SessionManagerLike;
}

interface MemoryManagerLike {
  search(query: string, limit: number): MemoryItem[];
  formatForInjection(memories: MemoryItem[], maxTokens: number): string;
}

interface PrinciplesManagerLike {
  listInjectable(limit: number): PrincipleItem[];
}

export interface BeforeAgentStartPromptInput {
  event: {
    prompt: string;
    systemPrompt: string;
  };
  config: PasstoContextConfig;
  grcState: GRCState | null;
  orchestrationSuspended: boolean;
  ctx: SummarySearchContextLike;
  principles: PrinciplesManagerLike | null;
  memory: MemoryManagerLike | null;
}

export interface BeforeAgentStartPromptOutput {
  systemPrompt: string;
  diagnostics: string[];
  principleUsageCandidates: PrincipleItem[];
  injectedMemories: MemoryItem[];
}

export async function buildBeforeAgentStartPrompt(input: BeforeAgentStartPromptInput): Promise<BeforeAgentStartPromptOutput> {
  const {
    event,
    config,
    grcState,
    orchestrationSuspended,
    ctx,
    principles,
    memory,
  } = input;

  let systemPrompt = event.systemPrompt;
  const diagnostics: string[] = [];
  const principleUsageCandidates: PrincipleItem[] = [];
  let injectedMemories: MemoryItem[] = [];

  const grcPromptEnabled = config.grc.enabled && !orchestrationSuspended;
  if (grcPromptEnabled) {
    systemPrompt += `\n\n${buildGeneratorCharterPrompt()}`;
    diagnostics.push("generator-charter");
  } else {
    diagnostics.push(
      `generator-charter:skip(grcEnabled=${config.grc.enabled}, suspended=${orchestrationSuspended}, runtimeMode=${grcState?.runtimeMode ?? "n/a"})`,
    );
  }

  if (grcPromptEnabled) {
    const effectiveGoalState = getEffectiveGoalState(grcState);
    const certaintyAssessment = grcState?.curator.lastCertaintyAssessment ?? null;
    if (effectiveGoalState) {
      const { userGoalTree: sidecarUserGoalTree, xNodeModels: sidecarXNodeModels } = getEffectiveObjectState(grcState);
      const rawUserGoalTree = sidecarUserGoalTree ?? deriveUserGoalTreeFromGoalState(effectiveGoalState);
      const rawXNodeModels = sidecarXNodeModels.length > 0 ? sidecarXNodeModels : deriveXNodeModelsFromGoalState(effectiveGoalState, rawUserGoalTree);
      const { userGoalTree: effectiveUserGoalTree, xNodeModels: effectiveXNodeModels } = applyCompletionClosure(rawUserGoalTree, rawXNodeModels);
      const currentXNodeModel = selectCurrentXNodeModel(effectiveUserGoalTree, effectiveXNodeModels);
      const currentPolicyProjection = currentXNodeModel?.latestPolicyProjection ?? null;
      const topLevelRuntimeProof = grcState?.curator.latestRuntimeProof ?? null;
      const topLevelProofSignals = grcState?.curator.latestProofSignals ?? null;
      const runtimeProofPreferredModel = currentXNodeModel
        ? {
            ...currentXNodeModel,
            latestRuntimeProof: topLevelRuntimeProof ?? currentXNodeModel.latestRuntimeProof ?? null,
            latestProofSignals: topLevelProofSignals ?? currentXNodeModel.latestProofSignals ?? null,
          }
        : topLevelRuntimeProof
          ? {
              version: 1 as const,
              id: `xnode-${effectiveUserGoalTree?.currentFocusUserGoalId ?? topLevelRuntimeProof.targetXNodeId}`,
              userGoalId: effectiveUserGoalTree?.currentFocusUserGoalId ?? topLevelRuntimeProof.targetXNodeId,
              agentRound: topLevelRuntimeProof.atRound,
              updatedAt: new Date().toISOString(),
              currentFocusXNodeId: topLevelRuntimeProof.targetXNodeId,
              rootXNodeIds: [topLevelRuntimeProof.targetXNodeId],
              nodes: [],
              latestRuntimeProof: topLevelRuntimeProof,
              latestProofSignals: topLevelProofSignals ?? undefined,
              latestPolicyProjection: null,
              completion: null,
            }
          : null;

      const objectFirstGoalView = buildGoalViewModelFromObjectSidecars(effectiveUserGoalTree, effectiveXNodeModels, {
        maxSiblingActiveGoals: Math.max(0, config.grc.maxGoalStateActive - 1),
      });
      const draftNodeIds = grcState?.curator.runtimeDraftGoalState?.goalState?.version === 2
        ? grcState.curator.runtimeDraftGoalState.goalState.nodes
            .filter((node) => node.signal === 'draft')
            .map((node) => node.id)
        : [];
      const goalStateInjection = objectFirstGoalView
        ? buildGoalStateInjectionFromObjectSidecars(
            effectiveUserGoalTree,
            effectiveXNodeModels,
            config.grc.maxGoalStateActive,
            certaintyAssessment,
            currentPolicyProjection,
            draftNodeIds,
          )
        : buildGoalStateInjection(
            effectiveGoalState,
            config.grc.maxGoalStateActive,
            certaintyAssessment,
            currentPolicyProjection,
          );
      if (goalStateInjection) {
        systemPrompt += `\n\n${goalStateInjection}`;
        diagnostics.push(`goal-state(${goalStateInjection.length} chars, source=${objectFirstGoalView ? "object-sidecars-primary" : "goal-state-fallback"})`);
      }

      const userGoalTreeInjection = effectiveUserGoalTree
        ? buildUserGoalTreeInjection(effectiveUserGoalTree, config.grc.maxGoalStateActive)
        : "";
      if (userGoalTreeInjection) {
        systemPrompt += `\n\n${userGoalTreeInjection}`;
        diagnostics.push(`user-goal-tree(${effectiveUserGoalTree?.userGoals.length ?? 0}/${userGoalTreeInjection.length} chars)`);
      } else {
        diagnostics.push(`user-goal-tree:skip(hasTree=${Boolean(effectiveUserGoalTree)})`);
      }

      const xNodeModelInjection = buildXNodeModelInjection(currentXNodeModel);
      if (xNodeModelInjection) {
        systemPrompt += `\n\n${xNodeModelInjection}`;
        diagnostics.push(`x-node-model(${currentXNodeModel?.nodes.length ?? 0}/${xNodeModelInjection.length} chars)`);
      } else {
        diagnostics.push(`x-node-model:skip(hasModel=${Boolean(currentXNodeModel)})`);
      }

      const packetInjection = buildContextMethodProofPacketInjection(buildContextMethodProofPackets({
        userGoalTree: effectiveUserGoalTree,
        xNodeModel: runtimeProofPreferredModel ?? currentXNodeModel,
        dynamicStateSource: objectFirstGoalView ? "object-sidecars" : "goal-state-fallback",
      }));
      systemPrompt += `\n\n${packetInjection}`;
      diagnostics.push(`context-method-proof-packets(${packetInjection.length} chars)`);

      const runtimeProofInjection = buildRuntimeProofInjection(runtimeProofPreferredModel);
      if (runtimeProofInjection) {
        systemPrompt += `\n\n${runtimeProofInjection}`;
        diagnostics.push(`runtime-proof(${runtimeProofPreferredModel?.latestRuntimeProof?.proofStatus ?? "unknown"}/${runtimeProofInjection.length} chars, source=${topLevelRuntimeProof ? "curator-top-level" : currentXNodeModel?.latestRuntimeProof ? "x-node-model" : "none"})`);
      } else {
        diagnostics.push(`runtime-proof:skip(hasProof=${Boolean(runtimeProofPreferredModel?.latestRuntimeProof)})`);
      }

      // object policy is primary; certaintyAssessment only remains as compatibility fallback when policy projection is absent.
      const nextStepPolicyInjection = buildNextStepPolicyInjection(currentPolicyProjection, certaintyAssessment);
      if (nextStepPolicyInjection) {
        systemPrompt += `\n\n${nextStepPolicyInjection}`;
        diagnostics.push(`next-step-policy(${currentPolicyProjection?.nextStepType ?? certaintyAssessment?.nextStepType ?? "unknown"}/${nextStepPolicyInjection.length} chars, source=${currentPolicyProjection ? "policyProjection" : certaintyAssessment ? "certaintyFallback" : "none"})`);
      } else {
        diagnostics.push("next-step-policy:skip(no-policy-projection)");
      }
    } else {
      diagnostics.push(`goal-state:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(effectiveGoalState)})`);
      diagnostics.push(`user-goal-tree:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(effectiveGoalState)})`);
      diagnostics.push(`x-node-model:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(effectiveGoalState)})`);
      diagnostics.push(`context-method-proof-packets:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(effectiveGoalState)})`);
      diagnostics.push(`runtime-proof:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(effectiveGoalState)})`);
      diagnostics.push(`next-step-policy:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(effectiveGoalState)}, hasPolicyFallback=${Boolean(certaintyAssessment)})`);
    }
  } else {
    diagnostics.push(`goal-state:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)})`);
    diagnostics.push(`user-goal-tree:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)})`);
    diagnostics.push(`x-node-model:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)})`);
    diagnostics.push(`context-method-proof-packets:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)})`);
    diagnostics.push(`runtime-proof:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)})`);
    diagnostics.push(`next-step-policy:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)}, hasPolicyFallback=${Boolean(grcState?.curator.lastCertaintyAssessment)})`);
  }

  if (grcPromptEnabled && grcState && grcState.curator.summaryCache.length > 0) {
    const injectedSummaryCacheRounds = grcState.curator.summaryCache
      .filter((entry) => entry.agentRound <= Math.max(0, grcState.currentAgentRound - config.grc.keepRecentAgentRounds))
      .map((entry) => entry.agentRound);
    const summaryCacheInjection = buildSummaryCacheInjection(
      grcState.curator.summaryCache,
      config.grc.summaryCacheSize,
      config.grc.keepRecentAgentRounds,
    );
    if (summaryCacheInjection) {
      systemPrompt += `\n\n${summaryCacheInjection}`;
      diagnostics.push(`summary-cache(${injectedSummaryCacheRounds.join(",") || "none"}/${summaryCacheInjection.length} chars)`);
    } else {
      diagnostics.push(`summary-cache:skip-all-overlap(total=${grcState.curator.summaryCache.length}, keepRecentAgentRounds=${config.grc.keepRecentAgentRounds})`);
    }
  } else {
    diagnostics.push(`summary-cache:skip(enabled=${grcPromptEnabled}, size=${grcState?.curator.summaryCache.length ?? 0})`);
  }

  {
    const summarySearchInjection = await injectSessionSummarySearchGuidance(systemPrompt, grcPromptEnabled, ctx, {
      lineageSummaryMaxDepth: config.grc.lineageSummaryMaxDepth,
    });
    systemPrompt = summarySearchInjection.systemPrompt;
    diagnostics.push(summarySearchInjection.diagnostic);
  }

  if (grcState?.mode === "grc" && grcState.reflector.status === "done" && grcState.reflector.lastAdvice) {
    const reflectorInjection = buildReflectorInjection(grcState.reflector.lastAdvice);
    if (reflectorInjection) {
      systemPrompt += `\n${reflectorInjection}`;
      diagnostics.push(`reflector(${reflectorInjection.length} chars)`);
    }
  } else {
    diagnostics.push(
      `reflector:skip(mode=${grcState?.mode ?? "n/a"}, status=${grcState?.reflector.status ?? "n/a"}, hasAdvice=${Boolean(grcState?.reflector.lastAdvice)})`,
    );
  }

  if (grcPromptEnabled && principles && config.grc.maxPrinciplesInjection > 0) {
    const injectablePrinciples = principles.listInjectable(config.grc.maxPrinciplesInjection);
    if (injectablePrinciples.length > 0) {
      const injection = formatPrinciplesForInjection(injectablePrinciples);
      if (injection) {
        systemPrompt += `\n\n${injection}`;
        principleUsageCandidates.push(...injectablePrinciples);
        diagnostics.push(`principles(${injectablePrinciples.length}/${injection.length} chars)`);
      }
    } else {
      diagnostics.push("principles:0");
    }
  } else {
    diagnostics.push(
      `principles:skip(enabled=${Boolean(principles)}, max=${config.grc.maxPrinciplesInjection}, grcPromptEnabled=${grcPromptEnabled})`,
    );
  }

  if (config.memory.enabled && memory) {
    injectedMemories = memory.search(event.prompt, 5);
    if (injectedMemories.length > 0) {
      const injection = memory.formatForInjection(injectedMemories, config.memory.maxInjectionTokens);
      if (injection) {
        systemPrompt += `\n\n${injection}`;
        diagnostics.push(`memories(${injectedMemories.length}/${injection.length} chars)`);
      }
    } else {
      diagnostics.push("memories:0");
    }
  } else {
    diagnostics.push(`memories:skip(enabled=${config.memory.enabled}, manager=${Boolean(memory)})`);
  }

  return {
    systemPrompt,
    diagnostics,
    principleUsageCandidates,
    injectedMemories,
  };
}
