import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { useCallTool } from "../shared/use-call-tool";

import { PlayerName } from "../shared/player-name";
import { TeamLogo } from "../shared/team-logo";
import { IntelBadge } from "../shared/intel-badge";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { CategoryTable } from "../shared/comparison-bar";
import { PhaseBar } from "../shared/phase-bar";
import {
  Swords, AlertTriangle, CheckSquare, Target, Shield, Lock, XCircle,
  TrendingUp, TrendingDown, ArrowRightLeft, UserPlus, Loader2, RefreshCw,
  Activity, CheckCircle,
} from "@/shared/icons";

interface ActionItem {
  priority: number;
  type: string;
  message: string;
  player_id?: string;
  transaction_key?: string;
}

interface MatchupCategory {
  name: string;
  my_value: string;
  opp_value: string;
  result: "win" | "loss" | "tie";
}

interface InjuredPlayer {
  name: string;
  position: string;
  status: string;
  injury_description?: string;
  team?: string;
  mlb_id?: number;
  intel?: any;
}

interface LineupSwap {
  bench_player: string;
  start_player: string;
  position: string;
}

interface WhatsNewActivity {
  type: string;
  player: string;
  team: string;
}

interface WhatsNewTrending {
  name: string;
  direction: string;
  delta: string;
  percent_owned: number;
}

interface OppTransaction {
  type: string;
  player: string;
  date: string;
}

interface WaiverTarget {
  name: string;
  pid: string;
  pct: number;
  categories: string[];
  team: string;
  games: number;
  mlb_id?: number;
}

interface MorningBriefingData {
  action_items: ActionItem[];
  injury: {
    injured_active: InjuredPlayer[];
    healthy_il: InjuredPlayer[];
    injured_bench: InjuredPlayer[];
    il_proper: InjuredPlayer[];
  };
  lineup: {
    games_today: number;
    active_off_day: Array<{ name: string; position?: string; team?: string; mlb_id?: number; intel?: any }>;
    bench_playing: Array<{ name: string; position?: string; team?: string; mlb_id?: number; intel?: any }>;
    il_players: Array<{ name: string; position?: string; team?: string }>;
    suggested_swaps: LineupSwap[];
    applied: boolean;
  };
  matchup: {
    week: string | number;
    my_team: string;
    opponent: string;
    my_team_logo?: string;
    opp_team_logo?: string;
    my_manager_image?: string;
    opp_manager_image?: string;
    score: { wins: number; losses: number; ties: number };
    categories: MatchupCategory[];
  };
  strategy: {
    week: number | string;
    opponent: string;
    score: { wins: number; losses: number; ties: number };
    categories: Array<MatchupCategory & { classification?: string; margin?: string }>;
    opp_transactions: OppTransaction[];
    strategy: { target: string[]; protect: string[]; concede: string[]; lock: string[] };
    waiver_targets: WaiverTarget[];
    summary: string;
  };
  whats_new: {
    last_check: string;
    check_time: string;
    injuries: Array<{ name: string; status: string; position: string; section: string }>;
    pending_trades: any[];
    league_activity: WhatsNewActivity[];
    trending: WhatsNewTrending[];
    prospects: Array<{ player: string; type: string; team: string; description: string }>;
  };
  waiver_batters: any;
  waiver_pitchers: any;
  edit_date?: string | null;
  ai_recommendation?: string | null;
  season_context?: {
    phase: string;
    week: number;
    weeks_remaining: number;
    pct_complete: number;
    urgency: string;
    phase_note: string;
  };
  category_trajectory?: Record<string, {
    current_rank: number;
    trend: string;
    projected_rank: number;
    weeks_declining: number;
    alert: boolean;
  }>;
  yesterday?: {
    players: Array<{
      name: string;
      position: string;
      mlb_id?: number;
      stats: Record<string, any>;
    }>;
    period?: string;
    date?: string;
  };
  roster_context?: Array<{
    name: string;
    status: string;
    flags?: string[];
    injury_severity?: string;
    latest_headline?: string;
    reddit?: { mentions: number; sentiment?: string };
  }>;
}

