import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, apiPost, toolError } from "../api/python-client.js";
import { header, actionList, issueList, waiverPairList, compactSection, pid, tkey } from "../api/format-text.js";
import {
  str,
  type MorningBriefingResponse,
  type MatchupDetailResponse,
  type MatchupStrategyResponse,
  type WhatsNewResponse,
  type LeagueLandscapeResponse,
  type SeasonPaceResponse,
  type TradeFinderResponse,
  type RosterHealthResponse,
  type WaiverRecommendationsResponse,
  type CategoryCheckResponse,
  type TradeAnalysisResponse,
  type InjuryReportResponse,
  type LineupOptimizeResponse,
  type GameDayManagerResponse,
  type WaiverDeadlinePrepResponse,
  type TradePipelineResponse,
  type WeeklyDigestResponse,
  type SeasonCheckpointResponse,
} from "../api/types.js";
import { SEASON_URI } from "./season-tools.js";
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export function registerWorkflowTools(server: McpServer, writesEnabled: boolean = false, enabledTools?: Set<string>) {
  const shouldRegister = (name: string) => _shouldRegister(enabledTools, name);

  // yahoo_morning_briefing
  if (shouldRegister("yahoo_morning_briefing")) {
  registerAppTool(
    server,
    "yahoo_morning_briefing",
    {
      description: "Use this as your first tool call of the day. Returns a complete situational report: injuries on your roster, today's lineup status, live matchup scores, category strategy, league activity, opponent moves, and top waiver targets — all in one call. Replaces calling 7+ individual tools. Best run daily before first pitch.",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: SEASON_URI } },
    },
    async () => {
      try {
        const data = await apiGet<MorningBriefingResponse>("/api/workflow/morning-briefing");

        const matchup: Partial<MatchupDetailResponse> = data.matchup || {};
        const strategy: Partial<MatchupStrategyResponse> = data.strategy || {};
        const whatsNew: Partial<WhatsNewResponse> = data.whats_new || {};
        const score = matchup.score || { wins: 0, losses: 0, ties: 0 };
        const strat = strategy.strategy || { target: [], protect: [], concede: [], lock: [] };

        const issueCount = (data.action_items || []).filter((a) => a.priority <= 2).length;
        const opCount = (data.action_items || []).filter((a) => a.priority === 3).length;

        const lines: string[] = [];
        lines.push(header("MORNING_BRIEFING", "Week " + str(matchup.week || "?") + " | " + issueCount + " issue(s) | " + opCount + " opportunity(s)"));

        // Live matchup
        lines.push("MATCHUP: vs " + str(matchup.opponent || "?") + " | " + score.wins + "-" + score.losses + "-" + score.ties);

        // Strategy summary
        if (strat.target.length > 0) lines.push("TARGET: " + strat.target.join(", "));
        if (strat.protect.length > 0) lines.push("PROTECT: " + strat.protect.join(", "));
        if (strat.concede.length > 0) lines.push("CONCEDE: " + strat.concede.join(", "));

        // Action items
        lines.push("");
        lines.push(actionList(data.action_items || []));

        // Opponent activity
        const oppTx = strategy.opp_transactions || [];
        if (oppTx.length > 0) {
          lines.push("");
          lines.push("OPPONENT MOVES: " + oppTx.map((t) => str(t.type) + " " + str(t.player)).join(", "));
        }

        // League activity digest
        const activity = (whatsNew.league_activity || []).slice(0, 3);
        if (activity.length > 0) {
          lines.push(compactSection("LEAGUE", activity.map((a) => str(a.type) + " " + str(a.player) + " -> " + str(a.team))));
        }

        // Prospect news alerts
        const newsAlerts = whatsNew.prospect_news_alerts;
        if (newsAlerts && newsAlerts.length > 0) {
          lines.push("");
          lines.push("PROSPECT NEWS:");
          for (const alert of newsAlerts) {
            const icon = alert.signal_type === "negative" ? "[-]" : alert.signal_type === "confirmed" || alert.signal_type === "imminent" ? "[!]" : "[+]";
            lines.push("  " + icon + " " + str(alert.player) + " — " + str(alert.description));
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "morning-briefing", ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_league_landscape
  if (shouldRegister("yahoo_league_landscape")) {
  registerAppTool(
    server,
    "yahoo_league_landscape",
    {
      description: "Use this for weekly strategic planning with a complete league intelligence report: standings, playoff projections, roster strength, active/dormant managers, this week's scoreboard, and trade opportunities. Returns data from multiple sources in one call.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<LeagueLandscapeResponse>("/api/workflow/league-landscape");

        const standings = data.standings?.standings || [];
        const pace: Partial<SeasonPaceResponse> = data.pace || {};
        const pulse = data.league_pulse?.teams || [];
        const tradeFinder: Partial<TradeFinderResponse> = data.trade_finder || {};
        const scoreboard = data.scoreboard?.matchups || [];

        // Find user's team in pace data
        const myTeam = (pace.teams || []).find((t) => t.is_my_team);

        const lines: string[] = [];

        // Header with your position
        if (myTeam) {
          lines.push(header("LEAGUE_LANDSCAPE", "You: " + myTeam.rank + getSuffix(myTeam.rank) + " | Playoff: " + str(myTeam.playoff_status) + " (magic# " + str(myTeam.magic_number) + ")"));
        } else {
          lines.push(header("LEAGUE_LANDSCAPE", "League overview"));
        }

        // Standings summary (top 5 + you)
        lines.push("STANDINGS:");
        for (const s of standings.slice(0, 5)) {
          const you = myTeam && str(s.name) === str(myTeam.name) ? " <-- YOU" : "";
          lines.push("  " + String(s.rank).padStart(2) + ". " + str(s.name).padEnd(28) + " " + s.wins + "-" + s.losses + you);
        }

        // Active vs dormant managers
        const active = pulse.filter((t) => t.total >= 5).slice(0, 3);
        const dormant = pulse.filter((t) => t.total <= 1);
        if (active.length > 0) {
          lines.push(compactSection("ACTIVE", active.map((t) => str(t.name) + " (" + t.total + " moves)")));
        }
        if (dormant.length > 0) {
          lines.push(compactSection("DORMANT", dormant.map((t) => str(t.name))));
        }

        // This week's scoreboard
        if (scoreboard.length > 0) {
          lines.push("THIS WEEK:");
          for (const m of scoreboard.slice(0, 5)) {
            lines.push("  " + str(m.team1).padEnd(20) + " vs " + str(m.team2).padEnd(20) + " " + str(m.status));
          }
        }

        // Trade opportunities
        const partners = (tradeFinder.partners || []).slice(0, 2);
        if (partners.length > 0) {
          lines.push("TRADE TARGETS:");
          for (const p of partners) {
            lines.push("  " + str(p.team_name) + tkey(p.team_key) + " — complementary: " + (p.complementary_categories || []).join(", "));
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_roster_health_check
  if (shouldRegister("yahoo_roster_health_check")) {
  registerAppTool(
    server,
    "yahoo_roster_health_check",
    {
      description: "Use this to audit your roster for problems: injured players in active slots, healthy players stuck on IL, bust candidates, and off-day starters. Returns issues ranked by severity (critical/warning/info) with concrete fix recommendations.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<RosterHealthResponse>("/api/workflow/roster-health");

        const critical = (data.issues || []).filter((i) => i.severity === "critical").length;
        const warning = (data.issues || []).filter((i) => i.severity === "warning").length;
        const info = (data.issues || []).filter((i) => i.severity === "info").length;

        const lines: string[] = [];
        lines.push(header("ROSTER_HEALTH", critical + " critical | " + warning + " warning | " + info + " info"));
        lines.push("");
        lines.push(issueList(data.issues || []));

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_waiver_recommendations
  if (shouldRegister("yahoo_waiver_recommendations")) {
  registerAppTool(
    server,
    "yahoo_waiver_recommendations",
    {
      description: "Use this when you want personalized add/drop pairs tailored to your team's weak categories. Returns ranked waiver pickup recommendations paired with suggested drops and projected category impact.",
      inputSchema: { count: z.number().describe("Number of recommendations per position type").default(5) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ count }) => {
      try {
        const data = await apiGet<WaiverRecommendationsResponse>("/api/workflow/waiver-recommendations", { count: String(count) });

        const catCheck: Partial<CategoryCheckResponse> = data.category_check || {};
        const weakest = catCheck.weakest || [];

        const lines: string[] = [];
        lines.push(header("WAIVER_RECOMMENDATIONS", (data.pairs || []).length + " options | weak: " + weakest.join(", ")));
        lines.push("");
        lines.push(waiverPairList(data.pairs || []));

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "waiver-analyze", ...data, ai_recommendation: (data as any).ai_recommendation },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_auto_lineup (write-gated)
  if (writesEnabled && shouldRegister("yahoo_auto_lineup")) {
  registerAppTool(
    server,
    "yahoo_auto_lineup",
    {
      description: "Use this to automatically optimize today's lineup and check for injuries in one step. Benches off-day players, starts active bench players, and flags injured starters needing manual IL moves. Safe for autonomous execution — idempotent, only moves players between active/bench slots.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: SEASON_URI } },
    },
    async () => {
      try {
        const [injury, lineup] = await Promise.all([
          apiGet<InjuryReportResponse>("/api/injury-report"),
          apiGet<LineupOptimizeResponse>("/api/lineup-optimize", { apply: "true" }),
        ]);

        const lines: string[] = [];
        lines.push(header("AUTO_LINEUP", lineup.applied ? "changes applied" : "preview only"));

        // Report injuries found
        if ((injury.injured_active || []).length > 0) {
          lines.push("INJURED IN LINEUP (" + injury.injured_active.length + "):");
          for (const p of injury.injured_active) {
            lines.push("  " + str(p.name) + " [" + str(p.status) + "] - needs manual IL move");
          }
        }

        // Report swaps made
        if ((lineup.suggested_swaps || []).length > 0) {
          lines.push("SWAPS " + (lineup.applied ? "APPLIED" : "SUGGESTED") + ":");
          for (const s of lineup.suggested_swaps) {
            lines.push("  Bench " + s.bench_player + " -> Start " + s.start_player + " (" + s.position + ")");
          }
        } else {
          lines.push("Lineup already optimal — no swaps needed.");
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  } // end writesEnabled

  // yahoo_trade_analysis
  if (shouldRegister("yahoo_trade_analysis")) {
  registerAppTool(
    server,
    "yahoo_trade_analysis",
    {
      description: "Use this when the user asks about a potential trade. Accepts player names (not IDs) and returns z-score comparison, surplus value analysis, category impact, Statcast profiles, and news context for all players involved. Returns structured data with ai_recommendation.",
      inputSchema: {
        give_names: z.array(z.string()).describe("Player names you would give up"),
        get_names: z.array(z.string()).describe("Player names you would receive"),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ give_names, get_names }) => {
      try {
        const data = await apiPost<TradeAnalysisResponse>("/api/workflow/trade-analysis", {
          give_names,
          get_names,
        });

        const lines: string[] = [];
        lines.push(header("TRADE_ANALYSIS", "Give " + give_names.join(", ") + " | Get " + get_names.join(", ")));

        // Player values
        lines.push("");
        const te = data.trade_eval;
        lines.push("GIVING:");
        for (const [i, p] of (data.give_players || []).entries()) {
          const total = Number(p.z_scores?.Final ?? 0);
          const playerId = data.give_ids?.[i] || "?";
          lines.push("  " + str(p.name).padEnd(25) + "  (id:" + playerId + ") z-total=" + total.toFixed(2));
          const tePlayer = (te && !("_error" in te)) ? (te.give_players || []).find((tp: any) => tp.name === p.name) : null;
          if (tePlayer?.context_line) lines.push("    " + tePlayer.context_line);
        }
        lines.push("GETTING:");
        for (const [i, p] of (data.get_players || []).entries()) {
          const total = Number(p.z_scores?.Final ?? 0);
          const playerId = data.get_ids?.[i] || "?";
          lines.push("  " + str(p.name).padEnd(25) + "  (id:" + playerId + ") z-total=" + total.toFixed(2));
          const tePlayer = (te && !("_error" in te)) ? (te.get_players || []).find((tp: any) => tp.name === p.name) : null;
          if (tePlayer?.context_line) lines.push("    " + tePlayer.context_line);
        }

        // Trade eval if available
        if (te && !("_error" in te)) {
          // Check for estimated z-scores
          const estimatedPlayers = [...(te.give_players || []), ...(te.get_players || [])]
            .filter((p) => (p as unknown as Record<string, unknown>).z_source === "estimated (ownership%)");
          lines.push("");
          lines.push("EVALUATION:");
          lines.push("  Give value: " + str(te.give_value) + " | Get value: " + str(te.get_value) + " | Net: " + str(te.net_value));
          lines.push("  Grade: " + str(te.grade));
          if (estimatedPlayers.length > 0) {
            lines.push("  NOTE: " + estimatedPlayers.map((p) => p.name).join(", ") + " z-score(s) estimated from ownership% (not in projections)");
          }
          // Surplus value breakdown
          if (te.adjusted_net_value !== undefined) {
            lines.push("  Adjusted Net: " + str(te.adjusted_net_value) + " (includes all premiums)");
          }
          if (te.roster_spot_adj && te.roster_spot_adj !== 0) {
            lines.push("    Roster spot adj: " + (te.roster_spot_adj > 0 ? "+" : "") + str(te.roster_spot_adj));
          }
          if (te.category_fit_bonus && te.category_fit_bonus !== 0) {
            lines.push("    Category fit: " + (te.category_fit_bonus > 0 ? "+" : "") + str(te.category_fit_bonus));
          }
          if (te.consolidation_premium && te.consolidation_premium !== 0) {
            lines.push("    Consolidation: " + (te.consolidation_premium > 0 ? "+" : "") + str(te.consolidation_premium));
          }
          if (te.catcher_premium && te.catcher_premium > 0) {
            lines.push("    Catcher premium: +" + str(te.catcher_premium));
          }
          const rivalWarn = te.rival_warning;
          if (rivalWarn && rivalWarn.is_rival) {
            lines.push("  WARNING: " + str(rivalWarn.warning));
          }
          // SGP standings impact
          if (te.sgp_give !== undefined || te.sgp_get !== undefined || te.sgp_net !== undefined) {
            lines.push("");
            lines.push("SGP (Standings Points):");
            lines.push("  Give: " + str(te.sgp_give) + " | Get: " + str(te.sgp_get) + " | Net: " + str(te.sgp_net));
          }
          // Their side evaluation
          const theirSide = te.their_side;
          if (theirSide) {
            lines.push("");
            lines.push("THEIR SIDE:");
            lines.push("  Grade: " + str(theirSide.grade) + " | Net: " + str(theirSide.adjusted_net_value));
            if (theirSide.weak_cats_filled && theirSide.weak_cats_filled.length > 0) {
              lines.push("  Fills their needs: " + theirSide.weak_cats_filled.join(", "));
            }
          }
          // Fairness + acceptance
          if (te.fairness) {
            lines.push("");
            lines.push("FAIRNESS: " + str(te.fairness) + " | ACCEPTANCE: " + str(te.acceptance_likelihood));
          }
          // Recommendation (driven by grade — the authoritative source from the backend)
          const grade = str(te.grade);
          let recommendation = "";
          if (grade.startsWith("A")) {
            recommendation = "ACCEPT — clear improvement";
          } else if (grade === "B+") {
            recommendation = "LEAN ACCEPT — moderate improvement";
          } else if (grade === "B" || grade === "C") {
            recommendation = "CLOSE — marginal difference";
          } else {
            recommendation = "REJECT — net loss of value";
          }
          if (te.acceptance_likelihood === "VERY_LOW") {
            recommendation += " — but opponent unlikely to accept";
          }
          // Injury advisory
          const allTePlayers = [...(te.give_players || []), ...(te.get_players || [])];
          for (const tp of allTePlayers) {
            if (tp.injury_severity) {
              lines.push("  ⚠️ " + tp.name + " is injured (" + tp.injury_severity + ") — factor into trade timing");
            }
          }
          lines.push("");
          lines.push("RECOMMENDATION: " + recommendation);
        }

        // Positional impact (Fix #6)
        const posImpact = data.positional_impact;
        if (posImpact && !("_error" in posImpact)) {
          lines.push("");
          lines.push("POSITIONAL IMPACT:");
          if ((posImpact.upgrades || []).length > 0) {
            for (const u of posImpact.upgrades) {
              lines.push("  UPGRADE " + str(u.position) + ": " + str(u.current) + " -> " + str(u.new));
            }
          }
          if ((posImpact.new_positions || []).length > 0) {
            for (const np of posImpact.new_positions) {
              lines.push("  NEW " + str(np.position) + ": " + str(np.player) + " (" + np.z_score + "z)");
            }
          }
          if ((posImpact.redundancies || []).length > 0) {
            for (const r of posImpact.redundancies) {
              lines.push("  BLOCKED " + str(r.position) + ": " + str(r.current) + " already better");
            }
          }
          if (posImpact.net_starting_impact) {
            lines.push("  >> " + posImpact.net_starting_impact);
          }
        }

        // Category impact (Fix #7)
        const catImpact = data.category_impact;
        if (catImpact && !("_error" in catImpact)) {
          const gained = catImpact.categories_gained || [];
          const lost = catImpact.categories_lost || [];
          if (gained.length > 0 || lost.length > 0) {
            lines.push("");
            lines.push("CATEGORY IMPACT:");
            if (gained.length > 0) lines.push("  Improves: " + gained.join(", "));
            if (lost.length > 0) lines.push("  Hurts: " + lost.join(", "));
          }
          const details = catImpact.details || [];
          if (details.length > 0) {
            for (const d of details) {
              const arrow = d.diff > 0 ? "+" : "";
              lines.push("  " + str(d.category).padEnd(12) + " give=" + d.give_z.toFixed(2) + " get=" + d.get_z.toFixed(2) + " net=" + arrow + d.diff.toFixed(2));
            }
          }
        }

        // Intel summary
        const intel = data.intel || {};
        const intelEntries = Object.entries(intel).filter(([, v]) => v != null);
        if (intelEntries.length > 0) {
          lines.push("");
          lines.push("INTEL:");
          for (const [name, report] of intelEntries) {
            if ("_error" in report) {
              lines.push("  " + str(name).padEnd(25) + " (intel unavailable: " + str((report as Record<string, string>)._error) + ")");
              continue;
            }
            const sc = (report as Record<string, any>).statcast || {};
            const trends = (report as Record<string, any>).trends || {};
            const ctx = (report as Record<string, any>).context || {};
            const disc = (report as Record<string, any>).discipline || {};
            const arsenal = (report as Record<string, any>).arsenal_changes || {};

            // Build a rich summary line
            const parts: string[] = [];

            // Batted ball quality
            const bb = sc.batted_ball || {};
            if (bb.barrel_tier) parts.push("barrel:" + bb.barrel_tier);
            if (bb.ev_tier) parts.push("EV:" + bb.ev_tier);

            // Expected stats
            const exp = sc.expected || {};
            if (exp.xwoba_tier) parts.push("xwOBA:" + exp.xwoba_tier + "(" + (exp.xwoba || "?") + ")");

            // Speed
            const spd = sc.speed || {};
            if (spd.speed_tier) parts.push("speed:" + spd.speed_tier);

            // Discipline
            if (disc.k_rate) parts.push("K%:" + (disc.k_rate * 100).toFixed(1));
            if (disc.bb_rate) parts.push("BB%:" + (disc.bb_rate * 100).toFixed(1));

            // Arsenal (pitchers)
            const pitches = arsenal.current || {};
            const pitchNames = Object.keys(pitches);
            if (pitchNames.length > 0) {
              const best = pitchNames.reduce((a, b) =>
                (pitches[a]?.whiff_rate || 0) > (pitches[b]?.whiff_rate || 0) ? a : b
              );
              const bestPitch = pitches[best];
              if (bestPitch) {
                parts.push("best-pitch:" + (bestPitch.pitch_name || best) + "(" + (bestPitch.whiff_rate || "?") + "% whiff)");
              }
            }

            // Trend
            if (trends.status && trends.status !== "neutral") {
              parts.push("trend:" + trends.status);
            }

            // Context/sentiment
            if (ctx.sentiment) parts.push("buzz:" + ctx.sentiment);

            if (parts.length > 0) {
              lines.push("  " + str(name));
              // Split into two lines if too long
              const line1 = parts.slice(0, 4).join(" | ");
              const line2 = parts.slice(4).join(" | ");
              lines.push("    " + line1);
              if (line2) lines.push("    " + line2);
            } else if (sc.note) {
              lines.push("  " + str(name).padEnd(25) + " (" + str(sc.note) + ")");
            }
          }
        }

        // News context warnings
        const newsCtx = data.news_context;
        if (newsCtx && Object.keys(newsCtx).length > 0) {
          const contextLines: string[] = [];
          for (const [name, ctx] of Object.entries(newsCtx)) {
            if (ctx.flags && ctx.flags.length > 0) {
              for (const flag of ctx.flags) {
                const prefix = flag.type === "DEALBREAKER" ? "!!!" : flag.type === "WARNING" ? "!!" : "i";
                contextLines.push("  [" + prefix + "] " + str(flag.message));
                if (flag.detail) contextLines.push("      " + str(flag.detail).substring(0, 80));
              }
            }
          }
          if (contextLines.length > 0) {
            lines.push("");
            lines.push("NEWS CONTEXT:");
            lines.push(...contextLines);
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "trade-eval", ...(te || {}), ai_recommendation: (data as any).ai_recommendation },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_game_day_manager
  if (shouldRegister("yahoo_game_day_manager")) {
  registerAppTool(
    server,
    "yahoo_game_day_manager",
    {
      description: "Use this before first pitch for a complete game-day pipeline: today's schedule, weather risks, injury check, lineup optimization, and streaming recommendation in one call. Catches late scratches and weather delays.",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: SEASON_URI } },
    },
    async () => {
      try {
        const data = await apiGet<GameDayManagerResponse>("/api/workflow/game-day-manager");

        const lines: string[] = [];
        lines.push(header("GAME_DAY_MANAGER", data.summary || "game-day check"));

        // Weather risks
        if ((data.weather_risks || []).length > 0) {
          lines.push("");
          lines.push("WEATHER RISKS:");
          for (const w of data.weather_risks) {
            lines.push("  " + str(w.game) + " — " + str(w.risk) + " (" + str(w.note) + ")");
          }
        }

        // Lineup changes
        if ((data.lineup_changes || []).length > 0) {
          lines.push("");
          lines.push("LINEUP SWAPS:");
          for (const s of data.lineup_changes) {
            lines.push("  Bench " + str(s.bench) + " -> Start " + str(s.start) + " (" + str(s.position) + ")");
          }
        } else {
          lines.push("Lineup already optimal — no swaps needed.");
        }

        // Streaming suggestion
        if (data.streaming_suggestion) {
          const ss = data.streaming_suggestion;
          lines.push("");
          lines.push("STREAMING: " + str(ss.name) + " (" + str(ss.team) + ", " + ss.games + " games, score=" + ss.score + ")");
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_waiver_deadline_prep
  if (shouldRegister("yahoo_waiver_deadline_prep")) {
  registerAppTool(
    server,
    "yahoo_waiver_deadline_prep",
    {
      description: "Use this before the waiver deadline to get a complete waiver analysis: your weak categories, ranked candidates with simulated category impact, roster issues, and FAAB bid recommendations for FAAB leagues.",
      inputSchema: { count: z.number().describe("Number of candidates per position type").default(5) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ count }) => {
      try {
        const data = await apiGet<WaiverDeadlinePrepResponse>("/api/workflow/waiver-deadline-prep", { count: String(count) });

        const lines: string[] = [];
        lines.push(header("WAIVER_DEADLINE_PREP", (data.ranked_claims || []).length + " candidates | weak: " + (data.weak_categories || []).join(", ")));

        // Roster issues
        if ((data.roster_issues || []).length > 0) {
          lines.push("");
          lines.push("ROSTER ISSUES:");
          for (const issue of data.roster_issues) {
            lines.push("  ! " + issue);
          }
        }

        // Ranked claims
        if ((data.ranked_claims || []).length > 0) {
          lines.push("");
          lines.push("RANKED CLAIMS:");
          for (const [i, claim] of (data.ranked_claims || []).entries()) {
            const label = claim.pos_type === "B" ? "BAT" : "PIT";
            const faabStr = claim.faab_bid != null ? "FAAB $" + claim.faab_bid + " | " : "";
            lines.push("  " + (i + 1) + ". [" + label + "] " + str(claim.player)
              + " (" + faabStr + str(claim.percent_owned) + "% owned"
              + " | net rank " + (claim.net_rank_improvement >= 0 ? "+" : "") + claim.net_rank_improvement + ")");
            if (claim.category_impact.length > 0) {
              lines.push("     impact: " + claim.category_impact.join(", "));
            }
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_trade_pipeline
  if (shouldRegister("yahoo_trade_pipeline")) {
  registerAppTool(
    server,
    "yahoo_trade_pipeline",
    {
      description: "Use this for end-to-end trade discovery: finds complementary trade partners, evaluates package values, simulates category impact, and grades each proposal with both sides' perspective. Returns ready-to-propose trade packages.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<TradePipelineResponse>("/api/workflow/trade-pipeline");

        const lines: string[] = [];
        lines.push(header("TRADE_PIPELINE", (data.partners || []).length + " partner(s) | weak: " + (data.weak_categories || []).join(", ")));

        for (const partner of data.partners || []) {
          lines.push("");
          lines.push("PARTNER: " + str(partner.team) + tkey(partner.team_key) + " — complementary: " + (partner.complementary_categories || []).join(", "));
          for (const [i, prop] of (partner.proposals || []).entries()) {
            lines.push("  " + (i + 1) + ". Give: " + prop.give.join(", ") + " (" + prop.give_value + "z)"
              + " -> Get: " + prop.get.join(", ") + " (" + prop.get_value + "z)"
              + " | Net: " + (prop.net_value >= 0 ? "+" : "") + prop.net_value + "z"
              + " | Grade: " + prop.grade
              + (prop.their_grade ? " (theirs: " + prop.their_grade + ")" : ""));
            if (prop.category_impact.length > 0) {
              lines.push("     impact: " + prop.category_impact.join(", "));
            }
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_weekly_digest
  if (shouldRegister("yahoo_weekly_digest")) {
  registerAppTool(
    server,
    "yahoo_weekly_digest",
    {
      description: "Use this at the end of the week for a structured summary: matchup result, standings position, transaction count, achievements earned, and a prose narrative. Best for weekly reporting and season tracking.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<WeeklyDigestResponse>("/api/workflow/weekly-digest");

        const lines: string[] = [];
        lines.push(header("WEEKLY_DIGEST", "Week " + str(data.week) + " vs " + str(data.opponent) + " | " + str(data.matchup_result)));

        lines.push("");
        lines.push(data.narrative || "");

        if (data.move_count > 0) {
          lines.push("Transactions: " + data.move_count);
        }

        if ((data.achievements_earned || []).length > 0) {
          lines.push("Achievements: " + data.achievements_earned.join(", "));
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_season_checkpoint
  if (shouldRegister("yahoo_season_checkpoint")) {
  registerAppTool(
    server,
    "yahoo_season_checkpoint",
    {
      description: "Use this monthly for a strategic season assessment: current rank, playoff probability, category trajectory (improving/declining categories), punt strategy, and trade recommendations. Tracks season-long progress at a high level.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<SeasonCheckpointResponse>("/api/workflow/season-checkpoint");

        const traj = data.category_trajectory || { improving: [], declining: [] };

        const lines: string[] = [];
        lines.push(header("SEASON_CHECKPOINT", data.summary || ""));

        lines.push("");
        lines.push("RANK: " + str(data.current_rank) + " | PLAYOFF: " + str(data.playoff_probability) + "%");

        if ((data.target_categories || []).length > 0) {
          lines.push("TARGET CATEGORIES: " + data.target_categories.join(", "));
        }
        if ((data.punt_categories || []).length > 0) {
          lines.push("PUNT CATEGORIES: " + data.punt_categories.join(", "));
        }

        if (traj.improving.length > 0) {
          lines.push("IMPROVING: " + traj.improving.join(", "));
        }
        if (traj.declining.length > 0) {
          lines.push("DECLINING: " + traj.declining.join(", "));
        }

        if ((data.trade_recommendations || []).length > 0) {
          lines.push("");
          lines.push("TRADE TARGETS:");
          for (const rec of data.trade_recommendations) {
            lines.push("  " + rec);
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }
}

function getSuffix(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  const mod10 = rank % 10;
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}
