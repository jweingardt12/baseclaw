/** Safe string coercion for padEnd/padStart — returns "" for null/undefined */
export function str(val: unknown): string {
  if (val == null) return "";
  return String(val);
}

// Transaction trend info attached to players trending across all Yahoo leagues
export interface TrendInfo {
  direction: "added" | "dropped";
  delta: string;
  rank: number;
  percent_owned: number;
}

// Shared player type used across multiple responses
// Python _player_info() returns: name, position, team, eligible_positions, status
export interface Player {
  name: string;
  player_id?: string;
  position?: string;
  eligible_positions?: string[];
  positions?: string[];
  status?: string;
  team?: string;
  percent_owned?: number;
  mlb_id?: number;
  intel?: PlayerIntel;
  trend?: TrendInfo;
}

// League Management responses
export interface RosterResponse {
  players: Player[];
}

export interface FreeAgentsResponse {
  pos_type: string;
  players: Player[];
}

export interface SearchResponse {
  query: string;
  results: Player[];
}

export interface ActionResponse {
  success: boolean;
  message: string;
  player_key?: string;
  add_key?: string;
  drop_key?: string;
}

export interface StandingsEntry {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  ties?: number;
  points_for?: string;
}

export interface StandingsResponse {
  standings: StandingsEntry[];
}

// Python matchups return team1/team2 as plain strings, not objects
export interface Matchup {
  team1: string;
  team2: string;
  status: string;
}

export interface MatchupsResponse {
  week: string;
  matchups: Matchup[];
}

export interface ScoreboardMatchup {
  team1: string;
  team2: string;
  status: string;
}

export interface ScoreboardResponse {
  week: string;
  matchups: ScoreboardMatchup[];
}

export interface MatchupCategory {
  name: string;
  my_value: string;
  opp_value: string;
  result: "win" | "loss" | "tie";
}

export interface MatchupDetailResponse {
  week: string | number;
  my_team: string;
  opponent: string;
  score: { wins: number; losses: number; ties: number };
  categories: MatchupCategory[];
}

export interface TransactionEntry {
  type: string;
  player: string;
  team?: string;
}

export interface TransactionsResponse {
  transactions: TransactionEntry[];
}

// Python returns "name" not "display_name"
export interface StatCategory {
  name: string;
  position_type?: string;
}

export interface StatCategoriesResponse {
  categories: StatCategory[];
}

// Python returns "playoff_teams" not "num_playoff_teams"
export interface LeagueInfoResponse {
  name: string;
  draft_status: string;
  season: string;
  start_date: string;
  end_date: string;
  current_week: number;
  num_teams: number;
  playoff_teams: number;
  max_weekly_adds: number;
  team_name: string;
  team_id: string;
}

// Transaction Trends (cross-league)
export interface TrendPlayer {
  name: string;
  player_id: string;
  team: string;
  position: string;
  percent_owned: number;
  delta: string;
  mlb_id?: number;
}

export interface TransactionTrendsResponse {
  most_added: TrendPlayer[];
  most_dropped: TrendPlayer[];
}

// Valuations responses
// Python returns "pos" not "position"
export interface RankingEntry {
  rank: number;
  name: string;
  team?: string;
  pos?: string;
  z_score: number;
  mlb_id?: number;
  intel?: PlayerIntel;
}

export interface RankingsResponse {
  pos_type: string;
  source: string;
  players: RankingEntry[];
}

// Python compare returns: player1/player2 with name/type/team/pos, z_scores as separate dict
export interface ComparePlayerInfo {
  name: string;
  type: string;
  team: string;
  pos: string;
}

export interface CompareResponse {
  player1: ComparePlayerInfo;
  player2: ComparePlayerInfo;
  z_scores: Record<string, { player1: number; player2: number }>;
}

// Python value returns: { players: [{ name, type, team, pos, raw_stats, z_scores }] }
export interface ValuePlayer {
  name: string;
  type: string;
  team: string;
  pos: string;
  raw_stats: Record<string, number>;
  z_scores: Record<string, number>;
  mlb_id?: number;
  intel?: PlayerIntel;
}

export interface ValueResponse {
  players: ValuePlayer[];
}

// Season Management responses
export interface LineupSwap {
  bench_player: string;
  start_player: string;
  position: string;
}

// Python returns "suggested_swaps" not "swaps", no "message" field
export interface LineupOptimizeResponse {
  games_today: number;
  active_off_day: Player[];
  bench_playing: Player[];
  il_players: Player[];
  suggested_swaps: LineupSwap[];
  applied: boolean;
}

