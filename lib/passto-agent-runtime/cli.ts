import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { PiChildRunOptions, SessionMode } from "./types.ts";

export const SUBAGENT_DEPTH_ENV = "PI_SUBAGENT_DEPTH";
export const SUBAGENT_MAX_DEPTH_ENV = "PI_SUBAGENT_MAX_DEPTH";
export const SUBAGENT_STACK_ENV = "PI_SUBAGENT_STACK";
export const SUBAGENT_PREVENT_CYCLES_ENV = "PI_SUBAGENT_PREVENT_CYCLES";
export const PI_OFFLINE_ENV = "PI_OFFLINE";

export type InheritedCliArgs = {
  extensionArgs: string[];
  alwaysProxy: string[];
  fallbackModel?: string;
  fallbackThinking?: string;
  fallbackTools?: string;
  fallbackNoTools: boolean;
};

function looksLikeExplicitRelativePath(value: string): boolean {
  return (
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith(".\\") ||
    value.startsWith("..\\")
  );
}

function resolvePathArg(
  value: string,
  options: { allowPackageSource?: boolean; alwaysResolveRelative?: boolean } = {},
): string {
  const { allowPackageSource = false, alwaysResolveRelative = false } = options;
  if (!value) return value;
  if (allowPackageSource && (value.startsWith("npm:") || value.startsWith("git:"))) return value;
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  if (path.isAbsolute(value)) return value;

  const resolved = path.resolve(process.cwd(), value);
  if (
    alwaysResolveRelative ||
    looksLikeExplicitRelativePath(value) ||
    path.extname(value) !== "" ||
    fs.existsSync(resolved)
  ) {
    return resolved;
  }
  return value;
}

export function parseInheritedCliArgs(argv: string[]): InheritedCliArgs {
  const extensionArgs: string[] = [];
  const alwaysProxy: string[] = [];
  let fallbackModel: string | undefined;
  let fallbackThinking: string | undefined;
  let fallbackTools: string | undefined;
  let fallbackNoTools = false;

  let i = 2;
  while (i < argv.length) {
    const raw = argv[i];
    if (!raw.startsWith("-")) {
      i += 1;
      continue;
    }

    const eqIdx = raw.indexOf("=");
    const flagName = eqIdx !== -1 ? raw.slice(0, eqIdx) : raw;
    const inlineValue = eqIdx !== -1 ? raw.slice(eqIdx + 1) : undefined;
    const nextToken = argv[i + 1];
    const nextIsValue = nextToken !== undefined && !nextToken.startsWith("-");

    const getValue = (): [string | undefined, number] => {
      if (inlineValue !== undefined) return [inlineValue, 1];
      if (nextIsValue) return [nextToken, 2];
      return [undefined, 1];
    };

    if (["--mode", "--session", "--append-system-prompt", "--export", "--subagent-max-depth"].includes(flagName)) {
      const [, skip] = getValue();
      i += skip;
      continue;
    }

    if (["--subagent-prevent-cycles", "--list-models"].includes(flagName)) {
      const [, skip] = getValue();
      i += skip;
      continue;
    }

    if (["--print", "-p", "--no-session", "--continue", "-c", "--resume", "-r", "--offline", "--help", "-h", "--version", "-v", "--no-subagent-prevent-cycles"].includes(flagName)) {
      i += 1;
      continue;
    }

    if (flagName === "--no-extensions" || flagName === "-ne") {
      extensionArgs.push(flagName);
      i += 1;
      continue;
    }

    if (flagName === "--extension" || flagName === "-e") {
      const [value, skip] = getValue();
      if (value !== undefined) extensionArgs.push(flagName, resolvePathArg(value, { allowPackageSource: true }));
      i += skip;
      continue;
    }

    if (["--skill", "--prompt-template", "--theme"].includes(flagName)) {
      const [value, skip] = getValue();
      if (value !== undefined) alwaysProxy.push(flagName, resolvePathArg(value));
      i += skip;
      continue;
    }

    if (flagName === "--session-dir") {
      const [value, skip] = getValue();
      if (value !== undefined) alwaysProxy.push(flagName, resolvePathArg(value, { alwaysResolveRelative: true }));
      i += skip;
      continue;
    }

    if (["--provider", "--api-key", "--system-prompt", "--models"].includes(flagName)) {
      const [value, skip] = getValue();
      if (value !== undefined) alwaysProxy.push(flagName, value);
      i += skip;
      continue;
    }

    if (["--no-skills", "-ns", "--no-prompt-templates", "-np", "--no-themes", "--verbose"].includes(flagName)) {
      alwaysProxy.push(flagName);
      i += 1;
      continue;
    }

    if (flagName === "--model") {
      const [value, skip] = getValue();
      if (value !== undefined) fallbackModel = value;
      i += skip;
      continue;
    }

    if (flagName === "--thinking") {
      const [value, skip] = getValue();
      if (value !== undefined) fallbackThinking = value;
      i += skip;
      continue;
    }

    if (flagName === "--tools") {
      const [value, skip] = getValue();
      if (value !== undefined) fallbackTools = value;
      i += skip;
      continue;
    }

    if (flagName === "--no-tools") {
      fallbackNoTools = true;
      i += 1;
      continue;
    }

    if (inlineValue !== undefined) {
      alwaysProxy.push(flagName, inlineValue);
      i += 1;
      continue;
    }

    if (nextIsValue) {
      alwaysProxy.push(flagName, nextToken);
      i += 2;
      continue;
    }

    alwaysProxy.push(flagName);
    i += 1;
  }

  return {
    extensionArgs,
    alwaysProxy,
    fallbackModel,
    fallbackThinking,
    fallbackTools,
    fallbackNoTools,
  };
}

