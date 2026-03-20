import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { Badge } from "../catalyst/badge";
import { Progress } from "../catalyst/progress";
import { Info } from "@/shared/icons";
import { formatFixed } from "../shared/number-format";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";

interface SeasonPaceTeam {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  weeks_played: number;
  remaining_weeks: number;
  win_pct: number;
  projected_wins: number;
  projected_losses: number;
  is_my_team: boolean;
  playoff_status: string;
  magic_number: number;
  team_logo?: string;
  manager_image?: string;
}

interface SeasonPaceData {
  current_week: number;
  end_week: number;
  playoff_teams: number;
  teams: SeasonPaceTeam[];
  ai_recommendation?: string | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "in") return <Badge className="text-xs bg-sem-success">In</Badge>;
  if (status === "bubble") return <Badge className="text-xs bg-sem-warning">Bubble</Badge>;
  if (status === "out") return <Badge color="red" className="text-xs">Out</Badge>;
  return <Badge color="zinc" className="text-xs">{status}</Badge>;
}

export function SeasonPaceView({ data }: { data: SeasonPaceData }) {
  var teams = data.teams || [];
  var progressPct = data.end_week > 0 ? Math.round((data.current_week / data.end_week) * 100) : 0;

  var myTeam = teams.find(function (t) { return t.is_my_team; });
  var myRank = myTeam ? myTeam.rank : null;
  var myMagic = myTeam ? myTeam.magic_number : 0;
  var myProjected = myTeam ? myTeam.projected_wins : 0;

  return (
    <div className="space-y-3">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        {myMagic > 0 && <KpiTile value={myMagic} label="Magic Number" color={myMagic <= 5 ? "success" : "warning"} />}
        <KpiTile value={myProjected} label="Projected Wins" color="primary" />
        {myRank && <KpiTile value={"#" + myRank} label="Current Rank" color={myRank <= (data.playoff_teams || 6) ? "success" : "risk"} />}
      </div>

      <div className="flex items-center gap-2">
        <Badge color="zinc" className="text-xs">Week {data.current_week}/{data.end_week}</Badge>
        <Badge color="zinc" className="text-xs">{data.playoff_teams} playoff spots</Badge>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Season Progress</span>
          <span>{progressPct}% complete</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader className="w-10">#</TableHeader>
            <TableHeader>Team</TableHeader>
            <TableHeader className="text-center">Record</TableHeader>
            <TableHeader className="text-right hidden sm:table-cell">Win%</TableHeader>
            <TableHeader className="text-right">Proj W</TableHeader>
            <TableHeader className="text-right hidden sm:table-cell">
              <span className="flex items-center gap-1 justify-end cursor-help" title="Wins needed to clinch a playoff spot, assuming the team on the bubble wins out.">
                Magic#
                <Info size={12} />
              </span>
            </TableHeader>
            <TableHeader className="text-center">Status</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {teams.map((t, idx) => {
            var showPlayoffLine = t.rank === data.playoff_teams && idx < teams.length - 1;
            return (
              <TableRow
                key={t.name}
                className={
                  (t.is_my_team ? "border-l-2 border-primary bg-primary/5 " : "")
                  + (showPlayoffLine ? "border-b-2 border-dashed border-muted-foreground/30" : "")
                }
              >
                <TableCell className="font-mono text-sm text-muted-foreground">{t.rank}</TableCell>
                <TableCell className={"font-medium" + (t.is_my_team ? " text-primary" : "")}>
                  <span className="flex items-center gap-1.5">
                    {t.team_logo && <img src={t.team_logo} alt="" width={28} height={28} className="rounded-sm" style={{ flexShrink: 0 }} />}
                    {t.name}
                  </span>
                </TableCell>
                <TableCell className="text-center font-mono text-sm">
                  {t.wins}-{t.losses}{t.ties > 0 ? "-" + t.ties : ""}
                </TableCell>
                <TableCell className="text-right font-mono text-sm hidden sm:table-cell">{formatFixed(t.win_pct * 100, 1, "0.0")}%</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{t.projected_wins}</TableCell>
                <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                  {t.magic_number > 0 ? t.magic_number : "-"}
                </TableCell>
                <TableCell className="text-center"><StatusBadge status={t.playoff_status} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
