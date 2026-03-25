/**
 * Integration tests for draft-related endpoints.
 * These may fail outside draft season — errors about "not in draft" are tolerated.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";

/** Tolerate out-of-season errors for draft endpoints. */
async function tolerateDraftSeason(path: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    var isOutOfSeason = msg.includes("draft") ||
      msg.includes("not available") ||
      msg.includes("off-season") ||
      msg.includes("no draft") ||
      msg.includes("season has not started");
    if (isOutOfSeason) {
      console.warn("  [SEASON] " + path + ": " + msg.slice(0, 80));
      recordResult(path, 0, "skip", "out of draft season");
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
  printReport("DRAFT ENDPOINTS");
});

describe("Draft endpoints", function () {
  it("GET /api/draft-status returns draft state", async function () {
    await tolerateDraftSeason("/api/draft-status", async function () {
      var res = await timedGet("/api/draft-status");
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/draft-status", res.elapsed_ms, "pass");
    });
  });

  it("GET /api/draft-recommend returns recommendations", async function () {
    await tolerateDraftSeason("/api/draft-recommend", async function () {
      var res = await timedGet("/api/draft-recommend");
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/draft-recommend", res.elapsed_ms, "pass");
    });
  });

  it("GET /api/draft-cheatsheet returns cheatsheet", async function () {
    await tolerateDraftSeason("/api/draft-cheatsheet", async function () {
      var res = await timedGet("/api/draft-cheatsheet");
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/draft-cheatsheet", res.elapsed_ms, "pass");
    });
  });

  it("GET /api/best-available returns best available players", async function () {
    await tolerateDraftSeason("/api/best-available", async function () {
      var res = await timedGet("/api/best-available", { pos_type: "B", count: "10" });
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/best-available", res.elapsed_ms, "pass");
    });
  });
});
