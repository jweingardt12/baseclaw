import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { apiGet, apiPost, toolError } from "../api/python-client.js";
import { APP_RESOURCE_DOMAINS } from "../api/csp.js";
import { tkey, buildFooter } from "../api/format-text.js";
import { READ_ANNO } from "../api/annotations.js";
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
  type LeagueSnapshotResponse,
  type RedzoneResponse,
} from "../api/types.js";
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export const STANDINGS_URI = "ui://baseclaw/standings.html";

export function registerStandingsTools(server: McpServer, distDir: string, enabledTools?: Set<string>) {
  const shouldRegister = (name: string) => _shouldRegister(enabledTools, name);
  registerAppResource(
    server,
    "Standings View",
    STANDINGS_URI,
    { description: "League standings, matchups, and scoreboard" },
    async () => ({
      contents: [{
        uri: STANDINGS_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await fs.readFile(path.join(distDir, "standings.html"), "utf-8"),
        _meta: {
          ui: {
            csp: {
              resourceDomains: APP_RESOURCE_DOMAINS,
            },
          },
        },
      }],
    }),
  );

  // yahoo_standings
  if (shouldRegister("yahoo_standings")) {
  registerAppTool(
    server,
    "yahoo_standings",
    {
      description: "Use this to see current league standings with win-loss records, season stats across all scoring categories, positional strengths/weaknesses, and playoff seeds. Returns all teams sorted by rank.",
      annotations: READ_ANNO,
      _meta: { ui: { resourceUri: STANDINGS_URI } },
    },
    async () => {
      try {
        // Try snapshot for richer data, fall back to basic standings
        var snapshot: LeagueSnapshotResponse | null = null;
        try {
          snapshot = await apiGet<LeagueSnapshotResponse>("/api/league-snapshot");
        } catch (e) { /* fall back to basic */ }

        if (snapshot && snapshot.teams && snapshot.teams.length > 0) {
          var lines: string[] = ["League Standings (Season Stats):"];
          for (var team of snapshot.teams) {
            var record = team.wins + "-" + team.losses + "-" + team.ties;
            var gb = team.games_back && team.games_back !== "-" ? " (" + team.games_back + " GB)" : "";
            lines.push("  " + String(team.rank).padStart(2) + ". " + str(team.name).padEnd(30) + tkey(team.team_key) + " " + record + gb);
            // Compact season stats
            if (team.season_stats && Object.keys(team.season_stats).length > 0) {
              var statParts: string[] = [];
              for (var [cat, val] of Object.entries(team.season_stats)) {
                statParts.push(cat + ":" + val);
              }
              lines.push("      " + statParts.join(" "));
            }
          }
          // Convert snapshot to StandingsResponse shape for insight generation
          var standingsData: StandingsResponse = {
            standings: snapshot.teams.map((t) => ({
              rank: t.rank, name: t.name, team_key: t.team_key,
              wins: t.wins, losses: t.losses, ties: t.ties,
            })),
          };
          var ai_recommendation = generateStandingsInsight(standingsData);
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
            structuredContent: { type: "standings", ai_recommendation, ...snapshot },
          };
        }

        // Fallback: basic standings
        const data = await apiGet<StandingsResponse>("/api/standings");
        const text = "League Standings:\n" + data.standings.map((s) =>
          "  " + String(s.rank).padStart(2) + ". " + str(s.name).padEnd(30) + tkey(s.team_key) + " " + s.wins + "-" + s.losses
          + (s.points_for ? " (" + s.points_for + " pts)" : "")
        ).join("\n");
        const ai_rec = generateStandingsInsight(data);
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "standings", ai_recommendation: ai_rec, ...data },
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
      annotations: READ_ANNO,
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
      description: "Use this to see how you're doing in this week's head-to-head matchup. Shows your score vs your opponent across every stat category with running totals, plus remaining games and live player stats from redzone.",
      annotations: READ_ANNO,
      _meta: { ui: { resourceUri: STANDINGS_URI } },
    },
    async () => {
      try {
        const data = await apiGet<MatchupDetailResponse>("/api/matchup-detail");
        const score = data.score;
        var lines: string[] = [];
        lines.push("Week " + data.week + " Matchup: " + data.my_team + " vs " + data.opponent);
        lines.push("Score: " + score.wins + "-" + score.losses + "-" + score.ties);

        // Try to enrich with redzone remaining games
        var rzExtra = "";
        try {
          var rz = await apiGet<RedzoneResponse>("/api/redzone");
          if (rz.my_matchup) {
            var myRz = rz.teams[rz.my_matchup.my_team_id];
            var oppRz = rz.teams[rz.my_matchup.opponent_id];
            if (myRz && oppRz) {
              rzExtra = "Games remaining: You " + myRz.remaining_games + " (" + myRz.completed_games + " done)"
                + " | Opp " + oppRz.remaining_games + " (" + oppRz.completed_games + " done)";
              lines.push(rzExtra);
              if (myRz.live_games > 0 || oppRz.live_games > 0) {
                lines.push("LIVE: You " + myRz.live_games + " | Opp " + oppRz.live_games);
              }
            }
          }
        } catch (e) { /* redzone optional */ }

        lines.push("");
        lines.push((data.categories || []).map((c) =>
          "  " + (c.result === "win" ? "W" : c.result === "loss" ? "L" : "T") + " " + str(c.name).padEnd(10) + " " + str(c.my_value).padStart(8) + " vs " + str(c.opp_value).padStart(8)
        ).join("\n"));

        var result = score.wins > score.losses ? "Winning" : score.wins < score.losses ? "Losing" : "Tied";
        var closeCats = (data.categories || []).filter(function (c) {
          var diff = Math.abs(parseFloat(c.my_value) - parseFloat(c.opp_value));
          var avg = (Math.abs(parseFloat(c.my_value)) + Math.abs(parseFloat(c.opp_value))) / 2;
          return avg > 0 && diff / avg < 0.15;
        });
        var flippable = closeCats.filter(function (c) { return c.result === "loss"; });
        var ai_recommendation = result + " " + score.wins + "-" + score.losses + (score.ties > 0 ? "-" + score.ties : "") + " vs " + data.opponent + "."
          + (rzExtra ? " " + rzExtra + "." : "")
          + (flippable.length > 0 ? " " + flippable.length + " close categor" + (flippable.length === 1 ? "y" : "ies") + " you can flip: " + flippable.map(function (c) { return c.name; }).join(", ") + "." : "");
        var footer = buildFooter(
          result + " " + score.wins + "-" + score.losses + "." + (flippable.length > 0 ? " " + flippable.length + " flippable." : " No close categories to target."),
          [
            "Live player stats for both teams -> yahoo_redzone",
            "Full strategy with target/protect/concede -> yahoo_matchup_strategy",
            "Find streaming pitchers to flip categories -> yahoo_streaming",
          ]
        );
        return {
          content: [{ type: "text" as const, text: lines.join("\n") + footer }],
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
      annotations: READ_ANNO,
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
        count: z.coerce.number().describe("Number of transactions to return").default(25),
        limit: z.coerce.number().default(20).describe("Max results to return (default 20, max 50)"),
        offset: z.coerce.number().default(0).describe("Offset for pagination"),
      },
      annotations: READ_ANNO,
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
          structuredContent: { type: "transactions", ai_recommendation, ...data },
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
        limit: z.coerce.number().default(20).describe("Max results per list to return (default 20)"),
        offset: z.coerce.number().default(0).describe("Offset for pagination"),
      },
      annotations: READ_ANNO,
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
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "transaction-trends", ai_recommendation, ...data },
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
      annotations: READ_ANNO,
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
      annotations: READ_ANNO,
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
          structuredContent: { type: "power-rankings", ai_recommendation, ...data },
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
      annotations: READ_ANNO,
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
          structuredContent: { ai_recommendation, ...data },
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
      annotations: READ_ANNO,
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
      annotations: READ_ANNO,
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
          structuredContent: { ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_league_snapshot
  if (shouldRegister("yahoo_league_snapshot")) {
  registerAppTool(
    server,
    "yahoo_league_snapshot",
    {
      description: "Full league snapshot in one call: standings with season-long category stats, positional ranks with grades, recommended trade partners, and playoff seeds. Use this to compare all teams across every scoring category for the full season, identify category surpluses/deficits league-wide, and find optimal trade targets.",
      annotations: READ_ANNO,
      _meta: {},
    },
    async () => {
      try {
        var data = await apiGet<LeagueSnapshotResponse>("/api/league-snapshot");
        var lines: string[] = ["LEAGUE SNAPSHOT (Season Stats + Positional Ranks)"];
        lines.push("=".repeat(60));

        for (var team of data.teams || []) {
          var record = team.wins + "-" + team.losses + "-" + team.ties;
          var gb = team.games_back && team.games_back !== "-" ? " (" + team.games_back + " GB)" : "";
          lines.push("\n#" + team.rank + " " + str(team.name) + tkey(team.team_key) + " " + record + gb);

          // Season stats
          if (team.season_stats && Object.keys(team.season_stats).length > 0) {
            var batting: string[] = [];
            var pitching: string[] = [];
            for (var cat of data.settings?.stat_categories || []) {
              if (cat.is_only_display_stat) continue;
              var val = team.season_stats[cat.display_name];
              if (val !== undefined) {
                if (cat.group === "batting") {
                  batting.push(cat.display_name + ":" + val);
                } else {
                  pitching.push(cat.display_name + ":" + val);
                }
              }
            }
            if (batting.length > 0) lines.push("  BAT: " + batting.join(" "));
            if (pitching.length > 0) lines.push("  PIT: " + pitching.join(" "));
          }

          // Positional strengths summary
          var strong: string[] = [];
          var weak: string[] = [];
          for (var pr of team.positional_ranks || []) {
            if (pr.grade === "strong") strong.push(pr.position + " #" + pr.rank);
            if (pr.grade === "weak") weak.push(pr.position + " #" + pr.rank);
          }
          if (strong.length > 0) lines.push("  + Strong: " + strong.join(", "));
          if (weak.length > 0) lines.push("  - Weak: " + weak.join(", "));

          // Trade partners
          if (team.recommended_trade_partners && team.recommended_trade_partners.length > 0) {
            lines.push("  Trade partners: " + team.recommended_trade_partners.join(", "));
          }
        }

        var ai_recommendation = "Use season stats to identify which teams lead or trail in specific categories. Cross-reference with positional ranks to find trade partners where you can offer strength for their weakness.";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_redzone
  if (shouldRegister("yahoo_redzone")) {
  registerAppTool(
    server,
    "yahoo_redzone",
    {
      description: "Live matchup scoreboard: every player's stats for the current week, remaining games for both teams, who's starting today, and per-category scoring. Best for real-time matchup tracking during the week.",
      annotations: READ_ANNO,
      _meta: {},
    },
    async () => {
      try {
        var data = await apiGet<RedzoneResponse>("/api/redzone");
        var lines: string[] = [];
        var matchup = data.my_matchup;
        if (!matchup) {
          lines.push("No active matchup found.");
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }

        var myTeam = data.teams[matchup.my_team_id];
        var oppTeam = data.teams[matchup.opponent_id];
        if (!myTeam || !oppTeam) {
          lines.push("Could not find matchup teams in redzone data.");
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }

        lines.push("LIVE MATCHUP — Week " + data.week + " (" + data.week_start + " to " + data.week_end + ")");
        lines.push("=".repeat(60));
        lines.push(str(myTeam.name) + " vs " + str(oppTeam.name));
        lines.push("Games: " + myTeam.completed_games + " done, " + myTeam.remaining_games + " left | Opp: " + oppTeam.completed_games + " done, " + oppTeam.remaining_games + " left");
        if (myTeam.live_games > 0 || oppTeam.live_games > 0) {
          lines.push("LIVE NOW: You " + myTeam.live_games + " | Opp " + oppTeam.live_games);
        }

        // Show active players with stats for both teams
        for (var [label, team] of [["YOUR ROSTER", myTeam], ["OPPONENT", oppTeam]] as [string, typeof myTeam][]) {
          lines.push("");
          lines.push(label + " (" + str(team.name) + "):");
          var active = team.players.filter((p) => !["BN", "IL", "NA", "--"].includes(p.position));
          for (var p of active) {
            var starting = p.is_starting === true ? " *" : p.is_starting === false ? "" : "";
            var newNote = p.has_new_notes ? " [!]" : "";
            var statusTag = p.status ? " [" + p.status + "]" : "";
            var statLine = Object.entries(p.stats || {}).filter(([_, v]) => v !== 0).map(([k, v]) => k + ":" + v).join(" ");
            lines.push("  " + p.position.padEnd(4) + " " + str(p.name).padEnd(22) + " " + p.team.padEnd(4) + starting + statusTag + newNote + (statLine ? " | " + statLine : ""));
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "redzone", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_competitor_tracker
  if (shouldRegister("yahoo_competitor_tracker")) {
    server.tool(
    "yahoo_competitor_tracker",
    "Track what rival managers are doing — roster moves, category impact, sniped targets, and threat levels for each competitor",
    {},
    async function () {
      try {
        var data = await apiGet<any>("/api/competitor-tracker");
        var lines: string[] = ["COMPETITOR TRACKER", "=".repeat(50)];
        lines.push("Your rank: #" + data.my_rank + " | Total rival moves: " + data.total_rival_moves);
        if (data.alerts && data.alerts.length > 0) {
          lines.push("\nALERTS:");
          for (var a of data.alerts) {
            lines.push("  [!] " + a.message);
          }
        }
        if (data.sniped_targets && data.sniped_targets.length > 0) {
          lines.push("\nSNIPED TARGETS:");
          for (var s of data.sniped_targets) {
            lines.push("  [-] " + s);
          }
        }
        lines.push("\nTEAM ACTIVITY:");
        for (var t of (data.teams || []).slice(0, 8)) {
          lines.push("  " + t.name + " (#" + t.standings_rank + ") — " + t.move_count + " moves, net z=" + t.net_z_change + " [" + t.threat_level + "]");
          if (t.categories_improving && t.categories_improving.length > 0) {
            lines.push("    Improving: " + t.categories_improving.join(", "));
          }
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "competitor-tracker", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_watchlist_add
  if (shouldRegister("yahoo_watchlist_add")) {
    server.tool(
    "yahoo_watchlist_add",
    "Add a player to your watchlist for tracking ownership changes, z-score movement, and news alerts",
    { name: z.string().describe("Player name to watch"), reason: z.string().optional().describe("Why you're watching this player"), type: z.enum(["pickup", "trade_target", "monitor", "sell_candidate"]).optional().describe("Tracking type") },
    async function (params: { name: string; reason?: string; type?: string }) {
      try {
        var data = await apiPost<any>("/api/watchlist-add", { name: params.name, reason: params.reason || "", type: params.type || "monitor" });
        return { content: [{ type: "text" as const, text: "Added " + data.added + " to watchlist (" + (data.type || "monitor") + "). Owner: " + (data.owner || "free agent") + ". Z-score: " + data.z_score }] };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_watchlist_remove
  if (shouldRegister("yahoo_watchlist_remove")) {
    server.tool(
    "yahoo_watchlist_remove",
    "Remove a player from your watchlist",
    { name: z.string().describe("Player name to remove") },
    async function (params: { name: string }) {
      try {
        var data = await apiPost<any>("/api/watchlist-remove", { name: params.name });
        return { content: [{ type: "text" as const, text: "Removed " + data.removed + " from watchlist" }] };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_watchlist
  if (shouldRegister("yahoo_watchlist")) {
    server.tool(
    "yahoo_watchlist",
    "Check all watched players for ownership changes, z-score movement, and status updates",
    {},
    async function () {
      try {
        var data = await apiGet<any>("/api/watchlist");
        var lines: string[] = ["PLAYER WATCHLIST (" + data.count + " players)", "=".repeat(50)];
        if (data.alerts && data.alerts.length > 0) {
          lines.push("ALERTS:");
          for (var a of data.alerts) {
            lines.push("  [!] " + a.message);
          }
          lines.push("");
        }
        for (var p of data.players || []) {
          var flags: string[] = [];
          if (p.owner_changed) flags.push("OWNER CHANGED");
          if (p.injury_severity) flags.push(p.injury_severity);
          if (Math.abs(p.z_change || 0) > 0.5) flags.push("z " + (p.z_change > 0 ? "+" : "") + p.z_change);
          lines.push("  " + p.name + " [" + (p.target_type || "monitor") + "] — " + p.current_owner + " (z=" + p.z_score + ")" + (flags.length ? " " + flags.join(" | ") : ""));
          if (p.latest_headline) lines.push("    News: " + p.latest_headline.slice(0, 80));
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "watchlist", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_category_arms_race
  if (shouldRegister("yahoo_category_arms_race")) {
    server.tool(
    "yahoo_category_arms_race",
    "Show category-by-category competitive position — your rank, gap to nearest rivals, and who's gaining on you",
    {},
    async function () {
      try {
        var data = await apiGet<any>("/api/category-arms-race");
        var lines: string[] = ["CATEGORY ARMS RACE", "=".repeat(50)];
        for (var c of data.categories || []) {
          var aboveStr = c.above ? " (" + c.above.team + " ahead by " + c.above.gap + ")" : "";
          var belowStr = c.below ? " (" + c.below.team + " behind by " + c.below.gap + ")" : "";
          lines.push("  " + c.name.padEnd(8) + "Rank #" + c.rank + "/" + c.total_teams + "  value=" + c.my_value + aboveStr + belowStr);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "category-arms-race", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_research_feed
  if (shouldRegister("yahoo_research_feed")) {
    server.tool(
    "yahoo_research_feed",
    "Unified intelligence feed — news, league transactions, trending pickups, prospect signals. Filter by: roster, league, market, prospects, all",
    { filter: z.enum(["all", "roster", "league", "market", "prospects", "news"]).optional().describe("Feed filter").default("all"), limit: z.number().optional().describe("Max items").default(20) },
    async function (params: { filter?: string; limit?: number }) {
      try {
        var data = await apiGet<any>("/api/research-feed?filter=" + (params.filter || "all") + "&limit=" + (params.limit || 20));
        var lines: string[] = ["RESEARCH FEED (" + data.filter + ")", "=".repeat(50)];
        for (var item of data.feed || []) {
          var prefix = item.type === "news" ? "[NEWS]" : item.type === "transaction" ? "[TXN]" : item.type === "trending" ? "[HOT]" : item.type === "prospect" ? "[PRSP]" : "[?]";
          var injury = item.injury_flag ? " [INJURY]" : "";
          lines.push("  " + prefix + " " + item.headline + injury);
          if (item.source) lines.push("    via " + item.source + (item.timestamp ? " — " + item.timestamp : ""));
        }
        if (data.feed.length === 0) lines.push("  No items matching filter '" + data.filter + "'");
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "research-feed", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }
}