// Python returns "name" not "category"
export interface CategoryRank {
  name: string;
  value: string;
  rank: number;
  total: number;
  strength: string;
}

export interface CategoryCheckResponse {
  week: number;
  categories: CategoryRank[];
  strongest: string[];
  weakest: string[];
}

// Python _player_info + optional injury_description
export interface InjuredPlayer {
  name: string;
  position: string;
  team?: string;
  eligible_positions?: string[];
  status: string;
  injury_description?: string;
  mlb_id?: number;
  intel?: PlayerIntel;
}

export interface InjuryReportResponse {
  injured_active: InjuredPlayer[];
  healthy_il: InjuredPlayer[];
  injured_bench: InjuredPlayer[];
  il_proper: InjuredPlayer[];
}

// Python waiver returns "recommendations" not "players", pid/pct not player_id/percent_owned
// weak_categories is array of objects {name, rank, total}, not strings
export interface WaiverRecommendation {
  name: string;
  pid: string;
  pct: number;
  positions: string;
  status: string;
  score: number;
  mlb_id?: number;
  intel?: PlayerIntel;
  trend?: TrendInfo;
}

export interface WeakCategory {
  name: string;
  rank: number;
  total: number;
}

export interface WaiverAnalyzeResponse {
  pos_type: string;
  weak_categories: WeakCategory[];
  recommendations: WaiverRecommendation[];
}

// Python streaming returns "recommendations" not "pitchers", pid/pct not player_id/percent_owned
// team_games is array of {team, games}, not a dict
export interface StreamingRecommendation {
  name: string;
  pid: string;
  pct: number;
  team: string;
  games: number;
  score: number;
  mlb_id?: number;
  intel?: PlayerIntel;
  trend?: TrendInfo;
}

export interface StreamingResponse {
  week: number;
  team_games: Array<{ team: string; games: number }>;
  recommendations: StreamingRecommendation[];
}

// Python returns give_players/get_players (not giving/getting)
// Each player has name, player_id, positions (array), value
export interface TradePlayer {
  name: string;
  player_id: string;
  positions: string[];
  value: number;
  mlb_id?: number;
  intel?: PlayerIntel;
}

export interface TradeEvalResponse {
  give_players: TradePlayer[];
  get_players: TradePlayer[];
  give_value: number;
  get_value: number;
  net_value: number;
  grade: string;
  position_impact: { losing: string[]; gaining: string[] };
}

export interface DailyUpdateResponse {
  lineup: LineupOptimizeResponse;
  injuries: InjuryReportResponse;
  edit_date?: string | null;
}

// Draft responses
export interface DraftPick {
  round: number;
  pick: number;
  team_key: string;
  team_name?: string;
  player_name: string;
  player_key?: string;
  position?: string;
}

export interface DraftStatusResponse {
  total_picks: number;
  current_round: number;
  hitters: number;
  pitchers: number;
  draft_results?: DraftPick[];
  num_teams?: number;
  your_team_key?: string;
}

// Python recommend returns: recommendation (not strategy), top_hitters/top_pitchers (not hitters/pitchers)
// Each player has: name, positions (array), z_score (nullable)
export interface DraftRecommendation {
  name: string;
  positions: string[];
  z_score: number | null;
  mlb_id?: number;
  intel?: PlayerIntel;
}

export interface DraftRecommendResponse {
  round: number;
  recommendation: string;
  hitters_count: number;
  pitchers_count: number;
  top_hitters: DraftRecommendation[];
  top_pitchers: DraftRecommendation[];
  top_pick: { name: string; type: string; z_score: number | null } | null;
}

// Python cheatsheet returns strategy (dict), targets (dict of arrays), avoid, opponents
export interface CheatsheetResponse {
  strategy: Record<string, string>;
  targets: Record<string, string[]>;
  avoid: string[];
  opponents: Array<{ name: string; tendency: string }>;
}

export interface BestAvailablePlayer {
  rank: number;
  name: string;
  positions?: string[];
  z_score: number | null;
  mlb_id?: number;
  intel?: PlayerIntel;
}

export interface BestAvailableResponse {
  pos_type: string;
  players: BestAvailablePlayer[];
}

// MLB Data responses
export interface MlbTeam {
  id: number;
  name: string;
  abbreviation: string;
}

export interface MlbTeamsResponse {
  teams: MlbTeam[];
}

export interface MlbRosterPlayer {
  name: string;
  jersey_number: string;
  position: string;
  player_id?: string;
}

