// ============================================================
// agent-web-search-pro v2 — HTTP Utilities
// ============================================================
import { FETCH_TIMEOUT_MS } from "./config.js";

export async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return `Request timed out after ${FETCH_TIMEOUT_MS}ms`;
    return error.message;
  }
  return String(error);
}
