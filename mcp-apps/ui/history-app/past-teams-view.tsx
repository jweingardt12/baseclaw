import { Button } from "../catalyst/button";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { useCallTool } from "../shared/use-call-tool";

import { ChevronLeft, ChevronRight, Loader2 } from "@/shared/icons";

interface PastTeamEntry {
  name: string;
  manager: string;
  moves: number;
  trades: number;
}

interface PastTeamsData {
  year: number;
  teams: PastTeamEntry[];
}

export function PastTeamsView({ data, app, navigate }: { data: PastTeamsData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const changeYear = async (year: number) => {
    const result = await callTool("yahoo_past_teams", { year });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <Button outline disabled={data.year <= 2011 || loading} onClick={() => changeYear(data.year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-bold">{"Teams - " + data.year}</span>
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
                <TableHeader className="font-bold">Team</TableHeader>
                <TableHeader className="hidden sm:table-cell font-bold">Manager</TableHeader>
                <TableHeader className="text-right font-bold">Moves</TableHeader>
                <TableHeader className="text-right font-bold">Trades</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.teams || []).map(function (t) {
                return (
                  <TableRow key={t.name}>
                    <TableCell className="font-semibold">{t.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{t.manager}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{t.moves}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{t.trades}</TableCell>
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