// Python returns "roster" not "players"
export interface MlbRosterResponse {
  team_name: string;
  roster: MlbRosterPlayer[];
}

export interface MlbPlayerResponse {
  name: string;
  position: string;
  team: string;
  bats: string;
  throws: string;
  age: number;
  mlb_id: number;
}

export interface MlbStatsResponse {
  season: string;
  stats: Record<string, string | number>;
}

export interface MlbInjury {
  player: string;
  team: string;
  description: string;
}

export interface MlbInjuriesResponse {
  injuries: MlbInjury[];
}

// Python returns "name" not "division"
export interface MlbDivision {
  name: string;
  teams: Array<{
    name: string;
    wins: number;
    losses: number;
    games_back: string;
  }>;
}

export interface MlbStandingsResponse {
  divisions: MlbDivision[];
}

export interface MlbGame {
  away: string;
  home: string;
  status: string;
}

export interface MlbScheduleResponse {
  date: string;
  games: MlbGame[];
}

// History responses
export interface SeasonResult {
  year: number;
  champion: string;
  your_finish?: string;
  your_record?: string;
}

export interface LeagueHistoryResponse {
  seasons: SeasonResult[];
}

export interface PastStandingsEntry {
  rank: number;
  team_name: string;
  manager: string;
  record: string;
}

export interface PastStandingsResponse {
  standings: PastStandingsEntry[];
}

export interface PastDraftPick {
  round: number;
  pick: number;
  player_name: string;
  team_name: string;
}

export interface PastDraftResponse {
  year: number;
  picks: PastDraftPick[];
}

export interface PastTeamEntry {
  name: string;
  manager: string;
  moves: number;
  trades: number;
}

export interface PastTeamsResponse {
  year: number;
  teams: PastTeamEntry[];
}

// Python returns trader_team/tradee_team, players is array of {name, from, to}
export interface PastTradePlayer {
  name: string;
  from: string;
  to: string;
}

export interface PastTrade {
  trader_team: string;
  tradee_team: string;
  players: PastTradePlayer[];
}

export interface PastTradesResponse {
  year: number;
  trades: PastTrade[];
}

export interface PastMatchupEntry {
  team1: string;
  team2: string;
  score: string;
  status: string;
}

export interface PastMatchupResponse {
  year: number;
  week: number;
  matchups: PastMatchupEntry[];
}

export interface CareerEntry {
  manager: string;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  playoffs: number;
  best_finish: number;
  best_year: number;
}

export interface ChampionEntry {
  year: number;
  team_name: string;
  manager: string;
  record: string;
  win_pct: number;
}

export interface RecordBookResponse {
  careers: CareerEntry[];
  champions: ChampionEntry[];
  season_records: Record<string, Record<string, unknown>>;
  activity_records: Record<string, Record<string, unknown>>;
  first_picks: Array<{ year: number; player: string }>;
  playoff_appearances: Array<{ manager: string; appearances: number }>;
}

export interface CategorySimulateResponse {
  add_player: { name: string; team: string; positions: string; mlb_id?: number };
  drop_player: { name: string; team: string; positions: string } | null;
  current_ranks: Array<{ name: string; rank: number; total: number }>;
  simulated_ranks: Array<{ name: string; rank: number; total: number; change: number }>;
  summary: string;
}

export interface ScoutCategory {
  name: string;
  my_value: string;
  opp_value: string;
  result: "win" | "loss" | "tie";
  margin: "close" | "comfortable" | "dominant";
}

export interface ScoutOpponentResponse {
  week: number;
  opponent: string;
  score: { wins: number; losses: number; ties: number };
  categories: ScoutCategory[];
  opp_strengths: string[];
  opp_weaknesses: string[];
  strategy: string[];
}

// Matchup Strategy response
export interface MatchupStrategyCategory {
  name: string;
  my_value: string;
  opp_value: string;
  result: "win" | "loss" | "tie";
  margin: "close" | "comfortable" | "dominant";
  classification: "target" | "protect" | "concede" | "lock";
  reason: string;
}

export interface MatchupStrategySchedule {
  my_batter_games: number;
  my_pitcher_games: number;
  opp_batter_games: number;
  opp_pitcher_games: number;
  advantage: "you" | "opponent" | "neutral";
}

export interface MatchupStrategyTransaction {
  type: string;
  player: string;
  date: string;
}

export interface MatchupStrategyWaiverTarget {
  name: string;
  pid: string;
  pct: number;
  categories: string[];
  team: string;
  games: number;
  mlb_id?: number;
}

