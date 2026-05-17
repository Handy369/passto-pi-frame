import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = path.dirname(new URL(import.meta.url).pathname);
const CACHE_FILE = path.join(CACHE_DIR, "models.dev-api.json");

// 规范化字符串：只保留英文字母和数字，转小写
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// 裁剪模型名末尾的后缀（去掉多余部分，保留核心名称）
// 规则：取到最后一个数字部分，再扩展一次后缀（多取一个 - 后的部分），去掉修饰词（high/low等）
function trimModelName(name: string): string {
  // 预处理：去掉日期后缀和版本号后缀
  let n = name
    .replace(/[-_](?:20\d{2}[-_]?\d{2,4})$/gi, "")
    .replace(/[-_]+v\d+(?:\.\d+)*$/gi, "");

  const parts = n.split("-");

  // 找到最后一个包含数字的部分
  let lastDigitIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/\d/.test(parts[i])) {
      lastDigitIdx = i;
      break;
    }
  }
  if (lastDigitIdx === -1) return n; // 没有数字，不裁剪

  // 取到最后一个数字部分
  let endIdx = lastDigitIdx;
  // 扩展一次：多取一个 - 后的英文（模型变体名，如 pro/plus/flash）
  if (endIdx + 1 < parts.length) {
    endIdx++;
  }

  const result = parts.slice(0, endIdx + 1).join("-");
  const resultParts = result.split("-");
  const lastPart = resultParts[resultParts.length - 1];

  // 如果扩展到的仍是修饰词（high/low 等），去掉
  if (/^(high|low|free|uncensored|customtools)$/i.test(lastPart) && resultParts.length > lastDigitIdx + 1) {
    return resultParts.slice(0, -1).join("-");
  }

  return result;
}

// 从 models.dev 缓存中查找匹配的模型（用包含关系匹配，选最优结果）
// 匹配规则：JSON 缓存中的模型名规范化后 **包含** 裁剪后的远程模型名规范化结果
function lookupModelInCache(
  cache: Record<string, any>,
  modelName: string
): { contextWindow: number; reasoning: boolean; cost: any; maxTokens: number; found: boolean } {
  // 先裁剪后缀，再规范化
  const trimmed = trimModelName(modelName);
  const normalizedInput = normalize(trimmed);

  type Match = {
    contextWindow: number;
    reasoning: boolean;
    cost: any;
    maxTokens: number;
    score: number; // 匹配质量：精确匹配最优
  };

  let bestMatch: Match | null = null;

  for (const providerKey of Object.keys(cache)) {
    // 忽略 302ai（信息不准）
    if (providerKey.toLowerCase() === "302ai") continue;

    const provider = cache[providerKey];
    if (!provider || !provider.models) continue;

    for (const modelId of Object.keys(provider.models)) {
      const model = provider.models[modelId];
      const cacheName = model.name || modelId;
      const normalizedCache = normalize(cacheName);

      // 包含匹配：JSON 缓存名 包含 裁剪后的远程模型名
      if (!normalizedCache.includes(normalizedInput)) {
        continue;
      }

      // 精确匹配时给更高分
      const score = normalizedCache === normalizedInput ? 100 : 50;

      const limit = model.limit || {};
      const cost = model.cost || {};
      // 上下文窗口取值：有 input 取 input，否则取 context - output
      const rawCtx = limit.input != null
        ? limit.input
        : (limit.context || 0) - (limit.output || 0);
      const contextWindow = rawCtx > 0 ? rawCtx : 131072;

      const candidate: Match = {
        contextWindow, reasoning: model.reasoning ?? false,
        cost: { input: cost.input ?? 0, output: cost.output ?? 0, cacheRead: cost.cache_read ?? 0, cacheWrite: cost.cache_write ?? 0 },
        maxTokens: Math.min(limit.output || 16384, 8192),
        score,
      };

      // 同 score 下取上下文更大的
      if (!bestMatch || score > bestMatch.score ||
          (score === bestMatch.score && contextWindow > bestMatch.contextWindow)) {
        bestMatch = candidate;
      }
    }
  }

  if (bestMatch) {
    return { ...bestMatch, found: true };
  }

  return {
    contextWindow: 131072, reasoning: false,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 8192, found: false,
  };
}

// 读取本地缓存
function readCache(): Record<string, any> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn("[PASSTOAI-TW] 读取本地缓存失败:", e);
  }
  return {};
}

// 写入本地缓存
function writeCache(data: Record<string, any>): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("[PASSTOAI-TW] 写入本地缓存失败:", e);
  }
}

// 从 models.dev 获取最新 API 数据
async function fetchModelsDevAPI(): Promise<Record<string, any> | null> {
  try {
    const response = await fetch("https://models.dev/api.json");
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn("[PASSTOAI-TW] 获取 models.dev API 失败:", e);
  }
  return null;
}

export default async function (pi: ExtensionAPI) {
  const baseUrl = "http://10.113.168.188:8317/v1";
  const apiKey = "sk-passto-ai-handy-1";

  try {
    // 1. 读取本地缓存（立即可用）
    const cache = readCache();

    // 2. 异步获取最新数据并更新缓存（不阻塞主流程）
    fetchModelsDevAPI().then((freshData) => {
      if (freshData) {
        writeCache(freshData);
      }
    });

    // 3. 获取远程模型列表
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json();

    if (data && data.data) {
      // 只保留有前缀的模型（id 中包含 "/" 的）
      const filteredModels = data.data.filter((m: any) => m.id && m.id.includes("/"));

      // 4. 构建模型对象，通过规范化模型名匹配缓存
      const remoteModels = filteredModels.map((m: any) => {
        // 去掉前缀，获取纯模型名
        const modelName = m.id.split("/").pop() || m.id;
        const matched = lookupModelInCache(cache, modelName);

        return {
          id: m.id,
          name: m.id,
          api: "openai-completions",
          reasoning: matched.reasoning,
          input: ["text"],
          cost: matched.cost,
          contextWindow: matched.contextWindow,
          maxTokens: matched.maxTokens,
        };
      });

      // 5. 按 provider (owned_by) 字母顺序排序，相同 provider 按 model id 字母顺序排序
      const modelMap = new Map<string, any[]>();
      for (const model of remoteModels) {
        const original = data.data.find((m: any) => m.id === model.id);
        const provider = original?.owned_by ?? "unknown";
        if (!modelMap.has(provider)) {
          modelMap.set(provider, []);
        }
        modelMap.get(provider)!.push(model);
      }

      const sortedProviders = Array.from(modelMap.keys()).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );

      const sortedModels: any[] = [];
      for (const provider of sortedProviders) {
        const models = modelMap.get(provider)!;
        models.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
        sortedModels.push(...models);
      }

      pi.registerProvider("PASSTOAI-TW", {
        baseUrl,
        apiKey,
        api: "openai-completions",
        authHeader: true,
        models: sortedModels,
      });

      console.log(
        `[PASSTOAI-TW] 成功加载 ${sortedModels.length} 个模型 (${sortedProviders.length} 个 provider)。`
      );
    }
  } catch (error) {
    console.error("[PASSTOAI-TW] Failed to fetch models:", error);
  }
}
