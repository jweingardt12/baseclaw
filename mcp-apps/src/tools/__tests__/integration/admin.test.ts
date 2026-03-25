/**
 * Integration tests for admin/utility endpoints.
 * Covers: who-owns, percent-owned, taken-players, roster-stats, browser-login-status.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";
import { TEST_PLAYER_ID, TEST_PLAYER_ID_2 } from "./helpers/test-params";

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("ADMIN ENDPOINTS");
});

describe("Admin/utility endpoints", function () {
  it("GET /api/who-owns returns ownership info", async function () {
    var res = await timedGet("/api/who-owns", { player_id: TEST_PLAYER_ID });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/who-owns", res.elapsed_ms, "pass");
  });

  it("GET /api/percent-owned returns ownership percentages", async function () {
    var res = await timedGet("/api/percent-owned", { ids: TEST_PLAYER_ID + "," + TEST_PLAYER_ID_2 });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/percent-owned", res.elapsed_ms, "pass");
  });

  it("GET /api/taken-players returns taken players list", async function () {
    var res = await timedGet("/api/taken-players", { limit: "10" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/taken-players", res.elapsed_ms, "pass");
  });

  it("GET /api/roster-stats returns roster statistics with period", async function () {
    var res = await timedGet("/api/roster-stats", { period: "season" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/roster-stats?period=season", res.elapsed_ms, "pass");
  });

  it("GET /api/browser-login-status returns login state", async function () {
    var res = await timedGet("/api/browser-login-status");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/browser-login-status", res.elapsed_ms, "pass");
  });
});
