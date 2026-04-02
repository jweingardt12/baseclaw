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
  percent_started?: number;
  preseason_pick?: number;
  current_pick?: number;
  stats?: Record<string, string | number>;
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

export interface PositionalRankPlayer {
  player_key: string;
  name: string;
}

export interface PositionalRank {
  position: string;
  rank: number;
  grade: string;
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

export interface PlayerListResponse {
  pos_type: string;
  count: number;
  status: string;
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
  team_key?: string;
  wins: number;
  losses: number;
  ties?: number;
  points_for?: string;
}

export interface StandingsResponse {
  standings: StandingsEntry[];
}

export interface SnapshotTeam {
  team_key: string;
  team_id: string;
  name: string;
  manager?: string;
  rank: number;
  playoff_seed?: string;
  games_back?: string;
  wins: number;
  losses: number;
  ties: number;
  win_pct?: string;
  waiver_priority?: number;
  number_of_moves?: number;
  season_stats: Record<string, number>;
  positional_ranks: PositionalRank[];
  recommended_trade_partners: string[];
  players?: SnapshotPlayer[];
}

export interface SnapshotPlayer {
  player_key: string;
  name: string;
  position: string;
  team: string;
  status?: string;
  injury?: string;
}

export interface LeagueSnapshotResponse {
  settings: {
    scoring_type: string;
    roster_positions: { position: string; count: number; is_starting: number }[];
    stat_categories: { stat_id: string; display_name: string; group: string; is_only_display_stat?: boolean }[];
    max_weekly_adds: string;
    trade_end_date: string;
    playoff_start_week: string;
    num_playoff_teams: string;
  };
  teams: SnapshotTeam[];
}

export interface RedzonePlayer {
  id: string;
  name: string;
  position: string;
  position_type: string;
  team: string;
  status: string;
  is_starting: boolean | null;
  has_new_notes: boolean;
  stats: Record<string, number>;
}

export interface RedzoneTeam {
  id: string;
  name: string;
  rank: string;
  wins: number;
  losses: number;
  ties: number;
  remaining_games: number;
  live_games: number;
  completed_games: number;
  players: RedzonePlayer[];
}

export interface RedzoneResponse {
  week: number;
  week_start: string;
  week_end: string;
  my_matchup: { my_team_id: string; opponent_id: string; opponent_name: string } | null;
  matchups: { team1_id: string; team2_id: string }[];
  teams: Record<string, RedzoneTeam>;
  negative_stat_ids: string[];
  scoring_stat_ids: string[];
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
  waiver_type?: string;
  scoring_type?: string;
  waiver_priority?: number;
  faab_balance?: number;
  number_of_moves?: number;
  number_of_trades?: number;
  clinched_playoffs?: number;
}

export interface RosterPosition {
  position: string;
  count: number;
  position_type: string;
}

export interface LeagueContextResponse {
  waiver_type: string;
  uses_faab: boolean;
  scoring_type: string;
  stat_categories: StatCategory[];
  roster_positions: RosterPosition[];
  num_teams: number;
  max_weekly_adds: number;
  faab_balance?: number;
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
  player_id?: string;
  position: string;
  team?: string;
  eligible_positions?: string[];
  status: string;
  injury_description?: string;
  injury_severity?: string;
  injury_detail?: string;
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
  warning?: string;
  news?: NewsHeadline[];
  context_flags?: ContextFlag[];
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

export interface ContextFlag {
  type: "DEALBREAKER" | "WARNING" | "INFO";
  message: string;
  detail: string;
}

export interface NewsHeadline {
  source: string;
  title: string;
  date: string;
  injury_flag: boolean;
}

export interface PlayerNewsContext {
  headlines: NewsHeadline[];
  transactions: Array<{ type: string; date: string; description: string; team: string }>;
  flags: ContextFlag[];
  injury_severity?: string;
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
  stream_score?: number;
  park_factor?: number;
  mlb_id?: number;
  intel?: PlayerIntel;
  trend?: TrendInfo;
  warning?: string;
  news?: NewsHeadline[];
  context_flags?: ContextFlag[];
  context_line?: string;
}

export interface StreamingResponse {
  week: number;
  team_games: Array<{ team: string; games: number }>;
  recommendations: StreamingRecommendation[];
  filtered?: Array<{ name: string; reason: string }>;
}

// Python returns give_players/get_players (not giving/getting)
// Each player has name, player_id, positions (array), value
export interface TradePlayer {
  name: string;
  player_id: string;
  positions: string[];
  value: number;
  mlb_id?: number;
  injury_severity?: string;
  intel?: PlayerIntel;
  context_line?: string;
}

export interface TradeEvalResponse {
  give_players: TradePlayer[];
  get_players: TradePlayer[];
  give_value: number;
  get_value: number;
  net_value: number;
  grade: string;
  position_impact: { losing: string[]; gaining: string[] };
  adjusted_net_value?: number;
  roster_spot_adj?: number;
  category_fit_bonus?: number;
  consolidation_premium?: number;
  catcher_premium?: number;
  rival_warning?: { is_rival: boolean; warning?: string; my_position?: number; partner_position?: number; gap?: number };
  sgp_give?: number;
  sgp_get?: number;
  sgp_net?: number;
  warnings?: string[];
  their_side?: {
    grade: string;
    give_value: number;
    get_value: number;
    net_value: number;
    adjusted_net_value: number;
    category_fit_bonus: number;
    roster_spot_adj: number;
    consolidation_premium: number;
    catcher_premium: number;
    weak_cats?: string[];
    strong_cats?: string[];
    weak_cats_filled?: string[];
  };
  fairness?: string;
  acceptance_likelihood?: string;
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

export interface MlbDraftPick {
  round: string;
  pick_number: string;
  name: string;
  position: string;
  school: string;
  team: string;
}

export interface MlbDraftResponse {
  year: string;
  picks: MlbDraftPick[];
  note?: string;
}

// Weather/venue risk responses
export interface WeatherGame {
  away: string;
  home: string;
  venue: string;
  game_time: string;
  status: string;
  is_dome: boolean;
  weather_risk: string;
  weather_note: string;
}

export interface WeatherResponse {
  date: string;
  games: WeatherGame[];
  dome_count: number;
  outdoor_count: number;
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
  expected?: {
    xwoba?: number | null;
    xwoba_pct?: number | null;
    xwoba_tier?: string | null;
    xba?: number | null;
    xba_pct?: number | null;
  };
  batted_ball?: {
    avg_exit_velo?: number | null;
    ev_pct?: number | null;
    ev_tier?: string | null;
    barrel_pct_rank?: number | null;
    hard_hit_pct?: number | null;
    hard_hit_pct_rank?: number | null;
  };
  speed?: {
    sprint_speed?: number | null;
    sprint_pct?: number | null;
    speed_tier?: string | null;
  };
  data_season?: number | null;
  quality_tier?: string | null;
  note?: string | null;
  // Legacy flat fields for backwards compat
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
}

export interface PlayerIntelTrends {
  last_14_days?: Record<string, string | number>;
  last_30_days?: Record<string, string | number>;
  vs_last_year?: string;
  hot_cold?: string;
  status?: string;
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

export interface StatcastComparison {
  metric: string;
  current: number | null;
  historical: number | null;
  delta: number | null;
  direction: string | null;
}

export interface StatcastCompareResponse {
  name: string;
  days: number;
  current_date: string | null;
  historical_date: string | null;
  comparisons: StatcastComparison[];
  note?: string;
  error?: string;
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

export interface PercentOwnedPlayer {
  player_id: string;
  name: string;
  percent_owned: number;
}

export interface PercentOwnedResponse {
  players: PercentOwnedPlayer[];
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
  player_id?: string;
  status: string;
  position: string;
  injury_severity?: string;
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

export interface WhatsNewProspectNewsAlert {
  player: string;
  signal_type: string;
  description: string;
  source_tier?: number;
}

export interface WhatsNewResponse {
  last_check: string;
  check_time: string;
  injuries: WhatsNewInjury[];
  pending_trades: TradeProposal[];
  league_activity: WhatsNewActivity[];
  trending: WhatsNewTrending[];
  prospects: WhatsNewProspect[];
  prospect_news_alerts?: WhatsNewProspectNewsAlert[];
}

// Trade Finder response
export interface TradePackagePlayer {
  name: string;
  player_id: string;
  positions: string[];
  z_score?: number;
  tier?: string;
  per_category_zscores?: Record<string, number>;
  status?: string;
  mlb_id?: number | null;
  is_pitcher?: boolean;
  intel?: Record<string, unknown>;
}

export interface TradePackage {
  give: TradePackagePlayer[];
  get: TradePackagePlayer[];
  rationale: string;
}

export interface TradeProposal {
  offer: string[];
  offer_details: TradePackagePlayer[];
  receive: string[];
  receive_details: TradePackagePlayer[];
  your_z_change: number;
  their_z_change: number;
  fairness_score: number;
  addresses_needs: string[];
  composite_score: number;
  summary: string;
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
  // League-scan mode fields
  weak_categories?: string[];
  strong_categories?: string[];
  partners?: TradePartner[];
  // Target-player mode fields
  target_player?: string;
  target_team?: string;
  target_team_needs?: string[];
  target_z_score?: number;
  target_tier?: string;
  proposals?: TradeProposal[];
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

// League Intel response
export interface LeagueIntelPowerRanking {
  rank: number;
  name: string;
  team_key: string;
  team_logo: string;
  manager_image: string;
  is_my_team: boolean;
  record: string;
  wins: number;
  losses: number;
  ties: number;
  roster_z_total: number;
  hitting_z: number;
  pitching_z: number;
  composite_score: number;
  adjusted_z_total: number;
  z_upside: number;
  strongest_categories: string[];
  weakest_categories: string[];
}

export interface LeagueIntelPerformer {
  name: string;
  team_key: string;
  team_name: string;
  position: string;
  z_final: number;
  tier: string;
  mlb_team: string;
  quality_tier?: string;
  hot_cold?: string;
  regression?: string;
  adjusted_z?: number;
}

export interface LeagueIntelTeamProfile {
  team_key: string;
  name: string;
  team_logo: string;
  manager_image: string;
  is_my_team: boolean;
  rank: number;
  record: string;
  hitting_z: number;
  pitching_z: number;
  roster_z_total: number;
  adjusted_z_total: number;
  z_upside: number;
  top_players: string[];
  strongest_categories: string[];
  weakest_categories: string[];
  surplus_positions: string[];
  weak_positions: string[];
  trade_fit: string;
  quality_breakdown: Record<string, number>;
  buy_low_count: number;
  sell_high_count: number;
  hot_players: number;
  cold_players: number;
}

export interface LeagueIntelCategoryRanking {
  rank: number;
  team_name: string;
  team_key: string;
  value: string | number;
  is_my_team: boolean;
}

export interface LeagueIntelCategoryLeaderboard {
  category: string;
  rankings: LeagueIntelCategoryRanking[];
}

export interface LeagueIntelH2HOpponent {
  opponent: string;
  opponent_key: string;
  wins: number;
  losses: number;
  ties: number;
}

export interface LeagueIntelH2HRecord {
  team_key: string;
  team_name: string;
  is_my_team: boolean;
  overall: { wins: number; losses: number; ties: number };
  streak: string;
  vs: LeagueIntelH2HOpponent[];
}

export interface LeagueIntelResponse {
  generated_at: string;
  my_team_key: string;
  num_teams: number;
  power_rankings: LeagueIntelPowerRanking[];
  top_performers: LeagueIntelPerformer[];
  team_profiles: LeagueIntelTeamProfile[];
  category_leaderboards: LeagueIntelCategoryLeaderboard[];
  h2h_matrix: LeagueIntelH2HRecord[];
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

// FAAB Recommendation response
export interface FaabRecommendPlayer {
  name: string;
  z_final: number;
  tier: string;
  pos: string;
  team: string;
}

export interface FaabRecommendResponse {
  player: FaabRecommendPlayer;
  recommended_bid: number;
  bid_range: { low: number; high: number };
  faab_remaining: number;
  faab_after: number;
  pct_of_budget: number;
  reasoning: string[];
  category_impact: Record<string, { add_z: number; drop_z: number; delta: number; direction: string }>;
  improving_categories: string[];
  phase_multiplier?: number;
  weeks_remaining?: number;
  player_tier?: string;
  is_contender?: boolean;
}

// Ownership Trends response
export interface OwnershipTrendEntry {
  date: string;
  pct_owned: number;
}

export interface OwnershipTrendsResponse {
  player_name: string;
  player_id: string;
  trend: OwnershipTrendEntry[];
  current_pct: number | null;
  direction: string;
  delta_7d: number;
  delta_30d: number;
  message?: string;
}

// Category Trends response
export interface CategoryHistoryEntry {
  week: number;
  value: number;
  rank: number;
}

export interface CategoryTrend {
  name: string;
  history: CategoryHistoryEntry[];
  current_rank: number;
  best_rank: number;
  worst_rank: number;
  trend: string;
}

export interface CategoryTrendsResponse {
  categories: CategoryTrend[];
  message?: string;
}

// Punt Advisor response
export interface PuntAdvisorCategory {
  name: string;
  stat_id: string;
  rank: number;
  value: string;
  total: number;
  gap_to_next: string;
  gap_from_above: string;
  cost_to_compete: string;
  lower_is_better: boolean;
  recommendation: string;
  reasoning: string;
}

export interface PuntAdvisorResponse {
  team_name: string;
  current_rank: number | string;
  num_teams: number;
  categories: PuntAdvisorCategory[];
  punt_candidates: string[];
  target_categories: string[];
  correlation_warnings: string[];
  strategy_summary: string;
}

// --- News response types ---

export interface NewsEntry {
  player: string;
  headline: string;
  timestamp: string;
  injury_flag: boolean;
  impact?: string;
  source?: string;
  link?: string;
  raw_title?: string;
}

export interface NewsFeedResponse {
  news: NewsEntry[];
  count: number;
}

export interface AggregatedNewsFeedResponse {
  entries: NewsEntry[];
  sources: string[];
  count: number;
}

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  ttl: number;
  enabled: boolean;
  last_fetch?: string | null;
  item_count: number;
}

export interface NewsSourcesResponse {
  sources: NewsSource[];
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
  season_standings?: Record<string, any>;
}

export interface LeagueLandscapeResponse {
  standings: StandingsResponse;
  pace: SeasonPaceResponse;
  power_rankings: PowerRankingsResponse;
  league_pulse: LeaguePulseResponse;
  transactions: TransactionsResponse;
  trade_finder: TradeFinderResponse;
  scoreboard: ScoreboardResponse;
  league_snapshot?: LeagueSnapshotResponse;
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

export interface PositionalUpgrade {
  position: string;
  current: string;
  new: string;
  upgrade: boolean;
}

export interface PositionalImpactResponse {
  upgrades: PositionalUpgrade[];
  redundancies: PositionalUpgrade[];
  new_positions: Array<{ position: string; player: string; z_score: number }>;
  net_starting_impact: string;
}

export interface CategoryImpactDetail {
  category: string;
  give_z: number;
  get_z: number;
  diff: number;
}

export interface CategoryImpactResponse {
  categories_gained: string[];
  categories_lost: string[];
  details: CategoryImpactDetail[];
}

export interface TradeAnalysisResponse {
  give_players: ValuePlayer[];
  get_players: ValuePlayer[];
  give_ids: string[];
  get_ids: string[];
  trade_eval: TradeEvalResponse | null;
  intel: Record<string, PlayerIntel>;
  news_context?: Record<string, PlayerNewsContext>;
  positional_impact?: PositionalImpactResponse;
  category_impact?: CategoryImpactResponse;
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

// IL Stash Advisor response
export interface ILStashPlayer {
  name: string;
  player_id?: string;
  position: string;
  status: string;
  z_score: number;
  tier: string;
  recommendation: string;
  reasoning: string;
  mlb_id?: number;
  injury_description?: string;
  intel?: PlayerIntel;
}

export interface ILStashFACandidate {
  name: string;
  player_id?: string;
  position: string;
  status: string;
  z_score: number;
  tier: string;
  percent_owned: number;
  recommendation: string;
  reasoning: string;
  mlb_id?: number;
  injury_description?: string;
  intel?: PlayerIntel;
}

export interface ILStashAdvisorResponse {
  il_slots: { used: number; total: number };
  your_il_players: ILStashPlayer[];
  fa_il_stash_candidates: ILStashFACandidate[];
  summary: string;
}

// Optimal Moves response
export interface OptimalMovePlayer {
  name: string;
  player_id: string;
  pos: string;
  z_score: number;
  tier?: string;
  percent_owned?: string;
  warning?: string;
  news?: NewsHeadline[];
  context_flags?: ContextFlag[];
  context_line?: string;
}

export interface OptimalMove {
  rank: number;
  drop: OptimalMovePlayer;
  add: OptimalMovePlayer;
  z_improvement: number;
  categories_gained: string[];
  categories_lost: string[];
}

export interface OptimalMovesResponse {
  roster_z_total: number;
  projected_z_after: number;
  net_improvement: number;
  moves: OptimalMove[];
  filtered_dealbreakers?: Array<{ name: string; reason: string }>;
  summary: string;
}

// Playoff Planner response
export interface PlayoffCategoryGap {
  category: string;
  current_rank: number;
  target_rank: number;
  places_to_gain: number;
  gap: string;
  priority: string;
  cost_to_compete: string;
}

export interface PlayoffAction {
  action_type: string;
  description: string;
  impact?: string;
  priority: string;
}

export interface PlayoffPlannerResponse {
  current_rank: number;
  playoff_cutoff: number;
  games_back: number;
  team_name: string;
  record: string;
  num_teams: number;
  category_gaps: PlayoffCategoryGap[];
  recommended_actions: PlayoffAction[];
  target_categories: string[];
  punt_categories: string[];
  playoff_probability: number;
  summary: string;
}

// Trash Talk response
export interface TrashTalkResponse {
  opponent: string;
  intensity: string;
  week: number | string;
  context: {
    your_rank: number | string;
    their_rank: number | string;
    score: string;
  };
  lines: string[];
  featured_line: string;
}

// Rival History responses
export interface RivalMatchupEntry {
  week: number;
  score: string;
  result: "win" | "loss" | "tie";
  mvp_category: string;
  note: string;
}

export interface RivalCategoryDetail {
  category: string;
  result: "win" | "loss" | "tie";
  my_value: string;
  opp_value: string;
}

export interface RivalOverviewEntry {
  opponent: string;
  record: string;
  wins: number;
  losses: number;
  ties: number;
  last_result: string;
  last_week: number;
  dominance: string;
}

export interface RivalHistoryOverviewResponse {
  your_team: string;
  rivals: RivalOverviewEntry[];
  error?: string;
}

export interface RivalHistoryDetailResponse {
  your_team: string;
  opponent: string;
  all_time_record: string;
  wins: number;
  losses: number;
  ties: number;
  matchups: RivalMatchupEntry[];
  category_edge: {
    you_dominate: string[];
    they_dominate: string[];
  };
  biggest_win: RivalMatchupEntry | null;
  closest_match: RivalMatchupEntry | null;
  narrative: string;
}

// Achievements response
export interface Achievement {
  name: string;
  description: string;
  earned: boolean;
  value: string | null;
  icon: string;
}

export interface AchievementsResponse {
  total_earned: number;
  total_available: number;
  team_name: string;
  record: string;
  current_rank: number;
  current_streak: number;
  longest_streak: number;
  achievements: Achievement[];
}

// Weekly Narrative response
export interface WeeklyNarrativeCategoryResult {
  name: string;
  your_value: string;
  opp_value: string;
  result: string;
}

export interface WeeklyNarrativeResponse {
  week: string | number;
  result: string;
  score: string;
  opponent: string;
  categories: WeeklyNarrativeCategoryResult[];
  mvp_category: { name: string; your_value: string; opp_value: string };
  weakness: { name: string; your_value: string; opp_value: string };
  standings_change: { from: string | number; to: string | number; direction: string };
  current_rank: string | number;
  key_moves: string[];
  narrative: string;
}

// --- New workflow orchestrator response types ---

export interface GameDayManagerResponse {
  schedule: MlbScheduleResponse | { _error?: string };
  weather_risks: Array<{ game: string; risk: string; note: string }>;
  injuries: InjuryReportResponse | { _error?: string };
  lineup_changes: Array<{ bench: string; start: string; position: string }>;
  streaming_suggestion: { name: string; team: string; games: number; score: number } | null;
  summary: string;
}

export interface WaiverDeadlinePrepResponse {
  weak_categories: string[];
  ranked_claims: Array<{
    player: string;
    player_id: string;
    pos_type: string;
    percent_owned: number;
    score: number;
    faab_bid?: number;
    net_rank_improvement: number;
    category_impact: string[];
  }>;
  roster_issues: string[];
  category_check: CategoryCheckResponse | { _error?: string };
  waiver_batters: WaiverAnalyzeResponse | { _error?: string };
  waiver_pitchers: WaiverAnalyzeResponse | { _error?: string };
}

export interface TradePipelineProposal {
  give: string[];
  get: string[];
  give_value: number;
  get_value: number;
  net_value: number;
  grade: string;
  their_grade?: string;
  category_impact: string[];
}

export interface TradePipelinePartner {
  team: string;
  team_key: string;
  complementary_categories: string[];
  proposals: TradePipelineProposal[];
}

export interface TradePipelineResponse {
  weak_categories: string[];
  strong_categories: string[];
  partners: TradePipelinePartner[];
}

export interface WeeklyDigestResponse {
  week: string | number;
  opponent: string;
  matchup_result: string;
  standings: StandingsResponse | { _error?: string };
  transactions: TransactionsResponse | { _error?: string };
  move_count: number;
  achievements_earned: string[];
  narrative: string;
  matchup: MatchupDetailResponse | { _error?: string };
  roster_stats: RosterStatsResponse | { _error?: string };
  whats_new: WhatsNewResponse | { _error?: string };
}

export interface SeasonCheckpointResponse {
  current_rank: number | string;
  playoff_probability: number;
  target_categories: string[];
  punt_categories: string[];
  category_trajectory: { improving: string[]; declining: string[] };
  trade_recommendations: string[];
  summary: string;
  standings: StandingsResponse | { _error?: string };
  pace: SeasonPaceResponse | { _error?: string };
  playoff_planner: PlayoffPlannerResponse | { _error?: string };
  category_trends: CategoryTrendsResponse | { _error?: string };
  trade_finder: TradeFinderResponse | { _error?: string };
}

// --- Prospect Intelligence response types ---

export interface ProspectEvaluation {
  readiness_score: number;
  strengths: string[];
  concerns: string[];
  grade: string;
}

export interface CallupProbability {
  probability: number;
  classification: string;
  factors: string[];
}

export interface StashRecommendation {
  action: string;
  confidence: number;
  reasons: string[];
}

export interface ProspectMiLBStats {
  level: string;
  games: number;
  [key: string]: unknown;
}

export interface ProspectReportResponse {
  name: string;
  mlb_id?: number;
  age?: number;
  position?: string;
  organization?: string;
  current_level?: string;
  on_40_man?: boolean;
  milb_stats?: ProspectMiLBStats[];
  evaluation?: ProspectEvaluation;
  callup_probability?: CallupProbability;
  stash_recommendation?: StashRecommendation;
  fv_grade?: number;
  overall_rank?: number;
  eta?: string;
  error?: string;
}

export interface ProspectRankingEntry {
  name: string;
  mlb_id?: number;
  position?: string;
  organization?: string;
  overall_rank?: number;
  fv_grade?: number;
  current_level?: string;
  eta?: string;
  on_40_man?: boolean;
  callup_probability?: number;
  classification?: string;
  readiness_score?: number;
}

export interface ProspectRankingsResponse {
  prospects: ProspectRankingEntry[];
  count: number;
  filters?: Record<string, string>;
}

export interface CallupWireEntry {
  player_name: string;
  team: string;
  type: string;
  date: string;
  description: string;
  fantasy_relevance?: number;
  prospect_rank?: number;
  creates_opportunity?: string[];
}

export interface CallupWireResponse {
  transactions: CallupWireEntry[];
  days: number;
  count: number;
}

export interface StashAdvisorEntry {
  name: string;
  mlb_id?: number;
  position?: string;
  organization?: string;
  action: string;
  confidence: number;
  reasons: string[];
  callup_probability?: number;
  classification?: string;
  readiness_score?: number;
  fv_grade?: number;
}

export interface StashAdvisorResponse {
  recommendations: StashAdvisorEntry[];
  count: number;
}

export interface ProspectCompareResponse {
  player1: ProspectReportResponse;
  player2: ProspectReportResponse;
}

export interface ProspectBuzzPost {
  title: string;
  score: number;
  num_comments: number;
  url?: string;
  subreddit?: string;
  prospect_match?: string;
}

export interface ProspectBuzzResponse {
  posts: ProspectBuzzPost[];
  count: number;
}

export interface EtaTrackerEntry {
  name: string;
  mlb_id?: number;
  current_probability: number;
  previous_probability: number;
  change: number;
  classification: string;
  flagged: boolean;
}

export interface EtaTrackerResponse {
  prospects: EtaTrackerEntry[];
  count: number;
}

export interface ProspectTradeTarget {
  name: string;
  mlb_id?: number;
  position?: string;
  organization?: string;
  owner?: string;
  owner_team_key?: string;
  overall_rank?: number;
  fv_grade?: number;
  callup_probability?: number;
  callup_classification?: string;
  urgency?: string;
  eta?: string;
  trade_suggestion?: string;
}

export interface ProspectTradeTargetsResponse {
  targets: ProspectTradeTarget[];
  count: number;
}

// Prospect News Intelligence types
export interface ProspectNewsSignal {
  signal_type: string;
  description: string;
  source: string;
  decay_factor: number;
  probability_delta: number;
}

export interface ProspectNewsArticle {
  title: string;
  source: string;
  date: string;
  url: string;
  signals: string[];
  sentiment: string;
}

export interface ProspectNewsSentiment {
  label: string;
  emoji: string;
  score: number;
}

export interface ProspectNewsResponse {
  prospect_name: string;
  articles_found: number;
  signals_extracted: number;
  article_summaries: ProspectNewsArticle[];
  overall_sentiment: ProspectNewsSentiment;
  ensemble_probability?: number;
  stat_based_probability?: number;
  news_adjusted_probability?: number;
  news_delta?: number;
  news_weight_used?: number;
  signal_contributions?: ProspectNewsSignal[];
  has_strong_signal?: boolean;
  error?: string;
}

