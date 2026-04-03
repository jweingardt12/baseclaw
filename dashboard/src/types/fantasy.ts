// TypeScript interfaces for BaseClaw Fantasy Baseball API responses
// Source of truth: /Users/jason/Docker/yahoo-fantasy/dashboard/src/lib/api.ts

// --- League Context ---

export interface LeagueContext {
  waiver_type: string;
  uses_faab: boolean;
  scoring_type: string;
  stat_categories: string[];
  roster_positions: { position: string; count: number; position_type: string }[];
  num_teams: number;
  max_weekly_adds: number;
  faab_balance?: number;
  current_week?: number;
  team_name?: string;
  league_name?: string;
}

// --- Standings ---

export interface Standing {
  team: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  gb: number;
  categories: Record<string, { value: number; rank: number }>;
  powerRank: number;
  playoffPct: number;
  trend: { week: number; wins: number; losses: number }[];
  team_logo?: string;
  manager_image?: string;
}

// --- Matchups ---

export interface ScoreboardMatchup {
  team1: string;
  team2: string;
  team1_logo?: string;
  team2_logo?: string;
  status: string;
  [key: string]: unknown;
}

export interface Scoreboard {
  matchups: ScoreboardMatchup[];
}

export interface MatchupCategory {
  name: string;
  my_value: string;
  opp_value: string;
  result: "win" | "loss" | "tie";
}

export interface Matchup {
  week: number;
  my_team: string;
  opponent: string;
  my_team_logo?: string;
  opp_team_logo?: string;
  my_manager_image?: string;
  opp_manager_image?: string;
  score: { wins: number; losses: number; ties: number };
  categories: MatchupCategory[];
}

// --- Players ---

export interface Player {
  name: string;
  team: string;
  position: string;
  status: "active" | "bench" | "IL" | "NA";
  stats: Record<string, number>;
  mlb_id?: number;
  statcast?: Record<string, number>;
  trends?: { date: string; value: number }[];
}

export interface PlayerListEntry {
  name: string;
  player_id: string;
  eligible_positions: string[];
  percent_owned: number;
  percent_started?: number;
  preseason_pick?: number;
  current_pick?: number;
  stats?: Record<string, string | number>;
  status: string;
  team: string;
  headshot?: string;
  mlb_id?: number;
  opponent?: string;
  roster_status: string;
  owner?: string;
  intel?: Record<string, unknown>;
  trend?: Record<string, unknown>;
}

export interface PlayerListResponse {
  pos_type: string;
  count: number;
  status: string;
  players: PlayerListEntry[];
}

// --- Power Rankings ---

export interface PowerRanking {
  rank: number;
  team: string;
  team_logo?: string;
  score?: number;
  record?: string;
  [key: string]: unknown;
}

// --- Category Data ---

export interface CategoryCheck {
  category: string;
  name: string;
  value: number;
  rank: number;
  trend: { date: string; value: number }[];
  target: number;
  strength?: string;
  total?: number;
}

export interface CategoryTrend {
  category: string;
  values: { week: number; value: number }[];
  [key: string]: unknown;
}

// --- Season Pace ---

export interface SeasonPaceTeam {
  name: string;
  rank?: number;
  team_logo?: string;
  record?: string;
  wins?: number;
  losses?: number;
  ties?: number;
  projected_wins?: number;
  projected_losses?: number;
  playoff_status?: string;
  magic_number?: number;
  [key: string]: unknown;
}

export interface SeasonPace {
  categories: { name: string; current: number; pace: number; target: number; on_track: boolean }[];
  teams: SeasonPaceTeam[];
  [key: string]: unknown;
}

// --- Positional Ranks ---

export interface PositionalRankPlayer {
  player_key: string;
  name: string;
}

export interface PositionalRank {
  position: string;
  rank: number;
  grade: "strong" | "neutral" | "weak";
  starters: PositionalRankPlayer[];
  bench: PositionalRankPlayer[];
}

export interface TeamPositionalRanks {
  team_key: string;
  team_id: string;
  name: string;
  team_logo?: string;
  manager?: string;
  manager_image?: string;
  positional_ranks: PositionalRank[];
  recommended_trade_partners: string[];
}

export interface PositionalRanksResponse {
  teams: TeamPositionalRanks[];
}

// --- Transactions ---

export interface TransactionPlayer {
  name: string;
  player_id?: string;
  mlb_id?: number | null;
  position: string;
  mlb_team: string;
  action: string;
  fantasy_team: string;
}

