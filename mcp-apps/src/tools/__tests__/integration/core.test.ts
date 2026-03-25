/**
 * Integration tests for core Yahoo Fantasy API endpoints.
 * Covers: roster, free agents, search, standings, matchups, league context,
 * transactions, trends, pulse, intel, pace, positional ranks, player stats, waivers.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError, validatePlayerArray, validateObject } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";
import { TEST_PLAYER } from "./helpers/test-params";

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("CORE ENDPOINTS");
});

describe("Core endpoints", function () {
  it("GET /api/roster returns players array", async function () {
    var res = await timedGet("/api/roster");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    var pv = validatePlayerArray(res.data, "players", ["name", "player_id", "eligible_positions"]);
    expect(pv.valid, pv.errors.join("; ")).toBe(true);
    recordResult("/api/roster", res.elapsed_ms, "pass");
  });

  it("GET /api/free-agents returns batters", async function () {
    var res = await timedGet("/api/free-agents", { pos_type: "B", count: "20" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    var pv = validatePlayerArray(res.data, "players", ["name", "player_id"]);
    expect(pv.valid, pv.errors.join("; ")).toBe(true);
    expect(res.data.players.length).toBeLessThanOrEqual(20);
    recordResult("/api/free-agents?pos_type=B", res.elapsed_ms, "pass");
  });

  it("GET /api/search finds a known player", async function () {
    var res = await timedGet("/api/search", { name: TEST_PLAYER });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    var pv = validatePlayerArray(res.data, "players", ["name", "player_id"]);
    expect(pv.valid, pv.errors.join("; ")).toBe(true);
    recordResult("/api/search", res.elapsed_ms, "pass");
  });

  it("GET /api/standings returns teams with ranks", async function () {
    var res = await timedGet("/api/standings");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    var sv = validatePlayerArray(res.data, "standings", ["name", "rank"]);
    expect(sv.valid, sv.errors.join("; ")).toBe(true);
    recordResult("/api/standings", res.elapsed_ms, "pass");
  });

  it("GET /api/matchups returns matchup data", async function () {
    var res = await timedGet("/api/matchups");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    expect(res.data).toBeDefined();
    recordResult("/api/matchups", res.elapsed_ms, "pass");
  });

  it("GET /api/matchup-detail returns current matchup", async function () {
    var res = await timedGet("/api/matchup-detail");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/matchup-detail", res.elapsed_ms, "pass");
  });

  it("GET /api/league-context returns league metadata", async function () {
    var res = await timedGet("/api/league-context");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/league-context", res.elapsed_ms, "pass");
  });

  it("GET /api/transactions returns recent transactions", async function () {
    var res = await timedGet("/api/transactions", { count: "10" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/transactions", res.elapsed_ms, "pass");
  });

  it("GET /api/transaction-trends returns trend data", async function () {
    var res = await timedGet("/api/transaction-trends");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/transaction-trends", res.elapsed_ms, "pass");
  });

  it("GET /api/league-pulse returns league activity", async function () {
    var res = await timedGet("/api/league-pulse");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/league-pulse", res.elapsed_ms, "pass");
  });

  it("GET /api/league-intel returns intelligence report", async function () {
    var res = await timedGet("/api/league-intel");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/league-intel", res.elapsed_ms, "pass");
  });

  it("GET /api/season-pace returns pace metrics", async function () {
    var res = await timedGet("/api/season-pace");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/season-pace", res.elapsed_ms, "pass");
  });

  it("GET /api/positional-ranks returns position rankings", async function () {
    var res = await timedGet("/api/positional-ranks");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/positional-ranks", res.elapsed_ms, "pass");
  });

  it("GET /api/player-stats returns stats for a player", async function () {
    var res = await timedGet("/api/player-stats", { name: TEST_PLAYER, period: "season" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/player-stats", res.elapsed_ms, "pass");
  });

  it("GET /api/waivers returns waiver data", async function () {
    var res = await timedGet("/api/waivers");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/waivers", res.elapsed_ms, "pass");
  });

  it("GET /api/player-list returns batters list", async function () {
    var res = await timedGet("/api/player-list", { pos_type: "B", count: "10" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/player-list", res.elapsed_ms, "pass");
  });
});
