import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getFinalAssistantText,
  getResultSummaryText,
  isResultError,
  isResultSuccess,
} from "../types.ts";
import {
  getDisplayItems,
  getToolResultSummariesFromRawEvents,
} from "../display-items.ts";
import {
  buildProgressUpdateText,
  buildRunningPreviewLines,
  formatElapsedMs,
  formatRecentActivityLine,
  formatRunningSummary,
  getRecentActivityPreview,
} from "../render-helpers.ts";
import { parseExecutionContract } from "../contracts.ts";
import { __internal as ralphInternal, verifyRalphLoop } from "../ralph-verification.ts";
import {
  resolveCompletionPolicy,
  resolveIdleTimeoutMs,
  resolveTerminateGraceMs,
} from "../../../lib/passto-agent-runtime/guards.ts";
import { getContractLifecycleConfig } from "../../../lib/passto-agent-runtime/config.ts";
import { runSubagent } from "../../../lib/passto-agent-runtime/index.ts";

function makeResult(overrides = {}) {
  return {
    agent: "oracle",
    task: "repro",
    exitCode: -1,
    messages: [],
    stderr: "",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 0,
    },
    ...overrides,
  };
}

test("prefers final assistant text in summary", () => {
  const result = makeResult({
    exitCode: 1,
    stderr: "Command exited with code 1",
    errorMessage: "Command exited with code 1",
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "No matches found" }],
        timestamp: 1,
      },
    ],
  });

  assert.equal(getFinalAssistantText(result.messages), "No matches found");
  assert.equal(getResultSummaryText(result), "No matches found");
});

test("falls back to errorMessage and stderr when no assistant output exists", () => {
  const withErrorMessage = makeResult({
    exitCode: 1,
    errorMessage: "Structured failure",
    stderr: "stderr failure",
  });
  assert.equal(getResultSummaryText(withErrorMessage), "Structured failure");

  const withStderr = makeResult({
    exitCode: 1,
    stderr: "stderr failure",
  });
  assert.equal(getResultSummaryText(withStderr), "stderr failure");
});

test("success and error detection use semantic completion", () => {
  const success = makeResult({
    exitCode: 1,
    sawAgentEnd: true,
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "Completed successfully." }],
        timestamp: 1,
      },
    ],
  });

  assert.equal(isResultSuccess(success), true);
  assert.equal(isResultError(success), false);

  const failure = makeResult({
    exitCode: 1,
    stopReason: "error",
    stderr: "Failed",
  });

  assert.equal(isResultSuccess(failure), false);
  assert.equal(isResultError(failure), true);
});

test("running results are neither success nor error", () => {
  const running = makeResult({ exitCode: -1 });
  assert.equal(isResultSuccess(running), false);
  assert.equal(isResultError(running), false);
});

test("formatElapsedMs formats finite non-negative values", () => {
  assert.equal(formatElapsedMs(1234), "1.2s");
  assert.equal(formatElapsedMs(0), "0.0s");
  assert.equal(formatElapsedMs(-1), null);
  assert.equal(formatElapsedMs(Number.NaN), null);
});

test("formatRunningSummary includes phase elapsed and current tool", () => {
  const running = makeResult({
    phase: "running",
    elapsedMs: 2345,
    currentTool: "read",
  });

  assert.equal(formatRunningSummary(running), "running · 2.3s · tool=read");
});

test("formatRecentActivityLine formats tool activity lines", () => {
  assert.equal(
    formatRecentActivityLine('tool: read {"path":"agent/extensions/pi-subagent/render.ts"}'),
    "→ read agent/extensions/pi-subagent/render.ts",
  );
  assert.equal(
    formatRecentActivityLine('tool: bash {"command":"cd agent/extensions/pi-subagent && git branch --show-current"}'),
    "→ bash cd agent/extensions/pi-subagent && git branch --show-current",
  );
  assert.equal(formatRecentActivityLine("assistant: starting"), "assistant: starting");
});

