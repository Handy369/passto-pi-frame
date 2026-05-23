import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  PI_OFFLINE_ENV,
  SUBAGENT_DEPTH_ENV,
  SUBAGENT_MAX_DEPTH_ENV,
  SUBAGENT_PREVENT_CYCLES_ENV,
  SUBAGENT_STACK_ENV,
  buildPiArgs,
  cleanupTempDir,
  parseInheritedCliArgs,
  resolvePiInvocation,
  resolveSessionMode,
  writeForkSessionToTempFile,
  writePromptToTempFile,
} from "./cli.ts";
import { loadAgentProfile, applyAgentProfileDefaults, deriveRuntimeWarnings } from "./agents.ts";
import { createEventState, finalizeEventState, processPiJsonLine } from "./events.ts";
import {
  createGuardContext,
  resolveCompletionPolicy,
  resolveIdleTimeoutMs,
  resolveTerminateGraceMs,
  resolveTimeoutMs,
  validateRunOptions,
} from "./guards.ts";
import { applyEventToProgress, createInitialProgress } from "./progress.ts";
import type { PiChildRunOptions, RunSubagentCallbacks, SubagentRunResult } from "./types.ts";

const isWindows = process.platform === "win32";

export async function runSubagent(
  options: PiChildRunOptions,
  callbacks?: RunSubagentCallbacks,
  signal?: AbortSignal,
): Promise<SubagentRunResult> {
  const runId = randomUUID();
  const agentProfile = loadAgentProfile(options.agent);
  const resolvedOptions = applyAgentProfileDefaults(options, agentProfile);
  const sessionMode = resolveSessionMode(resolvedOptions.sessionMode);
  const inherited = parseInheritedCliArgs(process.argv);
  const state = createEventState();
  const progress = createInitialProgress(runId);
  const runtimeWarnings = deriveRuntimeWarnings({
    requested: options,
    resolved: resolvedOptions,
    profile: agentProfile,
    inherited,
  });

  let promptTmpDir: string | null = null;
  let promptTmpPath: string | null = null;
  let forkTmpDir: string | null = null;
  let forkTmpPath: string | null = null;
  let wasAborted = false;

  validateRunOptions(resolvedOptions);

  try {
    if (resolvedOptions.appendSystemPrompt?.trim()) {
      const tmp = writePromptToTempFile(runId, resolvedOptions.appendSystemPrompt);
      promptTmpDir = tmp.dir;
      promptTmpPath = tmp.filePath;
    }
    if (sessionMode === "fork" && resolvedOptions.forkSessionSnapshotJsonl) {
      const tmp = writeForkSessionToTempFile(runId, resolvedOptions.forkSessionSnapshotJsonl);
      forkTmpDir = tmp.dir;
      forkTmpPath = tmp.filePath;
    }

    const args = buildPiArgs({ options: resolvedOptions, inherited, systemPromptPath: promptTmpPath, forkSessionPath: forkTmpPath });
    const invocation = resolvePiInvocation();
    const guardContext = createGuardContext(resolvedOptions, runId);

    const exitCode = await new Promise<number>((resolve) => {
      let buffer = "";
      let didClose = false;
      let settled = false;
      let abortHandler: (() => void) | undefined;
      let lastActivityAt = Date.now();
      let terminationStarted = false;

      const completionPolicy = resolveCompletionPolicy(resolvedOptions);
      const idleTimeoutMs = resolveIdleTimeoutMs(resolvedOptions);
      const terminateGraceMs = resolveTerminateGraceMs(resolvedOptions);

      const proc = spawn(invocation.command, [...invocation.prefixArgs, ...args], {
        cwd: resolvedOptions.cwd,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ...resolvedOptions.env,
          [SUBAGENT_DEPTH_ENV]: String(guardContext.nextDepth),
          [SUBAGENT_MAX_DEPTH_ENV]: String(guardContext.propagatedMaxDepth),
          [SUBAGENT_STACK_ENV]: JSON.stringify(guardContext.propagatedStack),
          [SUBAGENT_PREVENT_CYCLES_ENV]: resolvedOptions.preventCycles === false ? "0" : "1",
          [PI_OFFLINE_ENV]: resolvedOptions.offline === false ? String(process.env[PI_OFFLINE_ENV] ?? "") : "1",
        },
      });

      const timeoutMs = resolveTimeoutMs(resolvedOptions);
      const timeoutTimer = setTimeout(() => {
        if (didClose || settled) return;
        state.stderr += `\n[Error] Subagent execution timed out (limit: ${timeoutMs}ms).`;
        terminateChild("timeout");
      }, timeoutMs);
      timeoutTimer.unref();

      const idleTimer = setInterval(() => {
        if (didClose || settled) return;
        if (Date.now() - lastActivityAt < idleTimeoutMs) return;
        state.stderr += `\n[Error] Subagent execution became idle for ${idleTimeoutMs}ms.`;
        terminateChild("idle");
      }, Math.max(1000, Math.min(5000, Math.floor(idleTimeoutMs / 2))));
      idleTimer.unref();

      proc.stdin.on("error", () => {});
      proc.stdin.end();

      const markActivity = () => {
        lastActivityAt = Date.now();
      };

      const terminateChild = (reason: "idle" | "timeout" | "abort" | "normal-cleanup") => {
        if (terminationStarted) return;
        terminationStarted = true;
        if (reason === "idle" && !state.stopReason) state.stopReason = "idle_timeout";
        if (reason === "timeout" && !state.stopReason) state.stopReason = "timeout";
        if (reason === "abort" && !state.stopReason) state.stopReason = "aborted";

        if (isWindows) {
          if (proc.pid !== undefined) {
            const killer = spawn("taskkill", ["/T", "/F", "/PID", String(proc.pid)], { stdio: "ignore" });
            killer.unref();
          }
          return;
        }
        proc.kill("SIGTERM");
        const sigkillTimer = setTimeout(() => {
          if (!didClose) proc.kill("SIGKILL");
        }, terminateGraceMs);
        sigkillTimer.unref();
      };

      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        clearInterval(idleTimer);
        if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
        resolve(code);
      };

      const emit = (events: ReturnType<typeof processPiJsonLine>) => {
        for (const event of events) {
          callbacks?.onEvent?.(event);
          applyEventToProgress(progress, event);
          callbacks?.onProgress?.(progress);
        }
      };

      const flushLine = (line: string) => {
        markActivity();
        const events = processPiJsonLine(line, state);
        if (events.length > 0) emit(events);
        maybeFinishFromAgentEnd();
      };

      const flushBufferedLines = (text: string) => {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) flushLine(line);
        }
      };

      const maybeFinishFromAgentEnd = () => {
        if (completionPolicy !== "agent-end") return;
        if (!state.sawAgentEnd || didClose || settled) return;
        if (buffer.trim()) {
          flushBufferedLines(buffer);
          buffer = "";
        }
        proc.stdout.removeListener("data", onStdoutData);
        proc.stderr.removeListener("data", onStderrData);
        finish(0);
        terminateChild("normal-cleanup");
      };

      const onStdoutData = (chunk: Buffer) => {
        markActivity();
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) flushLine(line);
      };

      const onStderrData = (chunk: Buffer) => {
        markActivity();
        const text = chunk.toString();
        state.stderr += text;
        const event = { type: "stderr", text } as const;
        callbacks?.onEvent?.(event);
        applyEventToProgress(progress, event);
        callbacks?.onProgress?.(progress);
      };

      proc.stdout.on("data", onStdoutData);
      proc.stderr.on("data", onStderrData);

      proc.on("close", (code) => {
        didClose = true;
        if (buffer.trim()) flushBufferedLines(buffer);
        finish(code ?? 0);
      });

      proc.on("error", (err) => {
        if (!state.stderr.trim()) state.stderr = err.message;
        finish(1);
      });

      if (signal) {
        abortHandler = () => {
          if (didClose || settled) return;
          wasAborted = true;
          terminateChild("abort");
        };
        if (signal.aborted) abortHandler();
        else signal.addEventListener("abort", abortHandler, { once: true });
      }
    });

    applyEventToProgress(progress, { type: "done", exitCode });
    const finalized = finalizeEventState(state);
    const success = !wasAborted
      && exitCode === 0
      && finalized.stopReason !== "error"
      && finalized.stopReason !== "aborted"
      && finalized.stopReason !== "idle_timeout"
      && finalized.stopReason !== "timeout";
    if (wasAborted) {
      finalized.errorMessage = finalized.errorMessage || "Subagent was aborted.";
      finalized.stopReason = "aborted";
      progress.phase = "error";
    }

    return {
      runId,
      cwd: resolvedOptions.cwd,
      sessionMode,
      exitCode,
      success,
      stopReason: finalized.stopReason,
      errorMessage: finalized.errorMessage,
      usage: finalized.usage,
      messages: finalized.messages,
      stderr: finalized.stderr,
      rawEvents: finalized.rawEvents,
      finalOutputText: finalized.finalOutputText,
      progress,
      provenance: {
        reviewedBySubagent: true,
        subagentMode: sessionMode,
        transport: "pi-cli-json",
        runtimeVersion: "passto-agent-runtime-v1",
        agentProfile: agentProfile?.name,
        agentProfilePath: agentProfile?.filePath,
        providerName: resolvedOptions.provider ?? inherited.fallbackProvider ?? agentProfile?.provider,
        modelName: resolvedOptions.model ?? inherited.fallbackModel ?? agentProfile?.model,
        thinking: typeof resolvedOptions.thinking === "string"
          ? resolvedOptions.thinking
          : typeof inherited.fallbackThinking === "string"
            ? inherited.fallbackThinking
            : agentProfile?.thinking,
        inheritParentExtensions: resolvedOptions.inheritParentExtensions === true,
        inheritedExtensions:
          resolvedOptions.inheritParentExtensions === true ? inherited.extensionArgs : [],
        explicitExtensions: resolvedOptions.extensions ?? [],
        warnings: runtimeWarnings,
      },
    };
  } finally {
    cleanupTempDir(promptTmpDir);
    cleanupTempDir(forkTmpDir);
  }
}
