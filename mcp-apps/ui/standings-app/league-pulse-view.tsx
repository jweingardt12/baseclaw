import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { BarChart } from "@/charts";
import { Card, CardContent } from "../components/card";
import { Subheading } from "../components/heading";
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
      <div className="bg-emerald-500" style={{ width: movePct + "%" }} />
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
    name: t.name.length > 12 ? t.name.slice(0, 10) + ".." : t.name,
    moves: t.moves,
    trades: t.trades,
    isMyTeam: t.name === MY_TEAM,
  }));

  return (
    <div className="space-y-4">
      <Subheading>League Pulse</Subheading>

      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        {mostActive && <KpiTile value={mostActive.name} label="Most Active" color="success" />}
        {mostActive && <KpiTile value={mostActive.total} label="Top Moves" color="primary" />}
        {leastActive && <KpiTile value={leastActive.total} label="Least Moves" color="warning" />}
      </div>

      <div className="flex gap-2 flex-wrap">
        {mostActive && <Badge size="sm" className="bg-sem-success">Most Active: {mostActive.name} ({mostActive.total})</Badge>}
        {leastActive && <Badge variant="secondary">Least Active: {leastActive.name} ({leastActive.total})</Badge>}
      </div>

      <div className="w-full overflow-x-auto mcp-app-scroll-x">
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
                  <span className="flex items-center gap-1.5">
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
      </div>

      <Card>
        <CardContent className="p-4">
          <button onClick={() => setShowChart(!showChart)} className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2">
              <Subheading level={3} className="text-sm">Activity Chart</Subheading>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Moves</span>
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500 ml-1" />
                <span className="text-xs text-muted-foreground">Trades</span>
              </div>
            </div>
            <ChevronIcon open={showChart} />
          </button>
          {showChart && (
            <div className="mt-3">
              <BarChart
                data={chartData}
                horizontal
                labelWidth={100}
                series={[
                  { key: "moves", color: "#3b82f6" },
                  { key: "trades", color: "#f59e0b" },
                ]}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