test("getRecentActivityPreview returns the latest N formatted activities", () => {
  const running = makeResult({
    recentActivity: [
      "assistant: starting",
      'tool: read {"path":"a.txt"}',
      'tool: bash {"command":"pwd"}',
      "assistant: done",
    ],
  });

  assert.deepEqual(getRecentActivityPreview(running, 2), ["→ bash pwd", "assistant: done"]);
  assert.deepEqual(getRecentActivityPreview(running, 3), ["→ read a.txt", "→ bash pwd", "assistant: done"]);
});

test("buildRunningPreviewLines builds progress-first preview lines", () => {
  const running = makeResult({
    phase: "running",
    elapsedMs: 2345,
    currentTool: "read",
    lastAssistantText: "Inspecting render.ts",
    recentActivity: [
      "assistant: starting",
      'tool: read {"path":"render.ts"}',
      "assistant: found collapsed renderer",
    ],
  });

  assert.deepEqual(buildRunningPreviewLines(running, 2), [
    "running · 2.3s · tool=read",
    "last: Inspecting render.ts",
    "→ read render.ts",
    "assistant: found collapsed renderer",
  ]);
});

test("buildProgressUpdateText formats running progress content for onUpdate", () => {
  const progress = {
    phase: "running",
    elapsedMs: 2345,
    currentTool: "read",
    lastAssistantText: "Inspecting render.ts",
    recentActivity: [
      "assistant: starting",
      'tool: read {"path":"render.ts"}',
      "assistant: found collapsed renderer",
    ],
  };

  assert.equal(
    buildProgressUpdateText(progress, 2),
    [
      "running · 2.3s · tool=read",
      "last: Inspecting render.ts",
      "→ read render.ts",
      "assistant: found collapsed renderer",
    ].join("\n"),
  );
});

test("buildProgressUpdateText supports showing only the latest activity", () => {
  const progress = {
    phase: "running",
    elapsedMs: 2345,
    currentTool: "read",
    lastAssistantText: "Inspecting render.ts",
    recentActivity: [
      "assistant: starting",
      'tool: read {"path":"render.ts"}',
      "assistant: found collapsed renderer",
    ],
  };

  assert.equal(
    buildProgressUpdateText(progress, 1),
    [
      "running · 2.3s · tool=read",
      "last: Inspecting render.ts",
      "assistant: found collapsed renderer",
    ].join("\n"),
  );
});

test("getToolResultSummariesFromRawEvents extracts tool result text", () => {
  const rawEvents = [
    {
      type: "tool_result_end",
      message: {
        content: [
          {
            type: "toolResult",
            toolName: "read",
            content: [{ type: "text", text: "file contents summary" }],
          },
        ],
      },
    },
  ];

  assert.deepEqual(getToolResultSummariesFromRawEvents(rawEvents), [
    { toolName: "read", text: "file contents summary" },
  ]);
});

test("getDisplayItems inserts matching tool results after tool calls", () => {
  const messages = [
    {
      role: "assistant",
      content: [
        { type: "toolCall", name: "read", arguments: { path: "a.txt" } },
        { type: "text", text: "done" },
        { type: "toolCall", name: "bash", arguments: { command: "pwd" } },
      ],
    },
  ];

  assert.deepEqual(
    getDisplayItems(messages, [
      { toolName: "bash", text: "/tmp/project" },
      { toolName: "read", text: "file contents summary" },
    ]),
    [
      { type: "toolCall", name: "read", args: { path: "a.txt" } },
      { type: "toolResult", toolName: "read", text: "file contents summary" },
      { type: "text", text: "done" },
      { type: "toolCall", name: "bash", args: { command: "pwd" } },
      { type: "toolResult", toolName: "bash", text: "/tmp/project" },
    ],
  );
});

test("parseExecutionContract accepts ralph-loop", () => {
  assert.equal(parseExecutionContract("ralph-loop"), "ralph-loop");
  assert.equal(parseExecutionContract("RALPH-LOOP"), "ralph-loop");
  assert.equal(parseExecutionContract("unknown"), null);
});

