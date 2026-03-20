import { lazy } from "react";

// Lazy-load all view components
// Standings
const StandingsView = lazy(() => import("../standings-app/standings-view").then(m => ({ default: m.StandingsView })));
const MatchupsView = lazy(() => import("../standings-app/matchups-view").then(m => ({ default: m.MatchupsView })));
const MatchupDetailView = lazy(() => import("../standings-app/matchup-detail-view").then(m => ({ default: m.MatchupDetailView })));
const TransactionsView = lazy(() => import("../standings-app/transactions-view").then(m => ({ default: m.TransactionsView })));
const InfoView = lazy(() => import("../standings-app/info-view").then(m => ({ default: m.InfoView })));
const StatCategoriesView = lazy(() => import("../standings-app/stat-categories-view").then(m => ({ default: m.StatCategoriesView })));
const TransactionTrendsView = lazy(() => import("../standings-app/transaction-trends-view").then(m => ({ default: m.TransactionTrendsView })));
const LeaguePulseView = lazy(() => import("../standings-app/league-pulse-view").then(m => ({ default: m.LeaguePulseView })));
const PowerRankingsView = lazy(() => import("../standings-app/power-rankings-view").then(m => ({ default: m.PowerRankingsView })));
const SeasonPaceView = lazy(() => import("../standings-app/season-pace-view").then(m => ({ default: m.SeasonPaceView })));
// Season
const CategoryCheckView = lazy(() => import("../season-app/category-check-view").then(m => ({ default: m.CategoryCheckView })));
const InjuryReportView = lazy(() => import("../season-app/injury-report-view").then(m => ({ default: m.InjuryReportView })));
const WaiverAnalyzeView = lazy(() => import("../season-app/waiver-analyze-view").then(m => ({ default: m.WaiverAnalyzeView })));
const TradeEvalView = lazy(() => import("../season-app/trade-eval-view").then(m => ({ default: m.TradeEvalView })));
const LineupOptimizeView = lazy(() => import("../season-app/lineup-optimize-view").then(m => ({ default: m.LineupOptimizeView })));
const StreamingView = lazy(() => import("../season-app/streaming-view").then(m => ({ default: m.StreamingView })));
const DailyUpdateView = lazy(() => import("../season-app/daily-update-view").then(m => ({ default: m.DailyUpdateView })));
const TradeBuilderView = lazy(() => import("../season-app/trade-builder-view").then(m => ({ default: m.TradeBuilderView })));
const SimulateView = lazy(() => import("../season-app/simulate-view").then(m => ({ default: m.SimulateView })));
const ScoutView = lazy(() => import("../season-app/scout-view").then(m => ({ default: m.ScoutView })));
const MatchupStrategyView = lazy(() => import("../season-app/matchup-strategy-view").then(m => ({ default: m.MatchupStrategyView })));
const SetLineupView = lazy(() => import("../season-app/set-lineup-view").then(m => ({ default: m.SetLineupView })));
const PendingTradesView = lazy(() => import("../season-app/pending-trades-view").then(m => ({ default: m.PendingTradesView })));
const TradeActionView = lazy(() => import("../season-app/trade-action-view").then(m => ({ default: m.TradeActionView })));
const WhatsNewView = lazy(() => import("../season-app/whats-new-view").then(m => ({ default: m.WhatsNewView })));
const TradeFinderView = lazy(() => import("../season-app/trade-finder-view").then(m => ({ default: m.TradeFinderView })));
const WeekPlannerView = lazy(() => import("../season-app/week-planner-view").then(m => ({ default: m.WeekPlannerView })));
const CloserMonitorView = lazy(() => import("../season-app/closer-monitor-view").then(m => ({ default: m.CloserMonitorView })));
const PitcherMatchupView = lazy(() => import("../season-app/pitcher-matchup-view").then(m => ({ default: m.PitcherMatchupView })));
const CategoryTrendView = lazy(() => import("../season-app/category-trend-view").then(m => ({ default: m.CategoryTrendView })));
const MorningBriefingView = lazy(() => import("../season-app/morning-briefing-view").then(m => ({ default: m.MorningBriefingView })));
const PuntAdvisorView = lazy(() => import("../season-app/punt-advisor-view").then(m => ({ default: m.PuntAdvisorView })));
const PlayoffPlannerView = lazy(() => import("../season-app/playoff-planner-view").then(m => ({ default: m.PlayoffPlannerView })));
const OptimalMovesView = lazy(() => import("../season-app/optimal-moves-view").then(m => ({ default: m.OptimalMovesView })));
const ILStashAdvisorView = lazy(() => import("../season-app/il-stash-advisor-view").then(m => ({ default: m.ILStashAdvisorView })));
const TrashTalkView = lazy(() => import("../season-app/trash-talk-view").then(m => ({ default: m.TrashTalkView })));
const RivalHistoryView = lazy(() => import("../season-app/rival-history-view").then(m => ({ default: m.RivalHistoryView })));
const AchievementsView = lazy(() => import("../season-app/achievements-view").then(m => ({ default: m.AchievementsView })));
const WeeklyNarrativeView = lazy(() => import("../season-app/weekly-narrative-view").then(m => ({ default: m.WeeklyNarrativeView })));
const FaabRecommendView = lazy(() => import("../season-app/faab-recommend-view").then(m => ({ default: m.FaabRecommendView })));
const OwnershipTrendsView = lazy(() => import("../season-app/ownership-trends-view").then(m => ({ default: m.OwnershipTrendsView })));
const RosterStatsView = lazy(() => import("../season-app/roster-stats-view").then(m => ({ default: m.RosterStatsView })));
// Draft
const DraftStatusView = lazy(() => import("../draft-app/draft-status-view").then(m => ({ default: m.DraftStatusView })));
const DraftRecommendView = lazy(() => import("../draft-app/draft-recommend-view").then(m => ({ default: m.DraftRecommendView })));
const CheatsheetView = lazy(() => import("../draft-app/cheatsheet-view").then(m => ({ default: m.CheatsheetView })));
const BestAvailableView = lazy(() => import("../draft-app/best-available-view").then(m => ({ default: m.BestAvailableView })));
// Roster
const RosterView = lazy(() => import("../roster-app/roster-view").then(m => ({ default: m.RosterView })));
const FreeAgentsView = lazy(() => import("../roster-app/free-agents-view").then(m => ({ default: m.FreeAgentsView })));
const PlayerListView = lazy(() => import("../roster-app/player-list-view").then(m => ({ default: m.PlayerListView })));
const ActionView = lazy(() => import("../roster-app/action-view").then(m => ({ default: m.ActionView })));
const WhoOwnsView = lazy(() => import("../roster-app/who-owns-view").then(m => ({ default: m.WhoOwnsView })));
// Valuations
const RankingsView = lazy(() => import("../valuations-app/rankings-view").then(m => ({ default: m.RankingsView })));
const CompareView = lazy(() => import("../valuations-app/compare-view").then(m => ({ default: m.CompareView })));
const ValueView = lazy(() => import("../valuations-app/value-view").then(m => ({ default: m.ValueView })));
// MLB
const MlbTeamsView = lazy(() => import("../mlb-app/teams-view").then(m => ({ default: m.TeamsView })));
const MlbRosterView = lazy(() => import("../mlb-app/roster-view").then(m => ({ default: m.RosterView })));
const MlbPlayerView = lazy(() => import("../mlb-app/player-view").then(m => ({ default: m.PlayerView })));
const MlbStatsView = lazy(() => import("../mlb-app/stats-view").then(m => ({ default: m.StatsView })));
const MlbInjuriesView = lazy(() => import("../mlb-app/injuries-view").then(m => ({ default: m.InjuriesView })));
const MlbStandingsView = lazy(() => import("../mlb-app/standings-view").then(m => ({ default: m.StandingsView })));
const MlbScheduleView = lazy(() => import("../mlb-app/schedule-view").then(m => ({ default: m.ScheduleView })));
// History
const LeagueHistoryView = lazy(() => import("../history-app/league-history-view").then(m => ({ default: m.LeagueHistoryView })));
const RecordBookView = lazy(() => import("../history-app/record-book-view").then(m => ({ default: m.RecordBookView })));
const PastStandingsView = lazy(() => import("../history-app/past-standings-view").then(m => ({ default: m.PastStandingsView })));
const PastDraftView = lazy(() => import("../history-app/past-draft-view").then(m => ({ default: m.PastDraftView })));
const PastTeamsView = lazy(() => import("../history-app/past-teams-view").then(m => ({ default: m.PastTeamsView })));
const PastTradesView = lazy(() => import("../history-app/past-trades-view").then(m => ({ default: m.PastTradesView })));
const PastMatchupView = lazy(() => import("../history-app/past-matchup-view").then(m => ({ default: m.PastMatchupView })));
// Intel
const PlayerReportView = lazy(() => import("../intel-app/player-report-view").then(m => ({ default: m.PlayerReportView })));
const BreakoutsView = lazy(() => import("../intel-app/breakouts-view").then(m => ({ default: m.BreakoutsView })));
const RedditView = lazy(() => import("../intel-app/reddit-view").then(m => ({ default: m.RedditView })));
const ProspectsView = lazy(() => import("../intel-app/prospects-view").then(m => ({ default: m.ProspectsView })));
const IntelTransactionsView = lazy(() => import("../intel-app/transactions-view").then(m => ({ default: m.TransactionsView })));

