import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { useCallTool } from "../shared/use-call-tool";

import { TeamLogo } from "../shared/team-logo";
import { IntelBadge } from "../shared/intel-badge";
import { PlayerName } from "../shared/player-name";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { Play, Loader2, ArrowRightLeft, AlertTriangle, CheckCircle, ArrowRight, Copy, Check } from "@/shared/icons";

interface Player {
  name: string;
  position?: string;
  team?: string;
  mlb_id?: number;
  intel?: any;
}

interface LineupSwap {
  bench_player: string;
  start_player: string;
  position: string;
}

interface LineupData {
  active_off_day: Player[];
  bench_playing: Player[];
  il_players: Player[];
  swaps: LineupSwap[];
  applied: boolean;
  message: string;
  ai_recommendation?: string | null;
}

export function LineupOptimizeView({ data, app, navigate }: { data: LineupData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasIssues = (data.active_off_day || []).length > 0 || (data.bench_playing || []).length > 0;

  const handleCopySwaps = () => {
    const lines = (data.swaps || []).map((s) => s.bench_player + " \u2192 " + s.position + " (replacing " + s.start_player + ")");
    const text = "Lineup Swaps:\n" + lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    });
  };

  const handleApply = async () => {
    setConfirmOpen(false);
    const result = await callTool("yahoo_lineup_optimize", { apply: true });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  var issuesCount = (data.active_off_day || []).length + (data.bench_playing || []).length;
  var swapsCount = (data.swaps || []).length;
  var gamesCount = (data.bench_playing || []).length;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={issuesCount} label="Issues" color={issuesCount > 0 ? "risk" : "success"} />
        <KpiTile value={swapsCount} label="Swaps" color={swapsCount > 0 ? "warning" : "neutral"} />
        <KpiTile value={gamesCount} label="Bench w/ Games" color={gamesCount > 0 ? "info" : "neutral"} />
      </div>

      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Lineup Optimizer</h2>
        {data.applied && (
          <>
            <CheckCircle size={14} className="text-green-500" />
            <Badge variant="default">Applied</Badge>
          </>
        )}
      </div>

      {/* Post-Apply Success State */}
      {data.applied && (data.swaps || []).length > 0 && (
        <Card className="border-green-500/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={18} className="text-green-500" />
              <span className="font-semibold text-green-700 dark:text-green-400">Lineup Updated</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {(data.swaps || []).length + " swap" + ((data.swaps || []).length === 1 ? "" : "s") + " applied successfully."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your lineup is now optimized for today. Check back tomorrow for new recommendations.
            </p>
          </CardContent>
        </Card>
      )}

      {(data.active_off_day || []).length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-destructive" />
              Active Players - No Game Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pos</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.active_off_day || []).map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-mono text-xs">{p.position || "?"}</TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center" style={{ gap: "4px" }}>
                        <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                        {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex items-center" style={{ gap: "4px" }}>
                        <TeamLogo abbrev={p.team} />
                        {p.team || "?"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(data.bench_playing || []).length > 0 && (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary">Bench Players - Have Game Today</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pos</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.bench_playing || []).map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-mono text-xs">BN</TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center" style={{ gap: "4px" }}>
                        <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                        {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex items-center" style={{ gap: "4px" }}>
                        <TeamLogo abbrev={p.team} />
                        {p.team || "?"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(data.swaps || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Suggested Swaps
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopySwaps}>
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data.swaps || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <Badge variant="destructive" className="text-xs">Bench</Badge>
                <span className="text-sm"><PlayerName name={s.bench_player} context="roster" /></span>
                <ArrowRightLeft size={14} className="text-muted-foreground" />
                <Badge variant="default" className="text-xs">Start</Badge>
                <span className="text-sm"><PlayerName name={s.start_player} context="roster" /></span>
                <Badge variant="outline" className="text-xs">{s.position}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Before/After Visualization */}
      {(data.swaps || []).length > 0 && !data.applied && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Before / After</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
              {/* Before column */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Before</p>
                <div className="space-y-1.5">
                  {(data.swaps || []).map((s, i) => (
                    <div key={"before-" + i} className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs min-w-[36px] justify-center">{s.position}</Badge>
                      <span className="text-sm">{s.start_player}</span>
                    </div>
                  ))}
                  {(data.swaps || []).map((s, i) => (
                    <div key={"before-bn-" + i} className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs min-w-[36px] justify-center">BN</Badge>
                      <span className="text-sm text-muted-foreground">{s.bench_player}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Arrow */}
              <div className="flex items-center justify-center pt-4">
                <ArrowRight size={20} className="text-muted-foreground" />
              </div>
              {/* After column */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">After</p>
                <div className="space-y-1.5">
                  {(data.swaps || []).map((s, i) => (
                    <div key={"after-" + i} className="flex items-center gap-1.5">
                      <Badge variant="default" className="text-xs min-w-[36px] justify-center">{s.position}</Badge>
                      <span className="text-sm font-medium">{s.bench_player}</span>
                    </div>
                  ))}
                  {(data.swaps || []).map((s, i) => (
                    <div key={"after-bn-" + i} className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs min-w-[36px] justify-center">BN</Badge>
                      <span className="text-sm text-muted-foreground">{s.start_player}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!data.applied && (data.swaps || []).length > 0 && (
        <Button variant="default" className="w-full" onClick={() => setConfirmOpen(true)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          <span className="ml-1.5">Apply Swaps</span>
        </Button>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogHeader>
          <DialogTitle>Confirm Lineup Changes</DialogTitle>
          <DialogDescription>
            {"The following " + (data.swaps || []).length + " swap" + ((data.swaps || []).length === 1 ? "" : "s") + " will be applied:"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 my-2">
          {(data.swaps || []).map((s, i) => (
            <div key={"confirm-" + i} className="text-sm flex items-center gap-1.5">
              <span className="font-medium">{s.bench_player}</span>
              <ArrowRight size={12} className="text-muted-foreground" />
              <Badge variant="outline" className="text-xs">{s.position}</Badge>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="font-medium">{s.start_player}</span>
              <ArrowRight size={12} className="text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">BN</Badge>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="default" onClick={handleApply} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>{loading ? "Applying..." : "Confirm"}</span>
          </Button>
        </DialogFooter>
      </Dialog>

      {!hasIssues && (
        <Card>
          <CardContent className="p-3">
            <p className="text-sm text-muted-foreground">All active players have games today. Lineup looks good!</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{data.message}</p>
    </div>
  );
}
