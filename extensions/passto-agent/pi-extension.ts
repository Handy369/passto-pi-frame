import { complete } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import {
  createPasstoAgentUiAdapter,
  runPasstoAgentWithUi,
  setPasstoAgentMarkdownExtractor,
  type PasstoAgentChoiceQuestion,
  type PasstoAgentConfirmQuestion,
  type PasstoAgentMultiSelectQuestion,
  type PasstoAgentTextQuestion,
} from "./index.ts";
import { showPasstoAgentPreviewPanel } from "./src/preview-ui.ts";

async function runMultiselectQuestion(
  question: PasstoAgentMultiSelectQuestion,
  ctx: { ui: { select(title: string, options: string[]): Promise<string | undefined>; input(title: string, placeholder?: string): Promise<string | undefined> } },
): Promise<string[]> {
  const selected: string[] = [];
  const baseOptions = [...question.options];

  while (true) {
    const options = [
      ...baseOptions.filter((option) => !selected.includes(option)),
      ...(question.allowOther ? ["其他输入..."] : []),
      ...(selected.length > 0 ? ["完成选择"] : []),
    ];

    const choice = await ctx.ui.select(question.title, options);
    if (!choice) return selected;
    if (choice === "完成选择") return selected;
    if (choice === "其他输入...") {
      const other = await ctx.ui.input(question.title, question.placeholder);
      if (!other) continue;
      const values = other.split("|").map((item) => item.trim()).filter(Boolean);
      for (const value of values) if (!selected.includes(value)) selected.push(value);
      continue;
    }
    if (!selected.includes(choice)) selected.push(choice);
  }
}

function installMarkdownExtractor(ctx: {
  model?: { provider: string; id: string };
  modelRegistry: {
    find(provider: string, id: string): { provider: string; id: string } | undefined;
    getApiKeyAndHeaders(model: { provider: string; id: string }): Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string>; error?: string }>;
  };
  ui: { notify(message: string, type?: "info" | "warning" | "error"): void };
}) {
  setPasstoAgentMarkdownExtractor(async ({ raw }) => {
    const model = ctx.model
      ?? ctx.modelRegistry.find("openai", "gpt-5.2")
      ?? ctx.modelRegistry.find("openai", "gpt-4.1");

    if (!model) {
      throw new Error("No model available for passto-agent markdown extraction");
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) {
      throw new Error(auth.ok ? `No API key for ${model.provider}/${model.id}` : auth.error ?? "Auth failed");
    }

    const response = await complete(
      model,
      {
        messages: [{
          role: "user",
          content: [{
            type: "text",
            text: [
              "You extract execution-oriented structure from planning markdown.",
              "Return strict JSON only.",
              "Schema:",
              '{"constraints": string[], "todolist": string[], "checklist": string[]}',
              "Rules:",
              "- constraints: boundaries, prohibitions, scope limits, required invariants",
              "- todolist: concrete execution steps the executor should perform",
              "- checklist: validation or acceptance criteria",
              "- do not invent facts not grounded in the markdown",
              "- if uncertain, omit the item",
              "- return empty arrays when not enough evidence exists",
              "",
              "<markdown>",
              raw,
              "</markdown>",
            ].join("\n"),
          }],
          timestamp: Date.now(),
        }],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        reasoningEffort: "medium",
      },
    );

    const text = response.content
      .filter((item): item is { type: "text"; text: string } => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    const parsed = JSON.parse(text) as {
      constraints?: unknown;
      todolist?: unknown;
      checklist?: unknown;
    };

    const toStringArray = (value: unknown): string[] => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];

    return {
      constraints: toStringArray(parsed.constraints),
      todolist: toStringArray(parsed.todolist),
      checklist: toStringArray(parsed.checklist),
    };
  });
}

