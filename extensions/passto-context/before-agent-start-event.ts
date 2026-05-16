import { buildBeforeAgentStartPrompt } from "./before-agent-start-injection.ts";
import type { GRCState, Logger, MemoryItem, PasstoContextConfig, PrincipleItem } from "./types.ts";

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
}

interface SessionManagerLike {
  getBranch(): BranchEntryLike[];
}

interface ExtensionContextLike {
  sessionManager: SessionManagerLike;
}

interface MemoryManagerLike {
  search(query: string, limit: number): MemoryItem[];
  formatForInjection(memories: MemoryItem[], maxTokens: number): string;
}

interface PrinciplesManagerLike {
  listInjectable(limit: number): PrincipleItem[];
}

interface BeforeAgentStartEventLike {
  prompt: string;
  systemPrompt: string;
}

export interface BeforeAgentStartHandlerDeps {
  getConfig(): PasstoContextConfig | null;
  getGRCState(): GRCState | null;
  getPrinciples(): PrinciplesManagerLike | null;
  getMemory(): MemoryManagerLike | null;
  getCuratorPromise(): Promise<void> | null;
  getOrchestrationSuspended(): boolean;
  updateOrchestrationSuspension(ctx: ExtensionContextLike): void;
  getSessionScopeGuardReason(ctx: ExtensionContextLike): string | null;
  isCurrentSessionStateReady(ctx: ExtensionContextLike): boolean;
  isRuntimeEnabled(): boolean;
  isGRCAutoProcessingAllowed(): boolean;
  startGRCBackgroundJobs(ctx: ExtensionContextLike, targets: "curator"): void;
  logger: Pick<Logger, "debug" | "warn" | "error"> | null;
}

export function createBeforeAgentStartHandler(deps: BeforeAgentStartHandlerDeps) {
  return async function beforeAgentStart(
    event: BeforeAgentStartEventLike,
    ctx: ExtensionContextLike,
  ): Promise<{ systemPrompt: string } | undefined> {
    const config = deps.getConfig();
    if (!config) {
      return;
    }

    try {
      deps.updateOrchestrationSuspension(ctx);

      if (!deps.isCurrentSessionStateReady(ctx)) {
        deps.logger?.debug(`before_agent_start skipped runtime injections: ${deps.getSessionScopeGuardReason(ctx) ?? "session-state-not-ready"}`);
        return;
      }

      if (!deps.isRuntimeEnabled()) {
        deps.logger?.debug("before_agent_start skipped runtime injections: runtimeMode=off");
        return;
      }

      const grcState = deps.getGRCState();
      if (grcState && !deps.getCuratorPromise()) {
        const curatorAutoEnabled = config.grc.enabled;
        if (curatorAutoEnabled && deps.isGRCAutoProcessingAllowed()) {
          deps.startGRCBackgroundJobs(ctx, "curator");
        }
      }

      const promptInjection = buildBeforeAgentStartPrompt({
        event: { prompt: event.prompt, systemPrompt: event.systemPrompt },
        config,
        grcState,
        orchestrationSuspended: deps.getOrchestrationSuspended(),
        ctx,
        principles: deps.getPrinciples(),
        memory: deps.getMemory(),
      });
      const systemPrompt = promptInjection.systemPrompt;
      const injectionDiagnostics = promptInjection.diagnostics;

      if (promptInjection.principleUsageCandidates.length > 0) {
        deps.logger?.debug(`Injected ${promptInjection.principleUsageCandidates.length} principles`);
      }

      if (promptInjection.injectedMemories.length > 0) {
        deps.logger?.debug(`Injected ${promptInjection.injectedMemories.length} memories`);
      }

      deps.logger?.debug(
        `before_agent_start injection summary: ${injectionDiagnostics.join(" | ")} | state(mode=${grcState?.mode ?? "n/a"}, runtimeMode=${grcState?.runtimeMode ?? "n/a"}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)}, summaryCache=${grcState?.curator.summaryCache.length ?? 0}, lastSignal=${grcState?.curator.lastSignal?.type ?? "none"}, reflector=${grcState?.reflector.status ?? "n/a"}, curator=${grcState?.curator.status ?? "n/a"})`,
      );

      if (systemPrompt !== event.systemPrompt) {
        return { systemPrompt };
      }
      return;
    } catch (err) {
      deps.logger?.error("before_agent_start injection failed:", err);
      return;
    }
  };
}
