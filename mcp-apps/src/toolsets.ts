// mcp-apps/src/toolsets.ts
// Configurable toolset system — filters which tools are registered based on MCP_TOOLSET env var.
// Reduces effective tool count per session from 124 to ~26 (default profile).

export const TOOLSETS: Record<string, string[]> = {
  // Core — always loaded (~17 tools, session-critical essentials)
  core: [
    "yahoo_roster",
    "yahoo_standings",
    "yahoo_my_matchup",
    "yahoo_free_agents",
    "yahoo_search",
    "yahoo_player_stats",
    "yahoo_value",
    "yahoo_compare",
    "yahoo_matchups",
    "yahoo_injury_report",
    "yahoo_rankings",
    "yahoo_player_list",
    "yahoo_league_context",
    "yahoo_morning_briefing",
    "yahoo_whats_new",
    "yahoo_weekly_digest",
    "yahoo_weather",
  ],

  // Lineup management (~6 tools)
  lineup: [
    "yahoo_auto_lineup",
    "yahoo_lineup_optimize",
    "yahoo_set_lineup",
    "yahoo_week_planner",
    "yahoo_game_day_manager",
    "yahoo_roster_health_check",
  ],

  // Waiver & transactions (~9 tools)
  waivers: [
    "yahoo_waiver_recommendations",
    "yahoo_waiver_claim",
    "yahoo_waivers",
    "yahoo_streaming",
    "yahoo_add",
    "yahoo_drop",
    "yahoo_swap",
    "yahoo_transaction_trends",
    "yahoo_il_stash_advisor",
    "yahoo_waiver_deadline_prep",
  ],

  // Trade tools (~6 tools)
  trades: [
    "yahoo_trade_analysis",
    "yahoo_trade_pipeline",
    "yahoo_propose_trade",
    "yahoo_pending_trades",
    "yahoo_accept_trade",
    "yahoo_reject_trade",
  ],

  // Strategy & analytics (~14 tools)
  strategy: [
    "yahoo_category_check",
    "yahoo_matchup_strategy",
    "yahoo_scout_opponent",
    "yahoo_punt_advisor",
    "yahoo_league_landscape",
    "yahoo_power_rankings",
    "yahoo_league_intel",
    "yahoo_season_pace",
    "yahoo_playoff_planner",
    "yahoo_category_trends",
    "yahoo_closer_monitor",
    "yahoo_pitcher_matchup",
    "yahoo_faab_recommend",
    "yahoo_optimal_moves",
    "fantasy_probable_pitchers",
    "fantasy_schedule_analysis",
  ],

  // Workflow aggregators (~10 tools)
  workflows: [
    "yahoo_morning_briefing",
    "yahoo_weekly_digest",
    "yahoo_season_checkpoint",
    "yahoo_waiver_deadline_prep",
    "yahoo_whats_new",
    "yahoo_game_day_manager",
    "yahoo_roster_health_check",
    "yahoo_league_landscape",
    "yahoo_weekly_narrative",
    "yahoo_achievements",
  ],

  // Intel & Statcast (~12 tools)
  intel: [
    "fantasy_player_report",
    "fantasy_regression_candidates",
    "fantasy_reddit_buzz",
    "fantasy_trending_players",
    "fantasy_news_feed",
    "fantasy_transactions",
    "yahoo_statcast_history",
    "yahoo_projection_disagreements",
    "yahoo_zscore_shifts",
    "yahoo_ownership_trends",
    "yahoo_player_intel",
    "yahoo_projections_update",
  ],

  // Prospects (~11 tools)
  prospects: [
    "fantasy_prospect_rankings",
    "fantasy_prospect_report",
    "fantasy_prospect_compare",
    "fantasy_prospect_buzz",
    "fantasy_prospect_watch",
    "fantasy_callup_wire",
    "fantasy_eta_tracker",
    "fantasy_stash_advisor",
    "fantasy_prospect_trade_targets",
    "fantasy_prospect_watch_add",
    "fantasy_prospect_news",
  ],

  // Draft (~5 tools — not filtered by enabledTools since draft-tools.ts was not modified)
  draft: [
    "yahoo_draft_status",
    "yahoo_draft_recommend",
    "yahoo_draft_cheatsheet",
    "yahoo_best_available",
    "yahoo_draft_board",
  ],

  // MLB reference (~9 tools)
  mlb: [
    "mlb_teams",
    "mlb_roster",
    "mlb_player",
    "mlb_stats",
    "mlb_schedule",
    "mlb_injuries",
    "mlb_standings",
    "mlb_draft",
    "yahoo_weather",
  ],

  // League history (~9 tools)
  history: [
    "yahoo_league_history",
    "yahoo_record_book",
    "yahoo_past_standings",
    "yahoo_past_draft",
    "yahoo_past_teams",
    "yahoo_past_trades",
    "yahoo_past_matchup",
    "yahoo_rival_history",
    "yahoo_roster_history",
  ],

  // Meta — capability discovery (always registered, listed here for category visibility)
  meta: [
    "discover_capabilities",
    "get_tool_details",
  ],

  // Admin / team management (~12 tools)
  admin: [
    "yahoo_change_team_name",
    "yahoo_change_team_logo",
    "yahoo_league_context",
    "yahoo_league_pulse",
    "yahoo_transactions",
    "yahoo_all_rostered",
    "yahoo_browser_status",
    "yahoo_roster_stats",
    "yahoo_trash_talk",
    "yahoo_who_owns",
    "yahoo_percent_owned",
    "yahoo_positional_ranks",
    "yahoo_league_intel",
  ],
};

