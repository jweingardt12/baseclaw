/**
 * Integration tests for league history endpoints.
 * Covers: league-history, record-book, past standings/draft/teams/trades/matchup, roster-history.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";
import { TEST_PAST_YEAR } from "./helpers/test-params";

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("HISTORY ENDPOINTS");
});

describe("History endpoints", function () {
  it("GET /api/league-history returns league history", async function () {
    var res = await timedGet("/api/league-history");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/league-history", res.elapsed_ms, "pass");
  });

  it("GET /api/record-book returns records", async function () {
    var res = await timedGet("/api/record-book");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/record-book", res.elapsed_ms, "pass");
  });

  it("GET /api/past-standings returns past year standings", async function () {
    var res = await timedGet("/api/past-standings", { year: TEST_PAST_YEAR });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/past-standings", res.elapsed_ms, "pass");
  });

  it("GET /api/past-draft returns past draft results", async function () {
    var res = await timedGet("/api/past-draft", { year: TEST_PAST_YEAR, count: "10" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/past-draft", res.elapsed_ms, "pass");
  });

  it("GET /api/past-teams returns past year teams", async function () {
    var res = await timedGet("/api/past-teams", { year: TEST_PAST_YEAR });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/past-teams", res.elapsed_ms, "pass");
  });

  it("GET /api/past-trades returns past year trades", async function () {
    var res = await timedGet("/api/past-trades", { year: TEST_PAST_YEAR, count: "5" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/past-trades", res.elapsed_ms, "pass");
  });

  it("GET /api/past-matchup returns past matchup data", async function () {
    var res = await timedGet("/api/past-matchup", { year: TEST_PAST_YEAR, week: "1" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/past-matchup", res.elapsed_ms, "pass");
  });

  it("GET /api/roster-history returns historical roster", async function () {
    var res = await timedGet("/api/roster-history", { week: "1" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/roster-history", res.elapsed_ms, "pass");
  });
});
