import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, apiPost, toolError } from "../api/python-client.js";
import { generateRankingsInsight, generateCompareInsight } from "../insights.js";
import { str, type RankingsResponse, type CompareResponse, type ValueResponse } from "../api/types.js";
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export function registerValuationsTools(server: McpServer, enabledTools?: Set<string>) {
  const shouldRegister = (name: string) => _shouldRegister(enabledTools, name);
  // yahoo_rankings
  if (shouldRegister("yahoo_rankings")) {
  registerAppTool(
    server,
    "yahoo_rankings",
    {
      description: "Use this to see the top-ranked players by z-score value for batters or pitchers. Returns rank, name, position, z-score, and Statcast quality tier. Use yahoo_compare instead when you want a side-by-side comparison of two specific players, or yahoo_value for a single player's full category-level z-score breakdown.",
      inputSchema: {
        pos_type: z.string().describe("B for batters, P for pitchers").default("B"),
        count: z.number().describe("Number of players to return").default(25),
        limit: z.number().default(25).describe("Max results to return (default 25, max 50)"),
        offset: z.number().default(0).describe("Offset for pagination"),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ pos_type, count, limit, offset }) => {
      try {
        var effectiveCount = Math.min(count, limit);
        const data = await apiGet<RankingsResponse>("/api/rankings", { pos_type, count: String(effectiveCount), limit: String(effectiveCount), offset: String(offset) });
        const effectiveType = data.pos_type || pos_type;
        const label = effectiveType.toUpperCase() === "B" ? "Hitter" : "Pitcher";
        const text = "Top " + effectiveCount + " " + label + " Rankings (z-score, source: " + data.source + "):\n"
          + data.players.map((p) => {
            const tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
            return "  " + String(p.rank).padStart(3) + ". " + str(p.name).padEnd(25) + " " + str(p.pos).padEnd(8) + " z=" + p.z_score.toFixed(2) + tier;
          }).join("\n");
        var ai_recommendation = generateRankingsInsight(data);
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            type: "rankings",
            ai_recommendation,
            ...data,
            _pagination: {
              returned: (data.players || []).length,
              offset: offset,
              has_more: (data.players || []).length >= effectiveCount,
            },
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_compare
  if (shouldRegister("yahoo_compare")) {
  registerAppTool(
    server,
    "yahoo_compare",
    {
      description: "Use this to compare two players head-to-head with per-category z-score breakdowns. Returns who wins in each scoring category and overall z-score totals. Use yahoo_trade_analysis instead when you want a full trade evaluation with surplus value and category impact, or yahoo_value for a single player's detailed breakdown.",
      inputSchema: { player1: z.string().describe("First player name"), player2: z.string().describe("Second player name") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player1, player2 }) => {
      try {
        const data = await apiGet<CompareResponse>("/api/compare", { player1, player2 });
        const final1 = data.z_scores["Final"] ? data.z_scores["Final"].player1 : 0;
        const final2 = data.z_scores["Final"] ? data.z_scores["Final"].player2 : 0;
        const lines = [
          "Player Comparison:",
          "  " + data.player1.name + " (z=" + final1.toFixed(2) + ")  vs  " + data.player2.name + " (z=" + final2.toFixed(2) + ")",
          "",
        ];
        const cats1: Record<string, number> = {};
        const cats2: Record<string, number> = {};
        for (const [cat, scores] of Object.entries(data.z_scores)) {
          if (cat === "Final") continue;
          cats1[cat] = scores.player1;
          cats2[cat] = scores.player2;
          lines.push("  " + str(cat).padEnd(12) + str(scores.player1.toFixed(2)).padStart(8) + "  vs  " + str(scores.player2.toFixed(2)).padStart(8));
        }
        var ai_recommendation = generateCompareInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: {
            type: "compare",
            ai_recommendation,
            player1: { name: data.player1.name, z_score: final1, categories: cats1 },
            player2: { name: data.player2.name, z_score: final2, categories: cats2 },
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_value
  if (shouldRegister("yahoo_value")) {
  registerAppTool(
    server,
    "yahoo_value",
    {
      description: "Use this to see a single player's complete z-score breakdown across every scoring category with raw stat values, park factor, and Statcast quality tier. Use yahoo_compare instead when you want to evaluate two players side by side, or yahoo_rankings for a ranked list of top players by z-score.",
      inputSchema: { player_name: z.string().describe("Player name to look up") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name }) => {
      try {
        const data = await apiGet<ValueResponse>("/api/value", { player_name });
        const p = data.players[0];
        if (!p) {
          return {
            content: [{ type: "text" as const, text: "Player not found" }],
            structuredContent: { type: "value", name: "Unknown", z_final: 0, categories: [] },
          };
        }
        const zFinal = p.z_scores["Final"] || 0;
        const tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
        var parkLabel = "";
        var pf = (p as any).park_factor;
        if (pf != null) parkLabel = "  PF=" + Number(pf).toFixed(2);
        const lines = ["Value Breakdown: " + p.name + " (" + str(p.pos) + ", " + str(p.team) + ", z=" + zFinal.toFixed(2) + ")" + tier + parkLabel];
        const categories: Array<{ category: string; z_score: number; raw_stat: number | null }> = [];
        for (const [cat, z] of Object.entries(p.z_scores)) {
          if (cat === "Final") continue;
          const rawStat = p.raw_stats[cat] ?? null;
          categories.push({ category: cat, z_score: Number(z), raw_stat: rawStat });
          lines.push("  " + str(cat).padEnd(12) + " z=" + Number(z).toFixed(2) + (rawStat != null ? "  (" + rawStat + ")" : ""));
        }
        var ai_recommendation: string | null = null;
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: {
            type: "value",
            ai_recommendation,
            name: p.name,
            team: p.team,
            pos: p.pos,
            player_type: p.type,
            z_final: zFinal,
            park_factor: pf || null,
            categories,
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_projections_update
  if (shouldRegister("yahoo_projections_update")) {
  registerAppTool(
    server,
    "yahoo_projections_update",
    {
      description: "Use this to force-refresh player projections from FanGraphs before a draft or when projections are stale. Supports consensus (blends all systems), steamer, zips, or fangraphsdc. Use yahoo_rankings after updating to see the refreshed z-score rankings, or yahoo_projection_disagreements to identify where systems diverge.",
      inputSchema: {
        proj_type: z.string().describe("Projection system: consensus, steamer, zips, or fangraphsdc").default("consensus"),
      },
      annotations: { readOnlyHint: false },
      _meta: {},
    },
    async ({ proj_type }) => {
      try {
        var data = await apiPost<any>("/api/projections-update", { proj_type });
        var lines = ["Projections Updated (" + proj_type + "):"];
        for (var key of Object.keys(data)) {
          if (key !== "error") {
            lines.push("  " + key + ": " + String(data[key]));
          }
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "projections-update", proj_type, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_zscore_shifts
  if (shouldRegister("yahoo_zscore_shifts")) {
  registerAppTool(
    server,
    "yahoo_zscore_shifts",
    {
      description: "Use this to find players whose z-score value has shifted the most since draft day. Compares current rest-of-season projections to the draft-day baseline to identify risers and fallers. Use yahoo_rankings instead for current absolute rankings, or yahoo_optimal_moves to act on rising free agents with roster swaps.",
      inputSchema: {
        count: z.number().describe("Number of biggest movers to return").default(25),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ count }) => {
      try {
        var data = await apiGet<any>("/api/zscore-shifts", { count: String(count) });
        var note = data.note;
        if (note) {
          return {
            content: [{ type: "text" as const, text: note }],
            structuredContent: { type: "zscore-shifts", note },
          };
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
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "zscore-shifts", baseline_date: baseline, shifts },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_projection_disagreements
  if (shouldRegister("yahoo_projection_disagreements")) {
  registerAppTool(
    server,
    "yahoo_projection_disagreements",
    {
      description: "Use this to find players where Steamer, ZiPS, and FanGraphs Depth Charts projection systems disagree most on value. High disagreement flags draft sleepers and potential busts. Use yahoo_projections_update first to ensure projections are current, or yahoo_rankings for consensus z-score rankings.",
      inputSchema: {
        pos_type: z.string().describe("B for batters, P for pitchers").default("B"),
        count: z.number().describe("Number of players to show").default(20),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ pos_type, count }) => {
      try {
        var data = await apiGet<any>("/api/projection-disagreements", { pos_type, count: String(count) });
        var lines = ["Projection Disagreements (" + (pos_type === "B" ? "Hitters" : "Pitchers") + "):"];
        var disag = data.disagreements || [];
        for (var d of disag) {
          var systems = [];
          if (d.steamer_z != null) systems.push("Stm=" + d.steamer_z.toFixed(1));
          if (d.zips_z != null) systems.push("ZiP=" + d.zips_z.toFixed(1));
          if (d.fangraphsdc_z != null) systems.push("DC=" + d.fangraphsdc_z.toFixed(1));
          lines.push("  " + str(d.name).padEnd(22) + " consensus=" + (d.consensus_z || 0).toFixed(1) + "  " + systems.join(" ") + "  [" + (d.level || "?") + "]");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "projection-disagreements", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // fantasy_projection_confidence
  if (shouldRegister("fantasy_projection_confidence")) {
  registerAppTool(
    server,
    "fantasy_projection_confidence",
    {
      description: "Use this to see how much to trust a player's current projections vs actual stats using Bayesian analysis. Shows per-stat blend ratios (projection% vs actual%), posterior variance, confidence level, and how many days until actuals dominate each stat. Helps assess projection reliability for trade decisions, waiver adds, and lineup choices.",
      inputSchema: { player_name: z.string().describe("Player name to analyze") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name }) => {
      try {
        const data = await apiGet<any>("/api/valuations/projection-confidence", { name: player_name });
        if (data.error) return { content: [{ type: "text" as const, text: "Error: " + data.error }] };
        const lines = ["Projection Confidence: " + str(data.name)];
        lines.push("  Type: " + str(data.stat_type) + " | Sample: " + data.sample_size + " " + str(data.sample_label));
        lines.push("  Z-Score: " + data.z_score + " (" + str(data.tier) + ")");
        lines.push("  Composite Confidence: " + (data.composite_confidence * 100).toFixed(1) + "%");
        lines.push("");
        lines.push("  " + "Stat".padEnd(8) + "Proj%".padStart(8) + "Act%".padStart(8) + "PostVar".padStart(8) + "  Days to 50/50");
        lines.push("  " + "-".repeat(48));
        for (const s of (data.stats || [])) {
          const d50 = s.days_until_50_50 > 0 ? s.days_until_50_50 + "d" : "reached";
          lines.push("  " + str(s.stat).padEnd(8) + (s.projection_weight * 100).toFixed(1).padStart(7) + "%" + (s.actual_weight * 100).toFixed(1).padStart(7) + "%" + s.posterior_variance.toFixed(3).padStart(8) + "  " + d50);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "projection-confidence", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }
}