// Preset profiles that combine toolsets
export const PROFILES: Record<string, string[]> = {
  // Default — casual daily use (~35 tools, under Cursor's 40-tool limit)
  default: ["core", "lineup", "waivers", "trades"],

  // Full season management (~50+ tools)
  full: ["core", "lineup", "waivers", "trades", "strategy", "workflows"],

  // Draft day (~21 tools)
  "draft-day": ["core", "draft"],

  // Analysis mode (~36 tools)
  analysis: ["core", "strategy", "intel", "prospects"],

  // Automation mode (~25 tools)
  automation: ["core", "lineup", "waivers", "workflows"],
  // Note: "all" is handled by main.ts (enabledTools=undefined), not via PROFILES
};

// One-line descriptions for every tool — used by meta-tools TOOL_REGISTRY
// so unloaded tools get meaningful descriptions instead of name-derived placeholders.
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  // Core
  yahoo_roster: "View your current fantasy roster with positions, status, and player details",
  yahoo_standings: "League standings with win-loss records, category ranks, and playoff positioning",
  yahoo_my_matchup: "Current matchup details — category scores, projected outcome, key battles",
  yahoo_free_agents: "Browse available free agents filtered by position type and ownership",
  yahoo_search: "Search for any player by name across all Yahoo Fantasy teams and free agents",
  yahoo_player_stats: "Season and recent stats for a specific player from Yahoo",
  yahoo_value: "Single player z-score breakdown across every scoring category with raw stats",
  yahoo_compare: "Head-to-head z-score comparison of two players across all categories",
  yahoo_matchups: "All league matchups for the current scoring period with scores",
  yahoo_injury_report: "Current injuries across your roster and league with status and return dates",
  yahoo_rankings: "Top-ranked players by z-score value for batters or pitchers with tiers",
  yahoo_player_list: "List players from a specific team or position with key stats",
  yahoo_league_context: "League settings, scoring categories, roster rules, and team list",
  yahoo_morning_briefing: "Daily briefing with lineup, matchup, injuries, and waiver opportunities",
  yahoo_whats_new: "Recent transactions, roster moves, and league activity since last check",
  yahoo_weekly_digest: "End-of-week summary with matchup result, standings movement, and trends",
  yahoo_weather: "Game-day weather for MLB parks affecting player performance",

  // Lineup
  yahoo_auto_lineup: "Automatically set optimal daily lineup based on projections and matchups",
  yahoo_lineup_optimize: "Analyze and suggest lineup optimizations for upcoming games",
  yahoo_set_lineup: "Set a specific player into a specific roster slot",
  yahoo_week_planner: "Plan lineup moves for the entire scoring week with streaming slots",
  yahoo_game_day_manager: "Day-of-game lineup decisions with weather, injuries, and matchup data",
  yahoo_roster_health_check: "Check roster for IL-eligible stashes, empty slots, and lineup issues",

  // Waivers
  yahoo_waiver_recommendations: "AI-ranked waiver wire picks based on team needs and z-score value",
  yahoo_waiver_claim: "Submit a waiver claim to add a player (optionally dropping another)",
  yahoo_waivers: "View pending waiver claims and their priority status",
  yahoo_streaming: "Find best streaming options for pitchers or hitters for upcoming games",
  yahoo_add: "Add a free agent to your roster",
  yahoo_drop: "Drop a player from your roster",
  yahoo_swap: "Swap one roster player for a free agent in a single transaction",
  yahoo_transaction_trends: "Track recent add/drop trends across the league for player momentum",
  yahoo_il_stash_advisor: "Identify injured players worth stashing on IL for their return value",
  yahoo_waiver_deadline_prep: "Pre-deadline waiver analysis with priority rankings and FAAB strategy",

  // Trades
  yahoo_trade_analysis: "Full trade evaluation with z-score surplus, category impact, and grade",
  yahoo_trade_pipeline: "End-to-end trade search — finds partners, builds packages, grades proposals",
  yahoo_propose_trade: "Send a trade proposal to another team",
  yahoo_pending_trades: "View all pending trade offers sent and received",
  yahoo_accept_trade: "Accept a pending trade offer",
  yahoo_reject_trade: "Reject a pending trade offer",

  // Strategy
  yahoo_category_check: "Category-by-category rank analysis showing where you lead and trail",
  yahoo_matchup_strategy: "Strategic plan for winning the current matchup — which categories to target",
  yahoo_scout_opponent: "Deep analysis of an opponent's roster strengths, weaknesses, and tendencies",
  yahoo_punt_advisor: "Identify categories to strategically punt for roto or head-to-head advantage",
  yahoo_league_landscape: "League-wide competitive analysis with tier rankings and playoff odds",
  yahoo_power_rankings: "Z-score power rankings blending roster strength (60%) with actual record (40%)",
  yahoo_league_intel: "Comprehensive league intelligence: power rankings, top performers, team profiles, trade fits",
  yahoo_season_pace: "Season pace projections for cumulative categories (HR, K, W, etc.)",
  yahoo_playoff_planner: "Playoff scenarios, magic numbers, and clinching paths",
  yahoo_category_trends: "Track how your category ranks have moved over recent scoring periods",
  yahoo_closer_monitor: "Monitor closer situations — saves, holds, committee changes, injuries",
  yahoo_pitcher_matchup: "Evaluate pitcher matchups for streaming and start/sit decisions",
  yahoo_faab_recommend: "FAAB budget recommendations for waiver targets based on remaining budget",
  yahoo_optimal_moves: "AI-recommended optimal roster moves combining adds, drops, and trades",
  fantasy_probable_pitchers: "Upcoming probable pitchers with matchup difficulty and streaming value",
  fantasy_schedule_analysis: "Schedule-based analysis for streaming and weekly planning",

  // Workflows
  yahoo_season_checkpoint: "Mid-season checkpoint with standings, pace, and strategic adjustments",
  yahoo_weekly_narrative: "Narrative summary of the week's events, storylines, and league drama",
  yahoo_achievements: "Track milestones and achievements for your fantasy team this season",

  // Intel
  fantasy_player_report: "Comprehensive player report combining stats, news, Statcast, and z-scores",
  fantasy_regression_candidates: "Players likely to regress toward or away from their current performance",
  fantasy_reddit_buzz: "Reddit discussion buzz and sentiment for fantasy-relevant players",
  fantasy_trending_players: "Players trending up or down based on ownership changes and news volume",
  fantasy_news_feed: "Latest fantasy-relevant news headlines across all sources",
  fantasy_transactions: "Recent league transactions — adds, drops, trades across all teams",
  yahoo_statcast_history: "Historical Statcast data for a player — barrel rate, exit velo, sprint speed",
  yahoo_projection_disagreements: "Players where Steamer, ZiPS, and DC projection systems disagree most",
  yahoo_zscore_shifts: "Players whose z-score has shifted most since draft day baseline",
  yahoo_ownership_trends: "Ownership percentage trends over time for players on the wire",
  yahoo_player_intel: "Aggregated intelligence on a player — news, Statcast, injury, regression signals",
  yahoo_projections_update: "Force-refresh player projections from FanGraphs projection systems",

  // Prospects
  fantasy_prospect_rankings: "Top prospect rankings with ETA, tools grades, and fantasy relevance",
  fantasy_prospect_report: "Detailed scouting report for a specific prospect",
  fantasy_prospect_compare: "Side-by-side comparison of two prospects with tools and projection data",
  fantasy_prospect_buzz: "Recent prospect buzz from news, call-up rumors, and performance spikes",
  fantasy_prospect_watch: "Your personal prospect watchlist with status updates and alerts",
  fantasy_callup_wire: "Prospects most likely to be called up soon based on service time and need",
  fantasy_eta_tracker: "Track ETA projections for top prospects across multiple sources",
  fantasy_stash_advisor: "Which prospects to stash in NA slots based on call-up probability and value",
  fantasy_prospect_trade_targets: "Prospects on other teams worth targeting in dynasty/keeper trades",
  fantasy_prospect_watch_add: "Add a prospect to your personal watchlist for tracking",
  fantasy_prospect_news: "Latest news and updates specific to prospects and minor leaguers",

  // Draft
  yahoo_draft_status: "Current draft status — picks made, queue position, time remaining",
  yahoo_draft_recommend: "AI draft recommendation for your next pick based on value and need",
  yahoo_draft_cheatsheet: "Printable cheatsheet with z-score rankings, tiers, and draft targets",
  yahoo_best_available: "Best available players by z-score value at each position",
  yahoo_draft_board: "Visual draft board showing all picks made and positional runs",

  // MLB
  mlb_teams: "List MLB teams with records, divisions, and basic info",
  mlb_roster: "Full 40-man roster for an MLB team from the MLB Stats API",
  mlb_player: "Detailed player bio and career info from MLB Stats API",
  mlb_stats: "Season statistics for a player from the official MLB Stats API",
  mlb_schedule: "MLB schedule for a date range with scores and game status",
  mlb_injuries: "Current MLB injury report across all teams",
  mlb_standings: "Official MLB standings by division with records and streaks",
  mlb_draft: "MLB amateur draft results and pick history",

  // History
  yahoo_league_history: "Historical league data — past champions, records, and season summaries",
  yahoo_record_book: "All-time league records for categories, matchups, and seasons",
  yahoo_past_standings: "Final standings from a specific past season",
  yahoo_past_draft: "Draft results from a previous season with pick-by-pick data",
  yahoo_past_teams: "Team rosters and results from a previous season",
  yahoo_past_trades: "Trade history from a previous season",
  yahoo_past_matchup: "Historical matchup results between two teams",
  yahoo_rival_history: "Head-to-head record and history against a specific rival",
  yahoo_roster_history: "How a team's roster has changed over the course of a season",

  // Meta
  discover_capabilities: "Browse available tool categories and find tools for specific tasks",
  get_tool_details: "Get full description and parameters for a specific tool by name",

  // Admin
  yahoo_change_team_name: "Change your fantasy team's name",
  yahoo_change_team_logo: "Change your fantasy team's logo",
  yahoo_league_pulse: "Quick pulse check on league activity, standings movement, and hot topics",
  yahoo_transactions: "View recent transaction history across the league",
  yahoo_all_rostered: "List all rostered players across all teams in the league",
  yahoo_browser_status: "Check browser automation status for Yahoo operations",
  yahoo_roster_stats: "Aggregate roster statistics and team composition analysis",
  yahoo_trash_talk: "Send a trash talk message to the league message board",
  yahoo_who_owns: "Find which team owns a specific player",
  yahoo_percent_owned: "Check ownership percentage for a player across Yahoo leagues",
  yahoo_positional_ranks: "Rank teams by strength at each roster position",
};

export function shouldRegister(enabledTools: Set<string> | undefined, name: string): boolean {
  return !enabledTools || enabledTools.has(name);
}

export function resolveToolset(config: string): Set<string> {
  // Config can be: profile name, comma-separated toolset names, or "all"
  var names = config.split(",").map(function (s) { return s.trim(); });
  var toolNames = new Set<string>();

  for (var name of names) {
    if (PROFILES[name]) {
      for (var ts of PROFILES[name]) {
        for (var tool of TOOLSETS[ts] || []) {
          toolNames.add(tool);
        }
      }
    } else if (TOOLSETS[name]) {
      for (var tool of TOOLSETS[name]) {
        toolNames.add(tool);
      }
    }
  }

  return toolNames;
}
