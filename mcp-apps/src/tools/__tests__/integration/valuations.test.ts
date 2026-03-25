/**
 * Integration tests for valuation/z-score endpoints.
 * Covers: rankings, compare, value, zscore-shifts, projection-disagreements, projection-confidence.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError, validatePlayerArray, validateObject, validateNumericRange } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";
import { TEST_PLAYER, TEST_PLAYER_2 } from "./helpers/test-params";

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("VALUATION ENDPOINTS");
});

describe("Valuation endpoints", function () {
  it("GET /api/rankings returns ranked players with z-scores", async function () {
    var res = await timedGet("/api/rankings", { pos_type: "B", count: "10" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    var pv = validatePlayerArray(res.data, "players", ["name", "z_score", "rank"]);
    expect(pv.valid, pv.errors.join("; ")).toBe(true);
    expect(res.data.players.length).toBeLessThanOrEqual(10);

    var zv = validateNumericRange(res.data.players[0].z_score, -5, 15, "z_score");
    expect(zv.valid, zv.errors.join("; ")).toBe(true);
    recordResult("/api/rankings", res.elapsed_ms, "pass");
  });

  it("GET /api/compare compares two players", async function () {
    var res = await timedGet("/api/compare", { player1: TEST_PLAYER_2, player2: TEST_PLAYER });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    expect(res.data).toBeDefined();
    recordResult("/api/compare", res.elapsed_ms, "pass");
  });

  it("GET /api/value returns valuation for a player", async function () {
    var res = await timedGet("/api/value", { player_name: TEST_PLAYER });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/value", res.elapsed_ms, "pass");
  });

  it("GET /api/zscore-shifts returns trending z-score changes", async function () {
    var res = await timedGet("/api/zscore-shifts", { count: "10" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/zscore-shifts", res.elapsed_ms, "pass");
  });

  it("GET /api/projection-disagreements returns disagreements", async function () {
    var res = await timedGet("/api/projection-disagreements", { pos_type: "B", count: "10" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/projection-disagreements", res.elapsed_ms, "pass");
  });

  it("GET /api/valuations/projection-confidence returns confidence data", async function () {
    var res = await timedGet("/api/valuations/projection-confidence", { name: TEST_PLAYER });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/valuations/projection-confidence", res.elapsed_ms, "pass");
  });
});
