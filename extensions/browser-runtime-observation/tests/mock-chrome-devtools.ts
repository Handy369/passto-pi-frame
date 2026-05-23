import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "mcp__chrome-devtools-mcp__navigate_page",
    label: "Mock Navigate Page",
    description: "Mock navigate_page tool with real chrome-devtools-mcp naming.",
    promptSnippet: "Mock real-style chrome-devtools-mcp navigate_page tool.",
    parameters: Type.Object({
      url: Type.Optional(Type.String({ description: "Target URL" })),
      type: Type.Optional(Type.String({ description: "Navigation type" })),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `Navigated to ${params.url ?? "current page"}` }],
        details: { mock: true, tool: "navigate_page", url: params.url ?? null },
      };
    },
  });

  pi.registerTool({
    name: "mcp__chrome-devtools-mcp__take_snapshot",
    label: "Mock Take Snapshot",
    description: "Mock take_snapshot tool with real chrome-devtools-mcp naming.",
    promptSnippet: "Mock real-style chrome-devtools-mcp take_snapshot tool.",
    parameters: Type.Object({
      filePath: Type.Optional(Type.String({ description: "Optional file path" })),
      verbose: Type.Optional(Type.Boolean({ description: "Verbose snapshot" })),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: 'uid=1_0 RootWebArea "Example Domain" url="https://example.com/"\n  uid=1_1 heading "Example Domain" level="1"\n  uid=1_2 main\n  uid=1_3 navigation "Primary"' }],
        details: { mock: true, tool: "take_snapshot", title: "Example Domain", filePath: params.filePath ?? null },
      };
    },
  });

  pi.registerTool({
    name: "mcp__chrome-devtools-mcp__list_console_messages",
    label: "Mock List Console Messages",
    description: "Mock list_console_messages tool with real chrome-devtools-mcp naming.",
    promptSnippet: "Mock real-style chrome-devtools-mcp list_console_messages tool.",
    parameters: Type.Object({
      types: Type.Optional(Type.Array(Type.String(), { description: "Console types" })),
      pageIdx: Type.Optional(Type.Number({ description: "Page index" })),
      pageSize: Type.Optional(Type.Number({ description: "Page size" })),
      includePreservedMessages: Type.Optional(Type.Boolean({ description: "Include preserved messages" })),
    }),
    async execute() {
      return {
        content: [{ type: "text", text: "Console messages: 0 errors, 0 warnings, 0 issues." }],
        details: { mock: true, tool: "list_console_messages", errors: 0, warnings: 0, issues: 0 },
      };
    },
  });

  pi.registerTool({
    name: "mcp__chrome-devtools-mcp__list_network_requests",
    label: "Mock List Network Requests",
    description: "Mock list_network_requests tool with real chrome-devtools-mcp naming.",
    promptSnippet: "Mock real-style chrome-devtools-mcp list_network_requests tool.",
    parameters: Type.Object({
      resourceTypes: Type.Optional(Type.Array(Type.String(), { description: "Resource types" })),
      pageIdx: Type.Optional(Type.Number({ description: "Page index" })),
      pageSize: Type.Optional(Type.Number({ description: "Page size" })),
      includePreservedRequests: Type.Optional(Type.Boolean({ description: "Include preserved requests" })),
    }),
    async execute() {
      return {
        content: [{ type: "text", text: "Network requests: 1 successful document request, 0 failed requests." }],
        details: { mock: true, tool: "list_network_requests", successfulRequests: 1, failedRequests: 0 },
      };
    },
  });

  pi.registerTool({
    name: "mcp__chrome-devtools-mcp__lighthouse_audit",
    label: "Mock Lighthouse Audit",
    description: "Mock lighthouse_audit tool with real chrome-devtools-mcp naming.",
    promptSnippet: "Mock real-style chrome-devtools-mcp lighthouse_audit tool.",
    parameters: Type.Object({
      mode: Type.Optional(Type.String({ description: "Audit mode" })),
      device: Type.Optional(Type.String({ description: "Device" })),
      outputDirPath: Type.Optional(Type.String({ description: "Output directory" })),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: "Lighthouse summary: accessibility=1, seo=1, bestPractices=1." }],
        details: {
          mock: true,
          tool: "lighthouse_audit",
          accessibility: 1,
          seo: 1,
          bestPractices: 1,
          outputDirPath: params.outputDirPath ?? null,
        },
      };
    },
  });

  pi.registerTool({
    name: "mcp__chrome-devtools-mcp__evaluate_script",
    label: "Mock Evaluate Script",
    description: "Mock evaluate_script tool with real chrome-devtools-mcp naming.",
    promptSnippet: "Mock real-style chrome-devtools-mcp evaluate_script tool.",
    parameters: Type.Object({
      function: Type.String({ description: "Function source" }),
      args: Type.Optional(Type.Array(Type.Unknown(), { description: "Optional args" })),
    }),
    async execute() {
      return {
        content: [{ type: "text", text: "title=Example Domain; lang=en" }],
        details: { mock: true, tool: "evaluate_script", title: "Example Domain", lang: "en" },
      };
    },
  });

  pi.registerTool({
    name: "mcp__chrome-devtools-mcp__performance_start_trace",
    label: "Mock Performance Start Trace",
    description: "Mock performance_start_trace tool with real chrome-devtools-mcp naming.",
    promptSnippet: "Mock real-style chrome-devtools-mcp performance_start_trace tool.",
    parameters: Type.Object({
      reload: Type.Optional(Type.Boolean({ description: "Reload page" })),
      autoStop: Type.Optional(Type.Boolean({ description: "Auto stop trace" })),
      filePath: Type.Optional(Type.String({ description: "Trace file path" })),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: "Performance trace captured: lcp=1234, cls=0.03, inp=98, tbt=12." }],
        details: {
          mock: true,
          tool: "performance_start_trace",
          filePath: params.filePath ?? null,
          lcpMs: 1234,
          cls: 0.03,
          inpMs: 98,
          totalBlockingTimeMs: 12,
        },
      };
    },
  });

  pi.registerTool({
    name: "mcp__chrome-devtools-mcp__take_memory_snapshot",
    label: "Mock Take Memory Snapshot",
    description: "Mock take_memory_snapshot tool with real chrome-devtools-mcp naming.",
    promptSnippet: "Mock real-style chrome-devtools-mcp take_memory_snapshot tool.",
    parameters: Type.Object({
      filePath: Type.String({ description: "Heap snapshot file path" }),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: "Memory snapshot captured: heapNodes=4096, retainedSizeMb=12.5." }],
        details: {
          mock: true,
          tool: "take_memory_snapshot",
          filePath: params.filePath,
          heapNodes: 4096,
          retainedSizeMb: 12.5,
        },
      };
    },
  });
}
