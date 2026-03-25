import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Subheading } from "../components/heading";
import { useCallTool } from "../shared/use-call-tool";

import { BarChart } from "@/charts";

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
        label: shortName,
        rank: s.rank,
        wins: parsed.wins,
        losses: parsed.losses,
        ties: parsed.ties,
      };
    })
    .filter(function (d) { return d !== null; }) as Array<{
      label: string;
      rank: number;
      wins: number;
      losses: number;
      ties: number;
    }>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" disabled={data.year <= 2011 || loading} onClick={() => changeYear(data.year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-bold">{"Standings - " + data.year}</span>
        <Button variant="outline" disabled={data.year >= 2026 || loading} onClick={() => changeYear(data.year + 1)}>
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
          <div className="w-full overflow-x-auto mcp-app-scroll-x">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 font-bold">#</TableHead>
                <TableHead className="font-bold">Team</TableHead>
                <TableHead className="hidden sm:table-cell font-bold">Manager</TableHead>
                <TableHead className="text-center font-bold">Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.standings || []).map(function (s) {
                return (
                  <TableRow key={s.rank}>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Badge variant={s.rank <= 3 ? "default" : "secondary"} className="font-bold">{s.rank}</Badge>
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
        </div>
        {/* Win/Loss Chart */}
        {standingsChartData.length > 1 && (
          <div className="surface-card p-5 mt-3">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <Subheading>Win-Loss Breakdown</Subheading>
            </div>
            <BarChart
              data={standingsChartData}
              series={[
                { key: "wins", color: "var(--sem-success)" },
                { key: "losses", color: "var(--sem-risk)" },
              ]}
              horizontal
              labelWidth={90}
            />
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
