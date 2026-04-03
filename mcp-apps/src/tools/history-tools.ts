import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, toolError } from "../api/python-client.js";
import { READ_ANNO } from "../api/annotations.js";
import { pid, formatHolder } from "../api/format-text.js";
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
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export function registerHistoryTools(server: McpServer, enabledTools?: Set<string>) {
  const shouldRegister = (name: string) => _shouldRegister(enabledTools, name);
  // yahoo_league_history
  if (shouldRegister("yahoo_league_history")) {
  registerAppTool(
    server,
    "yahoo_league_history",
    {
      description: "Use this to see the all-time history of your fantasy league including champions, your finishes, and W-L-T records for every season. Returns a year-by-year summary of league results.",
      annotations: READ_ANNO,
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
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_record_book
  if (shouldRegister("yahoo_record_book")) {
  registerAppTool(
    server,
    "yahoo_record_book",
    {
      description: "Use this to see all-time league records including per-category stat records (batting and pitching), head-to-head records, career W-L leaders, champion history, and #1 draft picks. Returns a comprehensive record book scraped from Yahoo's recordbook page. Pass refresh=true to force re-scrape.",
      inputSchema: { refresh: z.boolean().describe("Force re-scrape from Yahoo (bypasses cache)").default(false) },
      annotations: READ_ANNO,
      _meta: {},
    },
    async ({ refresh }) => {
      try {
        var params: Record<string, string> = {};
        if (refresh) params.refresh = "true";
        var data = await apiGet<RecordBookResponse>("/api/record-book", params, 120000);
        var lines = ["Record Book:"];
        lines.push("\nChampions:");
        for (var c of (data.champions || [])) {
          lines.push("  " + c.year + ": " + str(c.team_name).padEnd(25) + " " + str(c.manager).padEnd(15) + " " + str(c.record));
        }
        lines.push("\nCareer Leaders:");
        for (var c2 of (data.careers || []).slice(0, 10)) {
          lines.push("  " + str(c2.manager).padEnd(15) + " " + c2.wins + "-" + c2.losses + "-" + c2.ties + " (" + c2.win_pct + "%)  " + c2.seasons + " seasons  Best: #" + c2.best_finish + " (" + c2.best_year + ")");
        }

        // Batting category records (from scrape)
        var batting = data.batting_records || [];
        var allTimeBatting = batting.filter(function(r) { return r.record_type.indexOf("All Time") > -1; });
        if (allTimeBatting.length > 0) {
          lines.push("\nBatting Records (All-Time):");
          for (var br of allTimeBatting) {
            var scope = br.record_type.indexOf("Week") > -1 ? "Week" : "Season";
            var label = br.category;
            if (br.direction === "worst") label = label + " (worst)";
            var holder = (br.holders || []).map(formatHolder).join(", ");
            lines.push("  " + scope.padEnd(8) + label.padEnd(28) + str(br.value).padStart(8) + "  " + holder);
          }
        }

        // Pitching category records (from scrape)
        var pitching = data.pitching_records || [];
        var allTimePitching = pitching.filter(function(r) { return r.record_type.indexOf("All Time") > -1; });
        if (allTimePitching.length > 0) {
          lines.push("\nPitching Records (All-Time):");
          for (var pr of allTimePitching) {
            var pScope = pr.record_type.indexOf("Week") > -1 ? "Week" : "Season";
            var pLabel = pr.category;
            if (pr.direction === "worst") pLabel = pLabel + " (worst)";
            var pHolder = (pr.holders || []).map(formatHolder).join(", ");
            lines.push("  " + pScope.padEnd(8) + pLabel.padEnd(28) + str(pr.value).padStart(8) + "  " + pHolder);
          }
        }

        // H2H records (from scrape)
        var h2h = data.h2h_records || [];
        if (h2h.length > 0) {
          lines.push("\nHead-to-Head Records:");
          for (var hr of h2h) {
            var hHolder = (hr.holders || []).slice(0, 3).map(formatHolder).join(", ");
            if ((hr.holders || []).length > 3) hHolder = hHolder + " (+" + ((hr.holders || []).length - 3) + " more)";
            lines.push("  " + str(hr.record_type).padEnd(40) + str(hr.value).padStart(6) + "  " + hHolder);
          }
        }

        lines.push("\n#1 Draft Picks:");
        for (var p of (data.first_picks || [])) {
          lines.push("  " + p.year + ": " + p.player);
        }
        if (data.source) lines.push("\n(source: " + data.source + ")");
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_past_standings
  if (shouldRegister("yahoo_past_standings")) {
  registerAppTool(
    server,
    "yahoo_past_standings",
    {
      description: "Use this to see the full standings for a specific past season with W-L-T records and manager names. Pass the year parameter (e.g. 2024) to get ranked standings for that season.",
      inputSchema: { year: z.coerce.number().describe("Season year (e.g. 2024)") },
      annotations: READ_ANNO,
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
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_past_draft
  if (shouldRegister("yahoo_past_draft")) {
  registerAppTool(
    server,
    "yahoo_past_draft",
    {
      description: "Use this to see who was drafted and in what order for a past season with player names resolved. Pass the year and optional count to control how many picks are returned.",
      inputSchema: { year: z.coerce.number().describe("Season year (e.g. 2024)"), count: z.coerce.number().describe("Number of picks to return").default(25) },
      annotations: READ_ANNO,
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
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_past_teams
  if (shouldRegister("yahoo_past_teams")) {
  registerAppTool(
    server,
    "yahoo_past_teams",
    {
      description: "Use this to see all team names, managers, move counts, and trade counts for a past season. Pass the year to see which managers were most active in transactions.",
      inputSchema: { year: z.coerce.number().describe("Season year (e.g. 2024)") },
      annotations: READ_ANNO,
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
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_past_trades
  if (shouldRegister("yahoo_past_trades")) {
  registerAppTool(
    server,
    "yahoo_past_trades",
    {
      description: "Use this to see the trade history for a past season showing which players were exchanged between which teams. Pass the year and optional count to limit results.",
      inputSchema: { year: z.coerce.number().describe("Season year (e.g. 2024)"), count: z.coerce.number().describe("Number of trades to return").default(10) },
      annotations: READ_ANNO,
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
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_past_matchup
  if (shouldRegister("yahoo_past_matchup")) {
  registerAppTool(
    server,
    "yahoo_past_matchup",
    {
      description: "Use this to see head-to-head matchup results for a specific week in a past season with category win counts. Pass both year and week number to see who played whom and the scores.",
      inputSchema: { year: z.coerce.number().describe("Season year (e.g. 2024)"), week: z.coerce.number().describe("Week number") },
      annotations: READ_ANNO,
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
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_roster_history
  if (shouldRegister("yahoo_roster_history")) {
  registerAppTool(
    server,
    "yahoo_roster_history",
    {
      description: "Use this to view a team's roster from a past week or specific date, showing who was in each lineup slot. Pass either a week number or a YYYY-MM-DD date, and optionally a team_key for another team.",
      inputSchema: {
        week: z.string().describe("Week number to look up").default(""),
        date: z.string().describe("Date to look up (YYYY-MM-DD)").default(""),
        team_key: z.string().describe("Team key (optional, defaults to your team)").default(""),
      },
      annotations: READ_ANNO,
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
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }
}
