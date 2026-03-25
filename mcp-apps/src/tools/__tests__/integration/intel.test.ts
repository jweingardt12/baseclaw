/**
 * Integration tests for intel/analytics endpoints.
 * Some endpoints depend on external services (Reddit, Google News, pybaseball)
 * and are wrapped in tolerateFlaky() to avoid false failures.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";
import { TEST_PLAYER } from "./helpers/test-params";

/** Wraps a test body so external-service failures become soft skips. */
async function tolerateFlaky(path: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    var isExternal = msg.includes("timed out") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("429") ||
      msg.includes("503") ||
      msg.includes("Reddit") ||
      msg.includes("rate") ||
      msg.includes("pybaseball") ||
      msg.includes("Statcast");
    if (isExternal) {
      console.warn("  [FLAKY] " + path + ": " + msg);
      recordResult(path, 0, "skip", "external flaky: " + msg.slice(0, 80));
      return;
    }
    throw e;
  }
}

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("INTEL ENDPOINTS");
});

describe("Intel endpoints", function () {
  it("GET /api/intel/player returns player intel", async function () {
    var res = await timedGet("/api/intel/player", { name: TEST_PLAYER });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/intel/player", res.elapsed_ms, "pass");
  });

  it("GET /api/intel/reddit returns reddit buzz (flaky-tolerant)", async function () {
    await tolerateFlaky("/api/intel/reddit", async function () {
      var res = await timedGet("/api/intel/reddit");
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/intel/reddit", res.elapsed_ms, "pass");
    });
  });

  it("GET /api/intel/trending returns trending players", async function () {
    var res = await timedGet("/api/intel/trending");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/intel/trending", res.elapsed_ms, "pass");
  });

  it("GET /api/intel/prospects returns prospect intel", async function () {
    var res = await timedGet("/api/intel/prospects");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/intel/prospects", res.elapsed_ms, "pass");
  });

  it("GET /api/intel/transactions returns recent intel transactions", async function () {
    var res = await timedGet("/api/intel/transactions", { days: "7" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/intel/transactions", res.elapsed_ms, "pass");
  });

  it("GET /api/intel/statcast-history returns Statcast data (flaky-tolerant)", async function () {
    await tolerateFlaky("/api/intel/statcast-history", async function () {
      var res = await timedGet("/api/intel/statcast-history", { name: TEST_PLAYER, days: "30" });
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/intel/statcast-history", res.elapsed_ms, "pass");
    });
  });

  it("GET /api/news/feed returns news entries (flaky-tolerant)", async function () {
    await tolerateFlaky("/api/news/feed", async function () {
      var res = await timedGet("/api/news/feed", { limit: "5" });
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/news/feed", res.elapsed_ms, "pass");
    });
  });

  it("GET /api/player-intel returns combined player intel", async function () {
    var res = await timedGet("/api/player-intel", { player: TEST_PLAYER });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/player-intel", res.elapsed_ms, "pass");
  });

  it("GET /api/intel/bat-tracking-breakouts returns bat tracking (flaky-tolerant)", async function () {
    await tolerateFlaky("/api/intel/bat-tracking-breakouts", async function () {
      var res = await timedGet("/api/intel/bat-tracking-breakouts", { count: "5" });
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/intel/bat-tracking-breakouts", res.elapsed_ms, "pass");
    });
  });

  it("GET /api/intel/pitch-mix-breakouts returns pitch mix data (flaky-tolerant)", async function () {
    await tolerateFlaky("/api/intel/pitch-mix-breakouts", async function () {
      var res = await timedGet("/api/intel/pitch-mix-breakouts", { count: "5" });
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/intel/pitch-mix-breakouts", res.elapsed_ms, "pass");
    });
  });
});
