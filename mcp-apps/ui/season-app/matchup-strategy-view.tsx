import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@plexui/ui/components/Badge";
import { Button } from "@plexui/ui/components/Button";
import { Subheading } from "../components/heading";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerName } from "../shared/player-name";

import { TeamLogo } from "../shared/team-logo";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import {
  Swords, TrendingUp, TrendingDown, Target, Shield, Lock, XCircle,
  Calendar, ArrowRightLeft, Loader2, RefreshCw, UserPlus,
} from "@/shared/icons";

interface StrategyCategory {
  name: string;
  my_value: string;
  opp_value: string;
  result: "win" | "loss" | "tie";
  margin: "close" | "comfortable" | "dominant";
  classification: "target" | "protect" | "concede" | "lock";
  reason: string;
}

interface ScheduleData {
  my_batter_games: number;
  my_pitcher_games: number;
  opp_batter_games: number;
  opp_pitcher_games: number;
  advantage: "you" | "opponent" | "neutral";
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

interface MatchupStrategyData {
  week: number | string;
  opponent: string;
  opp_team_logo?: string;
  score: { wins: number; losses: number; ties: number };
  schedule: ScheduleData;
  categories: StrategyCategory[];
  opp_transactions: OppTransaction[];
  strategy: { target: string[]; protect: string[]; concede: string[]; lock: string[] };
  waiver_targets: WaiverTarget[];
  summary: string;
  ai_recommendation?: string | null;
}

function resultColor(wins: number, losses: number): "green" | "red" | "yellow" {
  if (wins > losses) return "green";
  if (losses > wins) return "red";
  return "yellow";
}

function scoreBadgeColor(wins: number, losses: number): string {
  var color = resultColor(wins, losses);
  if (color === "green") return "bg-sem-success";
  if (color === "red") return "bg-sem-risk";
  return "bg-sem-warning";
}

function scoreLabel(wins: number, losses: number): string {
  if (wins > losses) return "Winning";
  if (losses > wins) return "Losing";
  return "Tied";
}

function classificationBadge(cls: string) {
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
      return <Badge color="secondary" size="sm">{cls}</Badge>;
  }
}

function rowBg(classification: string): string {
  switch (classification) {
    case "target": return "bg-sem-info-subtle";
    case "protect": return "bg-sem-warning-subtle";
    case "concede": return "bg-muted/30";
    case "lock": return "bg-sem-success-subtle";
    default: return "";
  }
}

