const API_BASE = "/api";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error: ${res.status}` + (body ? " — " + body : ""));
  }
  return res.json();
}

// Types
export interface Player {
  name: string;
  team: string;
  position: string;
  status: "active" | "bench" | "IL" | "NA";
  stats: Record<string, number>;
  mlb_id?: number;
  statcast?: Record<string, number>;
  trends?: { date: string; value: number }[];
  splits?: { split: string; stats: Record<string, number> }[];
}

export interface RosterPlayer extends Player {
  slot: string;
  isLocked: boolean;
  player_id?: number | string;
  eligible_positions?: string[];
  intel?: {
    mlb_id?: number;
    name?: string;
    statcast?: Record<string, unknown>;
    trends?: Record<string, unknown>;
  };
}

export interface FreeAgent extends Player {
  ownership: number;
  addScore: number;
  type: "hitter" | "pitcher";
  faabSuggested: number;
}

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

export interface MorningBriefing {
  edit_date: string;
  matchup: Record<string, unknown>;
  lineup: { games_today?: number; [key: string]: unknown };
  injury: Record<string, unknown>;
  strategy: { focus_categories?: string | string[]; [key: string]: unknown };
  action_items: { type: string; message: string; player_id?: string; priority: number }[];
  waiver_batters: Record<string, unknown>;
  waiver_pitchers: Record<string, unknown>;
  whats_new: Record<string, unknown>;
}

export interface CategoryCheck {
  category: string;
  value: number;
  rank: number;
  trend: { date: string; value: number }[];
  target: number;
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
  categories: { name: string; my_value: string; opp_value: string; result: "win" | "loss" | "tie" }[];
}

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

export interface Trade {
  id: string;
  partner: string;
  sending: Player[];
  receiving: Player[];
  grade: string;
  analysis: string;
  status: "pending" | "accepted" | "rejected" | "countered";
}

export interface LeagueHistoryEntry {
  season: number;
  wins: number;
  losses: number;
  rank: number;
  champion: string;
  details: Record<string, unknown>;
}

export interface WeekPlannerDay {
  date: string;
  dayOfWeek: string;
  games: number;
  starters: { name: string; matchup: string; quality: "good" | "neutral" | "bad" }[];
  recommendations: string[];
}

export interface PlayerReport {
  player: Player;
  analysis: string;
  outlook: string;
  comparisons: { metric: string; actual: number; expected: number }[];
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  timestamp: string;
  playerName?: string;
}

export interface BreakoutCandidate {
  player: Player;
  reason: string;
  confidence: number;
  keyMetrics: Record<string, number>;
}

export interface SystemStatus {
  status: string;
  [key: string]: unknown;
}

export interface AutonomyConfig {
  mode: "off" | "suggest" | "auto";
  actions: Record<string, boolean>;
  faabLimit: number;
}

export interface Rankings {
  players: { rank: number; name: string; team: string; position: string; value: number }[];
}

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
}

export type ApiResponse = Record<string, unknown>;

// MatchupDetail reuses the Matchup shape (same /matchup-detail endpoint)
export type MatchupDetail = Matchup;

export interface ScoutReport {
  strategy: string[];
  opp_strengths?: string[];
  opp_weaknesses?: string[];
  [key: string]: unknown;
}

export type CategorySimulation = ApiResponse;

export interface InjuryReport {
  injured_active: { name: string; status: string; [key: string]: unknown }[];
  healthy_il: { name: string; status: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface WaiverAnalysis {
  recommendations: { name: string; positions?: string; pct?: number; tier?: string; intel?: string; [key: string]: unknown }[];
  weak_categories?: string[];
  drop_candidates?: { name: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface StreamingPick {
  recommendations: { name: string; team: string; games?: number; z_score?: number; [key: string]: unknown }[];
  week?: number;
  team_games?: Record<string, number>;
  [key: string]: unknown;
}

export interface TradeEvaluation {
  grade?: string;
  analysis?: string;
  give_value?: number;
  get_value?: number;
  [key: string]: unknown;
}

// TODO: add fields once compare endpoint response shape is confirmed
export type PlayerComparison = ApiResponse;

export interface PlayerValue {
  name?: string;
  value?: number;
  z_score?: number;
  rank?: number;
  [key: string]: unknown;
}

export type ZscoreShift = ApiResponse;

export interface ProjectionDisagreement {
  pos_type: string;
  disagreements: Record<string, unknown>[];
}

export interface ParkFactors {
  park_factors: { team: string; factor: number }[];
}

export type Transaction = ApiResponse;
export type TransactionTrends = ApiResponse;
export type StatCategory = ApiResponse;
export type SearchResult = ApiResponse;
export type SwapResult = ApiResponse;
export type BestAvailable = ApiResponse;

export interface PowerRanking {
  rank: number;
  team: string;
  team_logo?: string;
  score?: number;
  record?: string;
  [key: string]: unknown;
}

export interface CategoryTrend {
  category: string;
  values: { week: number; value: number }[];
  [key: string]: unknown;
}

export interface PuntAdvisor {
  recommended_punts: string[];
  analysis?: string;
  [key: string]: unknown;
}

export interface PlayoffPlanner {
  playoff_probability?: number;
  current_seed?: number;
  schedule_strength?: number;
  recommendations?: string[];
  [key: string]: unknown;
}

export interface SeasonPace {
  categories: { name: string; current: number; pace: number; target: number; on_track: boolean }[];
  [key: string]: unknown;
}

export interface ScheduleAnalysis {
  weeks: { week: number; opponent: string; difficulty: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface NewsFeedItem {
  headline: string;
  summary?: string;
  source?: string;
  timestamp?: string;
  player_name?: string;
  sentiment?: string;
  [key: string]: unknown;
}

export interface ProbablePitcher {
  name: string;
  team: string;
  opponent?: string;
  game_time?: string;
  [key: string]: unknown;
}

export interface PitcherMatchupResult {
  pitcher?: string;
  opponent?: string;
  analysis?: string;
  [key: string]: unknown;
}

export interface FaabRecommendation {
  player?: string;
  recommended_bid?: number;
  analysis?: string;
  [key: string]: unknown;
}

export interface CloserMonitorEntry {
  team: string;
  closer?: string;
  status: string;
  handcuff?: string;
  saves?: number;
  [key: string]: unknown;
}

export interface IlStashCandidate {
  name: string;
  return_date?: string;
  value?: number;
  [key: string]: unknown;
}

export interface OwnershipTrendEntry {
  name: string;
  percent_owned: number;
  change: number;
  [key: string]: unknown;
}

export interface TradeFinder {
  recommendations: { partner: string; give: string[]; get: string[]; rationale: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface MlbPlayerInfo {
  name: string;
  position: string;
  team: string;
  bats: string;
  throws: string;
  age: number | string;
  mlb_id: number | string;
}

export interface MlbPlayerStats {
  season: string;
  stats: Record<string, string | number>;
}

export interface MlbBulkStats {
  season: string;
  players: Record<string, Record<string, string | number>>;
}

export interface MlbScheduleGame {
  away: string;
  away_id: number;
  home: string;
  home_id: number;
  status: string;
}

export interface MlbSchedule {
  date: string;
  games: MlbScheduleGame[];
}

export type MlbStandingsData = ApiResponse;
export type MlbInjury = ApiResponse;

// Internal response shapes for normalization
interface FreeAgentRaw {
  name?: string;
  team?: string;
  position?: string;
  positions?: string | string[];
  status?: string;
  stats?: Record<string, number>;
  mlb_id?: number;
  percent_owned?: number;
  ownership?: number;
  score?: number;
  addScore?: number;
  faabSuggested?: number;
  intel?: { context?: { team?: string }; statcast?: Record<string, number>; mlb_id?: number };
}

type FreeAgentsResponse = { players?: FreeAgentRaw[] } | FreeAgentRaw[];

interface StandingRaw {
  name?: string;
  team?: string;
  rank?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  gb?: number;
  playoffPct?: number;
  categories?: Record<string, { value: number; rank: number }>;
  powerRank?: number;
  trend?: { week: number; wins: number; losses: number }[];
  team_logo?: string;
  manager_image?: string;
}

type StandingsResponse = { standings?: StandingRaw[] } | StandingRaw[];

type WeekPlannerResponse = WeekPlannerDay[] | { dates?: string[]; daily_totals?: Record<string, number> };

interface LeagueHistorySeason {
  year: number;
  your_record?: string;
  your_finish?: string;
  champion?: string;
  details?: Record<string, unknown>;
}

interface PlayerReportResponse {
  player?: Player;
  analysis?: string;
  name?: string;
  mlb_id?: number;
  context?: { team?: string; position?: string; positions?: string[]; summary?: string; outlook?: string };
  statcast?: Record<string, number>;
  percentiles?: Record<string, unknown>;
  trends?: { recent?: Record<string, number> };
  discipline?: { summary?: string };
  [key: string]: unknown;
}

interface PercentileValue {
  value?: number;
  league_avg?: number;
}

// Normalization helpers for complex response shapes
function normalizeFreeAgents(r: FreeAgentsResponse): FreeAgent[] {
  const raw = Array.isArray(r) ? r : (r as { players?: FreeAgentRaw[] }).players ?? [];
  return raw.map((p) => ({
    name: p.name || "",
    team: p.intel?.context?.team || p.team || "",
    position: Array.isArray(p.positions) ? p.positions.join("/") : (p.positions || p.position || ""),
    status: (p.status || "active") as FreeAgent["status"],
    stats: p.intel?.statcast || p.stats || {},
    mlb_id: p.mlb_id || p.intel?.mlb_id,
    ownership: p.percent_owned ?? p.ownership ?? 0,
    addScore: p.score ?? p.addScore ?? 0,
    type: /^(SP|RP|P)/.test(Array.isArray(p.positions) ? p.positions[0] || "" : "") ? "pitcher" as const : "hitter" as const,
    faabSuggested: p.faabSuggested ?? 0,
  }));
}

function normalizeStandings(r: StandingsResponse): Standing[] {
  const raw = Array.isArray(r) ? r : (r as { standings?: StandingRaw[] }).standings ?? [];
  return raw.map((s) => ({
    team: s.name || s.team || "",
    rank: s.rank ?? 0,
    wins: s.wins ?? 0,
    losses: s.losses ?? 0,
    ties: s.ties ?? 0,
    gb: s.gb ?? 0,
    playoffPct: s.playoffPct ?? 0,
    categories: s.categories ?? {},
    powerRank: s.powerRank ?? 0,
    trend: s.trend ?? [],
    team_logo: s.team_logo,
    manager_image: s.manager_image,
  }));
}

// GET endpoints — unwrap nested response objects where needed
export const getRoster = () =>
  fetchApi<{ players: RosterPlayer[] }>("/roster").then(r => r.players ?? []);
export const getFreeAgents = (): Promise<FreeAgent[]> =>
  fetchApi<FreeAgentsResponse>("/free-agents").then(normalizeFreeAgents);
export const getStandings = (): Promise<Standing[]> =>
  fetchApi<StandingsResponse>("/standings").then(normalizeStandings);
export const getMorningBriefing = () => fetchApi<MorningBriefing>("/workflow/morning-briefing");
export const getCategoryCheck = () =>
  fetchApi<{ categories: CategoryCheck[] }>("/category-check").then(r => r.categories ?? []);
export const getMatchup = () => fetchApi<Matchup>("/matchup-detail");
export const getScoreboard = () => fetchApi<Scoreboard>("/scoreboard");
export const getPendingTrades = (): Promise<Trade[]> =>
  fetchApi<{ trades?: Trade[] }>("/pending-trades").then(r => {
    if (Array.isArray(r)) return r as unknown as Trade[];
    return r.trades ?? [];
  });
export const getLeagueHistory = () =>
  fetchApi<{ seasons: LeagueHistorySeason[] }>("/league-history").then((r) =>
    (r.seasons ?? []).map((s) => {
      const parts = (s.your_record || "").split("-").map(Number);
      const finish = String(s.your_finish || "");
      const rank = parseInt(finish) || 0;
      return {
        season: s.year,
        wins: parts[0] || 0,
        losses: parts[1] || 0,
        rank,
        champion: s.champion || "",
        details: s.details || {},
      } as LeagueHistoryEntry;
    })
  );
export const getWeekPlanner = (): Promise<WeekPlannerDay[]> =>
  fetchApi<WeekPlannerResponse>("/week-planner").then(r => {
    if (Array.isArray(r)) return r as WeekPlannerDay[];
    const dates: string[] = r.dates ?? [];
    const dailyTotals = r.daily_totals ?? {};
    return dates.map(date => {
      const d = new Date(date + "T12:00:00");
      const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "long" });
      return {
        date,
        dayOfWeek,
        games: dailyTotals[date] ?? 0,
        starters: [],
        recommendations: [],
      } as WeekPlannerDay;
    });
  });
export const getPlayerReport = (name: string): Promise<PlayerReport> =>
  fetchApi<PlayerReportResponse>("/intel/player?name=" + encodeURIComponent(name)).then(r => {
    if (r.player && r.analysis !== undefined) return r as unknown as PlayerReport;
    return {
      player: {
        name: r.name || name,
        team: r.context?.team || "",
        position: r.context?.position || (Array.isArray(r.context?.positions) ? r.context.positions[0] : "") || "",
        status: "active" as const,
        stats: {},
        mlb_id: r.mlb_id,
        statcast: r.statcast || r.percentiles,
        trends: r.trends?.recent
          ? Object.entries(r.trends.recent).map(([date, value]) => ({ date, value: Number(value) }))
          : undefined,
      },
      analysis: r.context?.summary || r.discipline?.summary || "Player report loaded.",
      outlook: r.context?.outlook || "",
      comparisons: r.percentiles
        ? Object.entries(r.percentiles).slice(0, 8).map(([metric, val]) => {
            const v = val as PercentileValue;
            return {
              metric,
              actual: Number(v?.value ?? val ?? 0),
              expected: Number(v?.league_avg ?? 50),
            };
          })
        : [],
    } as PlayerReport;
  });
export const getNewsLatest = (): Promise<NewsItem[]> =>
  fetchApi<{ news?: NewsItem[]; articles?: NewsItem[] }>("/news").then(r => r.news ?? r.articles ?? []);
export const getBreakoutCandidates = () =>
  fetchApi<{ candidates: BreakoutCandidate[] }>("/intel/breakouts").then(r => r.candidates ?? []);
export const getBustCandidates = () =>
  fetchApi<{ candidates: BreakoutCandidate[] }>("/intel/busts").then(r => r.candidates ?? []);
export const getRankings = () => fetchApi<Rankings>("/rankings");
export const getSystemStatus = () => fetchApi<SystemStatus>("/health");
export const getAutonomyConfig = () => fetchApi<AutonomyConfig>("/autonomy-config");

// Player List (enriched with stats, ADP, opponents)
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

export const getPlayerList = (posType = "B", count = 50, status = "FA") =>
  fetchApi<PlayerListResponse>("/player-list?pos_type=" + encodeURIComponent(posType) + "&count=" + count + "&status=" + encodeURIComponent(status));

// Positional Ranks (league-wide team strengths by position)
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

export const getPositionalRanks = () => fetchApi<PositionalRanksResponse>("/positional-ranks");

// New GET endpoints
export const getLeagueContext = () => fetchApi<LeagueContext>("/league-context");
export const getMatchupDetail = () => fetchApi<MatchupDetail>("/matchup-detail");
export const scoutOpponent = () => fetchApi<ScoutReport>("/scout-opponent");
export const getInjuryReport = () => fetchApi<InjuryReport>("/injury-report");
export const getWaiverAnalysis = (posType = "B", count = "15") =>
  fetchApi<WaiverAnalysis>("/waiver-analyze?pos_type=" + encodeURIComponent(posType) + "&count=" + encodeURIComponent(count));
export const getStreaming = (week?: string) =>
  fetchApi<StreamingPick>("/streaming" + (week ? "?week=" + encodeURIComponent(week) : ""));
export const comparePlayers = (player1: string, player2: string) =>
  fetchApi<PlayerComparison>("/compare?player1=" + encodeURIComponent(player1) + "&player2=" + encodeURIComponent(player2));
export const getPlayerValue = (name: string) =>
  fetchApi<PlayerValue>("/value?player_name=" + encodeURIComponent(name));
export const getZscoreShifts = (count = 25) =>
  fetchApi<ZscoreShift>("/zscore-shifts?count=" + count);
export const getProjectionDisagreements = (posType = "B", count = 20) =>
  fetchApi<ProjectionDisagreement>("/projection-disagreements?pos_type=" + encodeURIComponent(posType) + "&count=" + count);
export const getParkFactors = () => fetchApi<ParkFactors>("/park-factors");
export const getTransactions = (type?: string, count?: string) => {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (count) params.set("count", count);
  const qs = params.toString();
  return fetchApi<{ transactions: Transaction[] }>("/transactions" + (qs ? "?" + qs : "")).then(r => r.transactions ?? []);
};
export const getTransactionTrends = () => fetchApi<TransactionTrends>("/transaction-trends");
export const getStatCategories = () => fetchApi<StatCategory>("/stat-categories");
export const searchPlayers = (name: string) =>
  fetchApi<SearchResult>("/search?name=" + encodeURIComponent(name));
export const getBestAvailable = (posType = "B", count = "25") =>
  fetchApi<BestAvailable>("/best-available?pos_type=" + encodeURIComponent(posType) + "&count=" + encodeURIComponent(count));

// New GET endpoints (Phase 6)
export const getTradeFinder = () => fetchApi<TradeFinder>("/trade-finder");
export const getPowerRankings = () =>
  fetchApi<{ rankings?: PowerRanking[] } | PowerRanking[]>("/power-rankings").then(r =>
    Array.isArray(r) ? r : (r as { rankings?: PowerRanking[] }).rankings ?? []
  );
export const getCategoryTrends = () =>
  fetchApi<{ trends?: CategoryTrend[] } | CategoryTrend[]>("/category-trends").then(r =>
    Array.isArray(r) ? r : (r as { trends?: CategoryTrend[] }).trends ?? []
  );
export const getPuntAdvisor = () => fetchApi<PuntAdvisor>("/punt-advisor");
export const getPlayoffPlanner = () => fetchApi<PlayoffPlanner>("/playoff-planner");
export const getSeasonPace = () => fetchApi<SeasonPace>("/season-pace");
export const getScheduleAnalysis = () => fetchApi<ScheduleAnalysis>("/schedule-analysis");
export const getNewsFeed = (filter?: string) =>
  fetchApi<{ articles?: NewsFeedItem[]; news?: NewsFeedItem[] }>("/news/feed" + (filter ? "?filter=" + encodeURIComponent(filter) : ""))
    .then(r => r.articles ?? r.news ?? []);
export const getNewsSources = () => fetchApi<{ sources: string[] }>("/news/sources").then(r => r.sources ?? []);
export const getProbablePitchers = () =>
  fetchApi<{ pitchers?: ProbablePitcher[] } | ProbablePitcher[]>("/probable-pitchers").then(r =>
    Array.isArray(r) ? r : (r as { pitchers?: ProbablePitcher[] }).pitchers ?? []
  );
export const getPitcherMatchup = (pitcher: string, opponent?: string) =>
  fetchApi<PitcherMatchupResult>("/pitcher-matchup?pitcher=" + encodeURIComponent(pitcher) + (opponent ? "&opponent=" + encodeURIComponent(opponent) : ""));
export const getFaabRecommend = (name: string) =>
  fetchApi<FaabRecommendation>("/faab-recommend?name=" + encodeURIComponent(name));
export const getCloserMonitor = () =>
  fetchApi<{ closers?: CloserMonitorEntry[] } | CloserMonitorEntry[]>("/closer-monitor").then(r =>
    Array.isArray(r) ? r : (r as { closers?: CloserMonitorEntry[] }).closers ?? []
  );
export const getIlStashAdvisor = () =>
  fetchApi<{ candidates?: IlStashCandidate[] } | IlStashCandidate[]>("/il-stash-advisor").then(r =>
    Array.isArray(r) ? r : (r as { candidates?: IlStashCandidate[] }).candidates ?? []
  );
export const getOwnershipTrends = () =>
  fetchApi<{ players?: OwnershipTrendEntry[] } | OwnershipTrendEntry[]>("/ownership-trends").then(r =>
    Array.isArray(r) ? r : (r as { players?: OwnershipTrendEntry[] }).players ?? []
  );

// MLB Stats API (always available, no auth)
export const getMlbPlayer = (playerId: string) =>
  fetchApi<MlbPlayerInfo>("/mlb/player?player_id=" + encodeURIComponent(playerId));
export const getMlbStats = (playerId: string, season?: string) =>
  fetchApi<MlbPlayerStats>("/mlb/stats?player_id=" + encodeURIComponent(playerId) + (season ? "&season=" + encodeURIComponent(season) : ""));
export const getMlbStatsBulk = (ids: string[], season?: string) =>
  fetchApi<MlbBulkStats>("/mlb/player-stats-bulk?ids=" + ids.join(",") + (season ? "&season=" + encodeURIComponent(season) : ""));
export const getMlbSchedule = (date?: string) =>
  fetchApi<MlbSchedule>("/mlb/schedule" + (date ? "?date=" + encodeURIComponent(date) : ""));
export const getMlbStandings = () => fetchApi<MlbStandingsData>("/mlb/standings");
export const getMlbInjuries = () => fetchApi<MlbInjury[]>("/mlb/injuries");

// POST endpoints
export const autoOptimizeLineup = () => fetchApi<{ success: boolean; changes: string[]; suggested_swaps?: { player: string; from: string; to: string }[]; applied?: boolean; bench_playing?: string[]; active_off_day?: string[] }>("/lineup-optimize");
export const addPlayer = (name: string, faab?: number) => fetchApi<{ success: boolean }>("/add", { method: "POST", body: JSON.stringify({ name, faab }) });
export const dropPlayer = (name: string) => fetchApi<{ success: boolean }>("/drop", { method: "POST", body: JSON.stringify({ name }) });
export const setLineup = (moves: { player_id: string | number; position: string }[]) =>
  fetchApi<{ success: boolean; changes?: string[] }>("/set-lineup", { method: "POST", body: JSON.stringify({ moves }) });
export const swapPositions = (playerId1: string | number, playerId2: string | number) =>
  fetchApi<{ success: boolean }>("/swap", { method: "POST", body: JSON.stringify({ player1_id: playerId1, player2_id: playerId2 }) });
export const acceptTrade = (id: string) => fetchApi<{ success: boolean }>("/trades/accept", { method: "POST", body: JSON.stringify({ id }) });
export const rejectTrade = (id: string) => fetchApi<{ success: boolean }>("/trades/reject", { method: "POST", body: JSON.stringify({ id }) });
export const tradeEval = (giveIds: string, getIds: string) =>
  fetchApi<TradeEvaluation>("/trade-eval", { method: "POST", body: JSON.stringify({ give_ids: giveIds, get_ids: getIds }) });
export const categorySimulate = (addName: string, dropName?: string) =>
  fetchApi<CategorySimulation>("/category-simulate?add_name=" + encodeURIComponent(addName) + (dropName ? "&drop_name=" + encodeURIComponent(dropName) : ""));
export const swapPlayer = (addId: string, dropId: string) =>
  fetchApi<SwapResult>("/swap", { method: "POST", body: JSON.stringify({ add_id: addId, drop_id: dropId }) });

// PUT endpoints
export const setAutonomyConfig = (config: AutonomyConfig) => fetchApi<AutonomyConfig>("/autonomy-config", { method: "PUT", body: JSON.stringify(config) });

// SSE Chat
export function postChat(message: string, onChunk: (text: string) => void, onToolCall?: (tool: string) => void): { controller: AbortController; promise: Promise<void> } {
  const controller = new AbortController();
  const promise = fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "text") onChunk(parsed.content);
            if (parsed.type === "tool_call" && onToolCall) onToolCall(parsed.name);
          } catch {
            onChunk(data);
          }
        }
      }
    }
  }).catch((err) => {
    if (err.name !== "AbortError") {
      onChunk("[Network error: " + (err.message || "connection failed") + "]");
    }
  });
  return { controller, promise };
}
