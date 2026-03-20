import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { apiGet, apiPost, toolError } from "../api/python-client.js";
import { pid } from "../api/format-text.js";
import {
  generateLineupInsight,
  generateMatchupInsight,
  generateWaiverInsight,
  generateInjuryInsight,
  generateCategoryInsight,
  generateStreamingInsight,
  generateTradeInsight,
  generateWhatsNewInsight,
  generateTradeFinderInsight,
  generateCloserInsight,
  generateScoutInsight,
  generateWeekPlannerInsight,
  generatePitcherMatchupInsight,
  generateDailyUpdateInsight,
  generateSimulateInsight,
  generateILStashInsight,
  generateOptimalMovesInsight,
  generatePlayoffPlannerInsight,
  generateRivalHistoryInsight,
  generateAchievementsInsight,
  generateWeeklyNarrativeInsight,
} from "../insights.js";
import {
  str,
  type LineupOptimizeResponse,
  type CategoryCheckResponse,
  type InjuryReportResponse,
  type WaiverAnalyzeResponse,
  type StreamingResponse,
  type TradeEvalResponse,
  type DailyUpdateResponse,
  type CategorySimulateResponse,
  type ScoutOpponentResponse,
  type MatchupStrategyResponse,
  type SetLineupResponse,
  type PendingTradesResponse,
  type ProposeTradeResponse,
  type TradeActionResponse,
  type WhatsNewResponse,
  type TradeFinderResponse,
  type WeekPlannerResponse,
  type CloserMonitorResponse,
  type PitcherMatchupResponse,
  type RosterStatsResponse,
  type FaabRecommendResponse,
  type OwnershipTrendsResponse,
  type CategoryTrendsResponse,
  type PuntAdvisorResponse,
  type ILStashAdvisorResponse,
  type OptimalMovesResponse,
  type PlayoffPlannerResponse,
  type TrashTalkResponse,
  type RivalHistoryOverviewResponse,
  type RivalHistoryDetailResponse,
  type AchievementsResponse,
  type WeeklyNarrativeResponse,
} from "../api/types.js";

export const SEASON_URI = "ui://baseclaw/season.html";