export interface ViewDef {
  id: string;
  label: string;
  component: any;
  description?: string;
  featured?: boolean;
  props?: Record<string, any>;
}

export interface ViewGroup {
  name: string;
  views: ViewDef[];
}

function noop() {}

const VIEW_META: Record<string, { description: string; featured?: boolean }> = {
  "standings": { description: "League standings with win-loss-tie records and category totals." },
  "matchups": { description: "Weekly head-to-head pairings for every team in the league." },
  "matchup-detail": { description: "Your live matchup with category-by-category score comparison." },
  "scoreboard": { description: "Live scoring snapshot across all active league matchups." },
  "info": { description: "League settings, roster format, and scoring configuration summary." },
  "stat-categories": { description: "Full scoring categories used to determine weekly results." },
  "transactions": { description: "Recent adds, drops, and trades across the league." },
  "transaction-trends": { description: "Most added and dropped players across Yahoo leagues." },
  "league-pulse": { description: "Manager activity leaderboard based on moves and trades." },
  "power-rankings": { description: "Team strength rankings based on projected roster value.", featured: true },
  "season-pace": { description: "Playoff odds, pace projections, and magic-number tracking." },

  "category-check": { description: "See where your team ranks in each category versus league peers." },
  "injury-report": { description: "Injury status review with IL move suggestions and urgency." },
  "waiver-analyze": { description: "Top waiver targets scored by category impact and fit.", featured: true },
  "trade-eval": { description: "Evaluate a proposed trade by net value and category swing." },
  "lineup-optimize": { description: "Optimize starters and bench slots for today\'s games.", featured: true },
  "streaming": { description: "Recommended streaming pitchers based on schedule and matchup." },
  "daily-update": { description: "Quick daily ops view: lineup, injuries, and high-priority actions.", featured: true },
  "trade-builder": { description: "Build and compare multi-player trade packages by value." },
  "category-simulate": { description: "Simulate category changes from a specific add/drop move." },
  "scout-opponent": { description: "Opponent scouting report with strengths, weaknesses, and exploitable spots." },
  "matchup-strategy": { description: "Category game plan for this week\'s head-to-head matchup.", featured: true },
  "set-lineup": { description: "Manually place players into specific roster positions." },
  "pending-trades": { description: "Review incoming and outgoing trade offers awaiting action." },
  "trade-action": { description: "Accept or reject a pending trade and add a response note." },
  "whats-new": { description: "Digest of injuries, activity, trends, and notable updates." },
  "trade-finder": { description: "Find trade targets and partner teams with complementary needs.", featured: true },
  "week-planner": { description: "Games-per-day planner to spot off-days and lineup gaps." },
  "closer-monitor": { description: "Track saves roles, bullpen shifts, and available closers." },
  "pitcher-matchup": { description: "Starter matchup quality based on opponent offensive profile." },
  "category-trends": { description: "Time-series trend of your category rankings over the season." },
  "morning-briefing": { description: "All-in-one daily briefing with prioritized action items.", featured: true },
  "punt-advisor": { description: "Recommend categories to target or deprioritize strategically." },
  "playoff-planner": { description: "Path-to-playoffs planner with tactical roster recommendations.", featured: true },
  "optimal-moves": { description: "Best add/drop move sequences to maximize roster value." },
  "il-stash-advisor": { description: "Stash-versus-drop guidance for injured players." },
  "trash-talk": { description: "Generate matchup-themed trash talk at multiple intensity levels." },
  "rival-history": { description: "Historical head-to-head results versus each league rival." },
  "achievements": { description: "Season milestones, streaks, and fantasy achievement badges." },
  "weekly-narrative": { description: "Narrative recap of your most recent scoring week." },
  "faab-recommend": { description: "Suggested FAAB bid sizing based on need and budget." },
  "ownership-trends": { description: "Ownership trend lines to catch rising and fading players." },
  "roster-stats": { description: "Aggregated player stats for a roster by period or week." },

  "draft-status": { description: "Current draft room state with picks made and roster structure." },
  "draft-recommend": { description: "Best draft pick recommendation from available player pool." },
  "best-available": { description: "Top available players ranked by projected fantasy value." },
  "draft-cheatsheet": { description: "Round-by-round drafting guide and positional strategy." },

  "roster": { description: "Your full active roster with positions and eligibility." },
  "free-agents": { description: "Available free agents with quick add and compare workflows." },
  "player-list": { description: "Full player explorer with position filters, stats, and sorting.", featured: true },
  "action-add": { description: "Result view for add/drop/swap actions and confirmations." },
  "who-owns": { description: "Check which team currently owns a specific player." },

  "rankings": { description: "Overall player rankings powered by z-score valuations." },
  "compare": { description: "Side-by-side player comparison across scoring categories." },
  "value": { description: "Detailed valuation breakdown for a single player." },

  "mlb-teams": { description: "Directory of all MLB teams and abbreviations." },
  "mlb-roster": { description: "Current MLB roster for a selected team." },
  "mlb-player": { description: "Player bio and profile details from MLB data." },
  "mlb-stats": { description: "Season stat lines for a specific MLB player." },
  "mlb-injuries": { description: "League-wide MLB injury updates and status notes." },
  "mlb-standings": { description: "MLB division standings and team records." },
  "mlb-schedule": { description: "Daily MLB game schedule for matchup planning." },

  "league-history": { description: "All-time league outcomes, champions, and year-over-year results." },
  "record-book": { description: "Historical records for best seasons and manager performance." },
  "past-standings": { description: "Standings table for a selected prior season." },
  "past-draft": { description: "Historical draft picks by year with player context." },
  "past-teams": { description: "Team and manager snapshots for prior seasons." },
  "past-trades": { description: "Historical trade ledger with players exchanged." },
  "past-matchup": { description: "Past weekly matchup results and category outcomes." },

  "intel-player": { description: "Deep player intelligence: Statcast, trends, and signal checks." },
  "intel-breakouts": { description: "Breakout candidates where expected metrics outpace results." },
  "intel-busts": { description: "Bust risk candidates where production may regress." },
  "intel-reddit": { description: "Hot topics and discussion trends from r/fantasybaseball." },
  "intel-trending": { description: "Players with rising fantasy buzz and engagement." },
  "intel-prospects": { description: "Prospect call-ups and promotion watchlist updates." },
  "intel-transactions": { description: "Fantasy-relevant MLB transactions and roster movement." },
};

