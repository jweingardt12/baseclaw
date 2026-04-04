import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../api/python-client.js";
import { READ_ANNO, WRITE_ANNO } from "../api/annotations.js";
import {
  str,
  type ProspectReportResponse,
  type ProspectRankingsResponse,
  type CallupWireResponse,
  type StashAdvisorResponse,
  type ProspectCompareResponse,
  type ProspectBuzzResponse,
  type EtaTrackerResponse,
  type ProspectTradeTargetsResponse,
  type ProspectNewsResponse,
} from "../api/types.js";
import { defineTool } from "../api/define-tool.js";

export function registerProspectTools(server: McpServer, enabledTools?: Set<string>) {

  // prospect_report
  defineTool(
    server,
    "fantasy_prospect_report",
    {
      description: "Use this to get a deep-dive report on a specific MLB prospect including MiLB stats, scouting evaluation, FV grade, call-up probability, and stash recommendation. Pass the prospect's name for a full breakdown. Use fantasy_prospect_rankings instead when you want to browse the top prospects list rather than researching one specific player.",
      inputSchema: { player_name: z.string().describe("Prospect name to look up") },
      annotations: READ_ANNO,
      _meta: {},
    },
    async (args) => {
      var player_name = args.player_name as string;
      var data = await apiGet<ProspectReportResponse>("/api/prospects/report", { name: player_name });
      if (data.error) {
        return { text: "Error: " + data.error };
      }
      var lines: string[] = [];
      lines.push("Prospect Report: " + str(data.name));
      lines.push("");
      if (data.age) lines.push("  Age: " + data.age);
      if (data.position) lines.push("  Position: " + data.position);
      if (data.organization) lines.push("  Organization: " + data.organization);
      if (data.current_level) lines.push("  Current Level: " + data.current_level);
      if (data.on_40_man != null) lines.push("  40-Man: " + (data.on_40_man ? "Yes" : "No"));
      if (data.fv_grade) lines.push("  FV Grade: " + data.fv_grade);
      if (data.overall_rank) lines.push("  Overall Rank: #" + data.overall_rank);
      if (data.eta) lines.push("  ETA: " + data.eta);
      if (data.milb_stats && data.milb_stats.length > 0) {
        lines.push("");
        lines.push("MiLB Stats:");
        for (const s of data.milb_stats) {
          lines.push("  " + str(s.level) + " - " + s.games + " G" +
            Object.entries(s).filter(function([k]) { return k !== "level" && k !== "games"; })
              .map(function([k, v]) { return ", " + k + ": " + v; }).join(""));
        }
      }
      if (data.evaluation) {
        var ev = data.evaluation;
        lines.push("");
        lines.push("Evaluation: " + str(ev.grade));
        lines.push("  Readiness Score: " + ev.readiness_score);
        if (ev.strengths && ev.strengths.length > 0) {
          lines.push("  Strengths: " + ev.strengths.join(", "));
        }
        if (ev.concerns && ev.concerns.length > 0) {
          lines.push("  Concerns: " + ev.concerns.join(", "));
        }
      }
      if (data.callup_probability) {
        var cp = data.callup_probability;
        lines.push("");
        lines.push("Call-Up Probability: " + cp.probability + "% (" + str(cp.classification) + ")");
        if (cp.factors && cp.factors.length > 0) {
          lines.push("  Factors: " + cp.factors.join(", "));
        }
      }
      if (data.stash_recommendation) {
        var sr = data.stash_recommendation;
        lines.push("");
        lines.push("Stash Recommendation: " + str(sr.action) + " (confidence: " + sr.confidence + ")");
        if (sr.reasons && sr.reasons.length > 0) {
          lines.push("  Reasons: " + sr.reasons.join(", "));
        }
      }
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // prospect_rankings
  defineTool(
    server,
    "fantasy_prospect_rankings",
    {
      description: "Use this to see the top MLB prospects ranked by composite score with call-up probabilities, FV grades, and ETAs. Filter by position, level, or organization to narrow results. Use fantasy_prospect_report instead when you want a detailed deep-dive on one specific prospect rather than browsing the rankings list.",
      inputSchema: {
        position: z.string().optional().describe("Filter by position (e.g. SS, OF, RHP)"),
        level: z.string().optional().describe("Filter by level (e.g. AAA, AA)"),
        team: z.string().optional().describe("Filter by MLB organization"),
        count: z.coerce.number().optional().describe("Number of prospects to return (default 25)"),
      },
      annotations: READ_ANNO,
      _meta: {},
    },
    async (args) => {
      var position = args.position as string | undefined;
      var level = args.level as string | undefined;
      var team = args.team as string | undefined;
      var count = args.count as number | undefined;
      var params: Record<string, string> = {};
      if (position) params.position = position;
      if (level) params.level = level;
      if (team) params.team = team;
      if (count) params.count = String(count);
      var data = await apiGet<ProspectRankingsResponse>("/api/prospects/rankings", params);
      var lines: string[] = [];
      lines.push("Prospect Rankings (" + data.count + " prospects):");
      if (data.filters) {
        var filterParts = Object.entries(data.filters).map(function([k, v]) { return k + "=" + v; });
        if (filterParts.length > 0) lines.push("  Filters: " + filterParts.join(", "));
      }
      lines.push("");
      lines.push("  " + "#".padEnd(5) + "Name".padEnd(22) + "Pos".padEnd(6) + "Org".padEnd(6) + "Level".padEnd(6) + "FV".padEnd(5) + "ETA".padEnd(8) + "CallUp%");
      lines.push("  " + "-".repeat(65));
      for (const p of (data.prospects || [])) {
        lines.push("  " +
          str(p.overall_rank || "-").padEnd(5) +
          str(p.name).padEnd(22) +
          str(p.position || "").padEnd(6) +
          str(p.organization || "").padEnd(6) +
          str(p.current_level || "").padEnd(6) +
          str(p.fv_grade || "").padEnd(5) +
          str(p.eta || "").padEnd(8) +
          str(p.callup_probability != null ? p.callup_probability + "%" : ""));
      }
      if ((data.prospects || []).length === 0) lines.push("  No prospects found.");
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // callup_wire
  defineTool(
    server,
    "fantasy_callup_wire",
    {
      description: "Use this to see recent MLB call-ups with fantasy impact analysis including prospect ranks, fantasy relevance scores, and opportunities created by the move. Pass the days parameter to control the lookback window. Use fantasy_prospect_watch instead when you want a quick summary of prospect roster moves without the detailed fantasy impact analysis.",
      inputSchema: {
        days: z.coerce.number().optional().describe("Number of days to look back (default 7)"),
      },
      annotations: READ_ANNO,
      _meta: {},
    },
    async (args) => {
      var days = args.days as number | undefined;
      var params: Record<string, string> = {};
      if (days) params.days = String(days);
      var data = await apiGet<CallupWireResponse>("/api/prospects/callup-wire", params);
      var lines: string[] = [];
      lines.push("Call-Up Wire (last " + data.days + " days, " + data.count + " transactions):");
      lines.push("");
      for (const t of (data.transactions || [])) {
        lines.push("  " + str(t.date).padEnd(12) + str(t.type).padEnd(15) + str(t.player_name).padEnd(22) + str(t.team));
        if (t.description) lines.push("    " + t.description);
        if (t.prospect_rank) lines.push("    Prospect Rank: #" + t.prospect_rank);
        if (t.fantasy_relevance != null) lines.push("    Fantasy Relevance: " + t.fantasy_relevance + "/10");
        if (t.creates_opportunity && t.creates_opportunity.length > 0) {
          lines.push("    Creates Opportunity: " + t.creates_opportunity.join(", "));
        }
        lines.push("");
      }
      if ((data.transactions || []).length === 0) lines.push("  No recent call-ups found.");
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // stash_advisor
  defineTool(
    server,
    "fantasy_stash_advisor",
    {
      description: "Use this to get NA stash recommendations ranked by call-up probability and league context to decide who to stash on your NA roster slots. Returns prospect names, stash actions, confidence levels, call-up probabilities, and reasoning. Use fantasy_prospect_report instead when you want a full scouting report on a specific prospect you are already considering.",
      inputSchema: {
        count: z.coerce.number().optional().describe("Number of recommendations to return (default 10)"),
      },
      annotations: READ_ANNO,
      _meta: {},
    },
    async (args) => {
      var count = args.count as number | undefined;
      var params: Record<string, string> = {};
      if (count) params.count = String(count);
      var data = await apiGet<StashAdvisorResponse>("/api/prospects/stash-advisor", params);
      var lines: string[] = [];
      lines.push("NA Stash Advisor (" + data.count + " recommendations):");
      lines.push("");
      for (const r of (data.recommendations || [])) {
        lines.push("  " + str(r.name) + " (" + str(r.position) + ", " + str(r.organization) + ")");
        lines.push("    Action: " + str(r.action) + " | Confidence: " + r.confidence);
        if (r.callup_probability != null) lines.push("    Call-Up Probability: " + r.callup_probability + "% (" + str(r.classification) + ")");
        if (r.readiness_score != null) lines.push("    Readiness: " + r.readiness_score);
        if (r.fv_grade) lines.push("    FV Grade: " + r.fv_grade);
        if (r.reasons && r.reasons.length > 0) {
          lines.push("    Reasons: " + r.reasons.join("; "));
        }
        lines.push("");
      }
      if ((data.recommendations || []).length === 0) lines.push("  No stash recommendations available.");
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // prospect_compare
  defineTool(
    server,
    "fantasy_prospect_compare",
    {
      description: "Use this to compare two prospects side-by-side on stats, FV grades, call-up probability, evaluation scores, and stash recommendations. Pass player1 and player2 names for a head-to-head comparison table. Use fantasy_prospect_report instead when you want a full deep-dive on just one prospect rather than a comparison.",
      inputSchema: {
        player1: z.string().describe("First prospect name"),
        player2: z.string().describe("Second prospect name"),
      },
      annotations: READ_ANNO,
      _meta: {},
    },
    async (args) => {
      var player1 = args.player1 as string;
      var player2 = args.player2 as string;
      var data = await apiGet<ProspectCompareResponse>("/api/prospects/compare", { player1, player2 });
      var p1 = data.player1;
      var p2 = data.player2;
      var lines: string[] = [];
      lines.push("Prospect Comparison: " + str(p1.name) + " vs " + str(p2.name));
      lines.push("");
      lines.push("  " + "".padEnd(20) + str(p1.name).padEnd(22) + str(p2.name).padEnd(22));
      lines.push("  " + "-".repeat(64));
      lines.push("  " + "Position".padEnd(20) + str(p1.position || "-").padEnd(22) + str(p2.position || "-").padEnd(22));
      lines.push("  " + "Organization".padEnd(20) + str(p1.organization || "-").padEnd(22) + str(p2.organization || "-").padEnd(22));
      lines.push("  " + "Age".padEnd(20) + str(p1.age || "-").padEnd(22) + str(p2.age || "-").padEnd(22));
      lines.push("  " + "Level".padEnd(20) + str(p1.current_level || "-").padEnd(22) + str(p2.current_level || "-").padEnd(22));
      lines.push("  " + "FV Grade".padEnd(20) + str(p1.fv_grade || "-").padEnd(22) + str(p2.fv_grade || "-").padEnd(22));
      lines.push("  " + "Overall Rank".padEnd(20) + str(p1.overall_rank ? "#" + p1.overall_rank : "-").padEnd(22) + str(p2.overall_rank ? "#" + p2.overall_rank : "-").padEnd(22));
      lines.push("  " + "ETA".padEnd(20) + str(p1.eta || "-").padEnd(22) + str(p2.eta || "-").padEnd(22));
      lines.push("  " + "40-Man".padEnd(20) + str(p1.on_40_man != null ? (p1.on_40_man ? "Yes" : "No") : "-").padEnd(22) + str(p2.on_40_man != null ? (p2.on_40_man ? "Yes" : "No") : "-").padEnd(22));
      if (p1.callup_probability || p2.callup_probability) {
        lines.push("  " + "Call-Up %".padEnd(20) +
          str(p1.callup_probability ? p1.callup_probability.probability + "%" : "-").padEnd(22) +
          str(p2.callup_probability ? p2.callup_probability.probability + "%" : "-").padEnd(22));
      }
      if (p1.evaluation || p2.evaluation) {
        lines.push("");
        lines.push("  Evaluation:");
        lines.push("  " + "Grade".padEnd(20) + str(p1.evaluation ? p1.evaluation.grade : "-").padEnd(22) + str(p2.evaluation ? p2.evaluation.grade : "-").padEnd(22));
        lines.push("  " + "Readiness".padEnd(20) + str(p1.evaluation ? p1.evaluation.readiness_score : "-").padEnd(22) + str(p2.evaluation ? p2.evaluation.readiness_score : "-").padEnd(22));
      }
      if (p1.stash_recommendation || p2.stash_recommendation) {
        lines.push("");
        lines.push("  Stash Rec:");
        lines.push("  " + "Action".padEnd(20) + str(p1.stash_recommendation ? p1.stash_recommendation.action : "-").padEnd(22) + str(p2.stash_recommendation ? p2.stash_recommendation.action : "-").padEnd(22));
      }
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // prospect_buzz
  defineTool(
    server,
    "fantasy_prospect_buzz",
    {
      description: "Use this to see trending Reddit discussions specifically about MLB prospects, including posts from r/fantasybaseball and prospect-related subreddits. Returns post titles, scores, comment counts, and matched prospect names. Use fantasy_reddit_buzz instead when you want general fantasy baseball Reddit activity rather than prospect-specific discussions.",
      annotations: READ_ANNO,
      _meta: {},
    },
    async () => {
      var data = await apiGet<ProspectBuzzResponse>("/api/prospects/buzz");
      var lines: string[] = [];
      lines.push("Prospect Buzz (" + data.count + " posts):");
      lines.push("");
      for (const p of (data.posts || [])) {
        var sub = p.subreddit ? "[r/" + p.subreddit + "] " : "";
        var match = p.prospect_match ? " -> " + p.prospect_match : "";
        lines.push("  " + sub + str(p.title) + " (score:" + p.score + ", comments:" + p.num_comments + ")" + match);
      }
      if ((data.posts || []).length === 0) lines.push("  No prospect buzz found.");
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // eta_tracker
  defineTool(
    server,
    "fantasy_eta_tracker",
    {
      description: "Use this to track call-up probability changes over time for prospects on your watchlist, with flags for significant movements. Returns current vs previous probability, delta, classification, and flagged alerts for big movers. Use fantasy_prospect_watch_add instead when you need to add or remove a prospect from the watchlist being tracked.",
      annotations: READ_ANNO,
      _meta: {},
    },
    async () => {
      var data = await apiGet<EtaTrackerResponse>("/api/prospects/eta-tracker");
      var lines: string[] = [];
      lines.push("ETA Tracker (" + data.count + " prospects):");
      lines.push("");
      lines.push("  " + "Name".padEnd(22) + "Current".padStart(9) + "Previous".padStart(10) + "Change".padStart(9) + "  " + "Class".padEnd(12) + "Flag");
      lines.push("  " + "-".repeat(70));
      for (const p of (data.prospects || [])) {
        var arrow = p.change > 0 ? "+" : "";
        var flag = p.flagged ? " ***" : "";
        lines.push("  " +
          str(p.name).padEnd(22) +
          (p.current_probability + "%").padStart(9) +
          (p.previous_probability + "%").padStart(10) +
          (arrow + p.change + "%").padStart(9) + "  " +
          str(p.classification).padEnd(12) +
          flag);
      }
      if ((data.prospects || []).length === 0) lines.push("  No tracked prospects.");
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // prospect_trade_targets
  defineTool(
    server,
    "fantasy_prospect_trade_targets",
    {
      description: "Use this to identify stashed prospects on other teams in your league that are worth acquiring via trade. Returns prospect names, current owners, prospect ranks, FV grades, call-up probabilities, urgency levels, and trade suggestions. Use fantasy_stash_advisor instead when you want recommendations for which free-agent prospects to stash on your own NA slots.",
      annotations: READ_ANNO,
      _meta: {},
    },
    async () => {
      var data = await apiGet<ProspectTradeTargetsResponse>("/api/prospects/trade-targets");
      var lines: string[] = [];
      lines.push("Prospect Trade Targets (" + data.count + " targets):");
      lines.push("");
      for (const t of (data.targets || [])) {
        lines.push("  " + str(t.name) + " (" + str(t.position) + ", " + str(t.organization) + ")");
        if (t.owner) lines.push("    Owned by: " + t.owner);
        if (t.overall_rank) lines.push("    Prospect Rank: #" + t.overall_rank);
        if (t.fv_grade) lines.push("    FV Grade: " + t.fv_grade);
        if (t.callup_probability != null) lines.push("    Call-Up Probability: " + t.callup_probability + "% (" + str(t.callup_classification) + ")");
        if (t.urgency) lines.push("    Urgency: " + t.urgency);
        if (t.eta) lines.push("    ETA: " + t.eta);
        if (t.trade_suggestion) lines.push("    Suggestion: " + t.trade_suggestion);
        lines.push("");
      }
      if ((data.targets || []).length === 0) lines.push("  No trade targets identified.");
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // fantasy_prospect_watch_add
  defineTool(
    server,
    "fantasy_prospect_watch_add",
    {
      description: "Use this to add or remove a prospect from your ETA watchlist so their call-up probability changes are tracked over time. Pass the prospect name and optional action ('add' or 'remove'). Use fantasy_eta_tracker instead when you want to view the current watchlist and see probability changes rather than modifying the list.",
      inputSchema: {
        player_name: z.string().describe("Prospect name to add or remove"),
        action: z.string().optional().describe("'add' (default) or 'remove'"),
      },
      annotations: WRITE_ANNO,
      _meta: {},
    },
    async (args) => {
      var player_name = args.player_name as string;
      var action = args.action as string | undefined;
      var params: Record<string, string> = { name: player_name };
      if (action) params.action = action;
      var data = await apiGet<{ success?: boolean; error?: string; name?: string; current_probability?: number; action?: string }>("/api/prospects/watch-add", params);
      if (data.error) {
        return { text: "Error: " + data.error };
      }
      var lines: string[] = [];
      if (data.action === "removed") {
        lines.push("Removed " + str(data.name) + " from watchlist.");
      } else {
        lines.push("Added " + str(data.name) + " to watchlist.");
        if (data.current_probability != null) {
          lines.push("Current call-up probability: " + data.current_probability + "%");
        }
      }
      return { text: lines.join("\n") };
    },
    enabledTools,
  );

  // prospect_news
  defineTool(
    server,
    "fantasy_prospect_news",
    {
      description: "Use this to get qualitative news intelligence for a prospect by aggregating front office quotes, beat reporter intel, roster decisions, injury news, and rumors from MLB Trade Rumors, ESPN, FanGraphs, and Google News. Returns article summaries with sentiment signals and how they modify call-up probability via Bayesian blending. Use fantasy_prospect_report instead when you want the full statistical scouting profile rather than a news-focused intelligence briefing.",
      inputSchema: {
        player_name: z.string().describe("Prospect name to search for"),
        days: z.coerce.number().optional().describe("Number of days of news to search (default 7)"),
      },
      annotations: READ_ANNO,
      _meta: {},
    },
    async (args) => {
      var player_name = args.player_name as string;
      var days = args.days as number | undefined;
      var params: Record<string, string> = { name: player_name };
      if (days) params.days = String(days);
      var data = await apiGet<ProspectNewsResponse>("/api/prospects/news", params);
      if (data.error) {
        return { text: "Error: " + data.error };
      }
      var lines: string[] = [];
      var sentiment = data.overall_sentiment || { label: "NO NEWS", emoji: "~", score: 0 };
      lines.push("News Intelligence: " + str(data.prospect_name));
      lines.push("");
      lines.push("  Sentiment: " + sentiment.emoji + " " + sentiment.label + " (score: " + sentiment.score + ")");
      lines.push("  Articles Found: " + data.articles_found);
      lines.push("  Signals Extracted: " + data.signals_extracted);
      if (data.ensemble_probability != null) {
        lines.push("");
        lines.push("  Call-Up Probability Impact:");
        lines.push("    Stat-based:     " + (data.stat_based_probability != null ? data.stat_based_probability + "%" : "N/A"));
        lines.push("    News-adjusted:  " + (data.news_adjusted_probability != null ? data.news_adjusted_probability + "%" : "N/A"));
        lines.push("    Ensemble:       " + data.ensemble_probability + "%");
        var deltaSign = (data.news_delta || 0) >= 0 ? "+" : "";
        lines.push("    News delta:     " + deltaSign + (data.news_delta || 0) + "pp");
      }
      if (data.article_summaries && data.article_summaries.length > 0) {
        lines.push("");
        lines.push("  Recent Articles:");
        for (const article of data.article_summaries.slice(0, 8)) {
          var icon = article.sentiment === "BULLISH" ? "[+]" : article.sentiment === "BEARISH" ? "[-]" : "[~]";
          lines.push("    " + icon + " [" + article.date + "] " + str(article.source));
          lines.push("      " + str(article.title));
          for (const signal of (article.signals || [])) {
            lines.push("      -> " + signal);
          }
        }
      } else {
        lines.push("");
        lines.push("  No recent news found for this prospect.");
      }
      if (data.signal_contributions && data.signal_contributions.length > 0) {
        lines.push("");
        lines.push("  Signal Breakdown:");
        for (const contrib of data.signal_contributions.slice(0, 5)) {
          var sign = contrib.probability_delta >= 0 ? "+" : "";
          lines.push("    " + sign + contrib.probability_delta + "pp -- " + str(contrib.description) + " (" + str(contrib.source) + ", decay: " + contrib.decay_factor + ")");
        }
      }
      return { text: lines.join("\n") };
    },
    enabledTools,
  );
}
