import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "../components/card";
import { Subheading } from "../components/heading";
import { AiInsight } from "../shared/ai-insight";
import { EmptyState } from "../shared/empty-state";
import { KpiTile } from "../shared/kpi-tile";
import { PlayerName } from "../shared/player-name";
import { ArrowRight, TrendingUp } from "@/shared/icons";
import { formatFixed } from "../shared/number-format";

interface MovePlayer {
  name: string;
  player_id: string;
  pos: string;
  z_score: number;
  tier?: string;
  percent_owned?: number;
}

interface OptimalMove {
  rank: number;
  drop: MovePlayer;
  add: MovePlayer;
  z_improvement: number;
  categories_gained: string[];
  categories_lost: string[];
}

interface OptimalMovesResponse {
  roster_z_total: number;
  projected_z_after: number;
  net_improvement: number;
  moves: OptimalMove[];
  summary: string;
}

function signedZ(value: number): string {
  var formatted = formatFixed(value, 2, "0.00");
  if (value > 0) return "+" + formatted;
  return formatted;
}

export function OptimalMovesView({ data, app, navigate }: { data: OptimalMovesResponse; app?: any; navigate?: (data: any) => void }) {
  var moves = data.moves || [];

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.summary} />

      <div className="kpi-grid">
        <KpiTile value={formatFixed(data.roster_z_total, 1, "0.0")} label="Current Z" color="neutral" />
        <KpiTile value={formatFixed(data.projected_z_after, 1, "0.0")} label="Projected Z" color="success" />
        <KpiTile value={signedZ(data.net_improvement)} label="Net Improvement" color={data.net_improvement >= 0 ? "success" : "risk"} />
      </div>

      <Subheading className="flex items-center gap-2">
        <TrendingUp size={18} />
        Optimal Roster Moves
      </Subheading>

      {moves.length === 0 && (
        <EmptyState title="No beneficial moves found" description="Your roster is already optimized!" />
      )}

      {moves.map(function (move, i) {
        var improvement = move.z_improvement || 0;
        var gained = move.categories_gained || [];
        var lost = move.categories_lost || [];
        return (
          <Card key={i} className={improvement > 0 ? "border-green-500/20" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary">Move #{move.rank || i + 1}</Badge>
                <Badge className={improvement > 0 ? "bg-sem-success" : "bg-sem-risk"}>
                  {signedZ(improvement)} Z
                </Badge>
              </div>

              {/* Drop -> Add row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Drop player */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Drop</p>
                  <div className="flex items-center gap-1.5">
                    <PlayerName name={move.drop.name} playerId={move.drop.player_id} app={app} navigate={navigate} context="optimal-moves" />
                    <Badge variant="secondary" className="shrink-0">{move.drop.pos}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    z={formatFixed(move.drop.z_score, 2, "0.00")}
                    {move.drop.tier && (" | " + move.drop.tier)}
                  </p>
                </div>

                <ArrowRight size={16} className="text-muted-foreground shrink-0" />

                {/* Add player */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Add</p>
                  <div className="flex items-center gap-1.5">
                    <PlayerName name={move.add.name} playerId={move.add.player_id} app={app} navigate={navigate} context="optimal-moves" />
                    <Badge variant="secondary" className="shrink-0">{move.add.pos}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    z={formatFixed(move.add.z_score, 2, "0.00")}
                    {move.add.percent_owned != null && (" | " + move.add.percent_owned + "% owned")}
                  </p>
                </div>
              </div>

              {/* Categories gained / lost */}
              {(gained.length > 0 || lost.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {gained.map(function (cat) {
                    return <Badge key={"g-" + cat} className="bg-sem-success">{cat}</Badge>;
                  })}
                  {lost.map(function (cat) {
                    return <Badge key={"l-" + cat} variant="destructive">{cat}</Badge>;
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
