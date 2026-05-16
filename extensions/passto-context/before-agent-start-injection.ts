import { buildGeneratorCharterPrompt, buildGoalStateInjection, buildReflectorInjection, buildSummaryCacheInjection } from "./grc-prompts.ts";
import { formatPrinciplesForInjection } from "./grc-principles.ts";
import { injectSessionSummarySearchGuidance } from "./runtime-summary-search.ts";
import type { GRCState, MemoryItem, PasstoContextConfig, PrincipleItem } from "./types.ts";

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

export function buildBeforeAgentStartPrompt(input: BeforeAgentStartPromptInput): BeforeAgentStartPromptOutput {
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

  if (grcPromptEnabled && grcState?.curator.lastGoalState) {
    const goalStateInjection = buildGoalStateInjection(grcState.curator.lastGoalState, config.grc.maxGoalStateActive);
    if (goalStateInjection) {
      systemPrompt += `\n\n${goalStateInjection}`;
      diagnostics.push(`goal-state(${goalStateInjection.length} chars)`);
    }
  } else {
    diagnostics.push(`goal-state:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)})`);
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
    const summarySearchInjection = injectSessionSummarySearchGuidance(systemPrompt, grcPromptEnabled, ctx);
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