export function normalizeThinkingLevel(level: string | undefined): string | undefined {
  if (!level) return undefined;
  const normalized = level.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "minimal") return "low";
  if (normalized === "xhigh") return "high";
  return normalized;
}

export function resolvePiInvocation(): { command: string; prefixArgs: string[] } {
  const explicitPiBin = process.env.PI_SUBAGENT_PI_BIN?.trim();
  if (explicitPiBin) {
    return { command: explicitPiBin, prefixArgs: [] };
  }

  const isNode = /[\\/]node(?:\.exe)?$/i.test(process.execPath);
  const argv1 = process.argv[1] ?? "";
  const looksLikePiEntry = Boolean(argv1) && (
    argv1.includes("@mariozechner/pi-coding-agent") ||
    /(^|[\\/])pi(?:\.[cm]?[jt]s)?$/i.test(argv1) ||
    /(^|[\\/])cli(?:\.[cm]?[jt]s)?$/i.test(argv1)
  );

  if (isNode && looksLikePiEntry) {
    return { command: process.execPath, prefixArgs: [argv1] };
  }

  return { command: "pi", prefixArgs: [] };
}

export function writePromptToTempFile(label: string, prompt: string): { dir: string; filePath: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-"));
  const safeName = label.replace(/[^\w.-]+/g, "_");
  const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
  fs.writeFileSync(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
  return { dir: tmpDir, filePath };
}

export function writeForkSessionToTempFile(label: string, sessionJsonl: string): { dir: string; filePath: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-"));
  const safeName = label.replace(/[^\w.-]+/g, "_");
  const filePath = path.join(tmpDir, `fork-${safeName}.jsonl`);
  fs.writeFileSync(filePath, sessionJsonl, { encoding: "utf-8", mode: 0o600 });
  return { dir: tmpDir, filePath };
}

export function cleanupTempDir(dir: string | null | undefined): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
}

export type BuildPiArgsInput = {
  options: PiChildRunOptions;
  inherited?: InheritedCliArgs;
  systemPromptPath?: string | null;
  forkSessionPath?: string | null;
};

export function resolveSessionMode(mode: SessionMode | undefined): SessionMode {
  return mode ?? "spawn";
}

export function buildPiArgs(input: BuildPiArgsInput): string[] {
  const { options, inherited, systemPromptPath, forkSessionPath } = input;
  const sessionMode = resolveSessionMode(options.sessionMode);
  const inheritedCli = inherited ?? parseInheritedCliArgs(process.argv);

  const inheritedExtensionArgs = options.inheritParentExtensions === false ? [] : inheritedCli.extensionArgs;

  const args: string[] = [
    "--mode",
    "json",
    ...inheritedExtensionArgs,
    ...inheritedCli.alwaysProxy,
    "-p",
  ];

  const noSession = options.noSession !== false;
  if (sessionMode === "spawn") {
    if (noSession) args.push("--no-session");
  } else {
    if (!forkSessionPath) {
      throw new Error("fork mode requires forkSessionPath");
    }
    args.push("--session", forkSessionPath);
  }

  const model = options.model ?? inheritedCli.fallbackModel;
  if (model) args.push("--model", model);

  const thinking = normalizeThinkingLevel(options.thinking ?? inheritedCli.fallbackThinking);
  if (thinking) args.push("--thinking", thinking);

  if (options.tools && options.tools.length > 0) {
    args.push("--tools", options.tools.join(","));
  } else if (options.noTools) {
    args.push("--no-tools");
  } else if (inheritedCli.fallbackTools !== undefined) {
    args.push("--tools", inheritedCli.fallbackTools);
  } else if (inheritedCli.fallbackNoTools) {
    args.push("--no-tools");
  }

  if (options.noExtensions) {
    args.push("--no-extensions");
  } else if (options.extensions && options.extensions.length > 0) {
    for (const extension of options.extensions) {
      args.push("--extension", extension);
    }
  }

  if (options.noSkills) {
    args.push("--no-skills");
  } else if (options.skills && options.skills.length > 0) {
    for (const skill of options.skills) {
      args.push("--skill", skill);
    }
  }

  if (options.noPromptTemplates) args.push("--no-prompt-templates");
  if (options.noContextFiles) args.push("--no-context-files");
  if (options.offline) args.push("--offline");
  if (systemPromptPath) args.push("--append-system-prompt", systemPromptPath);
  if (options.extraArgs && options.extraArgs.length > 0) args.push(...options.extraArgs);
  args.push(options.prompt);

  return args;
}