export default function passtoAgentExtension(pi: ExtensionAPI) {
  const buildUiAdapter = (ctx: {
    ui: {
      select(title: string, options: string[]): Promise<string | undefined>;
      confirm(title: string, message: string): Promise<boolean>;
      input(title: string, placeholder?: string): Promise<string | undefined>;
      notify(message: string, type?: "info" | "warning" | "error"): void;
    };
  }) => createPasstoAgentUiAdapter({
    async choose(question: PasstoAgentChoiceQuestion): Promise<string> {
      const options = question.allowOther ? [...question.options, "其他输入..."] : [...question.options];
      const choice = await ctx.ui.select(question.title, options);
      if (!choice) throw new Error(`User cancelled: ${question.title}`);
      if (choice === "其他输入...") {
        const other = await ctx.ui.input(question.title, question.placeholder);
        if (!other?.trim()) throw new Error(`User cancelled: ${question.title}`);
        return other.trim();
      }
      return choice;
    },
    async multiselect(question: PasstoAgentMultiSelectQuestion): Promise<string[]> {
      return runMultiselectQuestion(question, ctx);
    },
    async prompt(question: PasstoAgentTextQuestion): Promise<string> {
      const value = await ctx.ui.input(question.title, question.placeholder ?? question.prefill);
      if (value === undefined) throw new Error(`User cancelled: ${question.title}`);
      return value;
    },
    async confirm(question: PasstoAgentConfirmQuestion): Promise<boolean> {
      return ctx.ui.confirm(question.title, question.message);
    },
    preview(payload) {
      return showPasstoAgentPreviewPanel(payload, ctx);
    },
  });

  pi.registerCommand("passto-agent", {
    description: "Run passto-agent interactive task construction and execution flow",
    handler: async (args, ctx) => {
      let input = args.trim();
      if (!input) {
        ctx.ui.notify("passto-agent: 输入自然语言任务需求，或输入本地 markdown 文档路径。", "info");
        input = (await ctx.ui.input("请输入任务需求或 markdown 文档路径", "Describe the task or provide /path/to/task.md"))?.trim() ?? "";
      }
      if (!input) return;

      installMarkdownExtractor(ctx);
      const result = await runPasstoAgentWithUi({
        input,
        cwd: ctx.cwd,
        execute: true,
        ui: buildUiAdapter(ctx),
      });

      if (result.executed) {
        ctx.ui.notify(`passto-agent 已执行: ${result.taskDocPath}`, "info");
      } else if (result.needsConfirmation || result.missingFields.length > 0) {
        ctx.ui.notify(`passto-agent 未执行，缺失: ${result.missingFields.join(", ") || "无"}`, "warning");
      } else {
        ctx.ui.notify(`passto-agent 已生成 task-doc: ${result.taskDocPath}`, "info");
      }
    },
  });

  pi.registerTool({
    name: "passto_agent",
    label: "Passto Agent",
    description: "Interactive passto-agent entrypoint that turns user input into a passto-executor task document and optionally executes it.",
    parameters: Type.Object({
      input: Type.Optional(Type.String({ description: "Natural language task request or local markdown task-doc path." })),
      execute: Type.Optional(Type.Boolean({ description: "Whether to execute after confirmation. Defaults to true." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const adapter = buildUiAdapter(ctx);
      let input = params.input?.trim();
      if (!input) {
        ctx.ui.notify("passto-agent: 请输入自然语言任务需求，或输入本地 markdown 文档路径。", "info");
        input = await ctx.ui.input("请输入任务需求或 markdown 文档路径", "Describe the task or provide /path/to/task.md");
      }
      if (!input?.trim()) {
        return {
          content: [{ type: "text", text: "passto-agent cancelled: no input provided." }],
          details: { cancelled: true },
        };
      }

      installMarkdownExtractor(ctx);
      const result = await runPasstoAgentWithUi({
        input: input.trim(),
        cwd: ctx.cwd,
        execute: params.execute !== false,
        ui: adapter,
      });

      return {
        content: [{
          type: "text",
          text: result.executed
            ? `passto-agent executed ${result.stage} via ${result.taskDocPath}`
            : `passto-agent prepared ${result.stage} task-doc at ${result.taskDocPath}`,
        }],
        details: result,
      };
    },
  });
}
