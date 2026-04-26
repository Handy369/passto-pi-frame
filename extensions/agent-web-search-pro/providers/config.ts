// ============================================================
// agent-web-search-pro v2 — Provider Configuration
// ============================================================
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionConfig } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const CONFIG_FILE = path.join(__dirname, "..", "config.json");

// Timeouts
export const FETCH_TIMEOUT_MS = 15000;
export const CURL_TIMEOUT_SECONDS = 15;
export const MAX_DEEP_READ_RESULTS = 3;

export async function loadConfig(): Promise<ExtensionConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as ExtensionConfig) : {};
  } catch {
    return {};
  }
}

export async function getProviderSettings(): Promise<{ tavilyApiKey: string; jinaReaderBaseUrl: string }> {
  const config = await loadConfig();
  return {
    tavilyApiKey: config.providers?.tavily?.apiKey?.trim() || process.env.TAVILY_API_KEY?.trim() || "",
    jinaReaderBaseUrl: config.providers?.jinaReader?.baseUrl?.trim() || "https://r.jina.ai",
  };
}
