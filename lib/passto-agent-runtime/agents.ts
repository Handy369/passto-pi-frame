import * as fs from "node:fs";
import * as path from "node:path";
import type {
  AgentProfile,
  PiChildRunOptions,
  SubagentRuntimeWarning,
} from "./types.ts";

const AGENTS_DIR = "/Users/handy/.pi/agent/lib/passto-agent-runtime/agents";

function looksLikePath(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.endsWith(".md");
}

function normalizeStringArray(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
}

export function resolveAgentProfilePath(agent: string | undefined): string | undefined {
  if (!agent) return undefined;
  if (looksLikePath(agent)) return path.isAbsolute(agent) ? agent : path.resolve(process.cwd(), agent);
  return path.join(AGENTS_DIR, `${agent}.md`);
}

export function parseAgentProfileMarkdown(filePath: string): AgentProfile {
  const raw = fs.readFileSync(filePath, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const frontmatter = match?.[1] ?? "";
  const body = (match?.[2] ?? raw).trim();
  const meta: Record<string, string> = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }

  return {
    name: meta.name || path.basename(filePath, ".md"),
    description: meta.description,
    provider: meta.provider,
    model: meta.model,
    thinking: meta.thinking,
    tools: normalizeStringArray(meta.tools),
    skills: normalizeStringArray(meta.skills),
    extensions: normalizeStringArray(meta.extensions),
    inheritParentExtensions: parseBoolean(meta.inheritParentExtensions),
    sessionMode: meta.sessionMode === "fork" ? "fork" : meta.sessionMode === "spawn" ? "spawn" : undefined,
    timeoutMs: meta.timeoutMs ? Number(meta.timeoutMs) : undefined,
    completionPolicy: meta.completionPolicy === "agent-end" ? "agent-end" : meta.completionPolicy === "process-exit" ? "process-exit" : undefined,
    idleTimeoutMs: meta.idleTimeoutMs ? Number(meta.idleTimeoutMs) : undefined,
    terminateGraceMs: meta.terminateGraceMs ? Number(meta.terminateGraceMs) : undefined,
    maxDepth: meta.maxDepth ? Number(meta.maxDepth) : undefined,
    systemPrompt: body,
    filePath,
  };
}

export function loadAgentProfile(agent: string | undefined): AgentProfile | undefined {
  const filePath = resolveAgentProfilePath(agent);
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  return parseAgentProfileMarkdown(filePath);
}

export function applyAgentProfileDefaults(options: PiChildRunOptions, profile: AgentProfile | undefined): PiChildRunOptions {
  if (!profile) return options;

  const systemPrompt = [profile.systemPrompt, options.appendSystemPrompt].filter((item) => item && item.trim()).join("\n\n");

  return {
    ...options,
    provider: options.provider ?? profile.provider,
    model: options.model ?? profile.model,
    thinking: options.thinking ?? profile.thinking,
    tools: options.tools ?? profile.tools,
    skills: options.skills ?? profile.skills,
    extensions: options.extensions ?? profile.extensions,
    inheritParentExtensions: options.inheritParentExtensions ?? profile.inheritParentExtensions,
    sessionMode: options.sessionMode ?? profile.sessionMode,
    timeoutMs: options.timeoutMs ?? profile.timeoutMs,
    completionPolicy: options.completionPolicy ?? profile.completionPolicy,
    idleTimeoutMs: options.idleTimeoutMs ?? profile.idleTimeoutMs,
    terminateGraceMs: options.terminateGraceMs ?? profile.terminateGraceMs,
    maxDepth: options.maxDepth ?? profile.maxDepth,
    appendSystemPrompt: systemPrompt || undefined,
  };
}

export function deriveRuntimeWarnings(input: {
  requested: PiChildRunOptions;
  resolved: PiChildRunOptions;
  profile?: AgentProfile;
  inherited: { fallbackProvider?: string; fallbackModel?: string; extensionArgs: string[] };
}): SubagentRuntimeWarning[] {
  const { requested, resolved, profile, inherited } = input;
  const warnings: SubagentRuntimeWarning[] = [];

  const effectiveProvider = resolved.provider ?? inherited.fallbackProvider ?? profile?.provider;
  const hasInheritedExtensions = inherited.extensionArgs.length > 0;
  const hasExplicitExtensions = (resolved.extensions?.length ?? 0) > 0;
  const inheritParentExtensions = resolved.inheritParentExtensions === true;

  if (effectiveProvider && hasInheritedExtensions && !inheritParentExtensions && !hasExplicitExtensions) {
    warnings.push({
      code: "provider_without_extension_inheritance",
      message:
        `Child will use provider "${effectiveProvider}" but parent extensions are not inherited and no child extensions were provided. ` +
        `If this provider is registered by a parent --extension, the child may fail to resolve it.`,
    });
  }

  if (effectiveProvider && !inheritParentExtensions && !hasExplicitExtensions) {
    warnings.push({
      code: "provider_with_no_child_extensions",
      message:
        `Child provider is "${effectiveProvider}" with no inherited or explicit extensions. ` +
        `This is safe only if the provider is built-in or otherwise available without extension registration.`,
    });
  }

  if (
    profile?.model &&
    inherited.fallbackModel &&
    requested.model === undefined &&
    resolved.model === profile.model &&
    profile.model !== inherited.fallbackModel
  ) {
    warnings.push({
      code: "profile_model_overrides_parent_model",
      message:
        `Agent profile model "${profile.model}" overrides inherited parent model "${inherited.fallbackModel}" because no explicit child model was provided.`,
    });
  }

  return warnings;
}
