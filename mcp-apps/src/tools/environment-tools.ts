import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, toolError } from "../api/python-client.js";
import { READ_ANNO } from "../api/annotations.js";
import {
  str,
  type GameEnvironmentResponse,
  type UmpireReportResponse,
  type ConsensusRankingsResponse,
  type FangraphsRecentResponse,
} from "../api/types.js";
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export function registerEnvironmentTools(server: McpServer, enabledTools?: Set<string>) {
  var shouldRegister = (name: string) => _shouldRegister(enabledTools, name);

  // yahoo_game_environment
  if (shouldRegister("yahoo_game_environment")) {
  registerAppTool(
    server,
    "yahoo_game_environment",
    {
      description: "Get weather conditions, home plate umpire, and park factor for every MLB game on a date. Useful for streaming decisions, lineup optimization, and matchup analysis. Shows temperature, wind, and whether conditions favor hitters or pitchers.",
      inputSchema: { date: z.string().describe("Date in YYYY-MM-DD format, empty for today").default("") },
      annotations: READ_ANNO,
      _meta: {},
    },
    async ({ date }) => {
      try {
        var params: Record<string, string> = {};
        if (date) params.date = date;
        var data = await apiGet<GameEnvironmentResponse>("/api/game-environment", params);
        var lines = ["Game Environment - " + data.date, ""];
        var games = data.games;
        for (var gpk of Object.keys(games)) {
          var g = games[gpk];
          lines.push(str(g.away_team) + " @ " + str(g.home_team) + " (" + str(g.venue) + ")");
          if (g.weather && (g.weather.temp || g.weather.wind)) {
            lines.push("  Weather: " + str(g.weather.temp) + "F, " + str(g.weather.wind) + " - " + str(g.weather.condition));
          }
          if (g.hp_umpire && g.hp_umpire.name) {
            lines.push("  HP Umpire: " + str(g.hp_umpire.name));
          }
          lines.push("  Park Factor: " + String(g.park_factor));
          lines.push("");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_umpire_report
  if (shouldRegister("yahoo_umpire_report")) {
  registerAppTool(
    server,
    "yahoo_umpire_report",
    {
      description: "Get home plate umpire assignments for all MLB games on a date. HP umpire identity affects strikeout rates and run-scoring environment.",
      inputSchema: { date: z.string().describe("Date in YYYY-MM-DD format, empty for today").default("") },
      annotations: READ_ANNO,
      _meta: {},
    },
    async ({ date }) => {
      try {
        var params: Record<string, string> = {};
        if (date) params.date = date;
        var data = await apiGet<UmpireReportResponse>("/api/umpire-report", params);
        var lines = ["HP Umpire Report - " + data.date, ""];
        for (var u of data.umpires) {
          lines.push(str(u.game) + " (" + str(u.venue) + ")");
          lines.push("  HP: " + str(u.hp_umpire.name));
          lines.push("");
        }
        if (data.umpires.length === 0) {
          lines.push("No umpire assignments posted yet for this date.");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_consensus_rankings
  if (shouldRegister("yahoo_consensus_rankings")) {
  registerAppTool(
    server,
    "yahoo_consensus_rankings",
    {
      description: "Get FantasyPros expert consensus rest-of-season rankings with disagreement signal. High rank_std means experts disagree — potential breakout or bust candidate. Useful for trade targets and waiver decisions. Filterable by position.",
      inputSchema: {
        position: z.string().describe("Position filter: ALL, SP, RP, C, 1B, 2B, 3B, SS, OF, DH").default("ALL"),
        limit: z.number().describe("Max players to return").default(50),
      },
      annotations: READ_ANNO,
      _meta: {},
    },
    async ({ position, limit }) => {
      try {
        var data = await apiGet<ConsensusRankingsResponse>("/api/consensus-rankings", { position: position });
        var players = data.players.slice(0, limit);
        var lines = ["FantasyPros Consensus Rankings (ROS) - " + data.position, ""];
        lines.push("Rank  Player".padEnd(35) + "Team  Pos    ECR   Min-Max    StdDev");
        lines.push("-".repeat(75));
        for (var p of players) {
          var rank = String(p.ecr).padStart(4);
          var name = str(p.player_name).padEnd(26);
          var team = str(p.team).padEnd(5);
          var pos = str(p.pos_rank).padEnd(7);
          var range = (String(p.rank_min) + "-" + String(p.rank_max)).padEnd(10);
          var std = p.rank_std.toFixed(1);
          var flag = p.rank_std >= 30 ? " [HIGH DISAGREE]" : (p.rank_std >= 15 ? " [MODERATE]" : "");
          lines.push(rank + "  " + name + team + pos + String(p.ecr).padEnd(6) + range + std + flag);
        }
        lines.push("");
        lines.push("Total ranked: " + data.count + " | Showing top " + players.length);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_fangraphs_recent
  if (shouldRegister("yahoo_fangraphs_recent")) {
  registerAppTool(
    server,
    "yahoo_fangraphs_recent",
    {
      description: "Get FanGraphs current-season stats for batters or pitchers. Returns park-adjusted metrics (wRC+, OPS, K%, BB% for hitters; ERA, FIP, WHIP for pitchers). Use for evaluating recent performance trends.",
      inputSchema: {
        stat: z.enum(["bat", "pit"]).describe("bat for hitters, pit for pitchers").default("bat"),
      },
      annotations: READ_ANNO,
      _meta: {},
    },
    async ({ stat }) => {
      try {
        var data = await apiGet<FangraphsRecentResponse>("/api/fangraphs-recent", { stat: stat });
        var lines = ["FanGraphs " + (stat === "bat" ? "Batting" : "Pitching") + " Stats", ""];
        lines.push("Players loaded: " + data.count);
        lines.push("Use yahoo_player_stats or yahoo_compare for individual player lookups.");
        lines.push("This data enriches hot/cold detection and player comparisons.");
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }
}