test("ralph verification extracts tool calls", () => {
  const calls = ralphInternal.extractToolCalls([
    {
      type: "message_end",
      message: {
        content: [
          { type: "toolCall", name: "ralph_start", arguments: {} },
          { type: "toolCall", name: "read", arguments: { path: ".ralph/pi-subagent-v2.md" } },
        ],
      },
    },
    {
      type: "agent_end",
      messages: [
        {
          role: "assistant",
          content: [{ type: "toolCall", name: "ralph_done", arguments: {} }],
        },
      ],
    },
  ]);

  assert.deepEqual(calls, ["ralph_start", "read", "ralph_done"]);
});

test("verifyRalphLoop fails when ralph_start not observed", () => {
  const result = verifyRalphLoop({ rawEvents: [], task: "Execute .ralph/pi-subagent-v2.md", cwd: process.cwd() });
  assert.equal(result.executionContract, "ralph-loop");
  assert.equal(result.contractSatisfied, false);
  assert.equal(result.ralphStartObserved, false);
});

test("verifyRalphLoop succeeds when tool calls and files are present", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-ralph-"));
  const ralphDir = path.join(tmp, ".ralph");
  fs.mkdirSync(ralphDir, { recursive: true });
  fs.writeFileSync(path.join(ralphDir, "pi-subagent-v2.md"), "# Task\n\nupdated");
  fs.writeFileSync(path.join(ralphDir, "pi-subagent-v2.state.json"), JSON.stringify({ iteration: 2 }, null, 2));

  const result = verifyRalphLoop({
    cwd: tmp,
    task: "Execute .ralph/pi-subagent-v2.md",
    rawEvents: [
      {
        type: "message_end",
        message: {
          content: [{ type: "toolCall", name: "ralph_start", arguments: {} }],
        },
      },
      {
        type: "agent_end",
        messages: [
          {
            role: "assistant",
            content: [{ type: "toolCall", name: "ralph_done", arguments: {} }],
          },
        ],
      },
    ],
  });

  assert.equal(result.contractSatisfied, true);
  assert.equal(result.ralphStartObserved, true);
  assert.equal(result.ralphDoneObserved, true);
  assert.equal(result.ralphStateFileFound, true);
  assert.equal(result.ralphIterationAdvanced, true);
  assert.equal(result.ralphTaskFileUpdated, true);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test("getDisplayItems appends unmatched tool results at the end", () => {
  const messages = [
    {
      role: "assistant",
      content: [{ type: "text", text: "done" }],
    },
  ];

  assert.deepEqual(getDisplayItems(messages, [{ toolName: "read", text: "file contents summary" }]), [
    { type: "text", text: "done" },
    { type: "toolResult", toolName: "read", text: "file contents summary" },
  ]);
});

test("runtime lifecycle resolvers prefer explicit options over config defaults", () => {
  const options = {
    prompt: "Task: test",
    cwd: process.cwd(),
    completionPolicy: "agent-end",
    idleTimeoutMs: 1234,
    terminateGraceMs: 5678,
  };

  assert.equal(resolveCompletionPolicy(options), "agent-end");
  assert.equal(resolveIdleTimeoutMs(options), 1234);
  assert.equal(resolveTerminateGraceMs(options), 5678);
});

test("runtime lifecycle resolvers use config defaults when options are omitted", async () => {
  const configPath = path.resolve(process.cwd(), "agent/lib/passto-agent-runtime/config.json");
  const original = fs.readFileSync(configPath, "utf-8");
  const customConfig = {
    subagent: {
      defaults: {
        completionPolicy: "agent-end",
        idleTimeoutMs: 22222,
        terminateGraceMs: 3333,
      },
      contracts: {
        "ralph-loop": {
          completionPolicy: "process-exit",
          idleTimeoutMs: 60000,
          terminateGraceMs: 10000,
        },
      },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2));

  try {
    const guardsModule = await import(`../../../lib/passto-agent-runtime/guards.ts?ts=${Date.now()}`);
    const options = {
      prompt: "Task: test",
      cwd: process.cwd(),
    };

    assert.equal(guardsModule.resolveCompletionPolicy(options), "agent-end");
    assert.equal(guardsModule.resolveIdleTimeoutMs(options), 22222);
    assert.equal(guardsModule.resolveTerminateGraceMs(options), 3333);
  } finally {
    fs.writeFileSync(configPath, original);
  }
});

test("runtime contract lifecycle config reads ralph-loop defaults from config", async () => {
  const configPath = path.resolve(process.cwd(), "agent/lib/passto-agent-runtime/config.json");
  const original = fs.readFileSync(configPath, "utf-8");
  const customConfig = {
    subagent: {
      defaults: {
        completionPolicy: "agent-end",
        idleTimeoutMs: 22222,
        terminateGraceMs: 3333,
      },
      contracts: {
        "ralph-loop": {
          completionPolicy: "process-exit",
          idleTimeoutMs: 44444,
          terminateGraceMs: 7777,
        },
      },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2));

  try {
    const configModule = await import(`../../../lib/passto-agent-runtime/config.ts?ts=${Date.now()}`);
    assert.deepEqual(configModule.getContractLifecycleConfig("ralph-loop"), {
      completionPolicy: "process-exit",
      idleTimeoutMs: 44444,
      terminateGraceMs: 7777,
    });
    assert.deepEqual(configModule.getContractLifecycleConfig("unknown-contract"), {});
  } finally {
    fs.writeFileSync(configPath, original);
  }
});

test("subagent lifecycle overrides use contract config for ralph-loop", async () => {
  const configPath = path.resolve(process.cwd(), "agent/lib/passto-agent-runtime/config.json");
  const original = fs.readFileSync(configPath, "utf-8");
  const customConfig = {
    subagent: {
      defaults: {
        completionPolicy: "agent-end",
        idleTimeoutMs: 22222,
        terminateGraceMs: 3333,
      },
      contracts: {
        "ralph-loop": {
          completionPolicy: "process-exit",
          idleTimeoutMs: 44444,
          terminateGraceMs: 7777,
        },
      },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2));

  try {
    const subagentModule = await import(`../index.ts?ts=${Date.now()}`);
    assert.deepEqual(
      subagentModule.__internal.resolveLifecycleOverrides("ralph-loop", {}),
      {
        completionPolicy: "process-exit",
        idleTimeoutMs: 44444,
        terminateGraceMs: 7777,
      },
    );
  } finally {
    fs.writeFileSync(configPath, original);
  }
});

test("subagent lifecycle overrides prefer explicit values over contract config", async () => {
  const configPath = path.resolve(process.cwd(), "agent/lib/passto-agent-runtime/config.json");
  const original = fs.readFileSync(configPath, "utf-8");
  const customConfig = {
    subagent: {
      defaults: {
        completionPolicy: "agent-end",
        idleTimeoutMs: 22222,
        terminateGraceMs: 3333,
      },
      contracts: {
        "ralph-loop": {
          completionPolicy: "process-exit",
          idleTimeoutMs: 44444,
          terminateGraceMs: 7777,
        },
      },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2));

  try {
    const subagentModule = await import(`../index.ts?ts=${Date.now()}`);
    assert.deepEqual(
      subagentModule.__internal.resolveLifecycleOverrides("ralph-loop", {
        completionPolicy: "agent-end",
        idleTimeoutMs: 999,
        terminateGraceMs: 111,
      }),
      {
        completionPolicy: "agent-end",
        idleTimeoutMs: 999,
        terminateGraceMs: 111,
      },
    );
  } finally {
    fs.writeFileSync(configPath, original);
  }
});

test("runtime lifecycle resolvers fall back when config file is missing", async () => {
  const configPath = path.resolve(process.cwd(), "agent/lib/passto-agent-runtime/config.json");
  const backupPath = `${configPath}.bak-test`;
  fs.renameSync(configPath, backupPath);

  try {
    const guardsModule = await import(`../../../lib/passto-agent-runtime/guards.ts?ts=${Date.now()}`);
    const options = {
      prompt: "Task: test",
      cwd: process.cwd(),
    };

    assert.equal(guardsModule.resolveCompletionPolicy(options), "process-exit");
    assert.equal(guardsModule.resolveIdleTimeoutMs(options), 15000);
    assert.equal(guardsModule.resolveTerminateGraceMs(options), 5000);
  } finally {
    fs.renameSync(backupPath, configPath);
  }
});

test("runSubagent waits for process exit in process-exit mode even after agent_end", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-runtime-"));
  const fakePi = path.join(tmp, "fake-pi.cjs");
  fs.writeFileSync(
    fakePi,
    `#!/usr/bin/env node
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  console.log(JSON.stringify({ type: "agent_start" }));
  console.log(JSON.stringify({
    type: "agent_end",
    messages: [{ role: "assistant", content: [{ type: "text", text: "first done" }], timestamp: 1 }]
  }));
  await sleep(300);
  console.log(JSON.stringify({
    type: "turn_end",
    message: { role: "assistant", content: [{ type: "text", text: "after agent_end" }], timestamp: 2 }
  }));
  process.exit(0);
})();
`,
    { encoding: "utf-8", mode: 0o755 },
  );

  const prevBin = process.env.PI_SUBAGENT_PI_BIN;
  process.env.PI_SUBAGENT_PI_BIN = fakePi;
  const startedAt = Date.now();

  try {
    const result = await runSubagent({
      prompt: "ignored-prompt",
      cwd: process.cwd(),
      noSession: true,
      offline: true,
      noContextFiles: true,
      noPromptTemplates: true,
      noSkills: true,
      noExtensions: true,
      completionPolicy: "process-exit",
      idleTimeoutMs: 2000,
      terminateGraceMs: 200,
      timeoutMs: 5000,
    });

    const elapsed = Date.now() - startedAt;
    assert.equal(result.success, true);
    assert.equal(result.exitCode, 0);
    assert.ok(elapsed >= 250, `expected elapsed >= 250ms, got ${elapsed}`);
    assert.equal(getFinalAssistantText(result.messages), "after agent_end");
  } finally {
    if (prevBin === undefined) delete process.env.PI_SUBAGENT_PI_BIN;
    else process.env.PI_SUBAGENT_PI_BIN = prevBin;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("runSubagent terminates idle child in process-exit mode", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-runtime-"));
  const fakePi = path.join(tmp, "fake-pi-idle.cjs");
  fs.writeFileSync(
    fakePi,
    `#!/usr/bin/env node
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  console.log(JSON.stringify({ type: "agent_start" }));
  console.log(JSON.stringify({
    type: "agent_end",
    messages: [{ role: "assistant", content: [{ type: "text", text: "done but hanging" }], timestamp: 1 }]
  }));
  await sleep(10000);
})();
`,
    { encoding: "utf-8", mode: 0o755 },
  );

  const prevBin = process.env.PI_SUBAGENT_PI_BIN;
  process.env.PI_SUBAGENT_PI_BIN = fakePi;

  try {
    const result = await runSubagent({
      prompt: "ignored-prompt",
      cwd: process.cwd(),
      noSession: true,
      offline: true,
      noContextFiles: true,
      noPromptTemplates: true,
      noSkills: true,
      noExtensions: true,
      completionPolicy: "process-exit",
      idleTimeoutMs: 200,
      terminateGraceMs: 100,
      timeoutMs: 5000,
    });

    assert.equal(result.success, false);
    assert.equal(result.stopReason, "idle_timeout");
    assert.match(result.stderr, /became idle/i);
  } finally {
    if (prevBin === undefined) delete process.env.PI_SUBAGENT_PI_BIN;
    else process.env.PI_SUBAGENT_PI_BIN = prevBin;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("runSubagent exits quickly in agent-end mode without waiting for later output", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-runtime-"));
  const fakePi = path.join(tmp, "fake-pi-agent-end.cjs");
  fs.writeFileSync(
    fakePi,
    `#!/usr/bin/env node
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  console.log(JSON.stringify({ type: "agent_start" }));
  console.log(JSON.stringify({
    type: "agent_end",
    messages: [{ role: "assistant", content: [{ type: "text", text: "agent-end summary" }], timestamp: 1 }]
  }));
  await sleep(400);
  console.log(JSON.stringify({
    type: "turn_end",
    message: { role: "assistant", content: [{ type: "text", text: "too late" }], timestamp: 2 }
  }));
  await sleep(400);
  process.exit(0);
})();
`,
    { encoding: "utf-8", mode: 0o755 },
  );

  const prevBin = process.env.PI_SUBAGENT_PI_BIN;
  process.env.PI_SUBAGENT_PI_BIN = fakePi;
  const startedAt = Date.now();

  try {
    const result = await runSubagent({
      prompt: "ignored-prompt",
      cwd: process.cwd(),
      noSession: true,
      offline: true,
      noContextFiles: true,
      noPromptTemplates: true,
      noSkills: true,
      noExtensions: true,
      completionPolicy: "agent-end",
      idleTimeoutMs: 5000,
      terminateGraceMs: 100,
      timeoutMs: 5000,
    });

    const elapsed = Date.now() - startedAt;
    assert.equal(result.exitCode, 0);
    assert.equal(result.success, true);
    assert.ok(elapsed < 350, `expected elapsed < 350ms, got ${elapsed}`);
    assert.equal(getFinalAssistantText(result.messages), "agent-end summary");
  } finally {
    if (prevBin === undefined) delete process.env.PI_SUBAGENT_PI_BIN;
    else process.env.PI_SUBAGENT_PI_BIN = prevBin;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("runSubagent enforces hard timeout even when child remains active", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-runtime-"));
  const fakePi = path.join(tmp, "fake-pi-timeout.cjs");
  fs.writeFileSync(
    fakePi,
    `#!/usr/bin/env node
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  console.log(JSON.stringify({ type: "agent_start" }));
  let i = 0;
  while (true) {
    console.error("heartbeat:" + i);
    console.log(JSON.stringify({
      type: "turn_end",
      message: { role: "assistant", content: [{ type: "text", text: "tick-" + i }], timestamp: i + 1 }
    }));
    i += 1;
    await sleep(80);
  }
})();
`,
    { encoding: "utf-8", mode: 0o755 },
  );

  const prevBin = process.env.PI_SUBAGENT_PI_BIN;
  process.env.PI_SUBAGENT_PI_BIN = fakePi;
  const startedAt = Date.now();

  try {
    const result = await runSubagent({
      prompt: "ignored-prompt",
      cwd: process.cwd(),
      noSession: true,
      offline: true,
      noContextFiles: true,
      noPromptTemplates: true,
      noSkills: true,
      noExtensions: true,
      completionPolicy: "process-exit",
      idleTimeoutMs: 1000,
      terminateGraceMs: 100,
      timeoutMs: 350,
    });

    const elapsed = Date.now() - startedAt;
    assert.equal(result.success, false);
    assert.equal(result.stopReason, "timeout");
    assert.match(result.stderr, /timed out/i);
    assert.ok(elapsed >= 300, `expected elapsed >= 300ms, got ${elapsed}`);
    assert.ok(elapsed < 1200, `expected elapsed < 1200ms, got ${elapsed}`);
  } finally {
    if (prevBin === undefined) delete process.env.PI_SUBAGENT_PI_BIN;
    else process.env.PI_SUBAGENT_PI_BIN = prevBin;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
