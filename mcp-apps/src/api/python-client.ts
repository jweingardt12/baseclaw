import { formatError } from "./errors.js";

export var API_BASE = process.env.PYTHON_API_URL || "http://localhost:8766";

export function toolError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  // Detect connection refused (Python API not running)
  if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
    return {
      content: [{ type: "text" as const, text: formatError("API_UNREACHABLE") }],
      structuredContent: { type: "_error", message: formatError("API_UNREACHABLE") },
      isError: true as const,
    };
  }
  return {
    content: [{ type: "text" as const, text: "Error: " + msg }],
    structuredContent: { type: "_error", message: msg },
    isError: true as const,
  };
}

async function checkResponseStatus(response: Response, url: URL): Promise<void> {
  if (response.status === 401) {
    throw new Error(formatError("YAHOO_AUTH_EXPIRED"));
  }
  if (response.status === 404 && url.pathname.includes("/api/league")) {
    throw new Error(formatError("LEAGUE_NOT_FOUND"));
  }
  if (response.status === 429) {
    throw new Error(formatError("RATE_LIMITED"));
  }
  if (!response.ok) {
    var body = await response.text().catch(function () { return ""; });
    throw new Error(formatError("", "API " + response.status + " " + response.statusText + (body ? " - " + body : "")));
  }
}

var DEFAULT_TIMEOUT_MS = 40000;

async function fetchWithTimeout(url: URL, init: RequestInit, timeoutMs?: number): Promise<Response> {
  var controller = new AbortController();
  var ms = timeoutMs || DEFAULT_TIMEOUT_MS;
  var timer = setTimeout(function () { controller.abort(); }, ms);
  try {
    return await fetch(url.toString(), { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out after " + (ms / 1000) + "s: " + url.pathname);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiGet<T>(path: string, params?: Record<string, string>, timeoutMs?: number): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }
  var response = await fetchWithTimeout(url, {}, timeoutMs);
  await checkResponseStatus(response, url);
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<T> {
  const url = new URL(path, API_BASE);
  var response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, timeoutMs);
  await checkResponseStatus(response, url);
  return response.json() as Promise<T>;
}
