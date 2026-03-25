/**
 * Integration tests for season management / strategy endpoints.
 * Covers: lineup, categories, injury, streaming, matchup strategy,
 * closer monitor, FAAB, ownership, punt, IL stash, and more.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError, validateObject } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";
import { TEST_PLAYER, TEST_MLB_TEAM } from "./helpers/test-params";

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("SEASON/STRATEGY ENDPOINTS");
});

describe("Season management endpoints", function () {
  it("GET /api/lineup-optimize returns lineup optimization", async function () {
    var res = await timedGet("/api/lineup-optimize");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/lineup-optimize", res.elapsed_ms, "pass");
  });

  it("GET /api/category-check returns category analysis", async function () {
    var res = await timedGet("/api/category-check");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/category-check", res.elapsed_ms, "pass");
  });

  it("GET /api/injury-report returns injury data", async function () {
    var res = await timedGet("/api/injury-report");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/injury-report", res.elapsed_ms, "pass");
  });

  it("GET /api/streaming returns streaming options", async function () {
    var res = await timedGet("/api/streaming");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/streaming", res.elapsed_ms, "pass");
  });

  it("GET /api/scout-opponent returns scouting report", async function () {
    var res = await timedGet("/api/scout-opponent");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/scout-opponent", res.elapsed_ms, "pass");
  });

  it("GET /api/matchup-strategy returns strategy data", async function () {
    var res = await timedGet("/api/matchup-strategy");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/matchup-strategy", res.elapsed_ms, "pass");
  });

  it("GET /api/whats-new returns recent changes", async function () {
    var res = await timedGet("/api/whats-new");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/whats-new", res.elapsed_ms, "pass");
  });

  it("GET /api/week-planner returns weekly plan", async function () {
    var res = await timedGet("/api/week-planner");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/week-planner", res.elapsed_ms, "pass");
  });

  it("GET /api/closer-monitor returns closer data", async function () {
    var res = await timedGet("/api/closer-monitor");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/closer-monitor", res.elapsed_ms, "pass");
  });

  it("GET /api/pitcher-matchup returns pitcher matchups", async function () {
    var res = await timedGet("/api/pitcher-matchup");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/pitcher-matchup", res.elapsed_ms, "pass");
  });

  it("GET /api/roster-stats returns roster statistics", async function () {
    var res = await timedGet("/api/roster-stats");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/roster-stats", res.elapsed_ms, "pass");
  });

  it("GET /api/faab-recommend returns FAAB advice", async function () {
    var res = await timedGet("/api/faab-recommend", { name: TEST_PLAYER });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/faab-recommend", res.elapsed_ms, "pass");
  });

  it("GET /api/ownership-trends returns ownership data", async function () {
    var res = await timedGet("/api/ownership-trends", { name: TEST_PLAYER });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/ownership-trends", res.elapsed_ms, "pass");
  });

  it("GET /api/category-trends returns category trends", async function () {
    var res = await timedGet("/api/category-trends");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/category-trends", res.elapsed_ms, "pass");
  });

  it("GET /api/punt-advisor returns punt analysis", async function () {
    var res = await timedGet("/api/punt-advisor");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/punt-advisor", res.elapsed_ms, "pass");
  });

  it("GET /api/il-stash-advisor returns IL stash recommendations", async function () {
    var res = await timedGet("/api/il-stash-advisor");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/il-stash-advisor", res.elapsed_ms, "pass");
  });

  it("GET /api/optimal-moves returns optimal moves", async function () {
    var res = await timedGet("/api/optimal-moves");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/optimal-moves", res.elapsed_ms, "pass");
  });

  it("GET /api/playoff-planner returns playoff planning", async function () {
    var res = await timedGet("/api/playoff-planner");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/playoff-planner", res.elapsed_ms, "pass");
  });

  it("GET /api/pending-trades returns pending trade info", async function () {
    var res = await timedGet("/api/pending-trades");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/pending-trades", res.elapsed_ms, "pass");
  });

  it("GET /api/achievements returns achievement data", async function () {
    var res = await timedGet("/api/achievements");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/achievements", res.elapsed_ms, "pass");
  });

  it("GET /api/weekly-narrative returns narrative", async function () {
    var res = await timedGet("/api/weekly-narrative");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/weekly-narrative", res.elapsed_ms, "pass");
  });

  it("GET /api/probable-pitchers returns upcoming pitchers", async function () {
    var res = await timedGet("/api/probable-pitchers", { days: "7" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/probable-pitchers", res.elapsed_ms, "pass");
  });

  it("GET /api/schedule-analysis returns schedule data", async function () {
    var res = await timedGet("/api/schedule-analysis", { team: TEST_MLB_TEAM, days: "14" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/schedule-analysis", res.elapsed_ms, "pass");
  });

  it("GET /api/regression-candidates returns regression data", async function () {
    var res = await timedGet("/api/regression-candidates");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/regression-candidates", res.elapsed_ms, "pass");
  });

  it("GET /api/travel-fatigue returns fatigue data", async function () {
    var res = await timedGet("/api/travel-fatigue");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/travel-fatigue", res.elapsed_ms, "pass");
  });
});
