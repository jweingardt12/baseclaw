import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../api/python-client.js";
import { READ_ANNO } from "../api/annotations.js";
import { defineTool } from "../api/define-tool.js";
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

export function registerMlbTools(server: McpServer, enabledTools?: Set<string>) {

  // mlb_teams
  defineTool(server, "mlb_teams", {
    description: "Use this to list all 30 MLB teams with their abbreviations and full names. Returns the team abbreviation codes needed by other tools like mlb_roster and mlb_standings. Use mlb_roster instead when you want to see a specific team's player roster.",
    annotations: READ_ANNO, _meta: {},
  }, async () => {
    var data = await apiGet<MlbTeamsResponse>("/api/mlb/teams");
    var text = "MLB Teams:\n" + data.teams.map(function (t) {
      return "  " + str(t.abbreviation).padEnd(4) + " " + str(t.name);
    }).join("\n");
    return { text };
  }, enabledTools);

  // mlb_roster
  defineTool(server, "mlb_roster", {
    description: "Use this to see all players on an MLB team's 40-man roster with jersey numbers and positions. Pass the team abbreviation (e.g. 'NYY', 'LAD') or MLB team ID. Use mlb_player instead when you want detailed info on a specific player rather than the full roster.",
    inputSchema: { team: z.string().describe("Team abbreviation (NYY, LAD) or MLB team ID") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ team }) => {
    var data = await apiGet<MlbRosterResponse>("/api/mlb/roster", { team: team as string });
    var text = data.team_name + " Roster:\n" + data.roster.map(function (p) {
      return "  #" + str(p.jersey_number).padStart(2) + " " + str(p.name).padEnd(25) + " " + str(p.position);
    }).join("\n");
    return { text };
  }, enabledTools);

  // mlb_player
  defineTool(server, "mlb_player", {
    description: "Use this to get biographical info for an MLB player including position, team, bats/throws, and age. Pass the MLB Stats API player ID. Use mlb_stats instead when you want a player's season statistics rather than their bio.",
    inputSchema: { player_id: z.string().describe("MLB Stats API player ID") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ player_id }) => {
    var data = await apiGet<MlbPlayerResponse>("/api/mlb/player", { player_id: player_id as string });
    var text = "Player: " + data.name + "\n"
      + "  Position: " + data.position + "\n"
      + "  Team: " + data.team + "\n"
      + "  Bats/Throws: " + data.bats + "/" + data.throws + "\n"
      + "  Age: " + data.age + "\n"
      + "  MLB ID: " + data.mlb_id;
    return { text };
  }, enabledTools);

  // mlb_stats
  defineTool(server, "mlb_stats", {
    description: "Use this to get a player's official season statistics from the MLB Stats API. Pass the player ID and optional season year. Use fantasy_player_report instead when you want a richer analysis with Statcast data, trends, and fantasy context beyond raw stats.",
    inputSchema: { player_id: z.string().describe("MLB Stats API player ID"), season: z.string().describe("Season year (e.g. 2025)").default("2025") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ player_id, season }) => {
    var data = await apiGet<MlbStatsResponse>("/api/mlb/stats", { player_id: player_id as string, season: season as string });
    var lines = ["Stats for " + season + ":"];
    for (var [key, val] of Object.entries(data.stats)) {
      lines.push("  " + key + ": " + String(val));
    }
    return { text: lines.join("\n") };
  }, enabledTools);

  // mlb_injuries
  defineTool(server, "mlb_injuries", {
    description: "Use this to see all current MLB injuries across every team with player names and injury descriptions. Returns the league-wide injury list which is useful for waiver wire planning. Use yahoo_player_intel instead when you want injury details for one specific player along with other qualitative context.",
    annotations: READ_ANNO, _meta: {},
  }, async () => {
    var data = await apiGet<MlbInjuriesResponse>("/api/mlb/injuries");
    var text = data.injuries.length > 0
      ? "Current Injuries:\n" + data.injuries.map(function (i) {
          return "  " + i.player + " (" + i.team + "): " + i.description;
        }).join("\n")
      : "No injuries reported (may be offseason)";
    return { text };
  }, enabledTools);

  // mlb_standings
  defineTool(server, "mlb_standings", {
    description: "Use this to see current MLB division standings with win-loss records and games back. Returns all six divisions with team rankings. Use mlb_schedule instead when you want to see upcoming games rather than standings.",
    annotations: READ_ANNO, _meta: {},
  }, async () => {
    var data = await apiGet<MlbStandingsResponse>("/api/mlb/standings");
    var lines: string[] = [];
    for (var div of data.divisions) {
      lines.push("", div.name + ":");
      for (var t of div.teams) {
        lines.push("  " + str(t.name).padEnd(25) + " " + t.wins + "-" + t.losses + " (" + str(t.games_back) + " GB)");
      }
    }
    return { text: lines.join("\n") };
  }, enabledTools);

  // mlb_schedule
  defineTool(server, "mlb_schedule", {
    description: "Use this to see the MLB game schedule for a given day showing matchups and game status. Pass a date in YYYY-MM-DD format or leave empty for today's games. Use yahoo_weather instead when you need to know which games are at outdoor vs domed stadiums for weather risk.",
    inputSchema: { date: z.string().describe("Date in YYYY-MM-DD format, empty for today").default("") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ date }) => {
    var params: Record<string, string> = {};
    if (date) params.date = date as string;
    var data = await apiGet<MlbScheduleResponse>("/api/mlb/schedule", params);
    var text = "Games for " + data.date + ":\n" + data.games.map(function (g) {
      return "  " + g.away + " @ " + g.home + " - " + g.status;
    }).join("\n");
    return { text };
  }, enabledTools);

  // mlb_draft
  defineTool(server, "mlb_draft", {
    description: "Use this to see MLB amateur draft picks by year with player names, teams, rounds, positions, and schools. Pass the year or omit for the current year's draft results. Use fantasy_prospect_rankings instead when you want fantasy-relevant prospect rankings with call-up probabilities rather than raw draft order.",
    inputSchema: { year: z.string().describe("Draft year (e.g. '2025'). Omit for current year.").default("") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ year }) => {
    var params: Record<string, string> = {};
    if (year) params.year = year as string;
    var data = await apiGet<MlbDraftResponse>("/api/mlb/draft", params);
    if (data.note) {
      return { text: data.note };
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
    return { text: lines.join("\n") };
  }, enabledTools);

  // yahoo_weather
  defineTool(server, "yahoo_weather", {
    description: "Use this to check weather and venue risk for MLB games by seeing which games are at outdoor vs domed stadiums. Returns a breakdown of dome and outdoor game counts to help with lineup and streaming pitcher decisions. Use mlb_schedule instead when you just need the game matchups without weather context.",
    inputSchema: { date: z.string().describe("Date in YYYY-MM-DD format, empty for today").default("") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ date }) => {
    var params: Record<string, string> = {};
    if (date) params.date = date as string;
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
    return { text: lines.join("\n") };
  }, enabledTools);
}
