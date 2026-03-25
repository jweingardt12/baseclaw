/**
 * Integration tests for composite workflow endpoints.
 * These chain 3-7 internal API calls and get a 90s timeout.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { timedGet, checkApiHealth } from "./helpers/api-client";
import { validateNoError } from "./helpers/validators";
import { recordResult, printReport, resetEntries } from "./helpers/report";

var WORKFLOW_TIMEOUT = 90000;

beforeAll(async function () {
  var healthy = await checkApiHealth();
  if (!healthy) {
    throw new Error("Python API not reachable at localhost:8766 — is the container running?");
  }
  resetEntries();
});

afterAll(function () {
  printReport("WORKFLOW ENDPOINTS");
});

describe("Workflow composite endpoints", function () {
  it("GET /api/workflow/morning-briefing returns briefing", async function () {
    var res = await timedGet("/api/workflow/morning-briefing", undefined, WORKFLOW_TIMEOUT);
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    expect(res.data).toBeDefined();
    recordResult("/api/workflow/morning-briefing", res.elapsed_ms, "pass");
  }, WORKFLOW_TIMEOUT);

  it("GET /api/workflow/league-landscape returns landscape", async function () {
    var res = await timedGet("/api/workflow/league-landscape", undefined, WORKFLOW_TIMEOUT);
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/workflow/league-landscape", res.elapsed_ms, "pass");
  }, WORKFLOW_TIMEOUT);

  it("GET /api/workflow/roster-health returns health report", async function () {
    var res = await timedGet("/api/workflow/roster-health", undefined, WORKFLOW_TIMEOUT);
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/workflow/roster-health", res.elapsed_ms, "pass");
  }, WORKFLOW_TIMEOUT);

  it("GET /api/workflow/waiver-recommendations returns picks", async function () {
    var res = await timedGet("/api/workflow/waiver-recommendations", { count: "3" }, WORKFLOW_TIMEOUT);
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/workflow/waiver-recommendations", res.elapsed_ms, "pass");
  }, WORKFLOW_TIMEOUT);

  it("GET /api/workflow/waiver-deadline-prep returns deadline prep", async function () {
    var res = await timedGet("/api/workflow/waiver-deadline-prep", undefined, WORKFLOW_TIMEOUT);
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/workflow/waiver-deadline-prep", res.elapsed_ms, "pass");
  }, WORKFLOW_TIMEOUT);

  it("GET /api/workflow/trade-pipeline returns trade analysis", async function () {
    var res = await timedGet("/api/workflow/trade-pipeline", undefined, WORKFLOW_TIMEOUT);
    var v = validateNoError(res.data);
    expect(v.valid, v.errors.join("; ")).toBe(true);
    recordResult("/api/workflow/trade-pipeline", res.elapsed_ms, "pass");
  }, WORKFLOW_TIMEOUT);

  it("GET /api/workflow/weekly-digest returns digest (if exists)", async function () {
    try {
      var res = await timedGet("/api/workflow/weekly-digest", undefined, WORKFLOW_TIMEOUT);
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/workflow/weekly-digest", res.elapsed_ms, "pass");
    } catch (e) {
      var msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("404") || msg.includes("not found") || msg.includes("No route")) {
        recordResult("/api/workflow/weekly-digest", 0, "skip", "endpoint not implemented");
        return;
      }
      throw e;
    }
  }, WORKFLOW_TIMEOUT);

  it("GET /api/workflow/season-checkpoint returns checkpoint (if exists)", async function () {
    try {
      var res = await timedGet("/api/workflow/season-checkpoint", undefined, WORKFLOW_TIMEOUT);
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/workflow/season-checkpoint", res.elapsed_ms, "pass");
    } catch (e) {
      var msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("404") || msg.includes("not found") || msg.includes("No route")) {
        recordResult("/api/workflow/season-checkpoint", 0, "skip", "endpoint not implemented");
        return;
      }
      throw e;
    }
  }, WORKFLOW_TIMEOUT);

  it("GET /api/workflow/game-day-manager returns game day data (if exists)", async function () {
    try {
      var res = await timedGet("/api/workflow/game-day-manager", undefined, WORKFLOW_TIMEOUT);
      var v = validateNoError(res.data);
      expect(v.valid, v.errors.join("; ")).toBe(true);
      recordResult("/api/workflow/game-day-manager", res.elapsed_ms, "pass");
    } catch (e) {
      var msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("404") || msg.includes("not found") || msg.includes("No route")) {
        recordResult("/api/workflow/game-day-manager", 0, "skip", "endpoint not implemented");
        return;
      }
      throw e;
    }
  }, WORKFLOW_TIMEOUT);
});