export interface MatchupStrategyResponse {
  week: number | string;
  opponent: string;
  score: { wins: number; losses: number; ties: number };
  schedule: MatchupStrategySchedule;
  categories: MatchupStrategyCategory[];
  opp_transactions: MatchupStrategyTransaction[];
  strategy: {
    target: string[];
    protect: string[];
    concede: string[];
    lock: string[];
  };
  waiver_targets: MatchupStrategyWaiverTarget[];
  summary: string;
}

// Player Intelligence types
export interface PlayerIntelStatcast {
  barrel_pct_rank?: number | null;
  avg_exit_velo?: number | null;
  ev_pct_rank?: number | null;
  hard_hit_rate?: number | null;
  hh_pct_rank?: number | null;
  xwoba?: number | null;
  xwoba_pct_rank?: number | null;
  xba?: number | null;
  xba_pct_rank?: number | null;
  sprint_speed?: number | null;
  speed_pct_rank?: number | null;
  whiff_rate?: number | null;
  chase_rate?: number | null;
  quality_tier?: string | null;
}

export interface PlayerIntelTrends {
  last_14_days?: Record<string, string | number>;
  last_30_days?: Record<string, string | number>;
  vs_last_year?: string;
  hot_cold?: string;
}

export interface PlayerIntelContext {
  reddit_mentions?: number;
  reddit_sentiment?: string;
  recent_headlines?: string[];
}

export interface PlayerIntelDiscipline {
  bb_rate?: number | null;
  k_rate?: number | null;
  o_swing_pct?: number | null;
  z_contact_pct?: number | null;
  swstr_pct?: number | null;
}

export interface PlayerIntel {
  name: string;
  statcast?: PlayerIntelStatcast;
  trends?: PlayerIntelTrends;
  context?: PlayerIntelContext;
  discipline?: PlayerIntelDiscipline;
  error?: string;
}

// Intel standalone tool response types
export interface IntelPlayerReportResponse extends PlayerIntel {}

export interface BreakoutCandidate {
  name: string;
  woba: number;
  xwoba: number;
  diff: number;
  pa: number;
}

export interface BreakoutsResponse {
  pos_type: string;
  candidates: BreakoutCandidate[];
}

export interface BustsResponse {
  pos_type: string;
  candidates: BreakoutCandidate[];
}

export interface RedditPost {
  title: string;
  score: number;
  num_comments: number;
  url?: string;
  created_utc?: number;
  flair?: string;
  category?: string;
}

export interface RedditBuzzResponse {
  posts: RedditPost[];
}

export interface TrendingResponse {
  posts: RedditPost[];
}

export interface ProspectTransaction {
  player: string;
  type: string;
  team?: string;
  date?: string;
  description?: string;
}

export interface ProspectWatchResponse {
  transactions: ProspectTransaction[];
}

export interface IntelTransactionsResponse {
  days: number;
  transactions: ProspectTransaction[];
}

export interface BatchIntelResponse {
  [playerName: string]: PlayerIntel;
}

// Team Settings responses
export interface ChangeTeamNameResponse {
  success: boolean;
  method: string;
  message: string;
  old_name?: string;
  new_name?: string;
}

export interface ChangeTeamLogoResponse {
  success: boolean;
  method: string;
  message: string;
  cloudinary_id?: string;
}

// Waiver Claim responses
export interface WaiverClaimResponse {
  success: boolean;
  player_key: string;
  faab: number | null;
  message: string;
}

export interface WaiverClaimSwapResponse {
  success: boolean;
  add_key: string;
  drop_key: string;
  faab: number | null;
  message: string;
}

// Set Lineup response
export interface SetLineupMove {
  player_id: string;
  position: string;
  success: boolean;
  error?: string;
}

export interface SetLineupResponse {
  success: boolean;
  moves: SetLineupMove[];
  message: string;
}

// Who Owns response
export interface WhoOwnsResponse {
  player_key: string;
  ownership_type: string;
  owner: string;
}

// League Pulse response
export interface LeaguePulseTeam {
  team_key: string;
  name: string;
  moves: number;
  trades: number;
  total: number;
}

export interface LeaguePulseResponse {
  teams: LeaguePulseTeam[];
}

// Trade Proposal types
export interface TradeProposalPlayer {
  name: string;
  player_key?: string;
  player_id?: string;
}