export function MatchupStrategyView({ data, app, navigate }: { data: MatchupStrategyData; app?: any; navigate?: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);
  const [localData, setLocalData] = useState<MatchupStrategyData | null>(null);
  const d = localData || data;

  const handleRefresh = async () => {
    var result = await callTool("yahoo_matchup_strategy");
    if (result && result.structuredContent) {
      setLocalData(result.structuredContent as MatchupStrategyData);
    }
  };

  const handleAdd = async (playerId: string) => {
    var result = await callTool("yahoo_add", { player_id: playerId });
    if (result && navigate) {
      navigate(result.structuredContent);
    }
  };

  const score = d.score || { wins: 0, losses: 0, ties: 0 };
  const sched = d.schedule || { my_batter_games: 0, my_pitcher_games: 0, opp_batter_games: 0, opp_pitcher_games: 0, advantage: "neutral" };
  const strat = d.strategy || { target: [], protect: [], concede: [], lock: [] };
  var myTotal = sched.my_batter_games + sched.my_pitcher_games;
  var oppTotal = sched.opp_batter_games + sched.opp_pitcher_games;
  var gameDiff = Math.abs(myTotal - oppTotal);

  return (
    <div className="space-y-2">
      <AiInsight recommendation={d.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={myTotal} label="Your Games" color="info" />
        <KpiTile value={oppTotal} label="Opp Games" color="neutral" />
        <KpiTile value={strat.target.length} label="Targets" color="success" />
        <KpiTile value={strat.protect.length} label="Protect" color="warning" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          <Subheading>Matchup Strategy</Subheading>
        </div>
        {app && (
          <Button variant="outline" color="secondary" size="xs" onClick={handleRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        )}
      </div>

      {/* Opponent + Score */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">Week {d.week}</p>
          <p className="font-semibold flex items-center gap-1.5">
            vs.
            {d.opp_team_logo && <img src={d.opp_team_logo} alt="" width={28} height={28} className="rounded-sm" style={{ flexShrink: 0 }} />}
            {d.opponent}
          </p>
        </div>
        <Badge className={"text-sm px-3 py-1 " + scoreBadgeColor(score.wins, score.losses)}>
          {scoreLabel(score.wins, score.losses)}{" "}
          {score.wins}-{score.losses}{score.ties > 0 ? "-" + score.ties : ""}
        </Badge>
      </div>

      {/* Summary Card */}
      {d.summary && (
        <Card className={"border-" + resultColor(score.wins, score.losses) + "-500/30 bg-" + resultColor(score.wins, score.losses) + "-500/5"}>
          <CardContent className="p-4">
            <p className="text-sm leading-relaxed">{d.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Schedule Comparison */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Remaining Games</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">You</p>
              <p className="text-xl font-bold font-mono">{myTotal}</p>
              <p className="text-xs text-muted-foreground">{sched.my_batter_games} bat / {sched.my_pitcher_games} pitch</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Opponent</p>
              <p className="text-xl font-bold font-mono">{oppTotal}</p>
              <p className="text-xs text-muted-foreground">{sched.opp_batter_games} bat / {sched.opp_pitcher_games} pitch</p>
            </div>
          </div>
          {sched.advantage !== "neutral" && (
            <div className="mt-3 text-center">
              <Badge className={sched.advantage === "you" ? "bg-sem-success" : "bg-sem-risk"}>
                {sched.advantage === "you"
                  ? "+" + gameDiff + " game advantage"
                  : "Opponent +" + gameDiff + " games"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          { key: "target" as const, label: "Target", Icon: Target, border: "border-blue-500/30 bg-blue-500/5", icon: "text-blue-500", text: "text-blue-600 dark:text-blue-400" },
          { key: "protect" as const, label: "Protect", Icon: Shield, border: "border-yellow-500/30 bg-yellow-500/5", icon: "text-yellow-500", text: "text-sem-warning" },
          { key: "concede" as const, label: "Concede", Icon: XCircle, border: "border-muted", icon: "text-muted-foreground", text: "text-muted-foreground" },
          { key: "lock" as const, label: "Lock", Icon: Lock, border: "border-green-500/30 bg-sem-success-subtle", icon: "text-sem-success", text: "text-sem-success" },
        ]).map(function (s) {
          if (strat[s.key].length === 0) return null;
          return (
            <Card key={s.key} className={s.border}>
              <CardContent className="p-2 text-center">
                <s.Icon className={"h-3.5 w-3.5 mx-auto mb-1 " + s.icon} />
                <p className={"text-xs font-semibold " + s.text}>{s.label}</p>
                <p className="text-xs text-muted-foreground break-words">{strat[s.key].join(", ")}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Category Strategy Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">You</TableHead>
                <TableHead className="text-right">Opp</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(d.categories || []).map(function (c, i) {
                return (
                  <TableRow key={i + "-" + c.name} className={rowBg(c.classification)} title={c.reason}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{c.my_value}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{c.opp_value}</TableCell>
                    <TableCell className="text-center">
                      {c.result === "win" && <TrendingUp className="h-4 w-4 text-sem-success inline" />}
                      {c.result === "loss" && <TrendingDown className="h-4 w-4 text-sem-risk inline" />}
                      {c.result === "tie" && <span className="text-xs text-sem-warning font-medium">TIE</span>}
                    </TableCell>
                    <TableCell className="text-center">{classificationBadge(c.classification)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Opponent Activity */}
      {(d.opp_transactions || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Opponent Recent Moves</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(d.opp_transactions || []).map(function (tx, idx) {
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
      {(d.waiver_targets || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Recommended Pickups</CardTitle>
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
                {(d.waiver_targets || []).map(function (wt, idx) {
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PlayerName name={wt.name} playerId={wt.pid} mlbId={wt.mlb_id} app={app} navigate={navigate} context="waivers" />
                        </div>
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
    </div>
  );
}
