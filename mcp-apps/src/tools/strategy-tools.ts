import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, apiPost, toolError } from "../api/python-client.js";
import {
  str,
  type ProbablePitchersResponse,
  type ScheduleAnalysisResponse,
  type RegressionCandidatesResponse,
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

}
