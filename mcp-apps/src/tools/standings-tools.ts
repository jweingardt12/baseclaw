import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { apiGet, toolError } from "../api/python-client.js";
import { tkey } from "../api/format-text.js";
import {
  generateStandingsInsight,
  generateSeasonPaceInsight,
  generatePowerRankInsight,
} from "../insights.js";
import {
  str,
  type PositionalRanksResponse,
  type StandingsResponse,
  type MatchupsResponse,
  type MatchupDetailResponse,
  type LeagueContextResponse,
  type TransactionsResponse,
  type TransactionTrendsResponse,
  type LeaguePulseResponse,
  type PowerRankingsResponse,
  type SeasonPaceResponse,
} from "../api/types.js";

export const STANDINGS_URI = "ui://baseclaw/standings.html";

export function registerStandingsTools(server: McpServer, distDir: string) {
  registerAppResource(
    server,
    "Standings View",
    STANDINGS_URI,
    {
      description: "League standings, matchups, and scoreboard",
      _meta: {
        ui: {
          csp: {
            resourceDomains: [
              "img.mlbstatic.com",
              "www.mlbstatic.com",
              "s.yimg.com",
              "securea.mlb.com",
            ],
          },
          permissions: { clipboardWrite: {} },
          prefersBorder: true,
        },
      },
    },
    async () => ({
      contents: [{
        uri: STANDINGS_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await fs.readFile(path.join(distDir, "standings.html"), "utf-8"),
      }],
    }),
  );

  // yahoo_standings
  registerAppTool(
    server,
    "yahoo_standings",
    {
      description: "Show league standings with win-loss records",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: STANDINGS_URI } },
    },
    async () => {
      try {
        const data = await apiGet<StandingsResponse>("/api/standings");
        const text = "League Standings:\n" + data.standings.map((s) =>
          "  " + String(s.rank).padStart(2) + ". " + str(s.name).padEnd(30) + tkey(s.team_key) + " " + s.wins + "-" + s.losses
          + (s.points_for ? " (" + s.points_for + " pts)" : "")
        ).join("\n");
        const ai_recommendation = generateStandingsInsight(data);
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "standings", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_matchups
  registerAppTool(
    server,
    "yahoo_matchups",
    {
      description: "Show weekly H2H matchup pairings. Leave week empty for current week.",
      inputSchema: { week: z.string().describe("Week number, empty for current week").default("") },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: STANDINGS_URI } },
    },
    async ({ week }) => {
      try {
        const params: Record<string, string> = {};
        if (week) params.week = week;
        const data = await apiGet<MatchupsResponse>("/api/matchups", params);
        const weekLabel = week || "current";
        const text = "Matchups (week " + weekLabel + "):\n" + data.matchups.map((m) =>
          "  " + str(m.team1).padEnd(28) + " vs  " + str(m.team2)
          + (m.status ? "  (" + m.status + ")" : "")
        ).join("\n");
        var ai_recommendation: string | null = data.matchups.length + " matchups for week " + weekLabel + ".";
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "matchups", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_my_matchup
  registerAppTool(
    server,
    "yahoo_my_matchup",
    {
      description: "Show your detailed H2H matchup with per-category comparison for the current week",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: STANDINGS_URI } },
    },
    async () => {
      try {
        const data = await apiGet<MatchupDetailResponse>("/api/matchup-detail");
        const score = data.score;
        const text = "Week " + data.week + " Matchup: " + data.my_team + " vs " + data.opponent + "\n"
          + "Score: " + score.wins + "-" + score.losses + "-" + score.ties + "\n"
          + (data.categories || []).map((c) =>
            "  " + (c.result === "win" ? "W" : c.result === "loss" ? "L" : "T") + " " + str(c.name).padEnd(10) + " " + str(c.my_value).padStart(8) + " vs " + str(c.opp_value).padStart(8)
          ).join("\n");
        var result = score.wins > score.losses ? "Winning" : score.wins < score.losses ? "Losing" : "Tied";
        var ai_recommendation = result + " " + score.wins + "-" + score.losses + (score.ties > 0 ? "-" + score.ties : "") + " vs " + data.opponent + ".";
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "matchup-detail", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_league_context
  registerAppTool(
    server,
    "yahoo_league_context",
    {
      description: "Compact league profile: waiver type (FAAB/priority), scoring format, stat categories, roster slots, and FAAB balance if applicable. Call once at session start — replaces separate yahoo_info + yahoo_stat_categories calls for agent setup.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<LeagueContextResponse>("/api/league-context");

        const lines: string[] = ["LEAGUE CONTEXT:"];
        lines.push("  Waiver: " + str(data.waiver_type) + (data.faab_balance != null ? " ($" + data.faab_balance + " remaining)" : ""));
        lines.push("  Scoring: " + str(data.scoring_type));
        lines.push("  Teams: " + str(data.num_teams) + " | Max adds/week: " + str(data.max_weekly_adds));

        const batCats = (data.stat_categories || [])
          .filter((c) => c.position_type === "B")
          .map((c) => str(c.name));
        const pitCats = (data.stat_categories || [])
          .filter((c) => c.position_type === "P")
          .map((c) => str(c.name));

        if (batCats.length > 0) lines.push("  Bat cats: " + batCats.join(", "));
        if (pitCats.length > 0) lines.push("  Pit cats: " + pitCats.join(", "));

        // Behavioral notes for the agent
        const notes: string[] = [];
        if (str(data.waiver_type) === "priority") {
          notes.push("Priority waivers — skip FAAB tools and bid recommendations.");
        } else if (str(data.waiver_type) === "faab") {
          notes.push("FAAB league — yahoo_waiver_deadline_prep includes bid recommendations.");
        }
        if (str(data.scoring_type) === "roto") {
          notes.push("Roto scoring — optimize for aggregate stat totals, not weekly category wins.");
        }
        if (notes.length > 0) {
          lines.push("  NOTE: " + notes.join(" "));
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "league-context", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_transactions
  registerAppTool(
    server,
    "yahoo_transactions",
    {
      description: "Show recent league transactions. trans_type: add, drop, trade, or empty for all",
      inputSchema: { trans_type: z.string().describe("Transaction type: add, drop, trade, or empty for all").default(""), count: z.number().describe("Number of transactions to return").default(25) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ trans_type, count }) => {
      try {
        const params: Record<string, string> = {};
        if (trans_type) params.type = trans_type;
        params.count = String(count);
        const data = await apiGet<TransactionsResponse>("/api/transactions", params);
        const label = trans_type || "all";
        const text = "Recent transactions (" + label + "):\n" + data.transactions.map((t) =>
          "  " + str(t.type).padEnd(8) + " " + str(t.player).padEnd(25) + (t.team ? " -> " + t.team : "")
        ).join("\n");
        var ai_recommendation: string | null = data.transactions.length + " recent transaction" + (data.transactions.length === 1 ? "" : "s") + ". Monitor league activity for waiver targets.";
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "transactions", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_transaction_trends
  registerAppTool(
    server,
    "yahoo_transaction_trends",
    {
      description: "Most added and most dropped players across all Yahoo Fantasy leagues",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<TransactionTrendsResponse>("/api/transaction-trends");
        const addedLines = (data.most_added || []).slice(0, 10).map((p, i) =>
          "  " + String(i + 1).padStart(2) + ". " + str(p.name).padEnd(25) + " " + str(p.team).padEnd(4)
          + " " + str(p.percent_owned) + "% (" + str(p.delta) + ")"
        );
        const droppedLines = (data.most_dropped || []).slice(0, 10).map((p, i) =>
          "  " + String(i + 1).padStart(2) + ". " + str(p.name).padEnd(25) + " " + str(p.team).padEnd(4)
          + " " + str(p.percent_owned) + "% (" + str(p.delta) + ")"
        );
        const text = "Most Added:\n" + addedLines.join("\n") + "\n\nMost Dropped:\n" + droppedLines.join("\n");
        var topAdded = (data.most_added || [])[0];
        var ai_recommendation: string | null = topAdded
          ? "Hottest pickup: " + topAdded.name + " (" + topAdded.percent_owned + "% owned, " + topAdded.delta + "). Check if available in your league."
          : null;
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "transaction-trends", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_league_pulse
  registerAppTool(
    server,
    "yahoo_league_pulse",
    {
      description: "Show league activity - moves and trades per team, sorted by most active",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<LeaguePulseResponse>("/api/league-pulse");
        const lines = [
          "League Activity Pulse:",
          "  " + "Team".padEnd(30) + "Moves".padStart(6) + "Trades".padStart(7) + "Total".padStart(6),
          "  " + "-".repeat(49),
        ];
        for (const t of data.teams) {
          lines.push("  " + str(t.name).padEnd(30) + tkey(t.team_key) + String(t.moves).padStart(6)
            + String(t.trades).padStart(7) + String(t.total).padStart(6));
        }
        var mostActive = (data.teams || [])[0];
        var ai_recommendation: string | null = mostActive
          ? "Most active team: " + mostActive.name + " with " + mostActive.total + " total moves. Active managers often gain an edge."
          : null;
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "league-pulse", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_power_rankings
  registerAppTool(
    server,
    "yahoo_power_rankings",
    {
      description: "Rank all league teams by estimated roster strength (based on aggregate player ownership %)",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<PowerRankingsResponse>("/api/power-rankings");
        const lines = [
          "Power Rankings:",
          "  " + "#".padStart(3) + "  " + "Team".padEnd(30) + "Avg Own%".padStart(9) + "  H/P",
          "  " + "-".repeat(52),
        ];
        for (const r of data.rankings) {
          const marker = r.is_my_team ? " <-- YOU" : "";
          lines.push("  " + String(r.rank).padStart(3) + "  " + str(r.name).padEnd(30) + tkey(r.team_key)
            + String(r.avg_owned_pct).padStart(8) + "%  " + r.hitting_count + "/" + r.pitching_count + marker);
        }
        const ai_recommendation = generatePowerRankInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "power-rankings", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_season_pace
  registerAppTool(
    server,
    "yahoo_season_pace",
    {
      description: "Project season pace, playoff probability, and magic number for all teams",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<SeasonPaceResponse>("/api/season-pace");
        const lines = [
          "Season Pace (Week " + data.current_week + "/" + data.end_week + ", " + data.playoff_teams + " playoff spots):",
          "  " + "#".padStart(3) + "  " + "Team".padEnd(28) + "Record".padStart(8) + "  Pace".padStart(6) + "  Magic#".padStart(8) + "  Status",
          "  " + "-".repeat(70),
        ];
        for (const t of data.teams) {
          let record = t.wins + "-" + t.losses;
          if (t.ties) record += "-" + t.ties;
          const marker = t.is_my_team ? " <-- YOU" : "";
          lines.push("  " + String(t.rank).padStart(3) + "  " + str(t.name).padEnd(28)
            + record.padStart(8) + "  " + String(t.projected_wins).padStart(5)
            + "  " + String(t.magic_number).padStart(7) + "  " + t.playoff_status + marker);
        }
        const ai_recommendation = generateSeasonPaceInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "season-pace", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_positional_ranks
  registerAppTool(
    server,
    "yahoo_positional_ranks",
    {
      description: "Get positional rankings for all teams in the league. Shows each team's rank (1-12) at every position with grade (strong/neutral/weak), starting and bench players, and recommended trade partners.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<PositionalRanksResponse>("/api/positional-ranks");
        const lines = ["League Positional Rankings:"];
        for (const team of data.teams || []) {
          lines.push("\n" + str(team.name) + tkey(team.team_key) + ":");
          for (const pr of team.positional_ranks || []) {
            const grade = pr.grade === "strong" ? "+" : pr.grade === "weak" ? "-" : " ";
            const starters = (pr.starters || []).map((p) => p.name + " (" + p.player_key + ")").join(", ");
            lines.push("  " + grade + " " + str(pr.position).padEnd(5) + " #" + String(pr.rank).padStart(2) + "  " + starters);
          }
          if (team.recommended_trade_partners && team.recommended_trade_partners.length > 0) {
            lines.push("  Trade partners: " + team.recommended_trade_partners.join(", "));
          }
        }
        const ai_recommendation = "Review positional ranks to identify where your team is weak and find trade partners who are strong in those positions.";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "positional-ranks", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
}
