import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { apiGet, toolError } from "../api/python-client.js";
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
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export const INTEL_URI = "ui://baseclaw/intel.html";

export function registerIntelTools(server: McpServer, distDir: string, enabledTools?: Set<string>) {
  const shouldRegister = (name: string) => _shouldRegister(enabledTools, name);

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

  // fantasy_player_report
  if (shouldRegister("fantasy_player_report")) {
  registerAppTool(
    server,
    "fantasy_player_report",
    {
      description: "Use this to get a deep-dive scouting report on a single player combining Statcast metrics, recent trends, plate discipline, and Reddit buzz. Returns exit velo, barrel rate, xwOBA percentiles, 14-day performance trends, and community sentiment.",
      inputSchema: { player_name: z.string().describe("Player name to look up") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name }) => {
      try {
        const data = await apiGet<IntelPlayerReportResponse>("/api/intel/player", { name: player_name });
        const lines = ["Player Intelligence: " + str(data.name)];
        if (data.statcast) {
          const sc = data.statcast;
          const expected = sc.expected || {};
          const bb = sc.batted_ball || {};
          const speed = sc.speed || {};
          lines.push("");
          const tier = expected.xwoba_tier || bb.ev_tier || sc.quality_tier || "unknown";
          lines.push("Statcast: " + tier.toUpperCase());
          if (sc.data_season && sc.data_season !== new Date().getFullYear()) {
            lines.push("  (Using " + sc.data_season + " data - preseason)");
          }
          if (expected.xwoba != null) lines.push("  xwOBA: " + expected.xwoba + " (" + (expected.xwoba_pct || "?") + "th pct)");
          if (bb.avg_exit_velo != null) lines.push("  Exit Velo: " + bb.avg_exit_velo + " (" + (bb.ev_pct || "?") + "th pct)");
          if (bb.barrel_pct_rank != null) lines.push("  Barrel Rate: " + bb.barrel_pct_rank + "th pct");
          if (bb.hard_hit_pct != null) lines.push("  Hard Hit: " + bb.hard_hit_pct + "% (" + (bb.hard_hit_pct_rank || "?") + "th pct)");
          if (speed.sprint_speed != null) lines.push("  Sprint: " + speed.sprint_speed + " (" + (speed.sprint_pct || "?") + "th pct)");
          if (sc.note) lines.push("  Note: " + sc.note);
        }
        if (data.trends) {
          const t = data.trends;
          lines.push("");
          lines.push("Trend: " + (t.status || t.hot_cold || "neutral").toUpperCase());
          if (t.last_14_days) {
            const d = t.last_14_days;
            lines.push("  14-Day: " + Object.entries(d).map(function([k,v]) { return k + "=" + v; }).join(", "));
          }
        }
        if (data.context) {
          const c = data.context;
          if (c.reddit_mentions && c.reddit_mentions > 0) {
            lines.push("");
            lines.push("Reddit: " + c.reddit_mentions + " mentions (" + (c.reddit_sentiment || "neutral") + ")");
          }
        }
        if (data.discipline) {
          const d = data.discipline;
          lines.push("");
          lines.push("Plate Discipline:");
          if (d.bb_rate != null) lines.push("  BB%: " + d.bb_rate);
          if (d.k_rate != null) lines.push("  K%: " + d.k_rate);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // fantasy_breakout_candidates
  // fantasy_reddit_buzz
  if (shouldRegister("fantasy_reddit_buzz")) {
  registerAppTool(
    server,
    "fantasy_reddit_buzz",
    {
      description: "Use this to see what r/fantasybaseball is talking about right now including hot posts, trending topics, and top discussions. Returns post titles, scores, comment counts, and flair tags.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<RedditBuzzResponse>("/api/intel/reddit");
        const lines = ["Reddit Fantasy Baseball Buzz:"];
        for (const p of (data.posts || [])) {
          const flair = p.flair ? "[" + p.flair + "] " : "";
          lines.push("  " + flair + p.title + " (score:" + p.score + ", comments:" + p.num_comments + ")");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // fantasy_trending_players
  if (shouldRegister("fantasy_trending_players")) {
  registerAppTool(
    server,
    "fantasy_trending_players",
    {
      description: "Use this to see which players have rising buzz on Reddit via high-engagement posts mentioning specific player names. Returns trending player discussion posts with scores and comment counts.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<TrendingResponse>("/api/intel/trending");
        const lines = ["Trending Players:"];
        for (const p of (data.posts || [])) {
          lines.push("  " + p.title + " (score:" + p.score + ", comments:" + p.num_comments + ")");
        }
        if ((data.posts || []).length === 0) lines.push("  No trending player posts found.");
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // fantasy_prospect_watch
  if (shouldRegister("fantasy_prospect_watch")) {
  registerAppTool(
    server,
    "fantasy_prospect_watch",
    {
      description: "Use this to see recent MLB prospect call-ups and roster moves that could impact fantasy leagues. Returns transaction types, player names, and team info for recent promotions and demotions.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<ProspectWatchResponse>("/api/intel/prospects");
        const lines = ["Prospect Watch - Recent Call-ups & Moves:"];
        for (const t of (data.transactions || [])) {
          lines.push("  " + str(t.type).padEnd(12) + " " + str(t.player).padEnd(25) + " " + str(t.team || ""));
        }
        if ((data.transactions || []).length === 0) lines.push("  No recent prospect moves found.");
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // fantasy_transactions
  if (shouldRegister("fantasy_transactions")) {
  registerAppTool(
    server,
    "fantasy_transactions",
    {
      description: "Use this to see recent fantasy-relevant MLB transactions including IL stints, call-ups, DFAs, and trades. Pass the days parameter to control how far back to look (default 7 days).",
      inputSchema: { days: z.number().describe("Number of days to look back").default(7) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ days }) => {
      try {
        const data = await apiGet<IntelTransactionsResponse>("/api/intel/transactions", { days: String(days) });
        const lines = ["MLB Transactions (last " + days + " days):"];
        for (const t of (data.transactions || [])) {
          lines.push("  " + str(t.type).padEnd(12) + " " + str(t.player).padEnd(25) + " " + str(t.team || "") + (t.description ? " - " + t.description : ""));
        }
        if ((data.transactions || []).length === 0) lines.push("  No transactions found.");
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_statcast_history
  if (shouldRegister("yahoo_statcast_history")) {
  registerAppTool(
    server,
    "yahoo_statcast_history",
    {
      description: "Use this to compare a player's Statcast profile now versus 30 or 60 days ago to track changes in exit velo, barrel rate, xwOBA, sprint speed, and more over time. Returns a side-by-side comparison with delta values and directional arrows.",
      inputSchema: {
        player_name: z.string().describe("Player name to look up"),
        days_ago: z.number().describe("How many days back to compare (30 or 60)").default(30),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name, days_ago }) => {
      try {
        var data = await apiGet<StatcastCompareResponse>("/api/intel/statcast-history", { name: player_name, days: String(days_ago) });
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
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // fantasy_news_feed
  if (shouldRegister("fantasy_news_feed")) {
  registerAppTool(
    server,
    "fantasy_news_feed",
    {
      description: "Use this to get a real-time fantasy baseball news feed aggregated from 16 sources including ESPN, FanGraphs, CBS, Yahoo, MLB.com, RotoWire, Pitcher List, Razzball, Google News, RotoBaller, Reddit, and Bluesky analyst feeds. Filter by source or search by player name.",
      inputSchema: {
        sources: z.string().optional().describe("Comma-separated source IDs to filter (e.g. 'espn,fangraphs,rotowire,reddit,bsky_pitcherlist'). Omit for all sources."),
        player: z.string().optional().describe("Player name to filter news for"),
        limit: z.number().optional().describe("Max entries to return (default 30)"),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ sources, player, limit }) => {
      try {
        const params: Record<string, string> = {};
        if (sources) params.sources = sources;
        if (player) params.player = player;
        if (limit) params.limit = String(limit);
        const data = await apiGet<AggregatedNewsFeedResponse>("/api/news/feed", params);
        const lines = ["Fantasy Baseball News (" + (data.count || 0) + " items from " + (data.sources || []).join(", ") + "):"];
        for (const e of (data.entries || [])) {
          const src = e.source ? "[" + e.source + "] " : "";
          const inj = e.injury_flag ? " [INJURY]" : "";
          const ts = e.timestamp ? " (" + e.timestamp + ")" : "";
          if (e.player) {
            lines.push("  " + src + e.player + ": " + str(e.headline) + inj + ts);
          } else {
            lines.push("  " + src + str(e.headline) + inj + ts);
          }
        }
        if ((data.entries || []).length === 0) lines.push("  No news found.");
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_player_intel
  if (shouldRegister("yahoo_player_intel")) {
  registerAppTool(
    server,
    "yahoo_player_intel",
    {
      description: "Use this when you want the full qualitative picture on a player beyond just stats, combining recent news, injury severity, hot/cold streak, role changes, Reddit buzz, Statcast tier, and Yahoo ownership trends into one actionable briefing. Returns synthesized intelligence from 6+ sources with flags for dealbreakers and role changes.",
      inputSchema: { player: z.string().describe("Player name to research") },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: INTEL_URI } },
    },
    async ({ player }) => {
      try {
        // Fetch intel + Yahoo season stats in parallel
        const [data, yahooStats] = await Promise.all([
          apiGet<Record<string, unknown>>("/api/player-intel", { player }),
          apiGet<Record<string, unknown>>("/api/player-stats", { name: player }).catch(() => ({} as Record<string, unknown>)),
        ]);
        const lines: string[] = [];
        lines.push("Player Intel: " + str(data.player_name || player));

        // Status + injury
        if (data.status) {
          lines.push("Status: " + str(data.status) + (data.status_reason ? " — " + str(data.status_reason) : ""));
        }
        if (data.injury_severity) {
          const sev = str(data.injury_severity);
          const icon = sev === "MINOR" ? " 🟢" : sev === "MODERATE" ? " 🟡" : sev === "SEVERE" ? " 🔴" : "";
          lines.push("Injury: " + sev + icon);
        }

        // News context
        const news = data.news_context as Record<string, unknown> | undefined;
        if (news) {
          const headlines = (news.headlines || []) as Array<Record<string, unknown>>;
          if (headlines.length > 0) {
            lines.push("");
            lines.push("NEWS (" + headlines.length + " headlines):");
            for (const h of headlines.slice(0, 5)) {
              let line = "  • " + str(h.title);
              if (h.source || h.date) {
                line += " (" + [h.source, h.date].filter(Boolean).join(", ") + ")";
              }
              lines.push(line);
            }
          }
          const flags = (news.flags || []) as Array<Record<string, unknown>>;
          if (flags.length > 0) {
            lines.push("");
            lines.push("FLAGS:");
            for (const f of flags) {
              lines.push("  ⚠️ " + str(f.type) + ": " + str(f.message));
            }
          }
          const txns = (news.transactions || []) as Array<Record<string, unknown>>;
          if (txns.length > 0) {
            lines.push("");
            lines.push("TRANSACTIONS:");
            for (const t of txns.slice(0, 3)) {
              lines.push("  • " + str(t.description));
            }
          }
          const reddit = news.reddit as Record<string, unknown> | undefined;
          if (reddit && (reddit.mentions as number) > 0) {
            lines.push("");
            lines.push("REDDIT: " + str(reddit.mentions) + " mentions, sentiment: " + str(reddit.sentiment));
            if (reddit.summary) lines.push("  " + str(reddit.summary));
          }
        }

        // Statcast
        const sc = data.statcast as Record<string, unknown> | undefined;
        if (sc && sc.quality_tier) {
          lines.push("");
          const parts = [str(sc.quality_tier)];
          if (sc.xwoba !== undefined) parts.push("xwOBA: " + str(sc.xwoba));
          if (sc.barrel_pct !== undefined) parts.push("Barrel%: " + str(sc.barrel_pct));
          if (sc.k_pct !== undefined) parts.push("K%: " + str(sc.k_pct));
          if (sc.bb_pct !== undefined) parts.push("BB%: " + str(sc.bb_pct));
          lines.push("STATCAST: " + parts.join(" | "));
        }

        // Trends
        const trends = data.trends as Record<string, unknown> | undefined;
        if (trends && trends.status) {
          const parts = [str(trends.status)];
          if (trends.avg_14d !== undefined) parts.push("14d AVG: " + str(trends.avg_14d));
          if (trends.ops_14d !== undefined) parts.push("14d OPS: " + str(trends.ops_14d));
          if (trends.era_14d !== undefined) parts.push("14d ERA: " + str(trends.era_14d));
          lines.push("");
          lines.push("TRENDS: " + parts.join(" | "));
        }

        // Yahoo trend
        const yt = data.yahoo_trend as Record<string, unknown> | undefined;
        if (yt && yt.direction) {
          lines.push("");
          let ytLine = "YAHOO TREND: " + str(yt.direction);
          if (yt.rank !== undefined) ytLine += " | rank #" + str(yt.rank);
          if (yt.delta !== undefined) ytLine += " (delta: " + str(yt.delta) + ")";
          lines.push(ytLine);
        }

        // Role change
        const rc = data.role_change as Record<string, unknown> | undefined;
        if (rc) {
          lines.push("");
          if (rc.role_changed) {
            lines.push("ROLE CHANGE: " + str(rc.change_type) + " — " + str(rc.description));
          } else {
            lines.push("ROLE: No change detected");
          }
        }

        // Add season stats to text
        const ys = (yahooStats.stats || {}) as Record<string, unknown>;
        if (Object.keys(ys).length > 0) {
          lines.push("");
          lines.push("SEASON STATS:");
          const statParts: string[] = [];
          for (const [k, v] of Object.entries(ys)) {
            if (v != null && v !== 0 && v !== "0" && v !== "-" && v !== "" && k !== "H/AB") {
              statParts.push(k + ": " + str(v));
            }
          }
          lines.push("  " + statParts.join(" | "));
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: {
            type: "intel-player",
            name: data.player || player,
            mlb_id: yahooStats.mlb_id || data.mlb_id,
            yahoo_stats: yahooStats.stats || {},
            yahoo_player_id: yahooStats.player_id,
            ...data,
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // fantasy_bat_tracking_breakouts
  if (shouldRegister("fantasy_bat_tracking_breakouts")) {
  registerAppTool(
    server,
    "fantasy_bat_tracking_breakouts",
    {
      description: "Use this to find hitters with improving bat speed, swing quality, and power metrics from Baseball Savant bat tracking data. Detects bat speed gains, fast-swing rate improvements, and squared-up rate increases that predict power breakouts weeks before traditional stats reflect it. Cross-references with z-scores to find low-owned breakout candidates.",
      inputSchema: { count: z.number().describe("Number of results to return").default(20) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ count }) => {
      try {
        const data = await apiGet<any>("/api/intel/bat-tracking-breakouts", { count: String(count) });
        if (data.error) return { content: [{ type: "text" as const, text: "Error: " + data.error }] };
        const breakouts = data.breakouts || [];
        const lines = ["Bat Tracking Breakouts (" + breakouts.length + " found, " + (data.total_hitters_scanned || 0) + " scanned)"];
        lines.push("  " + "#".padStart(3) + " " + "Name".padEnd(22) + "Score".padStart(6) + "  Z".padStart(6) + "  Signals");
        lines.push("  " + "-".repeat(60));
        for (var i = 0; i < breakouts.length; i++) {
          const b = breakouts[i];
          const signals = (b.signals || []).map(function(s: any) { return str(s.metric) + " " + str(s.detail); }).join("; ");
          lines.push("  " + String(i + 1).padStart(3) + " " + str(b.name).padEnd(22) + (b.breakout_score || 0).toFixed(1).padStart(6) + (b.z_score != null ? b.z_score.toFixed(1) : "n/a").padStart(6) + "  " + signals);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // fantasy_pitch_mix_breakouts
  if (shouldRegister("fantasy_pitch_mix_breakouts")) {
  registerAppTool(
    server,
    "fantasy_pitch_mix_breakouts",
    {
      description: "Use this to find pitchers making significant pitch arsenal changes that signal breakouts. Detects usage shifts >= 10%, velocity changes >= 1.5 mph, and new pitches added. Cross-references with effectiveness metrics (whiff rate, run value) and z-scores to rank by breakout signal strength. Surfaces candidates like Nick Lodolo's 2025 breakout weeks before stats catch up.",
      inputSchema: { count: z.number().describe("Number of results to return").default(20) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ count }) => {
      try {
        const data = await apiGet<any>("/api/intel/pitch-mix-breakouts", { count: String(count) });
        if (data.error) return { content: [{ type: "text" as const, text: "Error: " + data.error }] };
        const breakouts = data.breakouts || [];
        const lines = ["Pitch Mix Breakouts (" + breakouts.length + " found, " + (data.total_pitchers_scanned || 0) + " scanned)"];
        lines.push("  " + "#".padStart(3) + " " + "Name".padEnd(22) + "Score".padStart(6) + "  Z".padStart(6) + "  Changes");
        lines.push("  " + "-".repeat(65));
        for (var i = 0; i < breakouts.length; i++) {
          const b = breakouts[i];
          const changes = (b.changes || []).map(function(c: any) { return str(c.pitch_name || c.pitch_type) + ": " + str(c.detail); }).join("; ");
          lines.push("  " + String(i + 1).padStart(3) + " " + str(b.name).padEnd(22) + (b.signal_score || 0).toFixed(1).padStart(6) + (b.z_score != null ? b.z_score.toFixed(1) : "n/a").padStart(6) + "  " + changes);
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

}
