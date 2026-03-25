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
  type SeasonPaceResponse,
  type LeagueIntelResponse,
} from "../api/types.js";
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export const STANDINGS_URI = "ui://baseclaw/standings.html";

export function registerStandingsTools(server: McpServer, distDir: string, enabledTools?: Set<string>) {
  const shouldRegister = (name: string) => _shouldRegister(enabledTools, name);
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
  if (shouldRegister("yahoo_standings")) {
  registerAppTool(
    server,
    "yahoo_standings",
    {
      description: "Use this to see current league standings with win-loss records, points, and team rankings. Returns all teams sorted by rank.",
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
  }

  // yahoo_matchups
  if (shouldRegister("yahoo_matchups")) {
  registerAppTool(
    server,
    "yahoo_matchups",
    {
      description: "Use this to see all head-to-head matchup pairings for a given week across the league. Leave week empty for current week. Returns team pairings and matchup status.",
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
  }

  // yahoo_my_matchup
  if (shouldRegister("yahoo_my_matchup")) {
  registerAppTool(
    server,
    "yahoo_my_matchup",
    {
      description: "Use this to see how you're doing in this week's head-to-head matchup. Shows your score vs your opponent across every stat category with running totals.",
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
  }

  // yahoo_league_context
  if (shouldRegister("yahoo_league_context")) {
  registerAppTool(
    server,
    "yahoo_league_context",
    {
      description: "Use this to load the league profile at the start of a session: waiver type (FAAB/priority), scoring format (H2H/roto), stat categories, roster slots, and FAAB balance. Returns format-specific behavioral notes for the agent.",
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
  }

  // yahoo_transactions
  if (shouldRegister("yahoo_transactions")) {
  registerAppTool(
    server,
    "yahoo_transactions",
    {
      description: "Use this to see recent transactions in YOUR league — the actual adds, drops, and trades made by managers in your league. This is the right tool when someone asks about league transactions, recent moves, or who picked up/dropped whom. Filter by trans_type or leave empty for all types. Returns player names, transaction types, and the fantasy team involved.",
      inputSchema: {
        trans_type: z.string().describe("Transaction type: add, drop, trade, or empty for all").default(""),
        count: z.number().describe("Number of transactions to return").default(25),
        limit: z.number().default(20).describe("Max results to return (default 20, max 50)"),
        offset: z.number().default(0).describe("Offset for pagination"),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ trans_type, count, limit, offset }) => {
      try {
        const params: Record<string, string> = {};
        if (trans_type) params.type = trans_type;
        params.count = String(count);
        params.limit = String(limit);
        params.offset = String(offset);
        const data = await apiGet<TransactionsResponse>("/api/transactions", params);
        const label = trans_type || "all";
        const text = "Recent transactions (" + label + "):\n" + data.transactions.map((t) =>
          "  " + str(t.type).padEnd(8) + " " + str(t.player).padEnd(25) + (t.team ? " -> " + t.team : "")
        ).join("\n");
        var ai_recommendation: string | null = data.transactions.length + " recent transaction" + (data.transactions.length === 1 ? "" : "s") + ". Monitor league activity for waiver targets.";
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            type: "transactions",
            ai_recommendation,
            ...data,
            _pagination: {
              returned: (data.transactions || []).length,
              offset: offset,
              has_more: (data.transactions || []).length >= limit,
            },
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_transaction_trends
  if (shouldRegister("yahoo_transaction_trends")) {
  registerAppTool(
    server,
    "yahoo_transaction_trends",
    {
      description: "Use this to see the most-added and most-dropped players across ALL of Yahoo Fantasy (not your league). Shows global ownership trends and deltas. Only use this when the user explicitly asks about Yahoo-wide trends, most popular pickups globally, or ownership percentages.",
      inputSchema: {
        limit: z.number().default(20).describe("Max results per list to return (default 20)"),
        offset: z.number().default(0).describe("Offset for pagination"),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ limit, offset }) => {
      try {
        const data = await apiGet<TransactionTrendsResponse>("/api/transaction-trends", { limit: String(limit), offset: String(offset) });
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
        var addedCount = (data.most_added || []).length;
        var droppedCount = (data.most_dropped || []).length;
        var trendCount = addedCount > droppedCount ? addedCount : droppedCount;
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            type: "transaction-trends",
            ai_recommendation,
            ...data,
            _pagination: {
              returned: trendCount,
              offset: offset,
              has_more: trendCount >= limit,
            },
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_league_pulse
  if (shouldRegister("yahoo_league_pulse")) {
  registerAppTool(
    server,
    "yahoo_league_pulse",
    {
      description: "Use this to see how active each manager in the league has been — total moves, trades, and add/drops per team sorted by most active. Helps identify dormant teams to exploit and active competitors to watch.",
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
  }

  // yahoo_power_rankings — now backed by league-intel z-score data
  if (shouldRegister("yahoo_power_rankings")) {
  registerAppTool(
    server,
    "yahoo_power_rankings",
    {
      description: "Use this to rank all league teams by roster strength using multi-layer analysis: adjusted z-scores (projections + statcast + regression + trends), standings, and quality.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<LeagueIntelResponse>("/api/league-intel");
        const lines = [
          "Power Rankings (adjusted z + standings + quality):",
          "  " + "#".padStart(3) + "  " + "Team".padEnd(25) + "Record".padStart(8) + "  Adj-Z".padStart(8) + "  Upside".padStart(8) + "  Score".padStart(7),
          "  " + "-".repeat(63),
        ];
        for (const r of data.power_rankings) {
          const marker = r.is_my_team ? " <-- YOU" : "";
          const upside = r.z_upside || 0;
          const upsideStr = (upside > 0 ? "+" : "") + String(upside);
          lines.push("  " + String(r.rank).padStart(3) + "  " + str(r.name).padEnd(25) + tkey(r.team_key)
            + r.record.padStart(8) + "  " + String(r.adjusted_z_total).padStart(7) + "  "
            + upsideStr.padStart(7) + "  " + String(r.composite_score).padStart(6) + marker);
        }
        const myTeam = data.power_rankings.find(r => r.is_my_team);
        const ai_recommendation = myTeam
          ? "Ranked #" + myTeam.rank + " of " + data.num_teams + " by composite score (" + myTeam.composite_score
            + "). Adjusted z-total: " + myTeam.adjusted_z_total + " (upside: " + (myTeam.z_upside > 0 ? "+" : "") + myTeam.z_upside
            + "). Strong in " + myTeam.strongest_categories.join(", ") + "; weak in " + myTeam.weakest_categories.join(", ") + "."
          : "Power rankings loaded.";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "power-rankings", ai_recommendation, rankings: data.power_rankings },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_league_intel
  if (shouldRegister("yahoo_league_intel")) {
  registerAppTool(
    server,
    "yahoo_league_intel",
    {
      description: "Use this to get a comprehensive league intelligence report with multi-layer value analysis: adjusted z-scores (projections + statcast quality + regression signals + hot/cold trends), power rankings, top performers across all teams, team profiles with category strengths/weaknesses, and trade fit analysis. Best tool for 'who has who', 'which teams are strong/weak', 'who should I trade with', and 'who is overperforming/underperforming'.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<LeagueIntelResponse>("/api/league-intel");
        const lines: string[] = [];

        // Power Rankings section
        lines.push("POWER RANKINGS (adjusted z + standings + quality):");
        lines.push("  " + "#".padStart(3) + "  " + "Team".padEnd(25) + "Record".padStart(8) + "  Adj-Z".padStart(8) + "  Upside".padStart(8) + "  Score".padStart(7));
        lines.push("  " + "-".repeat(63));
        for (const r of data.power_rankings) {
          const marker = r.is_my_team ? " <-- YOU" : "";
          const upside = r.z_upside || 0;
          const upsideStr = (upside > 0 ? "+" : "") + String(upside);
          lines.push("  " + String(r.rank).padStart(3) + "  " + str(r.name).padEnd(25) + tkey(r.team_key)
            + r.record.padStart(8) + "  " + String(r.adjusted_z_total).padStart(7) + "  "
            + upsideStr.padStart(7) + "  " + String(r.composite_score).padStart(6) + marker);
        }

        // Top Performers section
        lines.push("\nTOP PERFORMERS (league-wide by adjusted z-score):");
        lines.push("  " + "#".padStart(3) + "  " + "Player".padEnd(20) + "Team".padEnd(18) + "Pos".padEnd(5) + "Adj-Z".padStart(7) + "  Flags");
        lines.push("  " + "-".repeat(70));
        for (let i = 0; i < Math.min(data.top_performers.length, 20); i++) {
          const p = data.top_performers[i];
          const flags: string[] = [];
          if (p.quality_tier === "elite" || p.quality_tier === "strong") flags.push("[" + p.quality_tier + "]");
          if (p.regression) flags.push(p.regression.toUpperCase().replace("_", "-"));
          if (p.hot_cold === "hot" || p.hot_cold === "cold") flags.push(p.hot_cold.toUpperCase());
          lines.push("  " + String(i + 1).padStart(3) + "  " + str(p.name).slice(0, 20).padEnd(20)
            + str(p.team_name).slice(0, 18).padEnd(18) + str(p.position).padEnd(5)
            + String(p.adjusted_z ?? p.z_final).padStart(7) + "  " + flags.join(" "));
        }

        // Team Profiles section
        lines.push("\nTEAM PROFILES:");
        for (const tp of data.team_profiles) {
          const marker = tp.is_my_team ? " (YOU)" : "";
          const upside = tp.z_upside || 0;
          const upsideStr = (upside > 0 ? "+" : "") + String(upside);
          lines.push("\n  #" + tp.rank + " " + str(tp.name) + marker + " | " + tp.record
            + " | Adj Z: " + tp.adjusted_z_total + " | Upside: " + upsideStr);
          if (tp.top_players.length > 0) {
            lines.push("    Stars: " + tp.top_players.join(", "));
          }
          // Quality + signals
          const qParts: string[] = [];
          for (const tier of ["elite", "strong", "average"]) {
            const cnt = tp.quality_breakdown?.[tier];
            if (cnt) qParts.push(cnt + " " + tier);
          }
          const sigParts: string[] = [];
          if (tp.buy_low_count) sigParts.push(tp.buy_low_count + " buy-low");
          if (tp.sell_high_count) sigParts.push(tp.sell_high_count + " sell-high");
          if (tp.hot_players) sigParts.push(tp.hot_players + " hot");
          if (tp.cold_players) sigParts.push(tp.cold_players + " cold");
          if (qParts.length) lines.push("    Quality: " + qParts.join(", "));
          if (sigParts.length) lines.push("    Signals: " + sigParts.join(", "));
          lines.push("    Strong: " + (tp.strongest_categories.join(", ") || "none")
            + " | Weak: " + (tp.weakest_categories.join(", ") || "none"));
          if (tp.trade_fit) {
            lines.push("    Trade fit: " + tp.trade_fit);
          }
        }

        // Category Leaderboards section
        if ((data.category_leaderboards || []).length > 0) {
          lines.push("\nCATEGORY LEADERBOARDS:");
          lines.push("  " + "Category".padEnd(10) + "Leader".padEnd(28) + "Value".padStart(10));
          lines.push("  " + "-".repeat(48));
          for (const lb of data.category_leaderboards) {
            const top = (lb.rankings || [])[0];
            if (top) {
              const marker = top.is_my_team ? " *" : "";
              lines.push("  " + str(lb.category).padEnd(10)
                + str(top.team_name).slice(0, 28).padEnd(28)
                + String(top.value).padStart(10) + marker);
            }
          }
        }

        // H2H Records section
        if ((data.h2h_matrix || []).length > 0) {
          lines.push("\nH2H RECORDS:");
          lines.push("  " + "Team".padEnd(28) + "Record".padStart(10) + "  Streak");
          lines.push("  " + "-".repeat(48));
          for (const entry of data.h2h_matrix) {
            const overall = entry.overall || { wins: 0, losses: 0, ties: 0 };
            const record = overall.wins + "-" + overall.losses + "-" + overall.ties;
            const marker = entry.is_my_team ? " <-- YOU" : "";
            lines.push("  " + str(entry.team_name).slice(0, 28).padEnd(28)
              + record.padStart(10) + "  " + str(entry.streak).padStart(4) + marker);
          }
        }

        // Build AI recommendation
        const myTeam = data.power_rankings.find(r => r.is_my_team);
        const rivals = data.power_rankings.filter(r => !r.is_my_team).slice(0, 3);
        const tradeFits = data.team_profiles.filter(tp => !tp.is_my_team && tp.trade_fit).slice(0, 2);
        const upsideTeams = data.team_profiles.filter(tp => !tp.is_my_team && tp.z_upside > 5).sort((a, b) => b.z_upside - a.z_upside).slice(0, 2);
        const paperTigers = data.team_profiles.filter(tp => !tp.is_my_team && tp.z_upside < -5).sort((a, b) => a.z_upside - b.z_upside).slice(0, 2);
        let ai_recommendation = "";
        if (myTeam) {
          ai_recommendation = "You're ranked #" + myTeam.rank + " of " + data.num_teams
            + " (composite " + myTeam.composite_score + "). "
            + "Adjusted z-total: " + myTeam.adjusted_z_total
            + " (upside: " + (myTeam.z_upside > 0 ? "+" : "") + myTeam.z_upside + "). "
            + "Strong in " + myTeam.strongest_categories.join(", ")
            + "; weak in " + myTeam.weakest_categories.join(", ") + ". ";
          if (rivals.length > 0) {
            ai_recommendation += "Top rivals: " + rivals.map(r => r.name + " (#" + r.rank + ")").join(", ") + ". ";
          }
          if (upsideTeams.length > 0) {
            ai_recommendation += "Teams with hidden upside (buy-low/elite quality): " + upsideTeams.map(t => t.name + " (+" + t.z_upside + ")").join(", ") + ". ";
          }
          if (paperTigers.length > 0) {
            ai_recommendation += "Paper tigers (sell-high/poor quality): " + paperTigers.map(t => t.name + " (" + t.z_upside + ")").join(", ") + ". ";
          }
          if (tradeFits.length > 0) {
            ai_recommendation += "Best trade fits: " + tradeFits.map(t => t.name + " — " + t.trade_fit).join("; ") + ". ";
          }
        }

        // Category leaderboard insights
        if ((data.category_leaderboards || []).length > 0) {
          const myLeads: string[] = [];
          const myTrails: string[] = [];
          for (const lb of data.category_leaderboards) {
            const myRank = (lb.rankings || []).find(r => r.is_my_team);
            if (myRank) {
              if (myRank.rank === 1) myLeads.push(lb.category);
              else if (myRank.rank >= (lb.rankings || []).length - 1) myTrails.push(lb.category);
            }
          }
          if (myLeads.length > 0) ai_recommendation += "Leading league in: " + myLeads.join(", ") + ". ";
          if (myTrails.length > 0) ai_recommendation += "Trailing in: " + myTrails.join(", ") + ". ";
        }

        // H2H record insights
        if ((data.h2h_matrix || []).length > 0) {
          const myH2H = data.h2h_matrix.find(e => e.is_my_team);
          if (myH2H) {
            const o = myH2H.overall || { wins: 0, losses: 0, ties: 0 };
            ai_recommendation += "H2H record: " + o.wins + "-" + o.losses + "-" + o.ties
              + (myH2H.streak ? " (" + myH2H.streak + ")" : "") + ". ";
            const noWinsAgainst = (myH2H.vs || []).filter(v => v.wins === 0 && (v.losses > 0 || v.ties > 0));
            if (noWinsAgainst.length > 0) {
              ai_recommendation += "Haven't beaten: " + noWinsAgainst.map(v => v.opponent).join(", ") + ". ";
            }
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "league-intel", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_season_pace
  if (shouldRegister("yahoo_season_pace")) {
  registerAppTool(
    server,
    "yahoo_season_pace",
    {
      description: "Use this to see projected final records, playoff probability, and magic numbers for every team in the league. Shows current pace, playoff status (clinched/in contention/eliminated), and your position.",
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
  }

  // yahoo_positional_ranks
  if (shouldRegister("yahoo_positional_ranks")) {
  registerAppTool(
    server,
    "yahoo_positional_ranks",
    {
      description: "Use this to see how every team ranks at each position (C, 1B, 2B, SS, 3B, OF, SP, RP) with strong/neutral/weak grades and recommended trade partners. Returns starters, bench players, and complementary trade opportunities for each team.",
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
}
