import * as React from "react";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { Badge } from "../catalyst/badge";
import { Card, CardContent } from "../catalyst/card";
import { Subheading } from "../catalyst/heading";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";

interface StandingsEntry {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  ties?: number;
  points_for?: string;
  team_logo?: string;
  manager_image?: string;
}

var MY_TEAM = "You Can Clip These Wings";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Badge className="text-xs bg-sem-warning">{rank}</Badge>;
  if (rank === 2) return <Badge className="text-xs bg-sem-neutral">{rank}</Badge>;
  if (rank === 3) return <Badge className="text-xs bg-sem-info">{rank}</Badge>;
  return <Badge color="zinc" className="text-xs">{rank}</Badge>;
}

function WinLossBar({ wins, losses }: { wins: number; losses: number }) {
  var total = wins + losses;
  if (total === 0) return null;
  var winPct = (wins / total) * 100;
  return (
    <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-muted">
      <div className="bg-green-500 rounded-l-full" style={{ width: winPct + "%" }} />
      <div className="bg-red-400 rounded-r-full" style={{ width: (100 - winPct) + "%" }} />
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={"transition-transform " + (open ? "rotate-180" : "")}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PointsDistributionChart({ standings, playoffLine }: { standings: StandingsEntry[]; playoffLine: number }) {
  var sorted = [...standings]
    .filter((s) => s.points_for)
    .sort((a, b) => parseFloat(b.points_for || "0") - parseFloat(a.points_for || "0"));

  var chartData = sorted.map((s) => ({
    name: s.name.length > 18 ? s.name.slice(0, 16) + ".." : s.name,
    points: parseFloat(s.points_for || "0"),
    isMyTeam: s.name === MY_TEAM,
    inPlayoffs: s.rank <= playoffLine,
  }));

  var playoffCutoffTeam = standings.find((s) => s.rank === playoffLine);
  var cutoffPoints = playoffCutoffTeam ? parseFloat(playoffCutoffTeam.points_for || "0") : 0;

  var chartHeight = Math.max(250, chartData.length * 32);

  return (
    <div style={{ width: "100%", height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 12 }}
          />
          {cutoffPoints > 0 && (
            <ReferenceLine
              x={cutoffPoints}
              stroke="var(--sem-neutral)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: "Playoff line", position: "top", fontSize: 11, fill: "var(--sem-neutral)" }}
            />
          )}
          <Bar dataKey="points" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, idx) => {
              var fill = entry.inPlayoffs ? "var(--sem-success)" : "var(--sem-risk)";
              if (entry.isMyTeam) fill = "hsl(var(--primary))";
              return <Cell key={"cell-" + idx} fill={fill} fillOpacity={entry.isMyTeam ? 1 : 0.7} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StandingsView({ data }: { data: { standings: StandingsEntry[]; playoff_teams?: number; ai_recommendation?: string | null } }) {
  var [showDistribution, setShowDistribution] = React.useState(false);
  var playoffLine = data.playoff_teams || 6;
  var hasTies = data.standings.some((s) => s.ties);
  var hasPoints = data.standings.some((s) => s.points_for);

  var myTeam = (data.standings || []).find(function (s) { return s.name === MY_TEAM; });
  var myRecord = myTeam ? myTeam.wins + "-" + myTeam.losses + (hasTies ? "-" + (myTeam.ties || 0) : "") : "";
  var myPoints = myTeam && myTeam.points_for ? myTeam.points_for : "";
  var leader = (data.standings || [])[0];
  var gb = "";
  if (myTeam && leader && myTeam.points_for && leader.points_for) {
    var diff = parseFloat(leader.points_for) - parseFloat(myTeam.points_for);
    gb = diff > 0 ? diff.toFixed(1) : "-";
  }

  return (
    <div className="space-y-3">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={myRecord} label="W-L Record" color="primary" />
        {myPoints && <KpiTile value={myPoints} label="Points" color="info" />}
        {gb && gb !== "-" && <KpiTile value={gb} label="Games Back" color={parseFloat(gb) > 10 ? "risk" : "warning"} />}
      </div>

      <div>
        <Subheading className="mb-2">League Standings</Subheading>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">#</TableHeader>
              <TableHeader>Team</TableHeader>
              <TableHeader className="text-center">Record</TableHeader>
              <TableHeader className="hidden sm:table-cell w-20"></TableHeader>
              {hasPoints && <TableHeader className="text-right">Points</TableHeader>}
            </TableRow>
          </TableHead>
          <TableBody>
            {(data.standings || []).map((s, idx) => {
              var isMyTeam = s.name === MY_TEAM;
              var showPlayoffLine = s.rank === playoffLine && idx < (data.standings || []).length - 1;
              return (
                <TableRow
                  key={s.rank}
                  className={
                    (isMyTeam ? "border-l-2 border-primary bg-primary/5 " : "")
                    + (showPlayoffLine ? "border-b-2 border-dashed border-muted-foreground/30" : "")
                  }
                >
                  <TableCell><RankBadge rank={s.rank} /></TableCell>
                  <TableCell className={"font-medium" + (isMyTeam ? " text-primary" : "")}>
                    <span className="flex items-center gap-1.5">
                      {s.team_logo && <img src={s.team_logo} alt="" width={28} height={28} className="rounded-sm" style={{ flexShrink: 0 }} />}
                      {s.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {s.wins}-{s.losses}{hasTies ? "-" + (s.ties || 0) : ""}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <WinLossBar wins={s.wins} losses={s.losses} />
                  </TableCell>
                  {hasPoints && <TableCell className="text-right font-mono font-medium">{s.points_for || "-"}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Points Distribution Chart (collapsible) */}
      {hasPoints && (
        <Card>
          <CardContent className="p-3">
            <button
              onClick={() => setShowDistribution(!showDistribution)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Subheading level={3} className="text-sm">Points Distribution</Subheading>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 opacity-70" />
                  <span className="text-xs text-muted-foreground">Playoff</span>
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500 opacity-70 ml-1" />
                  <span className="text-xs text-muted-foreground">Out</span>
                </div>
              </div>
              <ChevronIcon open={showDistribution} />
            </button>
            {showDistribution && (
              <div className="mt-3">
                <PointsDistributionChart standings={data.standings} playoffLine={playoffLine} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
