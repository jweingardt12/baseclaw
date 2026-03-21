import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@plexui/ui/components/Badge";
import { Button } from "@plexui/ui/components/Button";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { useCallTool } from "../shared/use-call-tool";

import { PlayerName } from "../shared/player-name";
import { TeamLogo } from "../shared/team-logo";
import { IntelBadge } from "../shared/intel-badge";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { ComparisonBar } from "../shared/comparison-bar";
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
      return <Badge size="sm" className="bg-sem-info"><Target className="h-2.5 w-2.5 mr-0.5 inline" />Target</Badge>;
    case "protect":
      return <Badge size="sm" className="bg-sem-warning"><Shield className="h-2.5 w-2.5 mr-0.5 inline" />Protect</Badge>;
    case "concede":
      return <Badge color="secondary" size="sm" className="text-muted-foreground"><XCircle className="h-2.5 w-2.5 mr-0.5 inline" />Concede</Badge>;
    case "lock":
      return <Badge size="sm" className="bg-sem-success"><Lock className="h-2.5 w-2.5 mr-0.5 inline" />Lock</Badge>;
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

      {/* KPI Row */}
      <div className="kpi-grid">
        <KpiTile
          value={score.wins + "-" + score.losses + (score.ties > 0 ? "-" + score.ties : "")}
          label={"vs " + (matchup.opponent || "?")}
          color={score.wins > score.losses ? "success" : score.losses > score.wins ? "risk" : "warning"}
        />
        <KpiTile value={issueCount} label="Issues" color={urgentCount > 0 ? "risk" : issueCount > 0 ? "warning" : "success"} />
        <KpiTile value={injuredActiveCount} label="Injured Active" color={injuredActiveCount > 0 ? "risk" : "success"} />
        <KpiTile value={swapCount} label="Lineup Swaps" color={swapCount > 0 ? "warning" : "neutral"} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <Subheading>Morning Briefing</Subheading>
          {matchup.week && <Badge color="secondary" size="sm">Week {matchup.week}</Badge>}
        </div>
        {app && (
          <Button variant="outline" color="secondary" size="xs" onClick={handleRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        )}
      </div>

      {/* Action Items */}
      {actions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Action Items</CardTitle>
              <Badge color="secondary" size="sm">{actions.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actions.map(function (item, idx) {
                return (
                  <div key={idx} className="flex items-start gap-2">
                    <Badge size="sm" className={"shrink-0 mt-0.5 " + priorityColor(item.priority)}>
                      {priorityLabel(item.priority)}
                    </Badge>
                    <span className="text-sm">{item.message}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matchup Preview */}
      {matchup.opponent && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Swords className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Matchup Preview</CardTitle>
              </div>
              <Badge className={"text-sm px-3 py-1 " + scoreBadgeColor(score.wins, score.losses)}>
                {scoreLabel(score.wins, score.losses)} {score.wins}-{score.losses}{score.ties > 0 ? "-" + score.ties : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              vs. <span className="font-semibold text-foreground">{matchup.opponent}</span>
            </p>

            {/* Strategy badges */}
            {(strat.target.length > 0 || strat.protect.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {strat.target.length > 0 && (
                  <div className="text-center p-2 rounded-md border border-blue-500/30 bg-blue-500/5">
                    <Target className="h-3.5 w-3.5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Target</p>
                    <p className="text-xs text-muted-foreground break-words">{strat.target.join(", ")}</p>
                  </div>
                )}
                {strat.protect.length > 0 && (
                  <div className="text-center p-2 rounded-md border border-yellow-500/30 bg-yellow-500/5">
                    <Shield className="h-3.5 w-3.5 mx-auto mb-1 text-yellow-500" />
                    <p className="text-xs font-semibold text-sem-warning">Protect</p>
                    <p className="text-xs text-muted-foreground break-words">{strat.protect.join(", ")}</p>
                  </div>
                )}
                {strat.lock.length > 0 && (
                  <div className="text-center p-2 rounded-md border border-green-500/30 bg-sem-success-subtle">
                    <Lock className="h-3.5 w-3.5 mx-auto mb-1 text-sem-success" />
                    <p className="text-xs font-semibold text-sem-success">Lock</p>
                    <p className="text-xs text-muted-foreground break-words">{strat.lock.join(", ")}</p>
                  </div>
                )}
                {strat.concede.length > 0 && (
                  <div className="text-center p-2 rounded-md border border-muted">
                    <XCircle className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground">Concede</p>
                    <p className="text-xs text-muted-foreground break-words">{strat.concede.join(", ")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Key category bars */}
            {contestedCats.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Key Categories</p>
                {contestedCats.map(function (c) {
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="flex-1">
                        <ComparisonBar
                          label={c.name}
                          leftValue={c.my_value}
                          rightValue={c.opp_value}
                          result={c.result}
                          leftLabel="You"
                          rightLabel="Opp"
                        />
                      </div>
                      {c.classification && (
                        <div className="shrink-0">{classificationIcon(c.classification)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
              <Badge color="danger">{(injury.injured_active || []).length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(injury.injured_active || []).map(function (p: InjuredPlayer) {
              return (
                <div key={p.name} className="flex items-center gap-2.5 py-2 border-b last:border-0">
                  <Badge color="secondary" size="sm" className="w-8 justify-center">{p.position}</Badge>
                  <span className="font-medium text-sm flex-1">
                    <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                  </span>
                  {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                  <Badge color="danger" size="sm">{p.status}</Badge>
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
              <Badge color="secondary">{(injury.healthy_il || []).length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(injury.healthy_il || []).map(function (p: InjuredPlayer) {
              return (
                <div key={p.name} className="flex items-center gap-2.5 py-2 border-b last:border-0">
                  <Badge color="secondary" size="sm" className="w-8 justify-center">{p.position}</Badge>
                  <span className="font-medium text-sm flex-1">
                    <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                  </span>
                  <Badge size="sm" className="bg-sem-success">Ready</Badge>
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
                  <Badge color="danger" size="sm">Bench</Badge>
                  <span className="text-sm"><PlayerName name={s.bench_player} context="roster" /></span>
                  <ArrowRightLeft size={14} className="text-muted-foreground" />
                  <Badge size="sm">Start</Badge>
                  <span className="text-sm"><PlayerName name={s.start_player} context="roster" /></span>
                  <Badge color="secondary" size="sm">{s.position}</Badge>
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
                    <Badge color={tx.type === "add" ? undefined : "zinc"}  size="sm" className="w-12 justify-center">
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
      {(strategy.waiver_targets || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Top Waiver Targets</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="hidden sm:table-cell">Team</TableHead>
                  <TableHead className="text-center">Games</TableHead>
                  <TableHead className="text-right">Own%</TableHead>
                  <TableHead className="hidden sm:table-cell">Targets</TableHead>
                  {app && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(strategy.waiver_targets || []).slice(0, 5).map(function (wt: WaiverTarget, idx: number) {
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <PlayerName name={wt.name} playerId={wt.pid} mlbId={wt.mlb_id} app={app} navigate={navigate} context="waivers" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TeamLogo abbrev={wt.team} />
                          {wt.team}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{wt.games}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{wt.pct}%</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-wrap gap-0.5">
                          {(wt.categories || []).map(function (cat) {
                            return <Badge key={cat} color="secondary" size="sm">{cat}</Badge>;
                          })}
                        </div>
                      </TableCell>
                      {app && (
                        <TableCell>
                          <Button
                            variant="ghost" color="secondary"
                            uniform size="sm"
                            onClick={function () { handleAdd(wt.pid); }}
                            disabled={loading}
                          >
                            <UserPlus className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Trending Players */}
      {(whatsNew.trending || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trending Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {(whatsNew.trending || []).slice(0, 6).map(function (t: WhatsNewTrending) {
                return (
                  <div key={t.name} className="flex items-center gap-2 text-sm">
                    {t.direction === "added"
                      ? <TrendingUp className="h-3.5 w-3.5 text-sem-success" />
                      : <TrendingDown className="h-3.5 w-3.5 text-sem-risk" />}
                    <span className="font-medium">
                      <PlayerName name={t.name} context="waivers" />
                    </span>
                    <span className={"text-xs " + (t.direction === "added" ? "text-sem-success" : "text-sem-risk")}>
                      {t.delta}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">{t.percent_owned}% owned</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
                    <Badge color={a.type === "add" ? undefined : "zinc"}  size="sm" className="w-12 justify-center">
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