export interface TradeProposal {
  transaction_key: string;
  status: string;
  trader_team_key: string;
  trader_team_name: string;
  tradee_team_key: string;
  tradee_team_name: string;
  trader_players: TradeProposalPlayer[];
  tradee_players: TradeProposalPlayer[];
  trade_note: string;
}

export interface PendingTradesResponse {
  trades: TradeProposal[];
}

export interface ProposeTradeResponse {
  success: boolean;
  tradee_team_key: string;
  your_player_keys: string[];
  their_player_keys: string[];
  message: string;
}

export interface TradeActionResponse {
  success: boolean;
  transaction_key?: string;
  message: string;
}

// What's New Digest response
export interface WhatsNewInjury {
  name: string;
  status: string;
  position: string;
  section: string;
}

export interface WhatsNewActivity {
  type: string;
  player: string;
  team: string;
}

export interface WhatsNewTrending {
  name: string;
  direction: string;
  delta: string;
  percent_owned: number;
}

export interface WhatsNewProspect {
  player: string;
  type: string;
  team: string;
  description: string;
}

export interface WhatsNewResponse {
  last_check: string;
  check_time: string;
  injuries: WhatsNewInjury[];
  pending_trades: TradeProposal[];
  league_activity: WhatsNewActivity[];
  trending: WhatsNewTrending[];
  prospects: WhatsNewProspect[];
}

// Trade Finder response
export interface TradePackagePlayer {
  name: string;
  player_id: string;
  positions: string[];
  status?: string;
}

export interface TradePackage {
  give: TradePackagePlayer[];
  get: TradePackagePlayer[];
  rationale: string;
}

export interface TradePartner {
  team_key: string;
  team_name: string;
  score: number;
  complementary_categories: string[];
  their_hitters: TradePackagePlayer[];
  their_pitchers: TradePackagePlayer[];
  packages: TradePackage[];
}

export interface TradeFinderResponse {
  weak_categories: string[];
  strong_categories: string[];
  partners: TradePartner[];
}

// Power Rankings response
export interface PowerRankingTeam {
  rank: number;
  team_key: string;
  name: string;
  hitting_count: number;
  pitching_count: number;
  roster_size: number;
  avg_owned_pct: number;
  total_score: number;
  is_my_team: boolean;
}

export interface PowerRankingsResponse {
  rankings: PowerRankingTeam[];
}

// Week Planner response
export interface WeekPlannerPlayer {
  name: string;
  position: string;
  positions: string[];
  mlb_team: string;
  total_games: number;
  games_by_date: Record<string, boolean>;
}

export interface WeekPlannerResponse {
  week: number;
  start_date: string;
  end_date: string;
  dates: string[];
  players: WeekPlannerPlayer[];
  daily_totals: Record<string, number>;
}

// Season Pace response
export interface SeasonPaceTeam {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  weeks_played: number;
  remaining_weeks: number;
  win_pct: number;
  projected_wins: number;
  projected_losses: number;
  is_my_team: boolean;
  playoff_status: string;
  magic_number: number;
}

export interface SeasonPaceResponse {
  current_week: number;
  end_week: number;
  playoff_teams: number;
  teams: SeasonPaceTeam[];
}

// Closer Monitor response
export interface CloserPlayer {
  name: string;
  player_id: string;
  positions: string[];
  percent_owned: number;
  status: string;
  mlb_id?: number;
  ownership: string;
}

export interface SavesLeader {
  name: string;
  saves: string;
}

export interface CloserMonitorResponse {
  my_closers: CloserPlayer[];
  available_closers: CloserPlayer[];
  saves_leaders: SavesLeader[];
}

// Pitcher Matchup response
export interface PitcherMatchupEntry {
  name: string;
  player_id: string;
  mlb_team: string;
  next_start_date: string;
  opponent: string;
  home_away: string;
  opp_avg: number;
  opp_obp: number;
  opp_k_pct: number;
  opp_woba: number;
  matchup_grade: string;
  two_start: boolean;
}

export interface PitcherMatchupResponse {
  week: number;
  start_date: string;
  end_date: string;
  pitchers: PitcherMatchupEntry[];
}

// --- News response types ---

export interface NewsEntry {
  player: string;
  headline: string;
  timestamp: string;
  injury_flag: boolean;
  impact?: string;
  source?: string;
}

export interface NewsFeedResponse {
  news: NewsEntry[];
  count: number;
}

export interface PlayerNewsResponse {
  news: NewsEntry[];
  player: string;
  count: number;
  note?: string;
}

// --- Strategy / Advanced Analysis response types ---

