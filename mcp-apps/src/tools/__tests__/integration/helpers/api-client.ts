/**
 * Timed fetch wrapper for integration tests.
 * Mirrors python-client.ts (apiGet/apiPost) but adds timing and recording.
 */

var API_BASE = process.env.PYTHON_API_URL || "http://localhost:8766";
var DEFAULT_TIMEOUT_MS = 45000;

export interface TimedResponse<T> {
  data: T;
  elapsed_ms: number;
  status_code: number;
}

async function fetchWithTimeout(url: URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    return await fetch(url.toString(), { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out after " + (timeoutMs / 1000) + "s: " + url.pathname);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function timedGet<T = any>(path: string, params?: Record<string, string>, timeoutMs?: number): Promise<TimedResponse<T>> {
  var url = new URL(path, API_BASE);
  if (params) {
    for (var key of Object.keys(params)) {
      var val = params[key];
      if (val !== undefined && val !== "") {
        url.searchParams.set(key, val);
      }
    }
  }
  var start = Date.now();
  var response = await fetchWithTimeout(url, {}, timeoutMs || DEFAULT_TIMEOUT_MS);
  var elapsed_ms = Date.now() - start;
  var data = await response.json() as T;
  return { data: data, elapsed_ms: elapsed_ms, status_code: response.status };
}

export async function timedPost<T = any>(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<TimedResponse<T>> {
  var url = new URL(path, API_BASE);
  var start = Date.now();
  var response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs || DEFAULT_TIMEOUT_MS
  );
  var elapsed_ms = Date.now() - start;
  var data = await response.json() as T;
  return { data: data, elapsed_ms: elapsed_ms, status_code: response.status };
}

/**
 * Check if the Python API is reachable before running tests.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    var url = new URL("/api/health", API_BASE);
    var response = await fetchWithTimeout(url, {}, 5000);
    return response.ok;
  } catch {
    return false;
  }
}
