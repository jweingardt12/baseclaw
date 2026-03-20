import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, toolError } from "../api/python-client.js";
import { pid } from "../api/format-text.js";
import {
  str,
  type LeagueHistoryResponse,
  type RecordBookResponse,
  type PastStandingsResponse,
  type PastDraftResponse,
  type PastTeamsResponse,
  type PastTradesResponse,
  type PastMatchupResponse,
  type RosterHistoryResponse,
} from "../api/types.js";

export function registerHistoryTools(server: McpServer) {
  // yahoo_league_history
  registerAppTool(
    server,
    "yahoo_league_history",
    {
      description: "All-time season results: champions, your finishes, and W-L-T records",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<LeagueHistoryResponse>("/api/league-history");
        const lines = ["League History:"];
        for (const s of data.seasons) {
          let line = "  " + s.year + ": Champion: " + s.champion;
          if (s.your_finish) line += " | You: " + s.your_finish;
          if (s.your_record) line += " (" + s.your_record + ")";
          lines.push(line);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "league-history", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_record_book
  registerAppTool(
    server,
    "yahoo_record_book",
    {
      description: "All-time records: career W-L, best seasons, most active managers, playoff appearances, #1 draft picks",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<RecordBookResponse>("/api/record-book");
        const lines = ["Record Book:"];
        lines.push("\nChampions:");
        for (const c of (data.champions || [])) {
          lines.push("  " + c.year + ": " + str(c.team_name).padEnd(25) + " " + str(c.manager).padEnd(15) + " " + str(c.record));
        }
        lines.push("\nCareer Leaders:");
        for (const c of (data.careers || []).slice(0, 10)) {
          lines.push("  " + str(c.manager).padEnd(15) + " " + c.wins + "-" + c.losses + "-" + c.ties + " (" + c.win_pct + "%)  " + c.seasons + " seasons  Best: #" + c.best_finish + " (" + c.best_year + ")");
        }
        lines.push("\n#1 Draft Picks:");
        for (const p of (data.first_picks || [])) {
          lines.push("  " + p.year + ": " + p.player);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "record-book", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_past_standings
  registerAppTool(
    server,
    "yahoo_past_standings",
    {
      description: "Full standings for a past season with W-L-T records and managers",
      inputSchema: { year: z.number().describe("Season year (e.g. 2024)") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ year }) => {
      try {
        const data = await apiGet<PastStandingsResponse>("/api/past-standings", { year: String(year) });
        const lines = ["Standings for " + year + ":"];
        for (const s of data.standings) {
          lines.push("  " + String(s.rank).padStart(2) + ". " + str(s.team_name).padEnd(25) + " " + str(s.manager).padEnd(15) + " " + str(s.record));
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "past-standings", ai_recommendation: null, year, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_past_draft
  registerAppTool(
    server,
    "yahoo_past_draft",
    {
      description: "Draft picks for a past season with player names resolved",
      inputSchema: { year: z.number().describe("Season year (e.g. 2024)"), count: z.number().describe("Number of picks to return").default(25) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ year, count }) => {
      try {
        const data = await apiGet<PastDraftResponse>("/api/past-draft", { year: String(year), count: String(count) });
        const lines = ["Draft " + year + ":"];
        for (const p of data.picks) {
          lines.push("  Rd " + String(p.round).padStart(2) + " Pick " + String(p.pick).padStart(2) + ": " + str(p.player_name).padEnd(25) + " -> " + str(p.team_name));
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "past-draft", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_past_teams
  registerAppTool(
    server,
    "yahoo_past_teams",
    {
      description: "Team names, managers, move counts, and trade counts for a past season",
      inputSchema: { year: z.number().describe("Season year (e.g. 2024)") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ year }) => {
      try {
        const data = await apiGet<PastTeamsResponse>("/api/past-teams", { year: String(year) });
        const lines = ["Teams for " + year + ":"];
        for (const t of data.teams) {
          lines.push("  " + str(t.name).padEnd(25) + " " + str(t.manager).padEnd(15) + " " + t.moves + " moves, " + t.trades + " trades");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "past-teams", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_past_trades
  registerAppTool(
    server,
    "yahoo_past_trades",
    {
      description: "Trade history for a past season showing players exchanged between teams",
      inputSchema: { year: z.number().describe("Season year (e.g. 2024)"), count: z.number().describe("Number of trades to return").default(10) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ year, count }) => {
      try {
        const data = await apiGet<PastTradesResponse>("/api/past-trades", { year: String(year), count: String(count) });
        const lines = ["Trades for " + year + ":"];
        const trades = data.trades || [];
        if (trades.length === 0) {
          lines.push("  No trades this season.");
        }
        for (const t of trades) {
          lines.push("  " + str(t.trader_team) + " <-> " + str(t.tradee_team));
          for (const p of (t.players || [])) {
            lines.push("    " + str(p.name) + ": " + str(p.from) + " -> " + str(p.to));
          }
          lines.push("");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "past-trades", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_past_matchup
  registerAppTool(
    server,
    "yahoo_past_matchup",
    {
      description: "Matchup results for a specific week in a past season with category win counts",
      inputSchema: { year: z.number().describe("Season year (e.g. 2024)"), week: z.number().describe("Week number") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ year, week }) => {
      try {
        const data = await apiGet<PastMatchupResponse>("/api/past-matchup", { year: String(year), week: String(week) });
        const lines = ["Matchups " + year + " Week " + week + ":"];
        for (const m of data.matchups) {
          lines.push("  " + str(m.team1).padEnd(25) + " " + str(m.score).padEnd(10) + " " + str(m.team2));
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "past-matchup", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_roster_history
  registerAppTool(
    server,
    "yahoo_roster_history",
    {
      description: "View a team's roster from a past week or specific date",
      inputSchema: {
        week: z.string().describe("Week number to look up").default(""),
        date: z.string().describe("Date to look up (YYYY-MM-DD)").default(""),
        team_key: z.string().describe("Team key (optional, defaults to your team)").default(""),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ week, date, team_key }) => {
      try {
        const params: Record<string, string> = {};
        if (week) params.week = week;
        if (date) params.date = date;
        if (team_key) params.team_key = team_key;
        if (!week && !date) {
          return {
            content: [{ type: "text" as const, text: "Error: provide either week or date parameter" }],
            structuredContent: { type: "_error", message: "Missing week or date parameter" },
            isError: true as const,
          };
        }
        const data = await apiGet<RosterHistoryResponse>("/api/roster-history", params);
        const players = data.players || [];
        const lines = ["Roster for " + data.label + ":"];
        for (const p of players) {
          let line = "  " + str(p.position).padEnd(4) + " " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",") + pid(p.player_id);
          if (p.status) line += " [" + p.status + "]";
          lines.push(line);
        }
        const ai_recommendation = players.length + " player" + (players.length === 1 ? "" : "s") + " on roster for " + data.label + ".";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "roster-history", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
}