function priorityColor(priority: number): string {
  if (priority === 1) return "bg-sem-risk";
  if (priority === 2) return "bg-sem-warning";
  return "bg-sem-info";
}

function priorityLabel(priority: number): string {
  if (priority === 1) return "URGENT";
  if (priority === 2) return "ISSUE";
  return "OPPORTUNITY";
}

function scoreBadgeColor(wins: number, losses: number): string {
  if (wins > losses) return "bg-sem-success";
  if (losses > wins) return "bg-sem-risk";
  return "bg-sem-warning";
}

function scoreLabel(wins: number, losses: number): string {
  if (wins > losses) return "Winning";
  if (losses > wins) return "Losing";
  return "Tied";
}

function classificationIcon(cls: string) {
  switch (cls) {
    case "target":
      return <Badge className="bg-sem-info"><Target className="h-2.5 w-2.5 mr-0.5 inline" />Target</Badge>;
    case "protect":
      return <Badge className="bg-sem-warning"><Shield className="h-2.5 w-2.5 mr-0.5 inline" />Protect</Badge>;
    case "concede":
      return <Badge variant="secondary" className="text-muted-foreground"><XCircle className="h-2.5 w-2.5 mr-0.5 inline" />Concede</Badge>;
    case "lock":
      return <Badge className="bg-sem-success"><Lock className="h-2.5 w-2.5 mr-0.5 inline" />Lock</Badge>;
    default:
      return null;
  }
}