const RAW_VIEW_GROUPS: ViewGroup[] = [
  {
    name: "Standings",
    views: [
      { id: "standings", label: "Standings", component: StandingsView },
      { id: "matchups", label: "Matchups", component: MatchupsView },
      { id: "matchup-detail", label: "My Matchup", component: MatchupDetailView },
      { id: "scoreboard", label: "Scoreboard", component: MatchupsView },
      { id: "info", label: "Info", component: InfoView },
      { id: "stat-categories", label: "Stat Categories", component: StatCategoriesView },
      { id: "transactions", label: "Transactions", component: TransactionsView },
      { id: "transaction-trends", label: "Transaction Trends", component: TransactionTrendsView },
      { id: "league-pulse", label: "League Pulse", component: LeaguePulseView },
      { id: "power-rankings", label: "Power Rankings", component: PowerRankingsView },
      { id: "season-pace", label: "Season Pace", component: SeasonPaceView },
    ],
  },
  {
    name: "Season",
    views: [
      { id: "category-check", label: "Category Check", component: CategoryCheckView },
      { id: "injury-report", label: "Injury Report", component: InjuryReportView, props: { app: null, navigate: noop } },
      { id: "waiver-analyze", label: "Waiver Analysis", component: WaiverAnalyzeView, props: { app: null, navigate: noop } },
      { id: "trade-eval", label: "Trade Eval", component: TradeEvalView, props: { app: null, navigate: noop } },
      { id: "lineup-optimize", label: "Lineup Optimize", component: LineupOptimizeView, props: { app: null, navigate: noop } },
      { id: "streaming", label: "Streaming", component: StreamingView, props: { app: null, navigate: noop } },
      { id: "daily-update", label: "Daily Update", component: DailyUpdateView, props: { app: null, navigate: noop } },
      { id: "trade-builder", label: "Trade Builder", component: TradeBuilderView, props: { app: null, navigate: noop } },
      { id: "category-simulate", label: "Category Simulate", component: SimulateView, props: { app: null, navigate: noop } },
      { id: "scout-opponent", label: "Scout Opponent", component: ScoutView, props: { app: null, navigate: noop } },
      { id: "matchup-strategy", label: "Matchup Strategy", component: MatchupStrategyView, props: { app: null, navigate: noop } },
      { id: "set-lineup", label: "Set Lineup", component: SetLineupView, props: { app: null, navigate: noop } },
      { id: "pending-trades", label: "Pending Trades", component: PendingTradesView, props: { app: null, navigate: noop } },
      { id: "trade-action", label: "Trade Action", component: TradeActionView, props: { app: null, navigate: noop } },
      { id: "whats-new", label: "What's New", component: WhatsNewView, props: { app: null, navigate: noop } },
      { id: "trade-finder", label: "Trade Finder", component: TradeFinderView, props: { app: null, navigate: noop } },
      { id: "week-planner", label: "Week Planner", component: WeekPlannerView },
      { id: "closer-monitor", label: "Closer Monitor", component: CloserMonitorView, props: { app: null, navigate: noop } },
      { id: "pitcher-matchup", label: "Pitcher Matchup", component: PitcherMatchupView },
      { id: "category-trends", label: "Category Trends", component: CategoryTrendView },
      { id: "morning-briefing", label: "Morning Briefing", component: MorningBriefingView, props: { app: null, navigate: noop } },
      { id: "punt-advisor", label: "Punt Advisor", component: PuntAdvisorView, props: { app: null, navigate: noop } },
      { id: "playoff-planner", label: "Playoff Planner", component: PlayoffPlannerView, props: { app: null, navigate: noop } },
      { id: "optimal-moves", label: "Optimal Moves", component: OptimalMovesView, props: { app: null, navigate: noop } },
      { id: "il-stash-advisor", label: "IL Stash Advisor", component: ILStashAdvisorView, props: { app: null, navigate: noop } },
      { id: "trash-talk", label: "Trash Talk", component: TrashTalkView, props: { app: null, navigate: noop } },
      { id: "rival-history", label: "Rival History", component: RivalHistoryView, props: { app: null, navigate: noop } },
      { id: "achievements", label: "Achievements", component: AchievementsView, props: { app: null, navigate: noop } },
      { id: "weekly-narrative", label: "Weekly Narrative", component: WeeklyNarrativeView, props: { app: null, navigate: noop } },
      { id: "faab-recommend", label: "FAAB Recommend", component: FaabRecommendView, props: { app: null, navigate: noop } },
      { id: "ownership-trends", label: "Ownership Trends", component: OwnershipTrendsView, props: { app: null, navigate: noop } },
      { id: "roster-stats", label: "Roster Stats", component: RosterStatsView, props: { app: null, navigate: noop } },
    ],
  },
  {
    name: "Draft",
    views: [
      { id: "draft-status", label: "Draft Status", component: DraftStatusView },
      { id: "draft-recommend", label: "Recommendation", component: DraftRecommendView, props: { app: null, navigate: noop } },
      { id: "best-available", label: "Best Available", component: BestAvailableView, props: { app: null, navigate: noop } },
      { id: "draft-cheatsheet", label: "Cheat Sheet", component: CheatsheetView, props: { app: null, navigate: noop } },
    ],
  },
  {
    name: "Roster",
    views: [
      { id: "roster", label: "My Roster", component: RosterView, props: { app: null, navigate: noop } },
      { id: "free-agents", label: "Free Agents", component: FreeAgentsView, props: { app: null, navigate: noop } },
      { id: "player-list", label: "Player List", component: PlayerListView, props: { app: null, navigate: noop } },
      { id: "action-add", label: "Action Result", component: ActionView, props: { app: null, navigate: noop } },
      { id: "who-owns", label: "Who Owns", component: WhoOwnsView, props: { app: null, navigate: noop } },
    ],
  },
  {
    name: "Valuations",
    views: [
      { id: "rankings", label: "Rankings", component: RankingsView, props: { app: null, navigate: noop } },
      { id: "compare", label: "Compare", component: CompareView, props: { app: null, navigate: noop } },
      { id: "value", label: "Value", component: ValueView, props: { app: null, navigate: noop } },
    ],
  },
  {
    name: "MLB",
    views: [
      { id: "mlb-teams", label: "Teams", component: MlbTeamsView },
      { id: "mlb-roster", label: "Roster", component: MlbRosterView, props: { app: null, navigate: noop } },
      { id: "mlb-player", label: "Player", component: MlbPlayerView, props: { app: null, navigate: noop } },
      { id: "mlb-stats", label: "Stats", component: MlbStatsView },
      { id: "mlb-injuries", label: "Injuries", component: MlbInjuriesView },
      { id: "mlb-standings", label: "Standings", component: MlbStandingsView },
      { id: "mlb-schedule", label: "Schedule", component: MlbScheduleView },
    ],
  },
  {
    name: "History",
    views: [
      { id: "league-history", label: "League History", component: LeagueHistoryView },
      { id: "record-book", label: "Record Book", component: RecordBookView },
      { id: "past-standings", label: "Past Standings", component: PastStandingsView, props: { app: null, navigate: noop } },
      { id: "past-draft", label: "Past Draft", component: PastDraftView, props: { app: null, navigate: noop } },
      { id: "past-teams", label: "Past Teams", component: PastTeamsView, props: { app: null, navigate: noop } },
      { id: "past-trades", label: "Past Trades", component: PastTradesView, props: { app: null, navigate: noop } },
      { id: "past-matchup", label: "Past Matchup", component: PastMatchupView, props: { app: null, navigate: noop } },
    ],
  },
  {
    name: "Intel",
    views: [
      { id: "intel-player", label: "Player Report", component: PlayerReportView, props: { app: null, navigate: noop } },
      { id: "intel-breakouts", label: "Breakouts", component: BreakoutsView, props: { app: null, navigate: noop } },
      { id: "intel-busts", label: "Busts", component: BreakoutsView, props: { app: null, navigate: noop } },
      { id: "intel-reddit", label: "Reddit Buzz", component: RedditView, props: { app: null, navigate: noop } },
      { id: "intel-trending", label: "Trending", component: RedditView, props: { app: null, navigate: noop } },
      { id: "intel-prospects", label: "Prospects", component: ProspectsView, props: { app: null, navigate: noop } },
      { id: "intel-transactions", label: "Transactions", component: IntelTransactionsView, props: { app: null, navigate: noop } },
    ],
  },
];

export const VIEW_GROUPS: ViewGroup[] = RAW_VIEW_GROUPS.map((group) => ({
  ...group,
  views: group.views.map((view) => ({
    ...view,
    ...(VIEW_META[view.id] || {}),
  })),
}));
