import { Button } from "@plexui/ui/components/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { useCallTool } from "../shared/use-call-tool";

import { ChevronLeft, ChevronRight, Loader2 } from "@/shared/icons";

interface PastMatchupEntry {
  team1: string;
  team2: string;
  score: string;
  status: string;
}

interface PastMatchupData {
  year: number;
  week: number;
  matchups: PastMatchupEntry[];
}

export function PastMatchupView({ data, app, navigate }: { data: PastMatchupData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const changeYear = async (year: number) => {
    const result = await callTool("yahoo_past_matchup", { year, week: data.week });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  const changeWeek = async (week: number) => {
    const result = await callTool("yahoo_past_matchup", { year: data.year, week });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" color="secondary" disabled={data.year <= 2011 || loading} onClick={() => changeYear(data.year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-bold">{String(data.year)}</span>
        <Button variant="outline" color="secondary" disabled={data.year >= 2026 || loading} onClick={() => changeYear(data.year + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" color="secondary" disabled={data.week <= 1 || loading} onClick={() => changeWeek(data.week - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-bold">{"Week " + data.week}</span>
        <Button variant="outline" color="secondary" disabled={data.week >= 22 || loading} onClick={() => changeWeek(data.week + 1)}>
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
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold">Team 1</TableHead>
                <TableHead className="text-center font-bold">Score</TableHead>
                <TableHead className="font-bold">Team 2</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.matchups || []).map(function (m, i) {
                return (
                  <TableRow key={i}>
                    <TableCell className="font-semibold">{m.team1}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono font-bold text-primary">{m.score}</span>
                    </TableCell>
                    <TableCell className="font-semibold">{m.team2}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
