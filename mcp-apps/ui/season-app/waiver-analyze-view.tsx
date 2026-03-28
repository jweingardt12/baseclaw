import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BarChart as BarChartComponent } from "@/charts";
import { Subheading } from "../components/heading";
import { useCallTool } from "../shared/use-call-tool";

import { IntelPanel } from "../shared/intel-panel";
import { ContextChips } from "../shared/context-chips";
import { PlayerCell, OwnershipCell } from "../shared/player-row";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { UserPlus, ArrowRightLeft, Loader2, TrendingUp } from "@/shared/icons";
import { formatFixed } from "../shared/number-format";
import { PhaseBar } from "../shared/phase-bar";

interface WaiverPlayer {
  name: string;
  pid?: string;
  player_id?: string;
  pct?: number;
  percent_owned?: number;
  positions: string;
  status: string;
  score: number;
  z_score?: number;
  tier?: string;
  mlb_id?: number;
  intel?: any;
  trend?: any;
  warning?: string;
  context_flags?: Array<{ type: string; message: string; detail?: string }>;
  context_line?: string;
  news?: Array<{ title: string; link?: string; source?: string }>;
  role_change?: { role_changed?: boolean; description?: string };
}

interface WeakCategory {
  name: string;
  rank: number;
  total: number;
}

interface WaiverData {
  pos_type: string;
  weak_categories: (WeakCategory | string)[];
  recommendations?: WaiverPlayer[];
  players?: WaiverPlayer[];
  ai_recommendation?: string | null;
}

function scoreBarColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 50) return "bg-blue-500";
  return "bg-muted-foreground/40";
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-16 rounded-full overflow-hidden bg-muted">
        <div className={"rounded-full " + scoreBarColor(pct)} style={{ width: pct + "%" }} />
      </div>
      <span className="font-mono text-xs font-medium w-8">{formatFixed(score, 1, "0.0")}</span>
    </div>
  );
}

function tierBarFill(tier: string): string {
  if (tier === "Untouchable" || tier === "Core") return "#22c55e";
  if (tier === "Solid") return "#eab308";
  return "#ef4444";
}

export function WaiverAnalyzeView({ data, app, navigate }: { data: WaiverData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);
  const [swapTarget, setSwapTarget] = useState<WaiverPlayer | null>(null);
  const label = data.pos_type === "P" ? "Pitchers" : "Batters";
  const players = data.recommendations || data.players || [];
  const maxScore = players.length > 0 ? Math.max(...players.map((p) => p.score)) : 1;

  var chartData = players.map(function (p) {
    return {
      name: p.name.length > 14 ? p.name.substring(0, 12) + ".." : p.name,
      fullName: p.name,
      score: p.score,
      tier: p.tier || "Unknown",
      positions: p.positions,
      ownPct: p.pct != null ? p.pct : p.percent_owned,
    };
  });

  const handleTabChange = async (value: string) => {
    const result = await callTool("yahoo_waiver_analyze", { pos_type: value, count: 15 });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  const handleAdd = async (playerId: string) => {
    const result = await callTool("yahoo_add", { player_id: playerId });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  const handleSwapConfirm = async () => {
    if (!swapTarget) return;
    const playerId = swapTarget.pid || swapTarget.player_id || "";
    setSwapTarget(null);
    const result = await callTool("yahoo_add", { player_id: playerId });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  var seasonCtx = (data as any).season_context || {} as any;
  var weakCatsCount = (data.weak_categories || []).length;
  var topScore = players.length > 0 ? players[0].score : 0;
  var avgOwn = players.length > 0
    ? Math.round(players.reduce(function (sum, p) { return sum + (p.pct != null ? p.pct : (p.percent_owned || 0)); }, 0) / players.length)
    : 0;

  return (
    <div className="space-y-2 animate-stagger">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={weakCatsCount} label="Weak Cats" color="risk" />
        <KpiTile value={formatFixed(topScore, 1, "0.0")} label="Top Score" color="success" />
        <KpiTile value={avgOwn + "%"} label="Avg Own%" color="neutral" />
      </div>

      <Subheading className="flex items-center gap-2">
        <TrendingUp size={18} />
        Waiver Wire Analysis - {label}
      </Subheading>

      <Tabs value={data.pos_type || "B"} onValueChange={handleTabChange} aria-label="Position type">
        <TabsList>
          <TabsTrigger value="B">Batters</TabsTrigger>
          <TabsTrigger value="P">Pitchers</TabsTrigger>
        </TabsList>
      </Tabs>

      {(data.weak_categories || []).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Weak categories:</span>
          {(data.weak_categories || []).map((c, i) => {
            const name = typeof c === "string" ? c : c.name;
            const detail = typeof c === "string" ? "" : " (" + c.rank + "/" + c.total + ")";
            return <Badge key={i} variant="destructive">{name}{detail}</Badge>;
          })}
        </div>
      )}

      <PhaseBar phase={seasonCtx.phase} week={seasonCtx.week} weeks_remaining={seasonCtx.weeks_remaining} phase_note={seasonCtx.phase_note} urgency={seasonCtx.urgency} />

      {chartData.length > 0 && (
        <BarChartComponent
          data={chartData.map(function (d) { return { label: d.name, value: d.score, color: tierBarFill(d.tier) }; })}
          rotateLabels
          showLabels
        />
      )}

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="w-full overflow-x-auto mcp-app-scroll-x">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead className="hidden sm:table-cell">Positions</TableHead>
                <TableHead className="text-right">Own%</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Rec</TableHead>
                <TableHead className="hidden sm:table-cell w-20">Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p, i) => {
                const playerId = p.pid || p.player_id || "";
                const ownPct = p.pct != null ? p.pct : p.percent_owned;
                return (
                  <React.Fragment key={playerId || i}>
                  <TableRow className={i < 3 ? "bg-sem-success-subtle" : ""}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1">
                        {i === 0 && <span className="text-green-600 mr-0.5">&#9733;</span>}
                        <PlayerCell player={p} app={app} navigate={navigate} context="waivers" />
                      </span>
                      <ContextChips warning={p.warning} context_flags={p.context_flags} news={p.news} trend={p.trend} role_change={p.role_change} compact />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {p.positions.split(",").map((pos) => (
                          <Badge key={pos.trim()} variant="secondary">{pos.trim()}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <OwnershipCell player={p} />
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      <ScoreBar score={p.score} maxScore={maxScore} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {p.status && p.status !== "Healthy" && (
                        <Badge variant="destructive">{p.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button variant="secondary" size="xs" onClick={() => handleAdd(playerId)} disabled={loading} title="Add player">
                          <UserPlus size={14} />
                        </Button>
                        <Button variant="outline" size="xs" onClick={() => setSwapTarget(p)} disabled={loading} title="Swap for roster player">
                          <ArrowRightLeft size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {p.intel && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <IntelPanel intel={p.intel} />
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Button variant="secondary" size="sm" onClick={async function () {
        var result = await callTool("yahoo_category_check", {});
        if (result) navigate(result.structuredContent);
      }} disabled={loading}>
        Check Category Impact
      </Button>

      <Dialog open={swapTarget !== null} onOpenChange={function (open) { if (!open) setSwapTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Swap: Add " + (swapTarget ? swapTarget.name : "")}</DialogTitle>
            <DialogDescription>{"This will add " + (swapTarget ? swapTarget.name : "") + " to your roster. Yahoo will prompt you to drop a player if your roster is full."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSwapTarget(null)}>Cancel</Button>
            <Button variant="secondary" onClick={handleSwapConfirm}>Add Player</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
