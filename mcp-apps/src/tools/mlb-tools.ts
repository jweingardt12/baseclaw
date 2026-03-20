import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, toolError } from "../api/python-client.js";
import {
  str,
  type MlbTeamsResponse,
  type MlbRosterResponse,
  type MlbPlayerResponse,
  type MlbStatsResponse,
  type MlbInjuriesResponse,
  type MlbStandingsResponse,
  type MlbScheduleResponse,
  type MlbDraftResponse,
  type WeatherResponse,
} from "../api/types.js";

export function registerMlbTools(server: McpServer) {
  // mlb_teams
  registerAppTool(
    server,
    "mlb_teams",
    {
      description: "List all MLB teams with abbreviations",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<MlbTeamsResponse>("/api/mlb/teams");
        const text = "MLB Teams:\n" + data.teams.map((t) =>
          "  " + str(t.abbreviation).padEnd(4) + " " + str(t.name)
        ).join("\n");
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "mlb-teams", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // mlb_roster
  registerAppTool(
    server,
    "mlb_roster",
    {
      description: "Get an MLB team's roster. team: abbreviation (NYY, LAD) or team ID",
      inputSchema: { team: z.string().describe("Team abbreviation (NYY, LAD) or MLB team ID") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ team }) => {
      try {
        const data = await apiGet<MlbRosterResponse>("/api/mlb/roster", { team });
        const text = data.team_name + " Roster:\n" + data.roster.map((p) =>
          "  #" + str(p.jersey_number).padStart(2) + " " + str(p.name).padEnd(25) + " " + str(p.position)
        ).join("\n");
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "mlb-roster", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // mlb_player
  registerAppTool(
    server,
    "mlb_player",
    {
      description: "Get MLB player info by MLB Stats API player ID",
      inputSchema: { player_id: z.string().describe("MLB Stats API player ID") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_id }) => {
      try {
        const data = await apiGet<MlbPlayerResponse>("/api/mlb/player", { player_id });
        const text = "Player: " + data.name + "\n"
          + "  Position: " + data.position + "\n"
          + "  Team: " + data.team + "\n"
          + "  Bats/Throws: " + data.bats + "/" + data.throws + "\n"
          + "  Age: " + data.age + "\n"
          + "  MLB ID: " + data.mlb_id;
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "mlb-player", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // mlb_stats
  registerAppTool(
    server,
    "mlb_stats",
    {
      description: "Get player season stats by MLB Stats API player ID",
      inputSchema: { player_id: z.string().describe("MLB Stats API player ID"), season: z.string().describe("Season year (e.g. 2025)").default("2025") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_id, season }) => {
      try {
        const data = await apiGet<MlbStatsResponse>("/api/mlb/stats", { player_id, season });
        const lines = ["Stats for " + season + ":"];
        for (const [key, val] of Object.entries(data.stats)) {
          lines.push("  " + key + ": " + String(val));
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "mlb-stats", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // mlb_injuries
  registerAppTool(
    server,
    "mlb_injuries",
    {
      description: "Show current MLB injuries across all teams",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<MlbInjuriesResponse>("/api/mlb/injuries");
        const text = data.injuries.length > 0
          ? "Current Injuries:\n" + data.injuries.map((i) =>
              "  " + i.player + " (" + i.team + "): " + i.description
            ).join("\n")
          : "No injuries reported (may be offseason)";
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "mlb-injuries", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // mlb_standings
  registerAppTool(
    server,
    "mlb_standings",
    {
      description: "Show MLB division standings",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<MlbStandingsResponse>("/api/mlb/standings");
        const lines: string[] = [];
        for (const div of data.divisions) {
          lines.push("", div.name + ":");
          for (const t of div.teams) {
            lines.push("  " + str(t.name).padEnd(25) + " " + t.wins + "-" + t.losses + " (" + str(t.games_back) + " GB)");
          }
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "mlb-standings", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // mlb_schedule
  registerAppTool(
    server,
    "mlb_schedule",
    {
      description: "Show MLB game schedule. Leave date empty for today, or pass YYYY-MM-DD",
      inputSchema: { date: z.string().describe("Date in YYYY-MM-DD format, empty for today").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ date }) => {
      try {
        const params: Record<string, string> = {};
        if (date) params.date = date;
        const data = await apiGet<MlbScheduleResponse>("/api/mlb/schedule", params);
        const text = "Games for " + data.date + ":\n" + data.games.map((g) =>
          "  " + g.away + " @ " + g.home + " - " + g.status
        ).join("\n");
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "mlb-schedule", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // mlb_draft
  registerAppTool(
    server,
    "mlb_draft",
    {
      description: "Show MLB draft picks by year. Returns draft selections with player names, teams, rounds, and positions",
      inputSchema: { year: z.string().describe("Draft year (e.g. '2025'). Omit for current year.").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ year }) => {
      try {
        var params: Record<string, string> = {};
        if (year) params.year = year;
        var data = await apiGet<MlbDraftResponse>("/api/mlb/draft", params);
        if (data.note) {
          return {
            content: [{ type: "text" as const, text: data.note }],
            structuredContent: { type: "mlb-draft", ai_recommendation: null, ...data },
          };
        }
        var lines = ["MLB Draft " + (data.year || year) + ":"];
        var currentRound = "";
        for (var p of data.picks) {
          if (str(p.round) !== currentRound) {
            currentRound = str(p.round);
            lines.push("  Round " + currentRound + ":");
          }
          var line = "    #" + str(p.pick_number).padStart(3) + " " + str(p.name).padEnd(25) + " " + str(p.position).padEnd(5) + " " + str(p.team);
          if (p.school) line += " (" + p.school + ")";
          lines.push(line);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "mlb-draft", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_weather
  registerAppTool(
    server,
    "yahoo_weather",
    {
      description: "Check weather/venue risk for MLB games. Shows which games are in domed vs outdoor stadiums to help with lineup and streaming decisions",
      inputSchema: { date: z.string().describe("Date in YYYY-MM-DD format, empty for today").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ date }) => {
      try {
        var params: Record<string, string> = {};
        if (date) params.date = date;
        var data = await apiGet<WeatherResponse>("/api/mlb/weather", params);
        var lines = ["Weather Risk Report - " + data.date, ""];
        var dome: string[] = [];
        var outdoor: string[] = [];
        for (var g of data.games) {
          var label = g.is_dome ? "[DOME]" : "[OUTDOOR]";
          var line = "  " + g.away + " @ " + g.home + " - " + g.venue + " " + label;
          if (g.is_dome) {
            dome.push(line);
          } else {
            outdoor.push(line);
          }
        }
        if (outdoor.length > 0) {
          lines.push("OUTDOOR (check forecast):");
          lines.push.apply(lines, outdoor);
          lines.push("");
        }
        if (dome.length > 0) {
          lines.push("DOME/RETRACTABLE (no weather risk):");
          lines.push.apply(lines, dome);
          lines.push("");
        }
        lines.push("Dome: " + data.dome_count + "  Outdoor: " + data.outdoor_count);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "weather", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
}