export interface Transaction {
  type: string;
  timestamp: string;
  players: TransactionPlayer[];
}

export type TransactionTrends = Record<string, unknown>;

// --- Playoff / Schedule ---

export interface PlayoffPlanner {
  playoff_probability?: number;
  current_seed?: number;
  schedule_strength?: number;
  recommendations?: string[];
  [key: string]: unknown;
}

export interface ScheduleAnalysis {
  weeks: { week: number; opponent: string; difficulty: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

// --- League History ---

export interface LeagueHistorySeason {
  year: number;
  champion: string;
  your_record: string;
  your_finish: string;
}

export interface LeagueHistoryEntry {
  season: number;
  wins: number;
  losses: number;
  rank: number;
  champion: string;
  details: Record<string, unknown>;
}

// --- Record Book ---

export interface CareerRecord {
  manager: string;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  playoffs: number;
  seasons: number;
  best_finish: number;
  best_year: number;
}

export interface ActivityRecord {
  manager: string;
  moves?: number;
  trades?: number;
  year: number;
}

export interface SeasonRecord {
  manager: string;
  year: number;
  wins: number;
  losses: number;
  ties: number;
  win_pct?: number;
}

export interface Champion {
  year: number;
  team_name: string;
  manager: string;
  record: string;
  win_pct: number;
}

export interface PlayoffAppearance {
  manager: string;
  appearances: number;
}

export interface FirstPick {
  year: number;
  player: string;
}

export interface RecordHolder {
  team_name: string;
  context: string;
}

export interface CategoryRecord {
  category: string;
  direction: string;
  record_type: string;
  holders: RecordHolder[];
  value: string;
}

export interface H2HRecord {
  record_type: string;
  holders: RecordHolder[];
  value: string;
  value_header: string;
}

export interface RecordBook {
  careers: CareerRecord[];
  champions: Champion[];
  season_records: {
    best_win_pct?: SeasonRecord;
    most_wins?: SeasonRecord;
    worst_win_pct?: SeasonRecord;
  };
  activity_records: {
    most_moves?: ActivityRecord;
    most_trades?: ActivityRecord;
  };
  playoff_appearances: PlayoffAppearance[];
  first_picks: FirstPick[];
  batting_records?: CategoryRecord[];
  pitching_records?: CategoryRecord[];
  h2h_records?: H2HRecord[];
  source?: string;
}

// --- Past Standings ---

export interface PastStandingEntry {
  rank: number;
  team_name: string;
  manager: string;
  record: string;
}

// --- Achievements ---

export interface Achievement {
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  value: string | null;
}

// --- League Pulse ---

export interface LeaguePulseTeam {
  name: string;
  moves: number;
  trades: number;
  total: number;
  team_key?: string;
  team_logo?: string;
  manager_image?: string;
}

// --- League Intel ---

export interface LeagueIntelTeam {
  name: string;
  rank: number;
  team_logo?: string;
  record?: string;
  adj_zscore?: number;
  upside?: number;
  score?: number;
  hitting_z?: number;
  pitching_z?: number;
  [key: string]: unknown;
}

// --- Roster Stats ---

export interface RosterStatsPlayer {
  name: string;
  player_id?: string;
  position: string;
  eligible_positions?: string[];
  mlb_id?: number;
  stats: Record<string, string | number>;
}

// --- Ownership Trends ---

export interface OwnershipTrendEntry {
  name: string;
  percent_owned: number;
  change: number;
  [key: string]: unknown;
}

// --- Closer Monitor ---

export interface CloserMonitorEntry {
  team: string;
  closer?: string;
  status: string;
  handcuff?: string;
  saves?: number;
  [key: string]: unknown;
}

// --- Breakout / Bust Candidates ---

export interface BreakoutCandidate {
  player?: Player;
  name?: string;
  reason: string;
  confidence: number;
  keyMetrics?: Record<string, number>;
  [key: string]: unknown;
}

// --- Z-Score Shifts ---

export interface ZscoreShift {
  name?: string;
  player?: string;
  z_score?: number;
  change?: number;
  [key: string]: unknown;
}

// --- Rival History ---

export interface RivalHistory {
  opponent?: string;
  wins?: number;
  losses?: number;
  ties?: number;
  [key: string]: unknown;
}

// --- Regression Candidates ---

export interface RegressionCandidate {
  name: string;
  babip: number;
  diff: number;
  confidence: number;
  direction: string;
  details: string;
  regression_score: number;
  pa: number;
  [key: string]: unknown;
}

export interface RegressionCandidatesResponse {
  buy_low_hitters: RegressionCandidate[];
  buy_low_pitchers: RegressionCandidate[];
  sell_high_hitters: RegressionCandidate[];
  sell_high_pitchers: RegressionCandidate[];
}

// --- Player Intel ---

export interface StatcastBatTracking {
  bat_speed: number;
  bat_speed_pct: number;
  bat_speed_tier: string;
  squared_up_pct: number;
  [key: string]: unknown;
}

export interface StatcastBattedBall {
  avg_exit_velo: number;
  barrel_pct: number;
  barrel_pct_rank: number;
  ev_pct: number;
  ev_tier: string;
  [key: string]: unknown;
}

export interface StatcastExpected {
  ba: number;
  slg: number;
  woba: number;
  xba: number;
  xslg: number;
  xwoba: number;
  xba_pct: number;
  xslg_pct: number;
  [key: string]: unknown;
}

export interface StatcastSpeed {
  sprint_speed: number;
  sprint_pct: number;
  speed_tier: string;
}

export interface PlayerIntelResponse {
  player: string;
  status: string;
  status_reason: string;
  statcast?: {
    player_type: string;
    data_season: number;
    bat_tracking?: StatcastBatTracking;
    batted_ball?: StatcastBattedBall;
    expected?: StatcastExpected;
    speed?: StatcastSpeed;
  };
  trends?: {
    status: string;
    splits?: Record<string, unknown>;
    [key: string]: unknown;
  };
  news_context?: {
    headlines?: { date: string; source: string; headline?: string; title?: string; [key: string]: unknown }[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// --- Player Tier ---

export interface PlayerTierResponse {
  name: string;
  tier: string;
  rank: number;
  z_total: number;
  z_final: number;
  per_category_zscores: Record<string, number>;
  team: string;
  pos: string;
  type: string;
}

// --- Z-Score Shifts Response ---

export interface ZscoreShiftEntry {
  name: string;
  current_z: number;
  draft_z: number;
  delta: number;
  direction: string;
  [key: string]: unknown;
}

export interface ZscoreShiftsResponse {
  baseline_date: string;
  shifts: ZscoreShiftEntry[];
}

// --- Ranked Players (all players, rostered + FA) ---

export interface RankedPlayer {
  name: string;
  team: string;
  pos: string;
  rank: number;
  z_score: number;
  park_factor: number;
  mlb_id?: number;
  intel?: {
    statcast?: {
      bat_tracking?: StatcastBatTracking;
      batted_ball?: StatcastBattedBall;
      expected?: StatcastExpected;
      speed?: StatcastSpeed;
      [key: string]: unknown;
    };
    trends?: { status: string; [key: string]: unknown };
    [key: string]: unknown;
  };
}

// --- MLB Data ---

export interface MLBDivisionTeam {
  name: string;
  wins: number;
  losses: number;
  pct: number;
  gb: string;
  [key: string]: unknown;
}

export interface MLBDivision {
  name: string;
  teams: MLBDivisionTeam[];
}

export interface MLBGame {
  away: string;
  home: string;
  time?: string;
  status?: string;
  [key: string]: unknown;
}

export interface WeatherGame {
  away: string;
  home: string;
  temp?: number;
  wind?: string;
  dome?: boolean;
  weather?: string;
  [key: string]: unknown;
}

export interface ParkFactor {
  park: string;
  team?: string;
  [key: string]: unknown;
}

export interface ProbablePitcher {
  name: string;
  team: string;
  opponent?: string;
  [key: string]: unknown;
}

export interface MLBInjury {
  player: string;
  team: string;
  status: string;
  [key: string]: unknown;
}

// --- Enhanced Intel ---

export interface BustCandidate {
  name: string;
  woba: number;
  xwoba: number;
  diff: number;
  pa: number;
  [key: string]: unknown;
}

export interface BatTrackingBreakout {
  name: string;
  bat_speed?: number;
  bat_speed_pct?: number;
  squared_up_pct?: number;
  fast_swing_pct?: number;
  [key: string]: unknown;
}

export interface TrendingPlayer {
  name: string;
  score: number;
  [key: string]: unknown;
}

export interface ProjectionDisagreement {
  name: string;
  [key: string]: unknown;
}
