// Mock app object for static/demo mode.
// Simulates all tool calls that views make by returning the appropriate mock data.

const TOOL_MAP: Record<string, string> = {
  // Roster actions
  yahoo_add: "action-add",
  yahoo_drop: "action-drop",
  yahoo_swap: "action-swap",
  yahoo_roster: "roster",

  // Season tools
  yahoo_waiver_analyze: "waiver-analyze",
  yahoo_category_simulate: "category-simulate",
  yahoo_free_agents: "free-agents",
  yahoo_player_list: "player-list",
  yahoo_search: "free-agents",
  yahoo_scout_opponent: "scout-opponent",
  yahoo_matchup_strategy: "matchup-strategy",
  yahoo_morning_briefing: "morning-briefing",
  yahoo_lineup_optimize: "lineup-optimize",
  yahoo_set_lineup: "set-lineup",
  yahoo_streaming: "streaming",
  yahoo_trade_eval: "trade-eval",
  yahoo_propose_trade: "pending-trades",
  yahoo_pending_trades: "pending-trades",
  yahoo_trade_finder: "trade-finder",
  yahoo_category_trends: "category-trends",
  yahoo_punt_advisor: "punt-advisor",
  yahoo_playoff_planner: "playoff-planner",
  yahoo_optimal_moves: "optimal-moves",
  yahoo_il_stash_advisor: "il-stash-advisor",
  yahoo_trash_talk: "trash-talk",
  yahoo_rival_history: "rival-history",
  yahoo_achievements: "achievements",
  yahoo_weekly_narrative: "weekly-narrative",
  yahoo_faab_recommend: "faab-recommend",
  yahoo_ownership_trends: "ownership-trends",
  yahoo_roster_stats: "roster-stats",

  // Rankings / valuations
  yahoo_rankings: "rankings",
  yahoo_compare: "compare",
  yahoo_value: "value",
  yahoo_best_available: "best-available",

  // History
  yahoo_past_standings: "past-standings",
  yahoo_past_draft: "past-draft",
  yahoo_past_teams: "past-teams",
  yahoo_past_trades: "past-trades",
  yahoo_past_matchup: "past-matchup",

  // Intel
  fantasy_player_report: "intel-player",
  fantasy_transactions: "intel-transactions",
  fantasy_reddit_buzz: "intel-reddit",
  fantasy_trending_players: "intel-trending",
  fantasy_breakout_candidates: "intel-breakouts",
  fantasy_bust_candidates: "intel-busts",
  fantasy_prospect_watch: "intel-prospects",
};

export function createMockApp(getMockData: () => Record<string, any> | null) {
  return {
    callServerTool: async function (nameOrObj: string | { name: string; arguments: Record<string, any> }, args?: Record<string, any>) {
      // Handle both call signatures: callServerTool("name", args) and callServerTool({ name, arguments })
      var toolName: string;
      if (typeof nameOrObj === "string") {
        toolName = nameOrObj;
      } else {
        toolName = nameOrObj.name;
      }

      var mockData = getMockData();
      if (!mockData) return null;

      var key = TOOL_MAP[toolName];
      var data = key ? mockData[key] : null;
      if (!data) return null;

      // Simulate network latency
      await new Promise(function (r) { setTimeout(r, 250); });

      return { structuredContent: data };
    },

    openLink: function (url: string) {
      window.open(url, "_blank");
    },

    sendMessage: function () {
      // no-op in static mode
    },
  };
}
