/**
 * Integration tests for MLB reference data endpoints.
 * Covers: teams, roster, player, stats, injuries, standings, schedule, draft, weather.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError, validatePlayerArray, validateObject } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";
import { TEST_MLB_TEAM, TEST_MLB_PLAYER_ID, TEST_PAST_YEAR } from "./helpers/test-params";

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("MLB ENDPOINTS");
});

describe("MLB reference endpoints", function () {
  it("GET /api/mlb/teams returns 30 MLB teams", async function () {
    var res = await timedGet("/api/mlb/teams");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    var tv = validatePlayerArray(res.data, "teams", ["name", "abbreviation"]);
    expect(tv.valid, tv.errors.join("; ")).toBe(true);
    expect(res.data.teams.length).toBe(30);
    recordResult("/api/mlb/teams", res.elapsed_ms, "pass");
  });

  it("GET /api/mlb/roster returns team roster", async function () {
    var res = await timedGet("/api/mlb/roster", { team: TEST_MLB_TEAM });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/mlb/roster", res.elapsed_ms, "pass");
  });

  it("GET /api/mlb/player returns player info", async function () {
    var res = await timedGet("/api/mlb/player", { player_id: TEST_MLB_PLAYER_ID });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/mlb/player", res.elapsed_ms, "pass");
  });

  it("GET /api/mlb/stats returns player stats", async function () {
    var res = await timedGet("/api/mlb/stats", { player_id: TEST_MLB_PLAYER_ID, season: "2025" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/mlb/stats", res.elapsed_ms, "pass");
  });

  it("GET /api/mlb/injuries returns injury list", async function () {
    var res = await timedGet("/api/mlb/injuries");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/mlb/injuries", res.elapsed_ms, "pass");
  });

  it("GET /api/mlb/standings returns MLB standings", async function () {
    var res = await timedGet("/api/mlb/standings");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/mlb/standings", res.elapsed_ms, "pass");
  });

  it("GET /api/mlb/schedule returns schedule", async function () {
    var res = await timedGet("/api/mlb/schedule");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/mlb/schedule", res.elapsed_ms, "pass");
  });

  it("GET /api/mlb/draft returns draft data", async function () {
    var res = await timedGet("/api/mlb/draft", { year: TEST_PAST_YEAR });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/mlb/draft", res.elapsed_ms, "pass");
  });

  it("GET /api/mlb/weather returns weather data", async function () {
    var res = await timedGet("/api/mlb/weather");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/mlb/weather", res.elapsed_ms, "pass");
  });
});
