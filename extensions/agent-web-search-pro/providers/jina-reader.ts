// ============================================================
// agent-web-search-pro v2 — Jina Reader Provider (+ curl fallback)
// ============================================================
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { ProviderName } from "../types.js";
import { getProviderSettings, CURL_TIMEOUT_SECONDS } from "./config.js";
import { fetchWithTimeout, normalizeErrorMessage } from "./http.js";

const execFile = promisify(execFileCallback);

export async function curlReadUrl(url: string): Promise<{ title: string; snippet: string; error?: string }> {
  const { jinaReaderBaseUrl } = await getProviderSettings();
  try {
    const target = `${jinaReaderBaseUrl.replace(/\/$/, "")}/${url}`;
    const { stdout } = await execFile("curl", ["-L", "--max-time", String(CURL_TIMEOUT_SECONDS), target], {
      maxBuffer: 1024 * 1024 * 2,
    });
    const text = String(stdout || "").trim();
    if (!text) return { title: url, snippet: "", error: "curl returned empty response" };
    const titleMatch = text.match(/^#\s+(.+)$/m) || text.match(/^Title:\s*(.+)$/im);
    return {
      title: titleMatch?.[1]?.trim() || url,
      snippet: text.slice(0, 500),
    };
  } catch (error) {
    return { title: url, snippet: "", error: normalizeErrorMessage(error) };
  }
}

export async function readUrlSnippet(url: string): Promise<{ title: string; snippet: string; error?: string; via?: ProviderName }> {
  const { jinaReaderBaseUrl } = await getProviderSettings();
  try {
    const response = await fetchWithTimeout(`${jinaReaderBaseUrl.replace(/\/$/, "")}/${url}`, {
      headers: { Accept: "text/plain, text/markdown;q=0.9, */*;q=0.8" },
    });
    if (!response.ok) {
      const curlFallback = await curlReadUrl(url);
      if (!curlFallback.error) return { ...curlFallback, via: "curl-jina-reader" };
      return { title: url, snippet: "", error: `HTTP ${response.status}; curl fallback failed: ${curlFallback.error}` };
    }
    const text = (await response.text()).trim();
    const titleMatch = text.match(/^#\s+(.+)$/m) || text.match(/^Title:\s*(.+)$/im);
    return {
      title: titleMatch?.[1]?.trim() || url,
      snippet: text.slice(0, 500),
      via: "jina-reader",
    };
  } catch (error) {
    const curlFallback = await curlReadUrl(url);
    if (!curlFallback.error) return { ...curlFallback, via: "curl-jina-reader" };
    return { title: url, snippet: "", error: `${normalizeErrorMessage(error)}; curl fallback failed: ${curlFallback.error}` };
  }
}

export async function callJinaReader(targetUrl: string): Promise<{
  title: string;
  snippet: string;
  error?: string;
  via?: ProviderName;
}> {
  if (!targetUrl?.trim()) {
    return { title: "", snippet: "", error: "Missing URL" };
  }
  return readUrlSnippet(targetUrl.trim());
}
