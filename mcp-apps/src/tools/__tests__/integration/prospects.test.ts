/**
 * Integration tests for prospect-related endpoints.
 * Covers: report, rankings, callup wire, stash advisor, compare, buzz, eta, trade targets, news.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError, validatePlayerArray } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";
import { TEST_PROSPECT, TEST_PROSPECT_2 } from "./helpers/test-params";

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("PROSPECT ENDPOINTS");
});

describe("Prospect endpoints", function () {
  it("GET /api/prospects/report returns prospect report", async function () {
    var res = await timedGet("/api/prospects/report", { name: TEST_PROSPECT });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/report", res.elapsed_ms, "pass");
  });

  it("GET /api/prospects/rankings returns ranked prospects", async function () {
    var res = await timedGet("/api/prospects/rankings", { count: "10" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/rankings", res.elapsed_ms, "pass");
  });

  it("GET /api/prospects/callup-wire returns callup candidates", async function () {
    var res = await timedGet("/api/prospects/callup-wire", { days: "14" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/callup-wire", res.elapsed_ms, "pass");
  });

  it("GET /api/prospects/stash-advisor returns stash recommendations", async function () {
    var res = await timedGet("/api/prospects/stash-advisor", { count: "5" });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/stash-advisor", res.elapsed_ms, "pass");
  });

  it("GET /api/prospects/compare compares two prospects", async function () {
    var res = await timedGet("/api/prospects/compare", { player1: TEST_PROSPECT, player2: TEST_PROSPECT_2 });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/compare", res.elapsed_ms, "pass");
  });

  it("GET /api/prospects/buzz returns prospect buzz", async function () {
    var res = await timedGet("/api/prospects/buzz");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/buzz", res.elapsed_ms, "pass");
  });

  it("GET /api/prospects/eta-tracker returns ETA tracking", async function () {
    var res = await timedGet("/api/prospects/eta-tracker");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/eta-tracker", res.elapsed_ms, "pass");
  });

  it("GET /api/prospects/trade-targets returns trade targets", async function () {
    var res = await timedGet("/api/prospects/trade-targets");
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/trade-targets", res.elapsed_ms, "pass");
  });

  it("GET /api/prospects/news returns prospect news", async function () {
    var res = await timedGet("/api/prospects/news", { name: TEST_PROSPECT });
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/prospects/news", res.elapsed_ms, "pass");
  });
});
