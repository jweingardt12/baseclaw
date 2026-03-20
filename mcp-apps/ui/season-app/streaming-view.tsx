import { Button } from "../catalyst/button";
import { Subheading } from "../catalyst/heading";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerCell, OwnershipCell } from "../shared/player-row";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { UserPlus, Loader2, Zap } from "@/shared/icons";
import { formatFixed } from "../shared/number-format";

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

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Pitcher</TableHeader>
              <TableHeader className="text-center">Games</TableHeader>
              <TableHeader className="hidden sm:table-cell text-right">Own%</TableHeader>
              <TableHeader className="text-right">Rec</TableHeader>
              <TableHeader className="w-16">2-Start</TableHeader>
              <TableHeader className="w-16"></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data.pitchers || []).map((p, i) => (
              <TableRow key={p.player_id} className={i === 0 ? "bg-primary/5" : ""}>
                <TableCell className="font-medium">
                  <PlayerCell player={p} app={app} navigate={navigate} context="free-agents" />
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
                  <Button onClick={() => handleAdd(p.player_id)}>
                    <UserPlus size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