export function registerSeasonTools(server: McpServer, distDir: string, writesEnabled: boolean = false) {
  registerAppResource(
    server,
    "Season Manager View",
    SEASON_URI,
    {
      description: "In-season management: lineup, waivers, injuries, streaming",
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
        uri: SEASON_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await fs.readFile(path.join(distDir, "season.html"), "utf-8"),
      }],
    }),
  );

  // yahoo_lineup_optimize
  registerAppTool(
    server,
    "yahoo_lineup_optimize",
    {
      description: "Optimize daily lineup by benching off-day players and starting active ones. Set apply=true to execute changes.",
      inputSchema: { apply: z.boolean().describe("Set true to apply lineup changes, false for preview only").default(false) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: SEASON_URI } },
    },
    async ({ apply }) => {
      try {
        const params: Record<string, string> = {};
        if (apply) params.apply = "true";
        const data = await apiGet<LineupOptimizeResponse>("/api/lineup-optimize", params);
        const lines = ["Lineup Optimizer:"];
        if (data.active_off_day.length > 0) {
          lines.push("PROBLEM: Active players on OFF DAY:");
          for (const p of data.active_off_day) {
            lines.push("  " + str(p.position || "?").padEnd(4) + " " + str(p.name).padEnd(25) + " (" + str(p.team || "?") + ") - NO GAME" + pid(p.player_id));
          }
        } else {
          lines.push("All active players have games today.");
        }
        if (data.bench_playing.length > 0) {
          lines.push("OPPORTUNITY: Bench players WITH games today:");
          for (const p of data.bench_playing) {
            lines.push("  BN   " + str(p.name).padEnd(25) + " (" + str(p.team || "?") + ")" + pid(p.player_id));
          }
        }
        if (data.suggested_swaps.length > 0) {
          lines.push("Suggested Swaps:");
          for (const s of data.suggested_swaps) {
            lines.push("  Bench " + s.bench_player + ", Start " + s.start_player + " (" + s.position + ")");
          }
        }
        if (data.applied) lines.push("Changes applied.");
        const ai_recommendation = generateLineupInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "lineup-optimize", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_category_check
  registerAppTool(
    server,
    "yahoo_category_check",
    {
      description: "Show where you rank in each stat category vs the league",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<CategoryCheckResponse>("/api/category-check");
        const lines = [
          "Category Check (week " + data.week + "):",
          "  " + "Category".padEnd(12) + "Value".padStart(10) + "  Rank",
          "  " + "-".repeat(35),
        ];
        for (const c of data.categories) {
          let marker = "";
          if (c.strength === "strong") marker = " << STRONG";
          if (c.strength === "weak") marker = " << WEAK";
          lines.push("  " + str(c.name).padEnd(12) + str(c.value).padStart(10) + "  " + c.rank + "/" + c.total + marker);
        }
        if (data.strongest.length > 0) lines.push("Strongest: " + data.strongest.join(", "));
        if (data.weakest.length > 0) lines.push("Weakest:   " + data.weakest.join(", "));
        const ai_recommendation = generateCategoryInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "category-check", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_injury_report
  registerAppTool(
    server,
    "yahoo_injury_report",
    {
      description: "Check roster for injured players and suggest IL moves",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<InjuryReportResponse>("/api/injury-report");
        const lines = ["Injury Report:"];
        if (data.injured_active.length > 0) {
          lines.push("PROBLEM: Injured players in ACTIVE lineup:");
          for (const p of data.injured_active) {
            lines.push("  " + str(p.position).padEnd(4) + " " + str(p.name).padEnd(25) + " [" + str(p.status) + "]" + pid(p.player_id) + (p.injury_description ? " - " + p.injury_description : ""));
          }
        } else {
          lines.push("No injured players in active lineup.");
        }
        if (data.healthy_il.length > 0) {
          lines.push("INEFFICIENCY: Players on IL with no injury status:");
          for (const p of data.healthy_il) {
            lines.push("  " + str(p.position).padEnd(4) + " " + str(p.name).padEnd(25) + " - may be activatable" + pid(p.player_id));
          }
        }
        if (data.injured_bench.length > 0) {
          lines.push("NOTE: Injured players on bench:");
          for (const p of data.injured_bench) {
            lines.push("  BN   " + str(p.name).padEnd(25) + " [" + str(p.status) + "]" + pid(p.player_id));
          }
        }
        const ai_recommendation = generateInjuryInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "injury-report", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_waiver_analyze
  registerAppTool(
    server,
    "yahoo_waiver_analyze",
    {
      description: "Score free agents by how much they'd improve your weakest categories. pos_type: B or P",
      inputSchema: { pos_type: z.string().describe("B for batters, P for pitchers").default("B"), count: z.number().describe("Number of recommendations to return").default(15) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ pos_type, count }) => {
      try {
        const data = await apiGet<WaiverAnalyzeResponse>("/api/waiver-analyze", { pos_type, count: String(count) });
        const label = pos_type === "B" ? "Batters" : "Pitchers";
        const lines = [
          "Waiver Wire Analysis (" + label + "):",
        ];
        if (data.weak_categories.length > 0) {
          lines.push("Weak categories: " + data.weak_categories.map((c) => c.name).join(", "));
        }
        lines.push("  " + "Player".padEnd(25) + "Pos".padEnd(12) + "Own%".padStart(5) + "  Score  Status");
        lines.push("  " + "-".repeat(60));
        for (const p of data.recommendations) {
          const status = p.status ? " [" + p.status + "]" : "";
          const tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
          lines.push("  " + str(p.name).padEnd(25) + str(p.positions).padEnd(12) + str(p.pct).padStart(5)
            + "  " + str(p.score.toFixed(1)).padStart(5) + status + tier + "  (id:" + p.pid + ")");
        }
        const ai_recommendation = generateWaiverInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "waiver-analyze", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_streaming
  registerAppTool(
    server,
    "yahoo_streaming",
    {
      description: "Recommend streaming pitchers based on schedule and two-start potential",
      inputSchema: { week: z.string().describe("Week number, empty for current week").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ week }) => {
      try {
        const params: Record<string, string> = {};
        if (week) params.week = week;
        const data = await apiGet<StreamingResponse>("/api/streaming", params);
        const lines = [
          "Streaming Pitcher Recommendations (week " + data.week + "):",
          "  " + "Pitcher".padEnd(25) + "Team".padEnd(15) + "Games".padStart(5) + "  Own%".padStart(6) + "  Score",
          "  " + "-".repeat(65),
        ];
        for (const p of data.recommendations) {
          const twoStart = p.games >= 7 ? " *2S*" : "";
          const tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
          lines.push("  " + str(p.name).padEnd(25) + str(p.team).padEnd(15) + str(p.games).padStart(5)
            + str(p.pct).padStart(6) + "  " + str(p.score.toFixed(1)).padStart(5)
            + twoStart + tier + "  (id:" + p.pid + ")");
        }
        const ai_recommendation = generateStreamingInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "streaming", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_trade_eval
  registerAppTool(
    server,
    "yahoo_trade_eval",
    {
      description: "Evaluate a trade. give_ids and get_ids are comma-separated player IDs (e.g. '12345,12346')",
      inputSchema: { give_ids: z.string().describe("Comma-separated Yahoo player IDs you would give"), get_ids: z.string().describe("Comma-separated Yahoo player IDs you would get") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ give_ids, get_ids }) => {
      try {
        const data = await apiPost<TradeEvalResponse>("/api/trade-eval", { give_ids, get_ids });
        const lines = [
          "Trade Evaluation:",
          "GIVING:",
        ];
        for (const p of data.give_players) {
          const tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
          lines.push("  " + str(p.name).padEnd(25) + pid(p.player_id) + " " + (p.positions || []).join(",") + tier);
        }
        lines.push("GETTING:");
        for (const p of data.get_players) {
          const tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
          lines.push("  " + str(p.name).padEnd(25) + pid(p.player_id) + " " + (p.positions || []).join(",") + tier);
        }
        lines.push("");
        lines.push("Give Value:    " + data.give_value.toFixed(1));
        lines.push("Get Value:     " + data.get_value.toFixed(1));
        lines.push("Net Value:     " + data.net_value.toFixed(1));
        lines.push("Trade Grade:   " + data.grade);
        const ai_recommendation = generateTradeInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "trade-eval", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_daily_update
  registerAppTool(
    server,
    "yahoo_daily_update",
    {
      description: "Run all daily checks: lineup optimization and injury report",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<DailyUpdateResponse>("/api/daily-update");
        const ai_recommendation = generateDailyUpdateInsight(data);
        return {
          content: [{ type: "text" as const, text: "Daily update complete" }],
          structuredContent: { type: "daily-update", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_scout_opponent
  registerAppTool(
    server,
    "yahoo_scout_opponent",
    {
      description: "Scout your current matchup opponent - analyze their strengths, weaknesses, and suggest counter-strategies",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<ScoutOpponentResponse>("/api/scout-opponent");
        const lines = [
          "Opponent Scout Report (week " + data.week + "):",
          "vs. " + data.opponent,
          "Score: " + data.score.wins + "-" + data.score.losses + "-" + data.score.ties,
          "",
          "Strategy:",
        ];
        for (const s of data.strategy) {
          lines.push("  - " + s);
        }
        const ai_recommendation = generateScoutInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "scout-opponent", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_category_simulate
  registerAppTool(
    server,
    "yahoo_category_simulate",
    {
      description: "Simulate category rank impact of adding a player. Shows how your weak/strong categories would change.",
      inputSchema: { add_name: z.string().describe("Player name to simulate adding"), drop_name: z.string().describe("Player name to simulate dropping, empty to skip").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ add_name, drop_name }) => {
      try {
        const params: Record<string, string> = { add_name };
        if (drop_name) params.drop_name = drop_name;
        const data = await apiGet<CategorySimulateResponse>("/api/category-simulate", params);
        const lines = ["Category Simulation:"];
        lines.push("Adding: " + data.add_player.name);
        if (data.drop_player) lines.push("Dropping: " + data.drop_player.name);
        lines.push("");
        lines.push(data.summary);
        const ai_recommendation = generateSimulateInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "category-simulate", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_matchup_strategy
  registerAppTool(
    server,
    "yahoo_matchup_strategy",
    {
      description: "Analyze your matchup and get a category-by-category game plan to maximize wins",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<MatchupStrategyResponse>("/api/matchup-strategy");
        const lines = [
          "Matchup Strategy (week " + data.week + "):",
          "vs. " + data.opponent,
          "Score: " + data.score.wins + "-" + data.score.losses + "-" + data.score.ties,
          "",
        ];
        const strat = data.strategy || { target: [], protect: [], concede: [], lock: [] };
        if (strat.target.length > 0) lines.push("TARGET: " + strat.target.join(", "));
        if (strat.protect.length > 0) lines.push("PROTECT: " + strat.protect.join(", "));
        if (strat.concede.length > 0) lines.push("CONCEDE: " + strat.concede.join(", "));
        if (strat.lock.length > 0) lines.push("LOCK: " + strat.lock.join(", "));
        lines.push("");
        lines.push(data.summary);
        const ai_recommendation = generateMatchupInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "matchup-strategy", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  if (writesEnabled) {

  // yahoo_set_lineup
  registerAppTool(
    server,
    "yahoo_set_lineup",
    {
      description: "Move specific player(s) to specific position(s). Each move is {player_id, position}.",
      inputSchema: {
        moves: z.array(z.object({ player_id: z.string().describe("Yahoo player ID"), position: z.string().describe("Target roster position (e.g. C, 1B, OF, BN, IL)") })).describe("List of player moves to execute"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: SEASON_URI } },
    },
    async ({ moves }) => {
      try {
        const data = await apiPost<SetLineupResponse>("/api/set-lineup", { moves });
        const lines = ["Set Lineup:"];
        for (const m of data.moves || []) {
          if (m.success) {
            lines.push("  Moved " + m.player_id + " to " + m.position);
          } else {
            lines.push("  Error moving " + m.player_id + ": " + (m.error || "unknown"));
          }
        }
        const ai_recommendation = null;
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "set-lineup", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  } // end writesEnabled (set_lineup)

  // yahoo_pending_trades
  registerAppTool(
    server,
    "yahoo_pending_trades",
    {
      description: "View all pending incoming and outgoing trade proposals",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<PendingTradesResponse>("/api/pending-trades");
        if (!data.trades || data.trades.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No pending trade proposals" }],
            structuredContent: { type: "pending-trades", ai_recommendation: null, ...data },
          };
        }
        const lines = ["Pending Trade Proposals:"];
        for (const t of data.trades) {
          const traderNames = (t.trader_players || []).map((p) => (p.name || "?") + pid(p.player_id)).join(", ");
          const tradeeNames = (t.tradee_players || []).map((p) => (p.name || "?") + pid(p.player_id)).join(", ");
          lines.push("  " + (t.trader_team_name || t.trader_team_key) + " sends: " + traderNames);
          lines.push("  " + (t.tradee_team_name || t.tradee_team_key) + " sends: " + tradeeNames);
          lines.push("  Status: " + t.status + "  Key: " + t.transaction_key);
          if (t.trade_note) lines.push("  Note: " + t.trade_note);
          lines.push("");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "pending-trades", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  if (writesEnabled) {

  // yahoo_propose_trade
  registerAppTool(
    server,
    "yahoo_propose_trade",
    {
      description: "Propose a trade to another team. your_player_ids and their_player_ids are comma-separated.",
      inputSchema: {
        their_team_key: z.string().describe("Target team key (e.g. 469.l.16960.t.5)"),
        your_player_ids: z.string().describe("Comma-separated Yahoo player IDs you are offering"),
        their_player_ids: z.string().describe("Comma-separated Yahoo player IDs you want"),
        note: z.string().describe("Optional trade message").default(""),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
      _meta: { ui: { resourceUri: SEASON_URI } },
    },
    async ({ their_team_key, your_player_ids, their_player_ids, note }) => {
      try {
        const data = await apiPost<ProposeTradeResponse>("/api/propose-trade", {
          their_team_key, your_player_ids, their_player_ids, note,
        });
        return {
          content: [{ type: "text" as const, text: data.message || "Trade proposal result: " + JSON.stringify(data) }],
          structuredContent: { type: "propose-trade", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_accept_trade
  registerAppTool(
    server,
    "yahoo_accept_trade",
    {
      description: "Accept a pending trade by transaction key",
      inputSchema: { transaction_key: z.string().describe("Transaction key from pending trades"), note: z.string().describe("Optional response message").default("") },
      annotations: { readOnlyHint: false, destructiveHint: true },
      _meta: { ui: { resourceUri: SEASON_URI } },
    },
    async ({ transaction_key, note }) => {
      try {
        const data = await apiPost<TradeActionResponse>("/api/accept-trade", { transaction_key, note });
        return {
          content: [{ type: "text" as const, text: data.message || "Accept trade result: " + JSON.stringify(data) }],
          structuredContent: { type: "accept-trade", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_reject_trade
  registerAppTool(
    server,
    "yahoo_reject_trade",
    {
      description: "Reject a pending trade by transaction key",
      inputSchema: { transaction_key: z.string().describe("Transaction key from pending trades"), note: z.string().describe("Optional response message").default("") },
      annotations: { readOnlyHint: false, destructiveHint: false },
      _meta: { ui: { resourceUri: SEASON_URI } },
    },
    async ({ transaction_key, note }) => {
      try {
        const data = await apiPost<TradeActionResponse>("/api/reject-trade", { transaction_key, note });
        return {
          content: [{ type: "text" as const, text: data.message || "Reject trade result: " + JSON.stringify(data) }],
          structuredContent: { type: "reject-trade", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  } // end writesEnabled (trades)

  // yahoo_whats_new
  registerAppTool(
    server,
    "yahoo_whats_new",
    {
      description: "Get a digest of what's new: injuries, pending trades, league activity, trending pickups, prospect call-ups",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<WhatsNewResponse>("/api/whats-new");
        const sections: string[] = ["What's New Digest:"];
        if (data.injuries.length > 0) {
          sections.push("INJURIES (" + data.injuries.length + "):");
          for (const p of data.injuries) {
            sections.push("  " + str(p.name).padEnd(25) + " [" + str(p.status) + "]" + pid(p.player_id));
          }
        }
        if (data.pending_trades.length > 0) {
          sections.push("PENDING TRADES (" + data.pending_trades.length + ")");
        }
        if (data.league_activity.length > 0) {
          sections.push("LEAGUE ACTIVITY (" + data.league_activity.length + "):");
          for (const a of data.league_activity.slice(0, 5)) {
            sections.push("  " + str(a.type).padEnd(6) + " " + str(a.player).padEnd(25) + " -> " + str(a.team));
          }
        }
        if (data.trending.length > 0) {
          sections.push("TRENDING (" + data.trending.length + "):");
          for (const t of data.trending.slice(0, 5)) {
            sections.push("  " + str(t.name).padEnd(25) + " " + t.percent_owned + "% (" + t.delta + ")");
          }
        }
        if (data.prospects.length > 0) {
          sections.push("PROSPECT CALL-UPS (" + data.prospects.length + "):");
          for (const p of data.prospects) {
            sections.push("  " + str(p.player).padEnd(25) + " " + str(p.type));
          }
        }
        const ai_recommendation = generateWhatsNewInsight(data);
        return {
          content: [{ type: "text" as const, text: sections.join("\n") }],
          structuredContent: { type: "whats-new", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_trade_finder
  registerAppTool(
    server,
    "yahoo_trade_finder",
    {
      description: "Find optimal trade packages to acquire a target player, analyzing both teams' needs and z-score values. If no target given, scans league for complementary trade partners.",
      inputSchema: { target_player: z.string().describe("Name of the player you want to acquire (leave empty to scan league for trade partners)").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ target_player }) => {
      try {
        var params: Record<string, string> = {};
        if (target_player) params.target = target_player;
        var data = await apiGet<TradeFinderResponse>("/api/trade-finder", params);
        var lines: string[] = [];

        // Target-player mode: new response shape with proposals
        if (data.target_player) {
          lines.push("Trade Package Builder for " + data.target_player + ":");
          lines.push("Owner: " + str(data.target_team || "?"));
          lines.push("Target Z-Score: " + str(data.target_z_score || "?") + " (" + str(data.target_tier || "?") + ")");
          lines.push("Their weak categories: " + (data.target_team_needs || []).join(", "));
          lines.push("");
          var proposals = data.proposals || [];
          if (proposals.length === 0) {
            lines.push("No viable trade packages found.");
          } else {
            for (var i = 0; i < proposals.length; i++) {
              var prop = proposals[i];
              lines.push("Proposal " + (i + 1) + " (fairness: " + str(prop.fairness_score) + "):");
              lines.push("  " + str(prop.summary || ""));
              var offerIds = (prop.offer_details || []).map(function (pl) { return pl.name + pid(pl.player_id); }).join(", ");
              var receiveIds = (prop.receive_details || []).map(function (pl) { return pl.name + pid(pl.player_id); }).join(", ");
              if (offerIds) lines.push("  Give: " + offerIds);
              if (receiveIds) lines.push("  Get: " + receiveIds);
              lines.push("  Your net Z: " + str(prop.your_z_change) + " | Their net Z: " + str(prop.their_z_change));
              if (prop.addresses_needs && prop.addresses_needs.length > 0) {
                lines.push("  Addresses their needs: " + prop.addresses_needs.join(", "));
              }
              lines.push("");
            }
          }
        } else {
          // League-scan mode: original response shape
          lines.push("Trade Finder:");
          lines.push("Weak categories: " + (data.weak_categories || []).join(", "));
          lines.push("Strong categories: " + (data.strong_categories || []).join(", "));
          lines.push("");
          if (!data.partners || data.partners.length === 0) {
            lines.push("No complementary trade partners found");
          } else {
            for (var p of data.partners) {
              lines.push("Partner: " + p.team_name + " (" + p.team_key + ") — complementary: " + p.complementary_categories.join(", "));
              for (var pkg of p.packages || []) {
                var give = (pkg.give || []).map(function (pl) { return pl.name + " (id:" + pl.player_id + ", z:" + (pl.z_score ?? "?") + ")"; }).join(", ");
                var get = (pkg.get || []).map(function (pl) { return pl.name + " (id:" + pl.player_id + ", z:" + (pl.z_score ?? "?") + ")"; }).join(", ");
                lines.push("  Give: " + give + " <-> Get: " + get);
              }
              lines.push("");
            }
          }
        }
        var ai_recommendation = generateTradeFinderInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "trade-finder", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_week_planner
  registerAppTool(
    server,
    "yahoo_week_planner",
    {
      description: "Show games-per-day grid for your roster this week. Identifies off-days and two-start pitchers.",
      inputSchema: { week: z.string().describe("Week number, empty for current week").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ week }) => {
      try {
        const params: Record<string, string> = {};
        if (week) params.week = week;
        const data = await apiGet<WeekPlannerResponse>("/api/week-planner", params);
        const lines = [
          "Week " + data.week + " Planner (" + data.start_date + " to " + data.end_date + "):",
        ];
        const dateHeaders = (data.dates || []).map((d) => d.slice(5));
        lines.push("  " + "Player".padEnd(20) + "Pos".padEnd(5) + dateHeaders.map((d) => d.padStart(6)).join(""));
        for (const p of data.players || []) {
          const days = (data.dates || []).map((d) => p.games_by_date[d] ? "  *  " : "  -  ");
          lines.push("  " + str(p.name).slice(0, 20).padEnd(20) + str(p.position).padEnd(5) + days.join(""));
        }
        const ai_recommendation = generateWeekPlannerInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "week-planner", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_closer_monitor
  registerAppTool(
    server,
    "yahoo_closer_monitor",
    {
      description: "Monitor closer situations - your closers, available closers by ownership %, and MLB saves leaders",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<CloserMonitorResponse>("/api/closer-monitor");
        const lines = ["Closer Monitor:"];
        if (data.my_closers && data.my_closers.length > 0) {
          lines.push("Your Closers/RPs:");
          for (const p of data.my_closers) {
            const status = p.status ? " [" + p.status + "]" : "";
            lines.push("  " + str(p.name).padEnd(25) + " " + p.percent_owned + "% owned" + status + pid(p.player_id));
          }
          lines.push("");
        }
        if (data.available_closers && data.available_closers.length > 0) {
          lines.push("Available Closers:");
          for (const p of data.available_closers.slice(0, 10)) {
            const status = p.status ? " [" + p.status + "]" : "";
            lines.push("  " + str(p.name).padEnd(25) + " " + p.percent_owned + "% owned" + status + pid(p.player_id));
          }
        }
        if (data.saves_leaders && data.saves_leaders.length > 0) {
          lines.push("");
          lines.push("MLB Saves Leaders:");
          for (const [i, p] of data.saves_leaders.slice(0, 10).entries()) {
            lines.push("  " + String(i + 1).padStart(2) + ". " + str(p.name).padEnd(25) + " " + p.saves + " saves");
          }
        }
        const ai_recommendation = generateCloserInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "closer-monitor", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_pitcher_matchup
  registerAppTool(
    server,
    "yahoo_pitcher_matchup",
    {
      description: "Show pitcher matchup quality for your rostered SPs based on opponent team batting stats",
      inputSchema: { week: z.string().describe("Week number, empty for current week").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ week }) => {
      try {
        const params: Record<string, string> = {};
        if (week) params.week = week;
        const data = await apiGet<PitcherMatchupResponse>("/api/pitcher-matchup", params);
        const lines = [
          "Pitcher Matchups (week " + data.week + "):",
          "  " + "Pitcher".padEnd(22) + "Start".padEnd(12) + "Opponent".padEnd(15) + "Grade",
          "  " + "-".repeat(55),
        ];
        for (const p of data.pitchers || []) {
          const ha = p.home_away === "home" ? "vs " : "@ ";
          const ts = p.two_start ? " [2S]" : "";
          lines.push("  " + str(p.name).padEnd(22) + str(p.next_start_date).slice(0, 10).padEnd(12)
            + (ha + str(p.opponent)).slice(0, 15).padEnd(15) + p.matchup_grade + ts);
        }
        const ai_recommendation = generatePitcherMatchupInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "pitcher-matchup", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_roster_stats
  registerAppTool(
    server,
    "yahoo_roster_stats",
    {
      description: "Show fantasy stats for every player on a roster. period: season (default) or week. Optionally specify a week number or team_key.",
      inputSchema: {
        period: z.string().describe("Stats period: season or week").default("season"),
        week: z.string().describe("Week number (optional, required when period=week)").default(""),
        team_key: z.string().describe("Team key to check (optional, defaults to your team)").default(""),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ period, week, team_key }) => {
      try {
        const params: Record<string, string> = { period };
        if (week) params.week = week;
        if (team_key) params.team_key = team_key;
        const data = await apiGet<RosterStatsResponse>("/api/roster-stats", params);
        const lines = ["Roster Stats (" + data.period + (data.week ? " week " + data.week : "") + "):"];
        for (const p of data.players || []) {
          lines.push("  " + str(p.position).padEnd(4) + " " + str(p.name).padEnd(25) + pid(p.player_id));
          const stats = p.stats || {};
          const statParts: string[] = [];
          for (const [key, val] of Object.entries(stats)) {
            if (key !== "player_id" && key !== "name") {
              statParts.push(str(key) + ":" + str(val));
            }
          }
          if (statParts.length > 0) {
            lines.push("       " + statParts.join("  "));
          }
        }
        const playerCount = (data.players || []).length;
        const ai_recommendation = playerCount + " player" + (playerCount === 1 ? "" : "s") + " with " + data.period + " stats. Compare individual contributions to identify underperformers.";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "roster-stats", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_faab_recommend
  registerAppTool(
    server,
    "yahoo_faab_recommend",
    {
      description: "Recommend a FAAB bid amount for a player based on z-score value, remaining budget, and category need",
      inputSchema: { player_name: z.string().describe("Name of the player to bid on") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name }) => {
      try {
        var data = await apiGet<FaabRecommendResponse>("/api/faab-recommend", { name: player_name });
        if ((data as any).error) {
          return toolError((data as any).error);
        }
        var lines = [
          "FAAB Recommendation: " + str(data.player.name),
          "  Position: " + str(data.player.pos) + "  Team: " + str(data.player.team),
          "  Tier: " + str(data.player.tier) + " (z=" + str(data.player.z_final) + ")",
          "",
          "  Recommended Bid: $" + str(data.recommended_bid) + " (range: $" + str(data.bid_range.low) + "-$" + str(data.bid_range.high) + ")",
          "  FAAB Remaining: $" + str(data.faab_remaining) + " -> $" + str(data.faab_after),
          "  Budget %: " + str(data.pct_of_budget) + "%",
          "",
        ];
        if (data.reasoning.length > 0) {
          lines.push("Reasoning:");
          for (var r of data.reasoning) {
            lines.push("  - " + r);
          }
        }
        if (data.improving_categories.length > 0) {
          lines.push("");
          lines.push("Improves categories: " + data.improving_categories.join(", "));
        }
        var ai_recommendation = "Bid $" + str(data.recommended_bid) + " (" + str(data.pct_of_budget) + "% of budget) for " + str(data.player.name)
          + " (" + str(data.player.tier) + " tier). Range: $" + str(data.bid_range.low) + "-$" + str(data.bid_range.high) + "."
          + (data.improving_categories.length > 0 ? " Improves: " + data.improving_categories.join(", ") + "." : "");
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "faab-recommend", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_ownership_trends
  registerAppTool(
    server,
    "yahoo_ownership_trends",
    {
      description: "Show ownership % trend over time for a player. Tracks rising/falling ownership from season.db history.",
      inputSchema: { player_name: z.string().describe("Name of the player to look up") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name }) => {
      try {
        var data = await apiGet<OwnershipTrendsResponse>("/api/ownership-trends", { name: player_name });
        if ((data as any).error) {
          return toolError((data as any).error);
        }
        var lines = ["Ownership Trends: " + str(data.player_name) + " (id:" + str(data.player_id) + ")"];
        if (!data.trend || data.trend.length === 0) {
          lines.push(data.message || "No ownership history recorded yet.");
        } else {
          lines.push("Current: " + str(data.current_pct) + "%  Direction: " + str(data.direction));
          lines.push("7-day change: " + str(data.delta_7d) + "%  30-day change: " + str(data.delta_30d) + "%");
          lines.push("");
          for (var entry of data.trend.slice(-14)) {
            lines.push("  " + str(entry.date) + "  " + str(entry.pct_owned) + "%");
          }
        }
        var ai_recommendation = data.trend && data.trend.length > 0
          ? str(data.player_name) + " ownership is " + str(data.direction) + " at " + str(data.current_pct) + "% (7d: " + (data.delta_7d >= 0 ? "+" : "") + str(data.delta_7d) + "%)."
          : "No ownership history available yet for " + str(data.player_name) + ".";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "ownership-trends", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_category_trends
  registerAppTool(
    server,
    "yahoo_category_trends",
    {
      description: "Show your team's category rank trends over time from season.db history. See which categories are improving or declining.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        var data = await apiGet<CategoryTrendsResponse>("/api/category-trends");
        if ((data as any).error) {
          return toolError((data as any).error);
        }
        var lines = ["Category Rank Trends:"];
        if (!data.categories || data.categories.length === 0) {
          lines.push(data.message || "No category history recorded yet.");
        } else {
          lines.push("  " + "Category".padEnd(12) + "Current".padStart(8) + "Best".padStart(6) + "Worst".padStart(7) + "  Trend");
          lines.push("  " + "-".repeat(45));
          for (var cat of data.categories) {
            var trendMarker = "";
            if (cat.trend === "improving") trendMarker = "IMPROVING";
            else if (cat.trend === "declining") trendMarker = "DECLINING";
            else trendMarker = "stable";
            lines.push("  " + str(cat.name).padEnd(12) + str(cat.current_rank).padStart(8) + str(cat.best_rank).padStart(6) + str(cat.worst_rank).padStart(7) + "  " + trendMarker);
          }
        }
        var improving = (data.categories || []).filter((c) => c.trend === "improving").map((c) => c.name);
        var declining = (data.categories || []).filter((c) => c.trend === "declining").map((c) => c.name);
        var ai_recommendation = data.categories && data.categories.length > 0
          ? "Category trends: " + (improving.length > 0 ? "Improving: " + improving.join(", ") + ". " : "")
            + (declining.length > 0 ? "Declining: " + declining.join(", ") + "." : "All stable or improving.")
          : "No category history available yet. Run category-check during the season to build history.";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "category-trends", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_punt_advisor
  registerAppTool(
    server,
    "yahoo_punt_advisor",
    {
      description: "Analyze your roster and standings to recommend which categories to target or punt for optimal strategy",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        var data = await apiGet<PuntAdvisorResponse>("/api/punt-advisor");
        if ((data as any).error) {
          return toolError((data as any).error);
        }
        var lines = [
          "Category Punting Advisor: " + str(data.team_name) + " (Rank " + str(data.current_rank) + "/" + str(data.num_teams) + ")",
          "",
        ];
        if (data.categories && data.categories.length > 0) {
          lines.push("  " + "Category".padEnd(12) + "Rank".padStart(6) + "  " + "Value".padStart(10) + "  Recommendation");
          lines.push("  " + "-".repeat(55));
          for (var cat of data.categories) {
            var rec = (cat.recommendation || "hold").toUpperCase();
            var rankStr = str(cat.rank) + "/" + str(cat.total);
            lines.push("  " + str(cat.name).padEnd(12) + rankStr.padStart(6) + "  " + str(cat.value).padStart(10) + "  " + rec);
          }
        }
        if (data.punt_candidates && data.punt_candidates.length > 0) {
          lines.push("");
          lines.push("Punt Candidates: " + data.punt_candidates.join(", "));
        }
        if (data.target_categories && data.target_categories.length > 0) {
          lines.push("Target Categories: " + data.target_categories.join(", "));
        }
        if (data.correlation_warnings && data.correlation_warnings.length > 0) {
          lines.push("");
          lines.push("Correlation Warnings:");
          for (var w of data.correlation_warnings) {
            lines.push("  - " + w);
          }
        }
        if (data.strategy_summary) {
          lines.push("");
          lines.push("Strategy: " + data.strategy_summary);
        }
        var ai_recommendation = data.strategy_summary || "No strategy recommendation available.";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "punt-advisor", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_il_stash_advisor
  registerAppTool(
    server,
    "yahoo_il_stash_advisor",
    {
      description: "Analyze injured players on your roster and free agents to recommend stash vs drop decisions",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        var data = await apiGet<ILStashAdvisorResponse>("/api/il-stash-advisor");
        var slots = data.il_slots || { used: 0, total: 0 };
        var lines = ["IL Stash Advisor:"];
        lines.push("IL Slots: " + str(slots.used) + "/" + str(slots.total) + " used");
        lines.push("");
        if (data.your_il_players && data.your_il_players.length > 0) {
          lines.push("Your IL Players:");
          lines.push("  " + "Player".padEnd(25) + "Pos".padEnd(6) + "Z".padStart(6) + "  " + "Tier".padEnd(12) + "  Action");
          lines.push("  " + "-".repeat(65));
          for (var p of data.your_il_players) {
            var rec = str(p.recommendation).toUpperCase();
            lines.push("  " + str(p.name).padEnd(25) + pid(p.player_id) + str(p.position).padEnd(6) + str(p.z_score).padStart(6) + "  " + str(p.tier).padEnd(12) + "  " + rec);
            lines.push("      " + str(p.reasoning));
          }
        } else {
          lines.push("No players currently on IL.");
        }
        if (data.fa_il_stash_candidates && data.fa_il_stash_candidates.length > 0) {
          lines.push("");
          lines.push("FA IL Stash Candidates:");
          lines.push("  " + "Player".padEnd(25) + "Pos".padEnd(6) + "Z".padStart(6) + "  " + "Tier".padEnd(12) + "  Action");
          lines.push("  " + "-".repeat(65));
          for (var fa of data.fa_il_stash_candidates) {
            var faRec = str(fa.recommendation).toUpperCase();
            lines.push("  " + str(fa.name).padEnd(25) + pid(fa.player_id) + str(fa.position).padEnd(6) + str(fa.z_score).padStart(6) + "  " + str(fa.tier).padEnd(12) + "  " + faRec);
            lines.push("      " + str(fa.reasoning));
          }
        }
        if (data.summary) {
          lines.push("");
          lines.push("Summary: " + data.summary);
        }
        var ai_recommendation = generateILStashInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "il-stash-advisor", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_optimal_moves
  registerAppTool(
    server,
    "yahoo_optimal_moves",
    {
      description: "Find the best sequence of add/drop moves to maximize your roster's z-score value",
      inputSchema: { count: z.number().describe("Number of moves to return (1-10)").default(5) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ count }) => {
      try {
        var params: Record<string, string> = {};
        if (count) params.count = String(count);
        var data = await apiGet<OptimalMovesResponse>("/api/optimal-moves", params);
        if ((data as any).error) {
          return toolError((data as any).error);
        }
        var lines = [
          "Optimal Add/Drop Chain Optimizer:",
          "Current Roster Z-Score: " + str(data.roster_z_total),
          "",
        ];
        if (data.moves && data.moves.length > 0) {
          lines.push("Recommended Moves:");
          lines.push("  " + "#".padStart(3) + "  " + "Drop".padEnd(22) + "Z".padStart(6) + "  ->  " + "Add".padEnd(22) + "Z".padStart(6) + "  " + "Gain".padStart(6));
          lines.push("  " + "-".repeat(75));
          for (var move of data.moves) {
            var d = move.drop;
            var a = move.add;
            lines.push("  " + str(move.rank).padStart(3) + "  " + str(d.name).padEnd(22) + pid(d.player_id) + str(d.z_score).padStart(6) + "  ->  " + str(a.name).padEnd(22) + pid(a.player_id) + str(a.z_score).padStart(6) + "  +" + str(move.z_improvement).padStart(5));
            var details: string[] = [];
            if (move.categories_gained.length > 0) details.push("Gains: " + move.categories_gained.join(", "));
            if (move.categories_lost.length > 0) details.push("Loses: " + move.categories_lost.join(", "));
            if (details.length > 0) lines.push("      " + details.join("  |  "));
          }
          lines.push("");
          lines.push("Projected Z-Score After: " + str(data.projected_z_after) + " (+" + str(data.net_improvement) + ")");
        } else {
          lines.push("No beneficial moves found above the +0.2 z-score threshold.");
        }
        if (data.summary) {
          lines.push("");
          lines.push("Summary: " + data.summary);
        }
        var ai_recommendation = generateOptimalMovesInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "optimal-moves", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_playoff_planner
  registerAppTool(
    server,
    "yahoo_playoff_planner",
    {
      description: "Calculate your path to the playoffs with specific category gaps, recommended trades, waiver adds, and drops",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        var data = await apiGet<PlayoffPlannerResponse>("/api/playoff-planner");
        if ((data as any).error) {
          return toolError((data as any).error);
        }
        var lines = [
          "Playoff Path Planner: " + str(data.team_name) + " (" + str(data.record) + ")",
          "Rank: " + str(data.current_rank) + "/" + str(data.num_teams) + " | Playoff Cutoff: Top " + str(data.playoff_cutoff) + " | Games Back: " + str(data.games_back),
          "Playoff Probability: " + str(data.playoff_probability) + "%",
          "",
        ];
        if (data.category_gaps && data.category_gaps.length > 0) {
          lines.push("Category Gaps to Close:");
          lines.push("  " + "Category".padEnd(12) + "Rank".padStart(6) + "  " + "Target".padStart(6) + "  " + "Priority".padEnd(10) + "Cost");
          lines.push("  " + "-".repeat(50));
          for (var gap of data.category_gaps) {
            lines.push("  " + str(gap.category).padEnd(12) + str(gap.current_rank).padStart(6) + "  " + str(gap.target_rank).padStart(6) + "  " + str(gap.priority).padEnd(10) + str(gap.cost_to_compete));
          }
          lines.push("");
        }
        if (data.recommended_actions && data.recommended_actions.length > 0) {
          lines.push("Recommended Actions:");
          for (var action of data.recommended_actions) {
            var prio = str(action.priority).toUpperCase();
            var atype = str(action.action_type).toUpperCase();
            lines.push("  [" + prio + "] " + atype + ": " + str(action.description));
            if (action.impact) {
              lines.push("         Impact: " + str(action.impact));
            }
          }
          lines.push("");
        }
        if (data.target_categories && data.target_categories.length > 0) {
          lines.push("Target Categories: " + data.target_categories.join(", "));
        }
        if (data.punt_categories && data.punt_categories.length > 0) {
          lines.push("Punt Categories: " + data.punt_categories.join(", "));
        }
        if (data.summary) {
          lines.push("");
          lines.push("Summary: " + data.summary);
        }
        var ai_recommendation = generatePlayoffPlannerInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "playoff-planner", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_trash_talk
  registerAppTool(
    server,
    "yahoo_trash_talk",
    {
      description: "Generate trash talk for your current matchup opponent. Intensity: friendly, competitive, or savage",
      inputSchema: { intensity: z.string().describe("Trash talk intensity: friendly, competitive, or savage").default("competitive") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ intensity }) => {
      try {
        var data = await apiGet<TrashTalkResponse>("/api/trash-talk?intensity=" + encodeURIComponent(intensity));
        var lines: string[] = [
          "Trash Talk vs. " + data.opponent + " (Week " + data.week + ")",
          "Intensity: " + data.intensity,
          "Score: " + data.context.score,
          "Your Rank: " + data.context.your_rank + " | Their Rank: " + data.context.their_rank,
          "",
        ];
        for (var line of data.lines) {
          lines.push("  > " + line);
        }
        lines.push("");
        lines.push("Featured: " + data.featured_line);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "trash-talk", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_rival_history
  registerAppTool(
    server,
    "yahoo_rival_history",
    {
      description: "View your head-to-head record against each league opponent with detailed matchup history",
      inputSchema: { opponent: z.string().describe("Opponent team name to filter to (empty for all rivals overview)").default("") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ opponent }) => {
      try {
        var params: Record<string, string> = {};
        if (opponent) params.opponent = opponent;
        var data = await apiGet<RivalHistoryOverviewResponse | RivalHistoryDetailResponse>("/api/rival-history", params);
        if ((data as any).error) {
          return toolError((data as any).error);
        }

        var lines: string[] = [];

        if ("rivals" in data) {
          // Overview mode
          var overview = data as RivalHistoryOverviewResponse;
          lines.push("Head-to-Head Rival History: " + overview.your_team);
          lines.push("");
          lines.push("  " + "Opponent".padEnd(28) + "Record".padEnd(10) + "Last".padEnd(16) + "Status");
          lines.push("  " + "-".repeat(60));
          for (var r of overview.rivals) {
            var lastStr = r.last_result;
            if (r.last_week) lastStr += " (wk " + r.last_week + ")";
            lines.push("  " + str(r.opponent).padEnd(28) + str(r.record).padEnd(10) + str(lastStr).padEnd(16) + str(r.dominance));
          }
        } else {
          // Detail mode
          var detail = data as RivalHistoryDetailResponse;
          lines.push("Rival History: " + detail.your_team + " vs " + detail.opponent);
          lines.push("All-Time Record: " + detail.all_time_record);
          lines.push("");
          lines.push("Matchups:");
          for (var mu of detail.matchups) {
            var marker = str(mu.result).charAt(0).toUpperCase();
            var muLine = "  Week " + str(mu.week).padStart(2) + "  [" + marker + "] " + mu.score;
            if (mu.mvp_category) muLine += "  MVP: " + mu.mvp_category;
            if (mu.note) muLine += "  (" + mu.note + ")";
            lines.push(muLine);
          }
          var edge = detail.category_edge || { you_dominate: [], they_dominate: [] };
          if (edge.you_dominate.length > 0) {
            lines.push("");
            lines.push("You dominate: " + edge.you_dominate.join(", "));
          }
          if (edge.they_dominate.length > 0) {
            lines.push("They dominate: " + edge.they_dominate.join(", "));
          }
          if (detail.narrative) {
            lines.push("");
            lines.push(detail.narrative);
          }
        }
        var ai_recommendation = generateRivalHistoryInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "rival-history", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_achievements
  registerAppTool(
    server,
    "yahoo_achievements",
    {
      description: "View your fantasy baseball achievements and milestones for the season",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        var data = await apiGet<AchievementsResponse>("/api/achievements");
        if ((data as any).error) {
          return toolError((data as any).error);
        }
        var lines = [
          "Achievements - " + str(data.team_name),
          "Record: " + str(data.record) + " | Rank: " + str(data.current_rank),
          "Earned: " + str(data.total_earned) + " / " + str(data.total_available),
          "",
        ];
        for (var a of data.achievements) {
          var marker = a.earned ? "[X]" : "[ ]";
          var val = a.value ? " (" + str(a.value) + ")" : "";
          lines.push("  " + marker + " " + str(a.name).padEnd(22) + str(a.description) + val);
        }
        var ai_recommendation = generateAchievementsInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "achievements", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_weekly_narrative
  registerAppTool(
    server,
    "yahoo_weekly_narrative",
    {
      description: "Get a narrative recap of your most recent week with highlights, MVP category, and standings movement",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        var data = await apiGet<WeeklyNarrativeResponse>("/api/weekly-narrative");
        var lines: string[] = [];
        lines.push("Week " + data.week + " Narrative Recap");
        lines.push("=".repeat(40));
        lines.push("");
        lines.push(data.narrative);
        lines.push("");
        lines.push("Score: " + data.score + " (" + data.result + ") vs " + data.opponent);
        lines.push("");
        lines.push("Category Breakdown:");
        for (var cat of (data.categories || [])) {
          var marker = cat.result === "win" ? "W" : cat.result === "loss" ? "L" : "T";
          lines.push("  [" + marker + "] " + str(cat.name).padEnd(12) + str(cat.your_value).padStart(8) + " vs " + str(cat.opp_value).padStart(8));
        }
        if (data.mvp_category && data.mvp_category.name) {
          lines.push("");
          lines.push("MVP Category: " + data.mvp_category.name + " (" + data.mvp_category.your_value + " vs " + data.mvp_category.opp_value + ")");
        }
        if (data.weakness && data.weakness.name) {
          lines.push("Weakness: " + data.weakness.name + " (" + data.weakness.your_value + " vs " + data.weakness.opp_value + ")");
        }
        if (data.standings_change && data.standings_change.direction !== "none") {
          lines.push("Standings: " + data.standings_change.from + " -> " + data.standings_change.to + " (" + data.standings_change.direction + ")");
        } else if (data.current_rank) {
          lines.push("Standings: #" + data.current_rank + " (unchanged)");
        }
        if (data.key_moves && data.key_moves.length > 0) {
          lines.push("");
          lines.push("Key Moves: " + data.key_moves.join(", "));
        }
        var ai_recommendation = generateWeeklyNarrativeInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "weekly-narrative", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
}
