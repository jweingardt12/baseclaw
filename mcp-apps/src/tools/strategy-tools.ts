import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, apiPost, toolError } from "../api/python-client.js";
import {
  str,
  type ProbablePitchersResponse,
  type ScheduleAnalysisResponse,
  type CategoryImpactResponse,
  type RegressionCandidatesResponse,
  type PlayerTierResponse,
} from "../api/types.js";

export function registerStrategyTools(server: McpServer) {

  // fantasy_probable_pitchers
  registerAppTool(
    server,
    "fantasy_probable_pitchers",
    {
      description: "Get upcoming probable starting pitchers for the next N days",
      inputSchema: { days: z.number().describe("Number of days to look ahead").default(7) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ days }) => {
      try {
        const data = await apiGet<ProbablePitchersResponse>("/api/probable-pitchers", { days: String(days) });
        const pitchers = data.pitchers || [];
        if (pitchers.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No probable pitchers found for next " + days + " days" }],
            structuredContent: { type: "probable-pitchers", ai_recommendation: null, ...data },
          };
        }
        const lines = ["Probable Pitchers (next " + days + " days):"];
        lines.push("  " + "Date".padEnd(12) + "Pitcher".padEnd(25) + "Team".padEnd(6) + "Opponent");
        lines.push("  " + "-".repeat(55));
        for (const p of pitchers) {
          const opp = p.opponent ? (p.home_away === "away" ? "@ " : "vs ") + str(p.opponent) : "";
          lines.push("  " + str(p.date).slice(0, 10).padEnd(12) + str(p.pitcher).padEnd(25) + str(p.team).padEnd(6) + opp);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "probable-pitchers", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // fantasy_schedule_analysis
  registerAppTool(
    server,
    "fantasy_schedule_analysis",
    {
      description: "Analyze schedule density for an MLB team - games per day, off days, and activity level over the next N days",
      inputSchema: {
        team: z.string().describe("MLB team name or abbreviation"),
        days: z.number().describe("Number of days to analyze").default(14),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ team, days }) => {
      try {
        const data = await apiGet<ScheduleAnalysisResponse>("/api/schedule-analysis", { team, days: String(days) });
        const lines = ["Schedule Analysis: " + str(data.team) + " (next " + data.days + " days):"];
        lines.push("  Total games:     " + str(data.games_total));
        lines.push("  This week:       " + str(data.games_this_week));
        lines.push("  Next week:       " + str(data.games_next_week));
        lines.push("  Off days:        " + str(data.off_days));
        lines.push("  Density rating:  " + str(data.density_rating));
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "schedule-analysis", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // fantasy_category_impact
  registerAppTool(
    server,
    "fantasy_category_impact",
    {
      description: "Project the category impact of adding/dropping players. Shows how each stat category would change.",
      inputSchema: {
        add_players: z.array(z.string()).describe("Player names to add"),
        drop_players: z.array(z.string()).describe("Player names to drop"),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ add_players, drop_players }) => {
      try {
        const data = await apiPost<CategoryImpactResponse>("/api/category-impact", { add_players, drop_players });
        const lines = ["Category Impact Analysis:"];
        lines.push("  Adding: " + add_players.join(", "));
        lines.push("  Dropping: " + drop_players.join(", "));
        lines.push("");
        const impact = data.category_impact || {};
        const entries = Object.entries(impact);
        if (entries.length > 0) {
          lines.push("  " + "Category".padEnd(12) + "Add Z".padStart(8) + "Drop Z".padStart(9) + "Delta".padStart(8) + "Direction".padStart(12));
          lines.push("  " + "-".repeat(49));
          for (const [cat, info] of entries) {
            const sign = info.delta >= 0 ? "+" : "";
            lines.push("  " + str(cat).padEnd(12) + str(info.add_z.toFixed(2)).padStart(8) + str(info.drop_z.toFixed(2)).padStart(9) + (sign + info.delta.toFixed(2)).padStart(8) + str(info.direction).padStart(12));
          }
        }
        lines.push("");
        lines.push("  Net Z change: " + str(data.net_z_change));
        lines.push("  Assessment:   " + str(data.assessment));
        if ((data.improving_categories || []).length > 0) {
          lines.push("  Improving:    " + data.improving_categories.join(", "));
        }
        if ((data.declining_categories || []).length > 0) {
          lines.push("  Declining:    " + data.declining_categories.join(", "));
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "category-impact", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // fantasy_regression_candidates
  registerAppTool(
    server,
    "fantasy_regression_candidates",
    {
      description: "Find buy-low and sell-high regression candidates based on Statcast metrics vs actual performance",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<RegressionCandidatesResponse>("/api/regression-candidates");
        const lines = ["Regression Candidates:"];
        const buyH = data.buy_low_hitters || [];
        const sellH = data.sell_high_hitters || [];
        const buyP = data.buy_low_pitchers || [];
        const sellP = data.sell_high_pitchers || [];
        if (buyH.length > 0) {
          lines.push("");
          lines.push("BUY LOW HITTERS (" + buyH.length + "):");
          for (const c of buyH.slice(0, 15)) {
            lines.push("  " + str(c.name).padEnd(25) + " " + str(c.signal).padEnd(20) + " " + str(c.details));
          }
        }
        if (sellH.length > 0) {
          lines.push("");
          lines.push("SELL HIGH HITTERS (" + sellH.length + "):");
          for (const c of sellH.slice(0, 15)) {
            lines.push("  " + str(c.name).padEnd(25) + " " + str(c.signal).padEnd(20) + " " + str(c.details));
          }
        }
        if (buyP.length > 0) {
          lines.push("");
          lines.push("BUY LOW PITCHERS (" + buyP.length + "):");
          for (const c of buyP.slice(0, 15)) {
            lines.push("  " + str(c.name).padEnd(25) + " " + str(c.signal).padEnd(20) + " " + str(c.details));
          }
        }
        if (sellP.length > 0) {
          lines.push("");
          lines.push("SELL HIGH PITCHERS (" + sellP.length + "):");
          for (const c of sellP.slice(0, 15)) {
            lines.push("  " + str(c.name).padEnd(25) + " " + str(c.signal).padEnd(20) + " " + str(c.details));
          }
        }
        if (buyH.length === 0 && sellH.length === 0 && buyP.length === 0 && sellP.length === 0) {
          lines.push("  No regression candidates found.");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "regression-candidates", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // fantasy_player_tier
  registerAppTool(
    server,
    "fantasy_player_tier",
    {
      description: "Get a player's z-score tier and category breakdown from the valuation engine",
      inputSchema: { player_name: z.string().describe("Player name to look up") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name }) => {
      try {
        const data = await apiGet<PlayerTierResponse>("/api/player-tier", { name: player_name });
        const lines = ["Player Tier: " + str(data.name)];
        lines.push("  Tier:    " + str(data.tier));
        lines.push("  Z-Score: " + str(data.z_final));
        lines.push("  Rank:    " + str(data.rank));
        const zScores = data.per_category_zscores || {};
        const entries = Object.entries(zScores);
        if (entries.length > 0) {
          lines.push("");
          lines.push("  Category Breakdown:");
          for (const [cat, val] of entries) {
            const sign = Number(val) >= 0 ? "+" : "";
            lines.push("    " + str(cat).padEnd(12) + sign + Number(val).toFixed(2));
          }
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "player-tier", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
}
