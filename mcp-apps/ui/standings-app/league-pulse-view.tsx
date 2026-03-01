import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "../components/ui/card";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import * as React from "react";

var MY_TEAM = "You Can Clip These Wings";

interface LeaguePulseTeam {
  team_key: string;
  name: string;
  moves: number;
  trades: number;
  total: number;
  team_logo?: string;
  manager_image?: string;
}

function ActivityBar({ moves, trades, max }: { moves: number; trades: number; max: number }) {
  var total = moves + trades;
  var pct = max > 0 ? (total / max) * 100 : 0;
  var movePct = max > 0 ? (moves / max) * 100 : 0;
  return (
    <div className="flex h-2 w-20 rounded-full overflow-hidden bg-muted">
      <div className="bg-blue-500" style={{ width: movePct + "%" }} />
      <div className="bg-amber-500" style={{ width: (pct - movePct) + "%" }} />
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={"transition-transform " + (open ? "rotate-180" : "")}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function LeaguePulseView({ data }: { data: { teams: LeaguePulseTeam[]; ai_recommendation?: string | null } }) {
  var [showChart, setShowChart] = React.useState(false);
  var teams = (data.teams || []).slice().sort((a, b) => b.total - a.total);
  var maxTotal = teams.length > 0 ? teams[0].total : 1;
  var mostActive = teams.length > 0 ? teams[0] : null;
  var leastActive = teams.length > 0 ? teams[teams.length - 1] : null;

  var chartData = teams.map((t) => ({
    name: t.name.length > 16 ? t.name.slice(0, 14) + ".." : t.name,
    moves: t.moves,
    trades: t.trades,
    isMyTeam: t.name === MY_TEAM,
  }));

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">League Pulse</h2>

      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        {mostActive && <KpiTile value={mostActive.name} label="Most Active" color="success" />}
        {mostActive && <KpiTile value={mostActive.total} label="Top Moves" color="primary" />}
        {leastActive && <KpiTile value={leastActive.total} label="Least Moves" color="warning" />}
      </div>

      <div className="flex gap-2 flex-wrap">
        {mostActive && <Badge className="text-xs bg-sem-success">Most Active: {mostActive.name} ({mostActive.total})</Badge>}
        {leastActive && <Badge variant="secondary" className="text-xs">Least Active: {leastActive.name} ({leastActive.total})</Badge>}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Moves</TableHead>
            <TableHead className="text-right">Trades</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="hidden sm:table-cell w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((t) => {
            var isMyTeam = t.name === MY_TEAM;
            return (
              <TableRow key={t.team_key} className={isMyTeam ? "border-l-2 border-primary bg-primary/5" : ""}>
                <TableCell className={"font-medium" + (isMyTeam ? " text-primary" : "")}>
                  <span className="flex items-center" style={{ gap: "6px" }}>
                    {t.team_logo && <img src={t.team_logo} alt="" width={28} height={28} className="rounded-sm" style={{ flexShrink: 0 }} />}
                    {t.name}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{t.moves}</TableCell>
                <TableCell className="text-right font-mono text-sm">{t.trades}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{t.total}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <ActivityBar moves={t.moves} trades={t.trades} max={maxTotal} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Card>
        <CardContent className="p-3">
          <button onClick={() => setShowChart(!showChart)} className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Activity Chart</h3>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span className="text-xs text-muted-foreground">Moves</span>
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500 ml-1" />
                <span className="text-xs text-muted-foreground">Trades</span>
              </div>
            </div>
            <ChevronIcon open={showChart} />
          </button>
          {showChart && (
            <div className="mt-3" style={{ width: "100%", height: Math.max(250, chartData.length * 32) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="moves" stackId="a" fill="#3b82f6" barSize={20} />
                  <Bar dataKey="trades" stackId="a" fill="#f59e0b" barSize={20} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
