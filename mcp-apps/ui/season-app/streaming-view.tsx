import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Subheading } from "../components/heading";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerCell, OwnershipCell } from "../shared/player-row";
import { ContextChips } from "../shared/context-chips";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { UserPlus, Loader2, Zap } from "@/shared/icons";
import { formatFixed } from "../shared/number-format";
import { PhaseBar } from "../shared/phase-bar";

interface StreamingPitcher {
  name: string;
  player_id: string;
  team: string;
  games: number;
  percent_owned: number;
  score: number;
  two_start: boolean;
  mlb_id?: number;
  intel?: any;
  trend?: any;
  park_factor?: number;
  warning?: string;
  context_flags?: Array<{ type: string; message: string; detail?: string }>;
  news?: Array<{ title: string; link?: string; source?: string }>;
  role_change?: { role_changed?: boolean; description?: string };
}

interface StreamingData {
  week: number;
  team_games: Record<string, number>;
  pitchers: StreamingPitcher[];
  ai_recommendation?: string | null;
}

export function StreamingView({ data, app, navigate }: { data: StreamingData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const handleAdd = async (playerId: string) => {
    const result = await callTool("yahoo_add", { player_id: playerId });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  var seasonCtx = (data as any).season_context || {} as any;
  var twoStartCount = (data.pitchers || []).filter(function (p) { return p.two_start; }).length;
  var bestGrade = (data.pitchers || []).length > 0 ? formatFixed((data.pitchers || [])[0].score, 1, "0.0") : "-";

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={twoStartCount} label="2-Start" color={twoStartCount > 0 ? "success" : "neutral"} />
        <KpiTile value={bestGrade} label="Best Score" color="primary" />
      </div>

      <Subheading>Streaming Pitchers - Week {data.week}</Subheading>

      <PhaseBar phase={seasonCtx.phase} week={seasonCtx.week} weeks_remaining={seasonCtx.weeks_remaining} phase_note={seasonCtx.phase_note} urgency={seasonCtx.urgency} />

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
                <TableHead>Pitcher</TableHead>
                <TableHead className="text-center">Games</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Own%</TableHead>
                <TableHead className="text-right">Rec</TableHead>
                <TableHead className="w-16">2-Start</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.pitchers || []).map((p, i) => (
                <TableRow key={p.player_id} className={i === 0 ? "bg-primary/5" : ""}>
                  <TableCell className="font-medium">
                    <PlayerCell player={p} app={app} navigate={navigate} context="free-agents" />
                    <ContextChips warning={p.warning} context_flags={p.context_flags} news={p.news} trend={p.trend} role_change={p.role_change} compact />
                    {p.park_factor != null && <span className="text-[10px] text-muted-foreground font-mono">PF: {formatFixed(p.park_factor, 2)}</span>}
                  </TableCell>
                  <TableCell className="text-center font-mono">{p.games}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right font-mono text-xs">
                    <OwnershipCell player={p} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatFixed(p.score, 1, "0.0")}</TableCell>
                  <TableCell>
                    {p.two_start && <Zap size={14} className="text-amber-500" />}
                  </TableCell>
                  <TableCell>
                    <Button variant="secondary" size="sm" onClick={() => handleAdd(p.player_id)}>
                      <UserPlus size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Button variant="secondary" size="sm" onClick={async function () {
        var result = await callTool("yahoo_category_check", {});
        if (result) navigate(result.structuredContent);
      }} disabled={loading}>
        Check Categories
      </Button>
    </div>
  );
}
