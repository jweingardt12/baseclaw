import { Badge } from "../catalyst/badge";
import { Button } from "../catalyst/button";
import { Subheading } from "../catalyst/heading";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { useCallTool } from "../shared/use-call-tool";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

import { ChevronLeft, ChevronRight, Loader2, Trophy, BarChart3 } from "@/shared/icons";

interface PastStandingsEntry {
  rank: number;
  team_name: string;
  manager: string;
  record: string;
}

interface PastStandingsData {
  year: number;
  standings: PastStandingsEntry[];
}

function parseStandingsRecord(record: string): { wins: number; losses: number; ties: number } | null {
  if (!record || record === "-") {
    return null;
  }
  var parts = record.split("-");
  if (parts.length < 2) {
    return null;
  }
  var wins = parseInt(parts[0], 10);
  var losses = parseInt(parts[1], 10);
  var ties = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  if (isNaN(wins) || isNaN(losses)) {
    return null;
  }
  return { wins: wins, losses: losses, ties: ties };
}

export function PastStandingsView({ data, app, navigate }: { data: PastStandingsData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const changeYear = async (year: number) => {
    const result = await callTool("yahoo_past_standings", { year });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  // Build chart data from standings records
  var standingsChartData = (data.standings || [])
    .map(function (s) {
      var parsed = parseStandingsRecord(s.record);
      if (!parsed) {
        return null;
      }
      // Truncate long team names for chart labels
      var shortName = s.team_name.length > 14 ? s.team_name.slice(0, 13) + "\u2026" : s.team_name;
      return {
        team: shortName,
        rank: s.rank,
        wins: parsed.wins,
        losses: parsed.losses,
        ties: parsed.ties,
      };
    })
    .filter(function (d) { return d !== null; }) as Array<{
      team: string;
      rank: number;
      wins: number;
      losses: number;
      ties: number;
    }>;

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <Button outline disabled={data.year <= 2011 || loading} onClick={() => changeYear(data.year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-bold">{"Standings - " + data.year}</span>
        <Button outline disabled={data.year >= 2026 || loading} onClick={() => changeYear(data.year + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="w-12 font-bold">#</TableHeader>
                <TableHeader className="font-bold">Team</TableHeader>
                <TableHeader className="hidden sm:table-cell font-bold">Manager</TableHeader>
                <TableHeader className="text-center font-bold">Record</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.standings || []).map(function (s) {
                return (
                  <TableRow key={s.rank}>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Badge color={s.rank <= 3 ? undefined : "zinc"} className="text-xs font-bold">{s.rank}</Badge>
                        {s.rank <= 3 && <Trophy size={14} className="text-amber-500" />}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold">{s.team_name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{s.manager}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{s.record}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {/* Win/Loss Chart */}
        {standingsChartData.length > 1 && (
          <div className="surface-card p-4 mt-3">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <Subheading>Win-Loss Breakdown</Subheading>
            </div>
            <div style={{ height: Math.max(standingsChartData.length * 26, 120) + "px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={standingsChartData} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="team"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    formatter={function (value: number, name: string) {
                      var label = name === "wins" ? "Wins" : name === "losses" ? "Losses" : "Ties";
                      return [value, label];
                    }}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="wins" stackId="record" fill="var(--sem-success)" radius={[0, 0, 0, 0]} maxBarSize={18} name="wins" />
                  <Bar dataKey="losses" stackId="record" fill="var(--sem-risk)" radius={[0, 4, 4, 0]} maxBarSize={18} name="losses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
                Wins
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                Losses
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
