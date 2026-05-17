interface BranchEntryLike {
  type?: string;
  message?: unknown;
}

interface ToolCallBlockLike {
  type?: string;
  name?: string;
}

interface MessageLike {
  toolName?: string;
  content?: ToolCallBlockLike[];
}

export const DEFAULT_ORCHESTRATOR_SCAN_TAIL_ENTRIES = 200;

export function detectExternalOrchestratorFromBranch(
  branch: BranchEntryLike[],
  prefixes: string[],
  tailEntries: number = DEFAULT_ORCHESTRATOR_SCAN_TAIL_ENTRIES,
): { suspended: boolean; reason: string } {
  if (prefixes.length === 0) {
    return { suspended: false, reason: "" };
  }

  const safeTailEntries = Math.max(1, Math.trunc(tailEntries));
  const startIndex = Math.max(0, branch.length - safeTailEntries);

  for (let i = branch.length - 1; i >= startIndex; i -= 1) {
    const entry = branch[i];
    if (entry?.type !== "message") continue;

    const message = entry.message as MessageLike | undefined;
    const toolNames = new Set<string>();
    if (typeof message?.toolName === "string" && message.toolName.length > 0) {
      toolNames.add(message.toolName);
    }

    for (const block of message?.content ?? []) {
      if (block?.type === "toolCall" && typeof block.name === "string" && block.name.length > 0) {
        toolNames.add(block.name);
      }
    }

    for (const toolName of toolNames) {
      const matchedPrefix = prefixes.find((prefix) => toolName.startsWith(prefix));
      if (matchedPrefix) {
        return {
          suspended: true,
          reason: `检测到外部编排流程：${toolName}`,
        };
      }
    }
  }

  return { suspended: false, reason: "" };
}
