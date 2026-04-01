import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { useCallTool } from "../shared/use-call-tool";

import { PlayerName } from "../shared/player-name";
import { IntelBadge } from "../shared/intel-badge";
import { AiInsight } from "../shared/ai-insight";
import { CategoryTable } from "../shared/comparison-bar";
import {
  Swords, AlertTriangle, CheckSquare, Target, Shield, Lock, XCircle,
  TrendingUp, TrendingDown, ArrowRightLeft, UserPlus, Loader2, RefreshCw,
  Activity, CheckCircle,
} from "@/shared/icons";

import { useState } from "react";

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

var PHASE_LABELS: Record<string, string> = {
  observation: "Observation",
  adjustment: "Buy-Low Window",
  midseason: "Midseason",
  stretch: "Stretch Run",
};

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
  var actions = data.action_items || [];
  var injuredActiveCount = (injury.injured_active || []).length;
  var swapCount = (lineup.suggested_swaps || []).length;

  // Categories from strategy (has classification) or matchup
  var categories = (strategy.categories || matchup.categories || []) as Array<MatchupCategory & { classification?: string; margin?: string }>;

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

  // Roster context — only show players with actual news headlines
  var rosterNews = (data.roster_context || []).filter(function (p) {
    return p.latest_headline;
  });

  // Combined league intel: opponent moves + league activity
  var oppTx = strategy.opp_transactions || [];
  var leagueActivity = (whatsNew.league_activity || []).slice(0, 6);

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

      {/* ── Matchup Hero + Phase ── */}
      {matchup.opponent && (
        <Card>
          <CardContent className="p-3">
            {/* Phase pill row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{"Week " + (matchup.week || "")}</span>
                {seasonCtx.phase && (
                  <Badge variant="secondary" className="text-[10px]">{PHASE_LABELS[seasonCtx.phase] || seasonCtx.phase}</Badge>
                )}
              </div>
              {app && (
                <Button variant="ghost" size="xs" onClick={handleRefresh} disabled={loading} className="h-6 px-1.5">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </Button>
              )}
            </div>
            {/* Score */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                {matchup.my_team_logo && <img src={matchup.my_team_logo} alt="" className="w-10 h-10 rounded-md" />}
                <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[80px] text-center">{matchup.my_team || "You"}</span>
              </div>
              <div className={"flex flex-col items-center rounded-lg px-3 py-1.5 border shrink-0 " + (score.wins > score.losses ? "bg-sem-success-subtle border-sem-success-border" : score.losses > score.wins ? "bg-sem-risk-subtle border-sem-risk-border" : "bg-sem-warning-subtle border-sem-warning-border")}>
                <span className={"text-2xl font-bold font-mono leading-none tabular-nums " + (score.wins > score.losses ? "text-sem-success" : score.losses > score.wins ? "text-sem-risk" : "text-sem-warning")}>{score.wins + "-" + score.losses + (score.ties > 0 ? "-" + score.ties : "")}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{score.wins > score.losses ? "Leading" : score.losses > score.wins ? "Trailing" : "Tied"}</span>
              </div>
              <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                {matchup.opp_team_logo && <img src={matchup.opp_team_logo} alt="" className="w-10 h-10 rounded-md" />}
                <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[80px] text-center">{matchup.opponent || "Opp"}</span>
              </div>
            </div>
            {/* Quick status chips */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50 flex-wrap">
              {injuredActiveCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">{injuredActiveCount + " injured active"}</Badge>
              )}
              {swapCount > 0 && (
                <Badge className="bg-sem-warning text-[10px]">{swapCount + " swap" + (swapCount > 1 ? "s" : "")}</Badge>
              )}
              {lineup.games_today > 0 && (
                <Badge variant="secondary" className="text-[10px]">{lineup.games_today + " games today"}</Badge>
              )}
              {injuredActiveCount === 0 && swapCount === 0 && (
                <Badge className="bg-sem-success text-[10px]">All clear</Badge>
              )}
              {data.edit_date && (
                <span className="text-[10px] text-muted-foreground ml-auto">{"Edit by " + data.edit_date}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Action Items (top priority) ── */}
      {actions.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <Subheading>Action Items</Subheading>
              <Badge variant="secondary">{actions.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {actions.map(function (item, idx) {
                var actionButton = null;
                if (app) {
                  if (item.type === "injury" && item.player_id) {
                    actionButton = (
                      <Button variant="outline" size="xs" onClick={function () { callTool("yahoo_injury_report"); }}>
                        View
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
                  <div key={idx} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 border-b border-border/20 last:border-0">
                    <Badge className={"shrink-0 text-[10px] " + priorityColor(item.priority)}>
                      {priorityLabel(item.priority)}
                    </Badge>
                    <span className="flex-1 text-sm leading-tight min-w-[120px]">{item.message}</span>
                    {actionButton}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Injuries + IL (only if there are issues) ── */}
      {((injury.injured_active || []).length > 0 || (injury.healthy_il || []).length > 0) && (
        <Card className="border-destructive/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <Subheading>Roster Alerts</Subheading>
            </div>
            <div className="space-y-1">
              {(injury.injured_active || []).map(function (p: InjuredPlayer) {
                return (
                  <div key={p.name} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0">
                    <Badge variant="secondary" className="w-7 justify-center text-[10px]">{p.position}</Badge>
                    <span className="font-medium text-sm flex-1 truncate">
                      <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                    </span>
                    {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                    <Badge variant="destructive" className="text-[10px]">{p.status}</Badge>
                  </div>
                );
              })}
              {(injury.healthy_il || []).map(function (p: InjuredPlayer) {
                return (
                  <div key={p.name} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0">
                    <Badge variant="secondary" className="w-7 justify-center text-[10px]">{p.position}</Badge>
                    <span className="font-medium text-sm flex-1 truncate">
                      <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                    </span>
                    <Badge className="bg-sem-success text-[10px]">Ready</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Lineup Swaps ── */}
      {(lineup.suggested_swaps || []).length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <Subheading>Lineup Swaps</Subheading>
            </div>
            {(lineup.suggested_swaps || []).map(function (s: LineupSwap, i: number) {
              return (
                <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 border-b border-border/20 last:border-0 text-sm">
                  <Badge variant="destructive" className="text-[10px]">Out</Badge>
                  <span className="truncate max-w-[40%]"><PlayerName name={s.bench_player} context="roster" /></span>
                  <ArrowRightLeft size={12} className="text-muted-foreground shrink-0" />
                  <Badge className="text-[10px]">In</Badge>
                  <span className="truncate max-w-[40%]"><PlayerName name={s.start_player} context="roster" /></span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{s.position}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Category Breakdown ── */}
      {categories.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Swords className="h-4 w-4 text-primary" />
              <Subheading>Categories</Subheading>
              <CatTrajectoryChips trajectory={catTrajectory} />
            </div>
            <CategoryTable categories={categories} myTeam={matchup.my_team} opponent={matchup.opponent} myLogo={matchup.my_team_logo} oppLogo={matchup.opp_team_logo} />
          </CardContent>
        </Card>
      )}

      {/* ── Yesterday + News (collapsible) ── */}
      {(yesterdayPlayers.length > 0 || rosterNews.length > 0) && (
        <CollapsibleCard
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          title="Yesterday & News"
          badge={yesterdayPlayers.length > 0 ? yesterdayPlayers.length + " played" : undefined}
          defaultOpen={yesterdayPlayers.some(function (p) { return p.impact > 5; }) || rosterNews.length > 0}
        >
          {yesterdayPlayers.length > 0 && (
            <div className="space-y-0.5">
              {yesterdayPlayers.slice(0, 6).map(function (p) {
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
                  <div key={p.name} className="flex items-center gap-1.5 text-sm py-0.5 min-w-0">
                    <span className="truncate shrink min-w-0"><PlayerName name={p.name} context="roster" /></span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{p.position}</span>
                    <span className={"text-[11px] font-mono ml-auto shrink-0 " + (isGood ? "text-sem-success" : isBad ? "text-sem-risk" : "text-muted-foreground")}>{line}</span>
                  </div>
                );
              })}
            </div>
          )}
          {rosterNews.length > 0 && yesterdayPlayers.length > 0 && (
            <div className="border-t border-border/30 mt-2 pt-2" />
          )}
          {rosterNews.length > 0 && (
            <div className="space-y-1">
              {rosterNews.slice(0, 4).map(function (p) {
                return (
                  <div key={p.name} className="text-sm">
                    <span className="font-medium"><PlayerName name={p.name} context="roster" /></span>
                    {p.latest_headline && (
                      <span className="text-xs text-muted-foreground ml-1">{p.latest_headline}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleCard>
      )}

      {/* ── Waiver Targets ── */}
      <WaiverTargetsCard data={data} strategy={strategy} app={app} navigate={navigate} loading={loading} onAdd={handleAdd} />

      {/* ── League Intel (opponent moves + activity + trending, collapsed) ── */}
      {(oppTx.length > 0 || leagueActivity.length > 0 || (whatsNew.trending || []).length > 0) && (
        <CollapsibleCard
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          title="League Intel"
          badge={(oppTx.length + leagueActivity.length) + " moves"}
          defaultOpen={false}
        >
          {oppTx.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Opponent</p>
              {oppTx.map(function (tx: OppTransaction, idx: number) {
                return (
                  <div key={idx} className="flex items-center gap-2 text-sm py-0.5">
                    <Badge variant={tx.type === "add" ? "default" : "secondary"} className="w-10 justify-center text-[10px]">
                      {tx.type === "add" ? "ADD" : "DROP"}
                    </Badge>
                    <span className="truncate">{tx.player}</span>
                    {tx.date && <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{tx.date}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {leagueActivity.length > 0 && (
            <div>
              {oppTx.length > 0 && <div className="border-t border-border/30 mb-2" />}
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">League</p>
              {leagueActivity.map(function (a: WhatsNewActivity, idx: number) {
                return (
                  <div key={idx} className="flex items-center gap-2 text-sm py-0.5">
                    <Badge variant={a.type === "add" ? "default" : "secondary"} className="w-10 justify-center text-[10px]">
                      {a.type.toUpperCase()}
                    </Badge>
                    <span className="truncate">{a.player}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{a.team}</span>
                  </div>
                );
              })}
            </div>
          )}
          <TrendingInline trending={whatsNew.trending || []} />
        </CollapsibleCard>
      )}
    </div>
  );
}

/* ── Collapsible Card ────────────────────────────────────── */

function CollapsibleCard({ icon, title, badge, defaultOpen, children }: {
  icon: any; title: string; badge?: string; defaultOpen: boolean; children: any;
}) {
  var [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardContent className="p-3">
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left min-h-[44px] -my-1"
          onClick={function () { setOpen(!open); }}
        >
          {icon}
          <Subheading>{title}</Subheading>
          {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
          <span className={"ml-auto text-muted-foreground text-xs transition-transform " + (open ? "rotate-180" : "")}>▾</span>
        </button>
        {open && <div className="mt-2">{children}</div>}
      </CardContent>
    </Card>
  );
}

/* ── Category Trajectory Chips (inline in Categories header) ── */

function CatTrajectoryChips({ trajectory }: { trajectory: Record<string, any> }) {
  var declining = Object.entries(trajectory).filter(function (e) { return e[1].alert || e[1].trend === "declining"; });
  if (declining.length === 0) return null;
  return (
    <span className="flex items-center gap-1 ml-auto flex-wrap justify-end">
      {declining.slice(0, 3).map(function (entry) {
        var cat = entry[0];
        var t = entry[1];
        return (
          <Badge key={cat} variant="destructive" className="text-[10px] gap-0.5">
            <TrendingDown className="h-2.5 w-2.5" />
            {cat + " " + t.current_rank + "\u2192" + t.projected_rank}
          </Badge>
        );
      })}
    </span>
  );
}

/* ── Waiver Targets Card ─────────────────────────────────── */

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
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <Subheading>Waiver Targets</Subheading>
        </div>
        <div className="divide-y divide-border/30">
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
              <div key={idx} className="flex items-start gap-2 py-2">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
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
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">Helps:</span>
                      {helps.map(function (cat: string) {
                        return <Badge key={cat} variant="secondary" className="text-[10px] h-4">{cat}</Badge>;
                      })}
                    </div>
                  )}
                  {contextLine && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">{contextLine}</p>
                  )}
                </div>
                {app && pid && (
                  <Button
                    variant="outline"
                    size="xs"
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

/* ── Trending Inline (inside League Intel) ───────────────── */

var EMPTY_DELTA = new Set(["0.0", "+0.0", "0", ""]);

function TrendingInline({ trending }: { trending: WhatsNewTrending[] }) {
  var risers = trending.filter(function (t) {
    return t.delta && !EMPTY_DELTA.has(t.delta);
  });
  if (risers.length === 0) return null;

  return (
    <div>
      <div className="border-t border-border/30 my-2" />
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Trending</p>
      <div className="space-y-0.5">
        {risers.slice(0, 4).map(function (t) {
          return (
            <div key={t.name} className="flex items-center gap-2 text-sm py-0.5">
              <TrendingUp className="h-3 w-3 text-sem-success shrink-0" />
              <span className="font-medium truncate"><PlayerName name={t.name} context="waivers" /></span>
              <span className="text-[10px] text-sem-success font-mono shrink-0">{t.delta}</span>
              <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{t.percent_owned + "%"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
