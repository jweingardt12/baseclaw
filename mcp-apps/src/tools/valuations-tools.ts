import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost } from "../api/python-client.js";
import { READ_ANNO, WRITE_ANNO } from "../api/annotations.js";
import { defineTool } from "../api/define-tool.js";
import { str, type RankingsResponse, type CompareResponse, type ValueResponse } from "../api/types.js";
import { buildFooter, sampleWarning } from "../api/format-text.js";

function adjZLabel(rawZ: number, adjZ: number | null | undefined): string {
  if (adjZ != null && adjZ !== rawZ) return "z=" + Number(adjZ).toFixed(2) + " (raw=" + rawZ.toFixed(2) + ")";
  return "z=" + rawZ.toFixed(2);
}

export function registerValuationsTools(server: McpServer, enabledTools?: Set<string>) {

  // yahoo_rankings
  defineTool(server, "yahoo_rankings", {
    description: "Use this to see the top-ranked players by z-score value for batters or pitchers. Returns rank, name, position, z-score, and Statcast quality tier. Use yahoo_compare instead when you want a side-by-side comparison of two specific players, or yahoo_value for a single player's full category-level z-score breakdown.",
    inputSchema: {
      pos_type: z.string().describe("B for batters, P for pitchers").default("B"),
      count: z.coerce.number().describe("Number of players to return").default(25),
      limit: z.coerce.number().default(25).describe("Max results to return (default 25, max 50)"),
      offset: z.coerce.number().default(0).describe("Offset for pagination"),
    },
    annotations: READ_ANNO, _meta: {},
  }, async ({ pos_type, count, limit, offset }) => {
    var effectiveCount = Math.min(count as number, limit as number);
    var data = await apiGet<RankingsResponse>("/api/rankings", { pos_type: pos_type as string, count: String(effectiveCount), limit: String(effectiveCount), offset: String(offset) });
    var effectiveType = data.pos_type || (pos_type as string);
    var label = effectiveType.toUpperCase() === "B" ? "Hitter" : "Pitcher";
    var text = "Top " + effectiveCount + " " + label + " Rankings (adjusted z-score, source: " + data.source + "):\n"
      + data.players.map(function (p: any) {
        var tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
        return "  " + String(p.rank).padStart(3) + ". " + str(p.name).padEnd(25) + " " + str(p.pos).padEnd(8) + " " + adjZLabel(p.z_score, p.adjusted_z) + tier;
      }).join("\n");
    var buyLow = data.players.filter(function (p: any) { return p.adjusted_z != null && p.adjusted_z > p.z_score + 0.3; }).length;
    var sellHigh = data.players.filter(function (p: any) { return p.adjusted_z != null && p.adjusted_z < p.z_score - 0.3; }).length;
    var footer = buildFooter(
      effectiveCount + " " + label.toLowerCase() + "s ranked." + (buyLow > 0 ? " " + buyLow + " buy-low (adjusted z > raw)." : "") + (sellHigh > 0 ? " " + sellHigh + " sell-high (adjusted z < raw)." : ""),
      [
        "Deep-dive any player -> yahoo_value {player_name}",
        "Compare two players -> yahoo_compare {player1} {player2}",
        "Find regression candidates -> fantasy_regression_candidates",
      ]
    );
    return { text: text + sampleWarning(data.players) + footer, structured: { type: "rankings", ...data } };
  }, enabledTools);

  // yahoo_compare
  defineTool(server, "yahoo_compare", {
    description: "Use this to compare two players head-to-head with per-category z-score breakdowns. Returns who wins in each scoring category and overall z-score totals. Use yahoo_trade_analysis instead when you want a full trade evaluation with surplus value and category impact, or yahoo_value for a single player's detailed breakdown.",
    inputSchema: { player1: z.string().describe("First player name"), player2: z.string().describe("Second player name") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ player1, player2 }) => {
    var data = await apiGet<CompareResponse>("/api/compare", { player1: player1 as string, player2: player2 as string });
    var final1 = data.z_scores["Final"] ? data.z_scores["Final"].player1 : 0;
    var final2 = data.z_scores["Final"] ? data.z_scores["Final"].player2 : 0;
    var z1Label = adjZLabel(final1, (data.player1 as any).adjusted_z);
    var z2Label = adjZLabel(final2, (data.player2 as any).adjusted_z);
    var lines = [
      "Player Comparison:",
      "  " + data.player1.name + " (" + z1Label + ")  vs  " + data.player2.name + " (" + z2Label + ")",
      "",
    ];
    for (var [cat, scores] of Object.entries(data.z_scores)) {
      if (cat === "Final") continue;
      lines.push("  " + str(cat).padEnd(12) + str(scores.player1.toFixed(2)).padStart(8) + "  vs  " + str(scores.player2.toFixed(2)).padStart(8));
    }
    return { text: lines.join("\n"), structured: { type: "compare", ...data } };
  }, enabledTools);

  // yahoo_value
  defineTool(server, "yahoo_value", {
    description: "Use this to see a single player's complete z-score breakdown across every scoring category with raw stat values, park factor, and Statcast quality tier. Use yahoo_compare instead when you want to evaluate two players side by side, or yahoo_rankings for a ranked list of top players by z-score.",
    inputSchema: { player_name: z.string().describe("Player name to look up") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ player_name }) => {
    var data = await apiGet<ValueResponse>("/api/value", { player_name: player_name as string });
    var p = data.players[0];
    if (!p) {
      return { text: "Player not found" };
    }
    var zFinal = p.z_scores["Final"] || 0;
    var adjZ = (p as any).adjusted_z;
    var zAdj = (p as any).z_adjustments || {};
    var tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
    var parkLabel = "";
    var pf = (p as any).park_factor;
    if (pf != null) parkLabel = "  PF=" + Number(pf).toFixed(2);
    var zLabel = adjZLabel(zFinal, adjZ);
    var lines = ["Value Breakdown: " + p.name + " (" + str(p.pos) + ", " + str(p.team) + ", " + zLabel + ")" + tier + parkLabel];
    if (Object.keys(zAdj).length > 0) {
      var parts: string[] = [];
      if (zAdj.regression) parts.push("regression " + (zAdj.regression > 0 ? "+" : "") + zAdj.regression);
      if (zAdj.quality) parts.push("quality " + (zAdj.quality > 0 ? "+" : "") + zAdj.quality);
      if (zAdj.momentum) parts.push("momentum " + (zAdj.momentum > 0 ? "+" : "") + zAdj.momentum);
      lines.push("  Adjustments: " + parts.join(", "));
    }
    for (var [cat, z] of Object.entries(p.z_scores)) {
      if (cat === "Final") continue;
      var rawStat = p.raw_stats[cat] ?? null;
      lines.push("  " + str(cat).padEnd(12) + " z=" + Number(z).toFixed(2) + (rawStat != null ? "  (" + rawStat + ")" : ""));
    }
    var adjParts: string[] = [];
    if (zAdj.regression) adjParts.push("regression");
    if (zAdj.quality) adjParts.push(((p as any).intel && (p as any).intel.statcast && (p as any).intel.statcast.quality_tier) || "quality");
    if (zAdj.momentum) adjParts.push(adjParts.length > 0 ? "momentum" : "trending");
    var adjReason = adjParts.length > 0 ? " (driven by " + adjParts.join(", ") + ")" : "";
    var footer = buildFooter(
      p.name + " is " + ((p as any).tier || "unranked") + adjReason + ".",
      [
        "Compare against alternatives -> yahoo_compare {" + p.name + "} {other_player}",
        "Full scouting report -> fantasy_player_report " + p.name,
        "Check who owns this player -> yahoo_who_owns " + (p as any).player_id,
      ]
    );
    return { text: lines.join("\n") + footer, structured: { type: "value", ...data } };
  }, enabledTools);

  // yahoo_projections_update
  defineTool(server, "yahoo_projections_update", {
    description: "Use this to force-refresh player projections from FanGraphs before a draft or when projections are stale. Supports consensus (blends all systems), steamer, zips, or fangraphsdc. Use yahoo_rankings after updating to see the refreshed z-score rankings, or yahoo_projection_disagreements to identify where systems diverge.",
    inputSchema: {
      proj_type: z.string().describe("Projection system: consensus, steamer, zips, or fangraphsdc").default("consensus"),
    },
    annotations: WRITE_ANNO, _meta: {},
  }, async ({ proj_type }) => {
    var data = await apiPost<any>("/api/projections-update", { proj_type });
    var lines = ["Projections Updated (" + proj_type + "):"];
    for (var key of Object.keys(data)) {
      if (key !== "error") {
        lines.push("  " + key + ": " + String(data[key]));
      }
    }
    return { text: lines.join("\n"), structured: { ...data } };
  }, enabledTools);

  // yahoo_zscore_shifts
  defineTool(server, "yahoo_zscore_shifts", {
    description: "Use this to find players whose z-score value has shifted the most since draft day. Compares current rest-of-season projections to the draft-day baseline to identify risers and fallers. Use yahoo_rankings instead for current absolute rankings, or yahoo_optimal_moves to act on rising free agents with roster swaps.",
    inputSchema: {
      count: z.coerce.number().describe("Number of biggest movers to return").default(25),
    },
    annotations: READ_ANNO, _meta: {},
  }, async ({ count }) => {
    var data = await apiGet<any>("/api/zscore-shifts", { count: String(count) });
    var note = data.note;
    if (note) {
      return { text: note };
    }
    var shifts = data.shifts || [];
    var baseline = data.baseline_date || "unknown";
    var lines = ["Z-Score Shifts (baseline: " + baseline + "):"];
    for (var s of shifts) {
      var arrow = s.direction === "rising" ? "^" : "v";
      lines.push(
        "  " + str(s.name).padEnd(25)
        + " " + str(s.pos).padEnd(8)
        + " draft=" + s.draft_z.toFixed(2)
        + " now=" + s.current_z.toFixed(2)
        + " delta=" + (s.delta > 0 ? "+" : "") + s.delta.toFixed(2)
        + " " + arrow
      );
    }
    return { text: lines.join("\n"), structured: { ...data } };
  }, enabledTools);

  // yahoo_projection_disagreements
  defineTool(server, "yahoo_projection_disagreements", {
    description: "Use this to find players where Steamer, ZiPS, and FanGraphs Depth Charts projection systems disagree most on value. High disagreement flags draft sleepers and potential busts. Use yahoo_projections_update first to ensure projections are current, or yahoo_rankings for consensus z-score rankings.",
    inputSchema: {
      pos_type: z.string().describe("B for batters, P for pitchers").default("B"),
      count: z.coerce.number().describe("Number of players to show").default(20),
    },
    annotations: READ_ANNO, _meta: {},
  }, async ({ pos_type, count }) => {
    var data = await apiGet<any>("/api/projection-disagreements", { pos_type: pos_type as string, count: String(count) });
    var lines = ["Projection Disagreements (" + ((pos_type as string) === "B" ? "Hitters" : "Pitchers") + "):"];
    var disag = data.disagreements || [];
    for (var d of disag) {
      var systems = [];
      if (d.steamer_z != null) systems.push("Stm=" + d.steamer_z.toFixed(1));
      if (d.zips_z != null) systems.push("ZiP=" + d.zips_z.toFixed(1));
      if (d.fangraphsdc_z != null) systems.push("DC=" + d.fangraphsdc_z.toFixed(1));
      lines.push("  " + str(d.name).padEnd(22) + " consensus=" + (d.consensus_z || 0).toFixed(1) + "  " + systems.join(" ") + "  [" + (d.level || "?") + "]");
    }
    return { text: lines.join("\n"), structured: { ...data } };
  }, enabledTools);

  // fantasy_projection_confidence
  defineTool(server, "fantasy_projection_confidence", {
    description: "Use this to see how much to trust a player's current projections vs actual stats using Bayesian analysis. Shows per-stat blend ratios (projection% vs actual%), posterior variance, confidence level, and how many days until actuals dominate each stat. Helps assess projection reliability for trade decisions, waiver adds, and lineup choices.",
    inputSchema: { player_name: z.string().describe("Player name to analyze") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ player_name }) => {
    var data = await apiGet<any>("/api/valuations/projection-confidence", { name: player_name as string });
    if (data.error) return { text: "Error: " + data.error };
    var lines = ["Projection Confidence: " + str(data.name)];
    lines.push("  Type: " + str(data.stat_type) + " | Sample: " + data.sample_size + " " + str(data.sample_label));
    lines.push("  Z-Score: " + data.z_score + " (" + str(data.tier) + ")");
    lines.push("  Composite Confidence: " + (data.composite_confidence * 100).toFixed(1) + "%");
    lines.push("");
    lines.push("  " + "Stat".padEnd(8) + "Proj%".padStart(8) + "Act%".padStart(8) + "PostVar".padStart(8) + "  Days to 50/50");
    lines.push("  " + "-".repeat(48));
    for (var s of (data.stats || [])) {
      var d50 = s.days_until_50_50 > 0 ? s.days_until_50_50 + "d" : "reached";
      lines.push("  " + str(s.stat).padEnd(8) + (s.projection_weight * 100).toFixed(1).padStart(7) + "%" + (s.actual_weight * 100).toFixed(1).padStart(7) + "%" + s.posterior_variance.toFixed(3).padStart(8) + "  " + d50);
    }
    return { text: lines.join("\n"), structured: { ...data } };
  }, enabledTools);
}
