// ============================================================
// agent-web-search-pro v2 — LLM-First Next Query Generation (Phase 2.5)
// ============================================================
// Selects the most valuable open gaps and proposes focused next queries
// using the local Pi LLM invocation path.
//
// Design constraints:
// - Only use provided original query / gaps / knowledge / asked queries
// - Return structured output that can be validated strictly
// - Do not silently invent broad or generic searches
// - Keep this module side-effect free

import type {
  AskedQuery,
  KnowledgeItem,
  ResearchGap,
  ResearchPlan,
} from "../types.js";

export type LlmModelRef = {
  id: string;
  name: string;
  provider: string;
  api: string;
  baseUrl: string;
};

export interface LlmNextQueryContext {
  model: LlmModelRef;
  apiKey: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface LlmNextQueryItem {
  query: string;
  gapId?: string;
  derivedFrom: string;
}

export interface LlmNextQueryOutput {
  selectedGapIds: string[];
  queries: LlmNextQueryItem[];
}

interface RawLlmNextQueryOutput {
  selectedGapIds: string[];
  queries: Array<{
    query: string;
    gapId?: string;
    derivedFrom: string;
  }>;
}

function buildPrompt(params: {
  originalQuery: string;
  plan?: ResearchPlan;
  knowledge: KnowledgeItem[];
  openGaps: ResearchGap[];
  askedQueries: AskedQuery[];
  maxQueries?: number;
}): string {
  const { originalQuery, plan, knowledge, openGaps, askedQueries, maxQueries = 3 } = params;
  const adopted = knowledge
    .filter((k) => k.adopted)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10)
    .map((k) => ({
      title: k.title,
      sourceUrl: k.sourceUrl,
      summary: k.summary,
      keyFacts: k.keyFacts.slice(0, 4),
      relevanceScore: k.relevanceScore,
    }));

  const candidateGaps = openGaps
    .filter((g) => !g.queried)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)
    .map((g, i) => ({
      gapId: `gap-${i + 1}`,
      description: g.description,
      aspect: g.aspect,
      type: g.type,
      priority: g.priority,
      suggestedQuery: g.suggestedQuery,
    }));

  return [
    "You are a follow-up query planner for a bounded research loop.",
    "Your job is to choose the highest-value remaining gaps and propose the next 1 to 3 search queries.",
    "Use ONLY the provided original query, plan, knowledge, gaps, and asked queries.",
    "Do not invent new facts. Do not produce generic searches.",
    "Preserve key entities from the original query, especially for comparisons.",
    "Return ONLY valid JSON. No markdown fences. No explanation outside JSON.",
    "",
    `originalQuery: ${JSON.stringify(originalQuery)}`,
    `planAspects: ${JSON.stringify(plan?.aspects ?? [])}`,
    `maxQueries: ${maxQueries}`,
    "",
    `askedQueries: ${JSON.stringify(askedQueries.map((q) => q.query), null, 2)}`,
    "",
    `candidateGaps: ${JSON.stringify(candidateGaps, null, 2)}`,
    "",
    `knowledge: ${JSON.stringify(adopted, null, 2)}`,
    "",
    "Return JSON with this exact shape:",
    JSON.stringify(
      {
        selectedGapIds: ["gap-1"],
        queries: [
          {
            query: "具体且不泛化的下一步搜索词",
            gapId: "gap-1",
            derivedFrom: "为什么这个查询能补该 gap",
          },
        ],
      },
      null,
      2,
    ),
    "",
    "Hard requirements:",
    "- choose at most 1 to 2 gaps and at most maxQueries queries",
    "- queries must be concrete and non-generic",
    "- do not repeat already asked queries",
    "- comparison queries must preserve both compared entities if the original query compares two things",
    "- factual queries must target the missing claim/constraint, not just say '详细介绍' or similar weak variants",
    "- solution/design queries must preserve the target system and design intent",
  ].join("\n");
}

async function callLlm(ctx: LlmNextQueryContext, prompt: string): Promise<string> {
  // @ts-ignore runtime dependency is available in Pi, but may be invisible to local extension ts resolution
  const { complete } = await import("@mariozechner/pi-ai");

  const response = await complete(
    ctx.model,
    {
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
          timestamp: Date.now(),
        },
      ],
    },
    {
      apiKey: ctx.apiKey,
      headers: ctx.headers,
      maxTokens: 2048,
      signal: ctx.signal,
    },
  );

  const text = response.content
    .filter((c: { type: string; text?: string }): c is { type: "text"; text: string } => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("LLM returned empty response");
  return text;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last <= first) throw new Error("No JSON object found in LLM output");
  return candidate.slice(first, last + 1);
}

function looksGeneric(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 6) return true;
  const banned = [
    "ai tools",
    "openai docs",
    "observability",
    "pricing",
    "example",
    "limitations",
    "详细介绍",
    "更多介绍",
  ];
  return banned.includes(q);
}

function validateOutput(parsed: RawLlmNextQueryOutput, maxQueries: number): LlmNextQueryOutput {
  if (!Array.isArray(parsed.selectedGapIds)) throw new Error("Invalid selectedGapIds");
  if (!Array.isArray(parsed.queries)) throw new Error("Invalid queries field");

  const queries = parsed.queries
    .filter((q) => q && typeof q.query === "string" && typeof q.derivedFrom === "string")
    .map((q) => ({
      query: q.query.trim(),
      gapId: typeof q.gapId === "string" ? q.gapId : undefined,
      derivedFrom: q.derivedFrom.trim(),
    }))
    .filter((q) => q.query.length > 0 && q.derivedFrom.length > 0)
    .slice(0, Math.max(1, maxQueries));

  if (queries.length === 0) throw new Error("No valid queries produced");
  if (queries.some((q) => looksGeneric(q.query))) throw new Error("Generated queries are too generic");

  return {
    selectedGapIds: parsed.selectedGapIds.filter((x) => typeof x === "string"),
    queries,
  };
}

export async function generateNextQueriesWithLlm(
  params: {
    originalQuery: string;
    plan?: ResearchPlan;
    knowledge: KnowledgeItem[];
    openGaps: ResearchGap[];
    askedQueries: AskedQuery[];
    maxQueries?: number;
  },
  ctx: LlmNextQueryContext,
): Promise<LlmNextQueryOutput> {
  const prompt = buildPrompt(params);
  const raw = await callLlm(ctx, prompt);
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as RawLlmNextQueryOutput;
  return validateOutput(parsed, params.maxQueries ?? 3);
}

export const __internal = {
  buildPrompt,
  extractJson,
  validateOutput,
  looksGeneric,
};