export interface ProbablePitcher {
  pitcher: string;
  team: string;
  date: string;
  opponent?: string;
  home_away?: string;
}

export interface ProbablePitchersResponse {
  pitchers: ProbablePitcher[];
}

export interface ScheduleAnalysisResponse {
  team: string;
  days: number;
  games_total: number;
  games_this_week: number;
  games_next_week: number;
  off_days: number;
  density_rating: string;
  [key: string]: unknown;
}

export interface CategoryImpactResponse {
  category_impact: Record<string, { add_z: number; drop_z: number; delta: number; direction: string }>;
  net_z_change: number;
  improving_categories: string[];
  declining_categories: string[];
  assessment: string;
  [key: string]: unknown;
}

export interface RegressionCandidate {
  name: string;
  signal: string;
  details: string;
  [key: string]: unknown;
}

export interface RegressionCandidatesResponse {
  buy_low_hitters: RegressionCandidate[];
  sell_high_hitters: RegressionCandidate[];
  buy_low_pitchers: RegressionCandidate[];
  sell_high_pitchers: RegressionCandidate[];
  [key: string]: unknown;
}

export interface PlayerTierResponse {
  name: string;
  tier: string;
  z_final: number;
  per_category_zscores: Record<string, number>;
  rank: number;
  [key: string]: unknown;
}

// --- Workflow (aggregated) response types ---

export interface ActionItem {
  priority: number;
  type: string;
  message: string;
  player_id?: string;
  transaction_key?: string;
}

export interface MorningBriefingResponse {
  action_items: ActionItem[];
  injury: InjuryReportResponse;
  lineup: LineupOptimizeResponse;
  matchup: MatchupDetailResponse;
  strategy: MatchupStrategyResponse;
  whats_new: WhatsNewResponse;
  waiver_batters: WaiverAnalyzeResponse;
  waiver_pitchers: WaiverAnalyzeResponse;
  edit_date?: string | null;
}

export interface LeagueLandscapeResponse {
  standings: StandingsResponse;
  pace: SeasonPaceResponse;
  power_rankings: PowerRankingsResponse;
  league_pulse: LeaguePulseResponse;
  transactions: TransactionsResponse;
  trade_finder: TradeFinderResponse;
  scoreboard: ScoreboardResponse;
}

export interface RosterIssue {
  severity: "critical" | "warning" | "info";
  type: string;
  message: string;
  fix: string;
  player_id?: string;
}

export interface RosterHealthResponse {
  issues: RosterIssue[];
  injury: InjuryReportResponse;
  lineup: LineupOptimizeResponse;
  roster: RosterResponse;
  busts: BustsResponse;
}

export interface WaiverPair {
  add: {
    name: string;
    player_id: string;
    positions: string;
    score: number;
    percent_owned: number;
  };
  pos_type: string;
  weak_categories: string[];
}

export interface WaiverRecommendationsResponse {
  pairs: WaiverPair[];
  category_check: CategoryCheckResponse;
  waiver_batters: WaiverAnalyzeResponse;
  waiver_pitchers: WaiverAnalyzeResponse;
  roster: RosterResponse;
}

export interface TradeAnalysisResponse {
  give_players: ValuePlayer[];
  get_players: ValuePlayer[];
  give_ids: string[];
  get_ids: string[];
  trade_eval: TradeEvalResponse | null;
  intel: Record<string, PlayerIntel>;
}

// Player Stats response
export interface PlayerStatsResponse {
  player_name: string;
  player_id: string;
  period: string;
  week?: string | null;
  date?: string | null;
  stats: Record<string, string | number>;
  mlb_id?: number;
}

// Roster Stats response
export interface RosterStatsPlayer {
  name: string;
  player_id: string;
  position: string;
  eligible_positions: string[];
  stats: Record<string, string | number>;
  mlb_id?: number;
}

export interface RosterStatsResponse {
  players: RosterStatsPlayer[];
  period: string;
  week?: string | null;
}

// Roster History response
export interface RosterHistoryPlayer {
  name: string;
  player_id: string;
  position: string;
  eligible_positions: string[];
  status: string;
  mlb_id?: number;
}

export interface RosterHistoryResponse {
  players: RosterHistoryPlayer[];
  lookup: string;
  label: string;
}

// Waivers response
export interface WaiversResponse {
  players: Player[];
}

// Taken Players (All Rostered) response
export interface TakenPlayersResponse {
  players: Array<Player & { owner?: string }>;
  position?: string | null;
  count: number;
}

