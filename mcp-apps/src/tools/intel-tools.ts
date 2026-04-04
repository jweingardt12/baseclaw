import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { apiGet } from "../api/python-client.js";
import { READ_ANNO } from "../api/annotations.js";
import { defineTool } from "../api/define-tool.js";
import { APP_RESOURCE_DOMAINS } from "../api/csp.js";
import {
  str,
  type IntelPlayerReportResponse,
  type RedditBuzzResponse,
  type TrendingResponse,
  type ProspectWatchResponse,
  type IntelTransactionsResponse,
  type StatcastCompareResponse,
  type AggregatedNewsFeedResponse,
} from "../api/types.js";

export const INTEL_URI = "ui://baseclaw/intel.html";

export function registerIntelTools(server: McpServer, distDir: string, enabledTools?: Set<string>) {

  registerAppResource(
    server,
    "Intelligence Dashboard",
    INTEL_URI,
    { description: "Player intelligence: Statcast, trends, Reddit buzz, breakouts, prospects" },
    async () => ({
      contents: [{
        uri: INTEL_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await fs.readFile(path.join(distDir, "intel.html"), "utf-8"),
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

  var PCT_LABELS: Record<string, string> = { xwoba: "xwOBA", xba: "xBA", exit_velocity: "EV", barrel_pct: "Brl%", hard_hit_pct: "HH%", k_pct: "K%", bb_pct: "BB%", whiff_pct: "Whiff%", chase_rate: "Chase%", sprint_speed: "Speed" };

  // fantasy_player_report
  defineTool(server, "fantasy_player_report", {
    description: "Use this to get a deep-dive scouting report on a single player combining Statcast metrics, recent trends, plate discipline, and Reddit buzz. Returns exit velo, barrel rate, xwOBA percentiles, 14-day performance trends, and community sentiment.",
    inputSchema: { player_name: z.string().describe("Player name to look up") },
    annotations: READ_ANNO, _meta: {},
  }, async ({ player_name }) => {
    var data = await apiGet<IntelPlayerReportResponse>("/api/intel/player", { name: player_name as string });
    var lines = ["Player Intelligence: " + str(data.name)];
    if (data.statcast) {
      var sc = data.statcast;
      var expected = sc.expected || {};
      var bb = sc.batted_ball || {};
      var speed = sc.speed || {};
      lines.push("");
      var tier = expected.xwoba_tier || bb.ev_tier || sc.quality_tier || "unknown";
      lines.push("Statcast: " + tier.toUpperCase());
      if (sc.data_season && sc.data_season !== new Date().getFullYear()) {
        lines.push("  (Using " + sc.data_season + " data - preseason)");
      }
      var pa = (expected as any).pa;
      var era_a = (sc as any).era_analysis;
      var ip = era_a && era_a.ip;
      if (pa != null) lines.push("  Sample: " + pa + " PA" + (pa < 100 ? " (small sample - stats may be volatile)" : ""));
      else if (ip != null) lines.push("  Sample: " + ip + " IP" + (Number(ip) < 30 ? " (small sample - stats may be volatile)" : ""));
      if (expected.xwoba != null) lines.push("  xwOBA: " + expected.xwoba + " (" + (expected.xwoba_pct || "?") + "th pct)");
      if (bb.avg_exit_velo != null) lines.push("  Exit Velo: " + bb.avg_exit_velo + " (" + (bb.ev_pct || "?") + "th pct)");
      if (bb.barrel_pct_rank != null) lines.push("  Barrel Rate: " + bb.barrel_pct_rank + "th pct");
      if (bb.hard_hit_pct != null) lines.push("  Hard Hit: " + bb.hard_hit_pct + "% (" + (bb.hard_hit_pct_rank || "?") + "th pct)");
      if (speed.sprint_speed != null) lines.push("  Sprint: " + speed.sprint_speed + " (" + (speed.sprint_pct || "?") + "th pct)");
      if (sc.note) lines.push("  Note: " + sc.note);
    }
    if (data.trends) {
      var t = data.trends;
      lines.push("");
      lines.push("Trend: " + (t.status || t.hot_cold || "neutral").toUpperCase());
      if (t.last_14_days) {
        var d = t.last_14_days;
        lines.push("  14-Day: " + Object.entries(d).map(function ([k, v]) { return k + "=" + v; }).join(", "));
      }
    }
    if (data.context) {
      var c = data.context;
      if (c.reddit_mentions && c.reddit_mentions > 0) {
        lines.push("");
        lines.push("Reddit: " + c.reddit_mentions + " mentions (" + (c.reddit_sentiment || "neutral") + ")");
      }
    }
    if (data.discipline) {
      var disc = data.discipline;
      lines.push("");
      lines.push("Plate Discipline:");
      if (disc.bb_rate != null) lines.push("  BB%: " + disc.bb_rate);
      if (disc.k_rate != null) lines.push("  K%: " + disc.k_rate);
    }
    return { text: lines.join("\n") };
  }, enabledTools);

  // fantasy_reddit_buzz
  defineTool(server, "fantasy_reddit_buzz", {
    description: "Use this to see what r/fantasybaseball is talking about right now including hot posts, trending topics, and top discussions. Returns post titles, scores, comment counts, and flair tags.",
    annotations: READ_ANNO, _meta: {},
  }, async () => {
    var data = await apiGet<RedditBuzzResponse>("/api/intel/reddit");
    var lines = ["Reddit Fantasy Baseball Buzz:"];
    for (var p of (data.posts || [])) {
      var flair = p.flair ? "[" + p.flair + "] " : "";
      lines.push("  " + flair + p.title + " (score:" + p.score + ", comments:" + p.num_comments + ")");
    }
    return { text: lines.join("\n") };
  }, enabledTools);

  // fantasy_trending_players
  defineTool(server, "fantasy_trending_players", {
    description: "Use this to see which players have rising buzz on Reddit via high-engagement posts mentioning specific player names. Returns trending player discussion posts with scores and comment counts.",
    annotations: READ_ANNO, _meta: {},
  }, async () => {
    var data = await apiGet<TrendingResponse>("/api/intel/trending");
    var lines = ["Trending Players:"];
    for (var p of (data.posts || [])) {
      lines.push("  " + p.title + " (score:" + p.score + ", comments:" + p.num_comments + ")");
    }
    if ((data.posts || []).length === 0) lines.push("  No trending player posts found.");
    return { text: lines.join("\n") };
  }, enabledTools);

  // fantasy_prospect_watch
  defineTool(server, "fantasy_prospect_watch", {
    description: "Use this to see recent MLB prospect call-ups and roster moves that could impact fantasy leagues. Returns transaction types, player names, and team info for recent promotions and demotions.",
    annotations: READ_ANNO, _meta: {},
  }, async () => {
    var data = await apiGet<ProspectWatchResponse>("/api/intel/prospects");
    var lines = ["Prospect Watch - Recent Call-ups & Moves:"];
    for (var t of (data.transactions || [])) {
      lines.push("  " + str(t.type).padEnd(12) + " " + str(t.player).padEnd(25) + " " + str(t.team || ""));
    }
    if ((data.transactions || []).length === 0) lines.push("  No recent prospect moves found.");
    return { text: lines.join("\n") };
  }, enabledTools);

  // fantasy_transactions
  defineTool(server, "fantasy_transactions", {
    description: "Use this to see recent fantasy-relevant MLB transactions including IL stints, call-ups, DFAs, and trades. Pass the days parameter to control how far back to look (default 7 days).",
    inputSchema: { days: z.coerce.number().describe("Number of days to look back").default(7) },
    annotations: READ_ANNO, _meta: {},
  }, async ({ days }) => {
    var data = await apiGet<IntelTransactionsResponse>("/api/intel/transactions", { days: String(days) });
    var lines = ["MLB Transactions (last " + days + " days):"];
    for (var t of (data.transactions || [])) {
      lines.push("  " + str(t.type).padEnd(12) + " " + str(t.player).padEnd(25) + " " + str(t.team || "") + (t.description ? " - " + t.description : ""));
    }
    if ((data.transactions || []).length === 0) lines.push("  No transactions found.");
    return { text: lines.join("\n") };
  }, enabledTools);

  // yahoo_statcast_history
  defineTool(server, "yahoo_statcast_history", {
    description: "Use this to compare a player's Statcast profile now versus 30 or 60 days ago to track changes in exit velo, barrel rate, xwOBA, sprint speed, and more over time. Returns a side-by-side comparison with delta values and directional arrows.",
    inputSchema: {
      player_name: z.string().describe("Player name to look up"),
      days_ago: z.coerce.number().describe("How many days back to compare (30 or 60)").default(30),
    },
    annotations: READ_ANNO, _meta: {},
  }, async ({ player_name, days_ago }) => {
    var data = await apiGet<StatcastCompareResponse>("/api/intel/statcast-history", { name: player_name as string, days: String(days_ago) });
    var lines = ["Statcast History: " + str(data.name)];
    lines.push("Current (" + str(data.current_date || "today") + ") vs " + str(data.days) + " days ago (" + str(data.historical_date || "N/A") + ")");
    lines.push("");
    lines.push("  " + "Metric".padEnd(18) + "Current".padStart(10) + "Historical".padStart(12) + "Delta".padStart(10));
    lines.push("  " + "-".repeat(50));
    var comparisons = data.comparisons || [];
    for (var i = 0; i < comparisons.length; i++) {
      var comp = comparisons[i];
      var currStr = comp.current != null ? String(comp.current) : "N/A";
      var histStr = comp.historical != null ? String(comp.historical) : "N/A";
      var deltaStr = "";
      if (comp.delta != null) {
        var arrow = "";
        if (comp.direction === "up") { arrow = "^"; }
        else if (comp.direction === "down") { arrow = "v"; }
        deltaStr = arrow + String(comp.delta);
      }
      lines.push("  " + str(comp.metric).padEnd(18) + currStr.padStart(10) + histStr.padStart(12) + deltaStr.padStart(10));
    }
    if (comparisons.length === 0) {
      lines.push("  No comparison data available yet.");
    }
    if (data.note) {
      lines.push("");
      lines.push("Note: " + data.note);
    }
    return { text: lines.join("\n") };
  }, enabledTools);

  // fantasy_news_feed
  defineTool(server, "fantasy_news_feed", {
    description: "Use this to get a real-time fantasy baseball news feed aggregated from 16 sources including ESPN, FanGraphs, CBS, Yahoo, MLB.com, RotoWire, Pitcher List, Razzball, Google News, RotoBaller, Reddit, and Bluesky analyst feeds. Filter by source or search by player name.",
    inputSchema: {
      sources: z.string().optional().describe("Comma-separated source IDs to filter (e.g. 'espn,fangraphs,rotowire,reddit,bsky_pitcherlist'). Omit for all sources."),
      player: z.string().optional().describe("Player name to filter news for"),
      limit: z.coerce.number().optional().describe("Max entries to return (default 30)"),
    },
    annotations: READ_ANNO, _meta: {},
  }, async ({ sources, player, limit }) => {
    var params: Record<string, string> = {};
    if (sources) params.sources = sources as string;
    if (player) params.player = player as string;
    if (limit) params.limit = String(limit);
    var data = await apiGet<AggregatedNewsFeedResponse>("/api/news/feed", params);
    var lines = ["Fantasy Baseball News (" + (data.count || 0) + " items from " + (data.sources || []).join(", ") + "):"];
    for (var e of (data.entries || [])) {
      var src = e.source ? "[" + e.source + "] " : "";
      var inj = e.injury_flag ? " [INJURY]" : "";
      var ts = e.timestamp ? " (" + e.timestamp + ")" : "";
      if (e.player) {
        lines.push("  " + src + e.player + ": " + str(e.headline) + inj + ts);
      } else {
        lines.push("  " + src + str(e.headline) + inj + ts);
      }
    }
    if ((data.entries || []).length === 0) lines.push("  No news found.");
    return { text: lines.join("\n") };
  }, enabledTools);

  // yahoo_player_intel
  defineTool(server, "yahoo_player_intel", {
    description: "Use this when you want the full qualitative picture on a player beyond just stats, combining recent news, injury severity, hot/cold streak, role changes, Reddit buzz, Statcast tier, and Yahoo ownership trends into one actionable briefing. Returns synthesized intelligence from 6+ sources with flags for dealbreakers and role changes.",
    inputSchema: { player: z.string().describe("Player name to research") },
    annotations: READ_ANNO,
    _meta: { ui: { resourceUri: INTEL_URI } },
  }, async ({ player }) => {
    var [data, yahooStats] = await Promise.all([
      apiGet<Record<string, unknown>>("/api/player-intel", { player: player as string }),
      apiGet<Record<string, unknown>>("/api/player-stats", { name: player as string }).catch(function () { return {} as Record<string, unknown>; }),
    ]);
    var lines: string[] = [];
    lines.push("Player Intel: " + str(data.player_name || player));

    if (data.status) {
      lines.push("Status: " + str(data.status) + (data.status_reason ? " — " + str(data.status_reason) : ""));
    }
    if (data.injury_severity) {
      var sev = str(data.injury_severity);
      var icon = sev === "MINOR" ? " 🟢" : sev === "MODERATE" ? " 🟡" : sev === "SEVERE" ? " 🔴" : "";
      lines.push("Injury: " + sev + icon);
    }

    var news = data.news_context as Record<string, unknown> | undefined;
    if (news) {
      var headlines = (news.headlines || []) as Array<Record<string, unknown>>;
      if (headlines.length > 0) {
        lines.push("");
        lines.push("NEWS (" + headlines.length + " headlines):");
        for (var h of headlines.slice(0, 5)) {
          var line = "  • " + str(h.title);
          if (h.source || h.date) {
            line += " (" + [h.source, h.date].filter(Boolean).join(", ") + ")";
          }
          lines.push(line);
        }
      }
      var flags = (news.flags || []) as Array<Record<string, unknown>>;
      if (flags.length > 0) {
        lines.push("");
        lines.push("FLAGS:");
        for (var f of flags) {
          lines.push("  ⚠️ " + str(f.type) + ": " + str(f.message));
        }
      }
      var txns = (news.transactions || []) as Array<Record<string, unknown>>;
      if (txns.length > 0) {
        lines.push("");
        lines.push("TRANSACTIONS:");
        for (var tx of txns.slice(0, 3)) {
          lines.push("  • " + str(tx.description));
        }
      }
      var reddit = news.reddit as Record<string, unknown> | undefined;
      if (reddit && (reddit.mentions as number) > 0) {
        lines.push("");
        lines.push("REDDIT: " + str(reddit.mentions) + " mentions, sentiment: " + str(reddit.sentiment));
        if (reddit.summary) lines.push("  " + str(reddit.summary));
      }
    }

    var sc = data.statcast as Record<string, unknown> | undefined;
    if (sc && sc.quality_tier) {
      lines.push("");
      var parts = [str(sc.quality_tier)];
      if (sc.xwoba !== undefined) parts.push("xwOBA: " + str(sc.xwoba));
      if (sc.barrel_pct !== undefined) parts.push("Barrel%: " + str(sc.barrel_pct));
      if (sc.k_pct !== undefined) parts.push("K%: " + str(sc.k_pct));
      if (sc.bb_pct !== undefined) parts.push("BB%: " + str(sc.bb_pct));
      lines.push("STATCAST: " + parts.join(" | "));
    }

    var pctData = data.percentiles as Record<string, unknown> | undefined;
    var pctMetrics = pctData ? pctData.metrics as Record<string, number> | undefined : undefined;
    if (pctMetrics && Object.keys(pctMetrics).length > 0) {
      var pctParts: string[] = [];
      for (var [pk, pv] of Object.entries(pctMetrics)) {
        if (pv != null) pctParts.push((PCT_LABELS[pk] || pk) + " " + Math.round(pv) + "th");
      }
      if (pctParts.length > 0) {
        lines.push("");
        lines.push("LEAGUE RANKINGS (percentile): " + pctParts.join(" | "));
      }
    }

    var trends = data.trends as Record<string, unknown> | undefined;
    if (trends && trends.status) {
      var tParts = [str(trends.status)];
      if (trends.avg_14d !== undefined) tParts.push("14d AVG: " + str(trends.avg_14d));
      if (trends.ops_14d !== undefined) tParts.push("14d OPS: " + str(trends.ops_14d));
      if (trends.era_14d !== undefined) tParts.push("14d ERA: " + str(trends.era_14d));
      lines.push("");
      lines.push("TRENDS: " + tParts.join(" | "));
    }

    var yt = data.yahoo_trend as Record<string, unknown> | undefined;
    if (yt && yt.direction) {
      lines.push("");
      var ytLine = "YAHOO TREND: " + str(yt.direction);
      if (yt.rank !== undefined) ytLine += " | rank #" + str(yt.rank);
      if (yt.delta !== undefined) ytLine += " (delta: " + str(yt.delta) + ")";
      lines.push(ytLine);
    }

    var discData = data.discipline as Record<string, unknown> | undefined;
    if (discData && !discData.error && !discData.note) {
      var discParts: string[] = [];
      if (discData.bb_rate != null) discParts.push("BB% " + str(discData.bb_rate));
      if (discData.k_rate != null) discParts.push("K% " + str(discData.k_rate));
      if (discData.o_swing_pct != null) discParts.push("O-Swing% " + str(discData.o_swing_pct));
      if (discData.z_contact_pct != null) discParts.push("Z-Contact% " + str(discData.z_contact_pct));
      if (discData.swstr_pct != null) discParts.push("SwStr% " + str(discData.swstr_pct));
      if (discParts.length > 0) {
        lines.push("");
        lines.push("DISCIPLINE: " + discParts.join(" | "));
      }
    }

    var rc = data.role_change as Record<string, unknown> | undefined;
    if (rc) {
      lines.push("");
      if (rc.role_changed) {
        lines.push("ROLE CHANGE: " + str(rc.change_type) + " — " + str(rc.description));
      } else {
        lines.push("ROLE: No change detected");
      }
    }

    var ys = (yahooStats.stats || {}) as Record<string, unknown>;
    if (Object.keys(ys).length > 0) {
      lines.push("");
      lines.push("SEASON STATS:");
      var statParts: string[] = [];
      for (var [k, v] of Object.entries(ys)) {
        if (v != null && v !== 0 && v !== "0" && v !== "-" && v !== "" && k !== "H/AB") {
          statParts.push(k + ": " + str(v));
        }
      }
      lines.push("  " + statParts.join(" | "));
    }

    return {
      text: lines.join("\n"),
      structured: {
        type: "intel-player",
        name: data.player || player,
        mlb_id: yahooStats.mlb_id || data.mlb_id,
        yahoo_stats: yahooStats.stats || {},
        yahoo_player_id: yahooStats.player_id,
        ...data,
      },
    };
  }, enabledTools);

  // fantasy_statcast_leaders
  defineTool(server, "fantasy_statcast_leaders", {
    description: "Use this to see MLB leaderboards for Statcast advanced metrics. Metrics: exit_velocity, max_exit_velocity, barrel_pct, hard_hit_pct, xwoba, xba, xslg, sprint_speed, bat_speed, swing_length, squared_up_rate, blast_pct, launch_angle. Set player_type to 'pitcher' for pitching metrics.",
    inputSchema: {
      metric: z.string().describe("Metric to rank by (e.g. exit_velocity, xwoba, barrel_pct, sprint_speed, bat_speed)"),
      player_type: z.string().describe("batter or pitcher").default("batter"),
      count: z.coerce.number().describe("Number of leaders to return").default(20),
    },
    annotations: READ_ANNO, _meta: {},
  }, async ({ metric, player_type, count }) => {
    var data = await apiGet<any>("/api/intel/statcast-leaders", { metric: metric as string, player_type: player_type as string, count: String(count) });
    if (data.error) return { text: "Error: " + data.error };
    var leaders = data.leaders || [];
    var lines = [data.label + " Leaders (" + data.data_season + " " + data.player_type + "s, " + leaders.length + " shown):"];
    lines.push("  " + "#".padStart(3) + "  " + "Player".padEnd(25) + "Team".padEnd(6) + "Value".padStart(8));
    lines.push("  " + "-".repeat(45));
    for (var l of leaders) {
      var valStr = typeof l.value === "number" ? (l.value % 1 === 0 ? String(l.value) : l.value.toFixed(3)) : String(l.value);
      lines.push("  " + String(l.rank).padStart(3) + ". " + str(l.name).padEnd(25) + str(l.team).padEnd(6) + valStr.padStart(8));
    }
    return { text: lines.join("\n") };
  }, enabledTools);

  // fantasy_bat_tracking_breakouts
  defineTool(server, "fantasy_bat_tracking_breakouts", {
    description: "Use this to find hitters with improving bat speed, swing quality, and power metrics from Baseball Savant bat tracking data. Detects bat speed gains, fast-swing rate improvements, and squared-up rate increases that predict power breakouts weeks before traditional stats reflect it. Cross-references with z-scores to find low-owned breakout candidates.",
    inputSchema: { count: z.coerce.number().describe("Number of results to return").default(20) },
    annotations: READ_ANNO, _meta: {},
  }, async ({ count }) => {
    var data = await apiGet<any>("/api/intel/bat-tracking-breakouts", { count: String(count) });
    if (data.error) return { text: "Error: " + data.error };
    var breakouts = data.breakouts || [];
    var lines = ["Bat Tracking Breakouts (" + breakouts.length + " found, " + (data.total_hitters_scanned || 0) + " scanned)"];
    lines.push("  " + "#".padStart(3) + " " + "Name".padEnd(22) + "Score".padStart(6) + "  Z".padStart(6) + "  Signals");
    lines.push("  " + "-".repeat(60));
    for (var i = 0; i < breakouts.length; i++) {
      var b = breakouts[i];
      var signals = (b.signals || []).map(function (s: any) { return str(s.metric) + " " + str(s.detail); }).join("; ");
      lines.push("  " + String(i + 1).padStart(3) + " " + str(b.name).padEnd(22) + (b.breakout_score || 0).toFixed(1).padStart(6) + (b.z_score != null ? b.z_score.toFixed(1) : "n/a").padStart(6) + "  " + signals);
    }
    return { text: lines.join("\n") };
  }, enabledTools);

  // fantasy_pitch_mix_breakouts
  defineTool(server, "fantasy_pitch_mix_breakouts", {
    description: "Use this to find pitchers making significant pitch arsenal changes that signal breakouts. Detects usage shifts >= 10%, velocity changes >= 1.5 mph, and new pitches added. Cross-references with effectiveness metrics (whiff rate, run value) and z-scores to rank by breakout signal strength. Surfaces candidates like Nick Lodolo's 2025 breakout weeks before stats catch up.",
    inputSchema: { count: z.coerce.number().describe("Number of results to return").default(20) },
    annotations: READ_ANNO, _meta: {},
  }, async ({ count }) => {
    var data = await apiGet<any>("/api/intel/pitch-mix-breakouts", { count: String(count) });
    if (data.error) return { text: "Error: " + data.error };
    var breakouts = data.breakouts || [];
    var lines = ["Pitch Mix Breakouts (" + breakouts.length + " found, " + (data.total_pitchers_scanned || 0) + " scanned)"];
    lines.push("  " + "#".padStart(3) + " " + "Name".padEnd(22) + "Score".padStart(6) + "  Z".padStart(6) + "  Changes");
    lines.push("  " + "-".repeat(65));
    for (var i = 0; i < breakouts.length; i++) {
      var b = breakouts[i];
      var changes = (b.changes || []).map(function (c: any) { return str(c.pitch_name || c.pitch_type) + ": " + str(c.detail); }).join("; ");
      lines.push("  " + String(i + 1).padStart(3) + " " + str(b.name).padEnd(22) + (b.signal_score || 0).toFixed(1).padStart(6) + (b.z_score != null ? b.z_score.toFixed(1) : "n/a").padStart(6) + "  " + changes);
    }
    return { text: lines.join("\n") };
  }, enabledTools);
}