export function MorningBriefingView({ data, app, navigate }: { data: MorningBriefingData; app?: any; navigate?: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  var matchup = data.matchup || {} as any;
  var strategy = data.strategy || {} as any;
  var injury = data.injury || {} as any;
  var lineup = data.lineup || {} as any;
  var whatsNew = data.whats_new || {} as any;
  var seasonCtx = data.season_context || {} as any;
  var catTrajectory = data.category_trajectory || {};

  var score = matchup.score || { wins: 0, losses: 0, ties: 0 };
  var strat = (strategy.strategy || { target: [], protect: [], concede: [], lock: [] }) as { target: string[]; protect: string[]; concede: string[]; lock: string[] };
  var actions = data.action_items || [];
  var urgentCount = actions.filter(function (a) { return a.priority === 1; }).length;
  var issueCount = actions.filter(function (a) { return a.priority <= 2; }).length;
  var oppCount = actions.filter(function (a) { return a.priority === 3; }).length;
  var injuredActiveCount = (injury.injured_active || []).length;
  var swapCount = (lineup.suggested_swaps || []).length;

  // Categories from strategy (has classification) or matchup
  var categories = (strategy.categories || matchup.categories || []) as Array<MatchupCategory & { classification?: string; margin?: string }>;

  // Close/contested categories for comparison bars
  var contestedCats = categories.filter(function (c) {
    return c.margin === "close" || c.classification === "target" || c.classification === "protect";
  });
  if (contestedCats.length === 0) contestedCats = categories.slice(0, 6);

  // Yesterday's performance — filter to players who actually played, sort by impact
  var yesterdayPlayers = (data.yesterday?.players || []).filter(function (p) {
    var s = p.stats || {};
    return s["H/AB"] && s["H/AB"] !== "-/-" && s["H/AB"] !== "0";
  }).map(function (p) {
    var s = p.stats || {};
    var posType = s.position_type || (["SP","RP","P"].some(function(x) { return (p.position || "").indexOf(x) >= 0; }) ? "P" : "B");
    var impact = 0;
    if (posType === "P") {
      impact = (Number(s.IP) || 0) * 2 + (Number(s.W) || 0) * 5 + (Number(s.QS) || 0) * 4 + (Number(s.K) || 0) - (Number(s.ER) || 0) * 2;
    } else {
      impact = (Number(s.HR) || 0) * 4 + (Number(s.RBI) || 0) * 2 + (Number(s.R) || 0) * 2 + (Number(s.H) || 0) + (Number(s.TB) || 0) * 0.5 - (Number(s.K) || 0);
    }
    return { ...p, posType: posType, impact: impact };
  }).sort(function (a, b) { return b.impact - a.impact; });

  // Roster context — only show players with actual news headlines (flags are unreliable for common names)
  var rosterNews = (data.roster_context || []).filter(function (p) {
    return p.latest_headline;
  });

  var handleRefresh = async function () {
    var result = await callTool("yahoo_morning_briefing");
    if (result && result.structuredContent && navigate) {
      navigate(result.structuredContent);
    }
  };

  var handleAdd = async function (playerId: string) {
    var result = await callTool("yahoo_add", { player_id: playerId });
    if (result && navigate) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-2 animate-stagger">
      {/* AI Insight */}
      <AiInsight recommendation={data.ai_recommendation || strategy.summary} />

      {/* Matchup Hero */}
      {matchup.opponent && (
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center mb-2">{"Week " + (matchup.week || "")}</p>
            <div className="flex items-center justify-between gap-2">
              {/* My team */}
              <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                {matchup.my_team_logo && <img src={matchup.my_team_logo} alt="" className="w-10 h-10 rounded-md" />}
                <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[80px] text-center">{matchup.my_team || "You"}</span>
              </div>
              {/* Score */}
              <div className={"flex flex-col items-center rounded-lg px-3 py-1.5 border shrink-0 " + (score.wins > score.losses ? "bg-sem-success-subtle border-sem-success-border" : score.losses > score.wins ? "bg-sem-risk-subtle border-sem-risk-border" : "bg-sem-warning-subtle border-sem-warning-border")}>
                <span className={"text-2xl font-bold font-mono leading-none tabular-nums " + (score.wins > score.losses ? "text-sem-success" : score.losses > score.wins ? "text-sem-risk" : "text-sem-warning")}>{score.wins + "-" + score.losses + (score.ties > 0 ? "-" + score.ties : "")}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{score.wins > score.losses ? "Leading" : score.losses > score.wins ? "Trailing" : "Tied"}</span>
              </div>
              {/* Opponent */}
              <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                {matchup.opp_team_logo && <img src={matchup.opp_team_logo} alt="" className="w-10 h-10 rounded-md" />}
                <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[80px] text-center">{matchup.opponent || "Opp"}</span>
              </div>
            </div>
            {/* Compact alerts row */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
              {injuredActiveCount > 0 && (
                <span className="text-xs text-sem-risk font-medium">{injuredActiveCount + " injured active"}</span>
              )}
              {swapCount > 0 && (
                <span className="text-xs text-sem-warning font-medium">{swapCount + " lineup swap" + (swapCount > 1 ? "s" : "")}</span>
              )}
              {urgentCount > 0 && (
                <span className="text-xs text-sem-risk font-medium">{urgentCount + " urgent"}</span>
              )}
              {injuredActiveCount === 0 && swapCount === 0 && urgentCount === 0 && (
                <span className="text-xs text-sem-success font-medium">All clear</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Season Phase */}
      <PhaseBar phase={seasonCtx.phase} week={seasonCtx.week} weeks_remaining={seasonCtx.weeks_remaining} phase_note={seasonCtx.phase_note} urgency={seasonCtx.urgency} />

      {/* Category Trajectory Alerts */}
      {Object.keys(catTrajectory).length > 0 && (function () {
        var declining = Object.entries(catTrajectory).filter(function (e) { return e[1].alert || e[1].trend === "declining"; });
        if (declining.length === 0) return null;
        return (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-sem-risk" />
                <Subheading>Category Trends</Subheading>
              </div>
              <div className="space-y-1.5">
                {declining.map(function (entry) {
                  var cat = entry[0];
                  var t = entry[1];
                  return (
                    <div key={cat} className={"flex items-center justify-between py-1 border-b border-border/30 last:border-0 " + (t.alert ? "text-sem-risk" : "text-sem-warning")}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{cat}</span>
                        <span className="text-[10px] text-muted-foreground">{t.weeks_declining > 0 ? t.weeks_declining + "w declining" : "declining"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono">{t.current_rank + "th"}</span>
                        <span className="text-muted-foreground">{"\u2192"}</span>
                        <span className={"font-mono font-bold " + (t.projected_rank >= 10 ? "text-sem-risk" : "")}>{t.projected_rank + "th"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <Subheading>Morning Briefing</Subheading>
          {matchup.week && <Badge variant="secondary">{"Wk " + matchup.week + (seasonCtx.phase ? " \u00B7 " + seasonCtx.phase.charAt(0).toUpperCase() + seasonCtx.phase.slice(1) : "")}</Badge>}
        </div>
        {app && (
          <Button variant="outline" size="xs" onClick={handleRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        )}
      </div>

      {/* Yesterday's Performance */}
      {yesterdayPlayers.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Yesterday's Performance</CardTitle>
              <Badge variant="secondary">{yesterdayPlayers.length} played</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {yesterdayPlayers.slice(0, 8).map(function (p) {
                var s = p.stats || {};
                var line = "";
                if (p.posType === "P") {
                  var parts: string[] = [];
                  if (s.IP) parts.push(s.IP + " IP");
                  if (s.K) parts.push(s.K + " K");
                  if (s.W) parts.push("W");
                  if (s.QS) parts.push("QS");
                  if (s.ER) parts.push(s.ER + " ER");
                  if (s.HLD) parts.push("HLD");
                  line = parts.join(", ");
                } else {
                  var parts2: string[] = [];
                  if (s["H/AB"]) parts2.push(s["H/AB"]);
                  if (s.R) parts2.push(s.R + " R");
                  if (s.HR) parts2.push(s.HR + " HR");
                  if (s.RBI) parts2.push(s.RBI + " RBI");
                  if (s.TB && Number(s.TB) > Number(s.H || 0)) parts2.push(s.TB + " TB");
                  if (s.NSB && Number(s.NSB) > 0) parts2.push(s.NSB + " SB");
                  line = parts2.join(", ");
                }
                var isGood = p.impact > 3;
                var isBad = p.impact < 0;
                return (
                  <div key={p.name} className="flex items-center gap-2 text-sm py-0.5">
                    <PlayerName name={p.name} context="roster" />
                    <span className="text-xs text-muted-foreground">{p.position}</span>
                    <span className={"text-xs font-mono ml-auto " + (isGood ? "text-sem-success" : isBad ? "text-sem-risk" : "text-muted-foreground")}>{line}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roster News */}
      {rosterNews.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Player News</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {rosterNews.slice(0, 5).map(function (p) {
                return (
                  <div key={p.name} className="text-sm">
                    <span className="font-medium">
                      <PlayerName name={p.name} context="roster" />
                    </span>
                    {p.latest_headline && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.latest_headline}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      {actions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Action Items</CardTitle>
              <Badge variant="secondary">{actions.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actions.map(function (item, idx) {
                var actionButton = null;
                if (app) {
                  if (item.type === "injury" && item.player_id) {
                    actionButton = (
                      <Button variant="outline" size="xs" onClick={function () { callTool("yahoo_injury_report"); }}>
                        View Injuries
                      </Button>
                    );
                  } else if (item.type === "lineup") {
                    actionButton = (
                      <Button variant="outline" size="xs" className="bg-sem-info-subtle" onClick={function () { callTool("yahoo_auto_lineup"); }}>
                        Fix Lineup
                      </Button>
                    );
                  } else if (item.type === "waiver" && item.player_id) {
                    actionButton = (
                      <Button variant="outline" size="xs" onClick={function () { handleAdd(item.player_id!); }}>
                        <UserPlus className="h-3 w-3" /> Add
                      </Button>
                    );
                  } else if (item.type === "trade") {
                    actionButton = (
                      <Button variant="outline" size="xs" onClick={function () { callTool("yahoo_pending_trades"); }}>
                        Review
                      </Button>
                    );
                  } else if (item.type === "il_activation" && item.player_id) {
                    actionButton = (
                      <Button variant="outline" size="xs" onClick={function () { callTool("yahoo_injury_report"); }}>
                        Activate
                      </Button>
                    );
                  }
                }
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Badge className={"shrink-0 " + priorityColor(item.priority)}>
                      {priorityLabel(item.priority)}
                    </Badge>
                    <span className="flex-1 text-sm">{item.message}</span>
                    {actionButton}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Swords className="h-4 w-4 text-primary" />
              <Subheading>Categories</Subheading>
            </div>
            <CategoryTable categories={categories} myTeam={matchup.my_team} opponent={matchup.opponent} myLogo={matchup.my_team_logo} oppLogo={matchup.opp_team_logo} />
          </CardContent>
        </Card>
      )}

      {/* Injury Alerts */}
      {(injury.injured_active || []).length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-base text-destructive">Injury Alerts</CardTitle>
              <Badge variant="destructive">{(injury.injured_active || []).length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(injury.injured_active || []).map(function (p: InjuredPlayer) {
              return (
                <div key={p.name} className="flex items-center gap-2.5 py-2 border-b last:border-0">
                  <Badge variant="secondary" className="w-8 justify-center">{p.position}</Badge>
                  <span className="font-medium text-sm flex-1">
                    <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                  </span>
                  {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                  <Badge variant="destructive">{p.status}</Badge>
                  {p.injury_description && <span className="text-xs text-muted-foreground hidden sm:inline">{p.injury_description}</span>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Healthy on IL */}
      {(injury.healthy_il || []).length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-sem-warning" />
              <CardTitle className="text-base text-sem-warning">Ready to Activate</CardTitle>
              <Badge variant="secondary">{(injury.healthy_il || []).length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(injury.healthy_il || []).map(function (p: InjuredPlayer) {
              return (
                <div key={p.name} className="flex items-center gap-2.5 py-2 border-b last:border-0">
                  <Badge variant="secondary" className="w-8 justify-center">{p.position}</Badge>
                  <span className="font-medium text-sm flex-1">
                    <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                  </span>
                  <Badge className="bg-sem-success">Ready</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Lineup Swaps */}
      {(lineup.suggested_swaps || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Suggested Lineup Swaps</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {(lineup.suggested_swaps || []).map(function (s: LineupSwap, i: number) {
              return (
                <div key={i} className="flex items-center gap-2 py-1">
                  <Badge variant="destructive">Bench</Badge>
                  <span className="text-sm"><PlayerName name={s.bench_player} context="roster" /></span>
                  <ArrowRightLeft size={14} className="text-muted-foreground" />
                  <Badge>Start</Badge>
                  <span className="text-sm"><PlayerName name={s.start_player} context="roster" /></span>
                  <Badge variant="secondary">{s.position}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Opponent Moves */}
      {(strategy.opp_transactions || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Opponent Moves</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {(strategy.opp_transactions || []).map(function (tx: OppTransaction, idx: number) {
                return (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Badge variant={tx.type === "add" ? "default" : "secondary"} className="w-12 justify-center">
                      {tx.type === "add" ? "ADD" : "DROP"}
                    </Badge>
                    <span>{tx.player}</span>
                    {tx.date && <span className="text-xs text-muted-foreground ml-auto">{tx.date}</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiver Targets */}
      <WaiverTargetsCard data={data} strategy={strategy} app={app} navigate={navigate} loading={loading} onAdd={handleAdd} />

      {/* Trending Pickups */}
      <TrendingPickupsCard trending={whatsNew.trending || []} />

      {/* League Activity */}
      {(whatsNew.league_activity || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">League Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {(whatsNew.league_activity || []).slice(0, 8).map(function (a: WhatsNewActivity, idx: number) {
                return (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Badge variant={a.type === "add" ? "default" : "secondary"} className="w-12 justify-center">
                      {a.type.toUpperCase()}
                    </Badge>
                    <span>{a.player}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{a.team}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      {data.edit_date && (
        <Text>Lineup edit deadline: {data.edit_date}</Text>
      )}
    </div>
  );
}

/* ── Waiver Targets Card ─────────────────────────────────── */

var EMPTY_DELTA = new Set(["0.0", "+0.0", "0", ""]);

function WaiverTargetsCard({ data, strategy, app, navigate, loading, onAdd }: {
  data: MorningBriefingData; strategy: any; app?: any; navigate?: (data: any) => void; loading: boolean; onAdd: (pid: string) => void;
}) {
  var waiverRecs = ([] as any[])
    .concat((data.waiver_batters as any)?.recommendations || [])
    .concat((data.waiver_pitchers as any)?.recommendations || [])
    .sort(function (a: any, b: any) { return (b.score || 0) - (a.score || 0); })
    .slice(0, 5);
  if (waiverRecs.length === 0) {
    waiverRecs = (strategy.waiver_targets || []).slice(0, 5);
  }
  if (waiverRecs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Top Waiver Targets</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {waiverRecs.map(function (rec: any, idx: number) {
            var helps = rec.helps_categories || rec.categories || [];
            var tier = rec.tier || null;
            var zScore = rec.z_score != null ? rec.z_score : null;
            var positions = rec.positions || "";
            var pct = rec.pct != null ? rec.pct : rec.percent_owned;
            var pid = rec.pid || "";
            var contextLine = rec.context_line || null;
            var regression = typeof rec.regression === "string" ? rec.regression : (rec.regression && rec.regression.signal ? rec.regression.signal : null);

            return (
              <div key={idx} className="flex items-start gap-3 py-2.5 px-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-sm truncate">
                      <PlayerName name={rec.name} playerId={pid} mlbId={rec.mlb_id} app={app} navigate={navigate} context="waivers" />
                    </span>
                    {tier && <Badge variant="secondary" className="text-[10px] shrink-0">{tier}</Badge>}
                    {zScore != null && zScore !== 0 && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{"z=" + zScore}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    {positions && <span>{positions}</span>}
                    {pct != null && <span>{pct + "% owned"}</span>}
                    {regression && <span className={"font-medium " + (regression.indexOf("buy") >= 0 ? "text-sem-success" : "text-sem-warning")}>{regression}</span>}
                  </div>
                  {helps.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">Improves:</span>
                      {helps.map(function (cat: string) {
                        return <Badge key={cat} variant="secondary" className="text-[10px] h-4">{cat}</Badge>;
                      })}
                    </div>
                  )}
                  {contextLine && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 italic">{contextLine}</p>
                  )}
                </div>
                {app && pid && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 mt-0.5"
                    onClick={function () { onAdd(pid); }}
                    disabled={loading}
                  >
                    <UserPlus className="h-3 w-3" /> Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Trending Pickups Card ────────────────────────────────── */

function TrendingPickupsCard({ trending }: { trending: WhatsNewTrending[] }) {
  var risers = trending.filter(function (t) {
    return t.delta && !EMPTY_DELTA.has(t.delta);
  });
  if (risers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-sem-success" />
          <CardTitle className="text-base">Trending Pickups</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {risers.slice(0, 6).map(function (t) {
            return (
              <div key={t.name} className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-3.5 w-3.5 text-sem-success shrink-0" />
                <span className="font-medium truncate">
                  <PlayerName name={t.name} context="waivers" />
                </span>
                <span className="text-xs text-sem-success font-mono shrink-0">{t.delta}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">{t.percent_owned}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
