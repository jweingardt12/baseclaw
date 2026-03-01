import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { useCallTool } from "../shared/use-call-tool";

import { ChevronLeft, ChevronRight, Loader2, Trophy } from "@/shared/icons";

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

export function PastStandingsView({ data, app, navigate }: { data: PastStandingsData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const changeYear = async (year: number) => {
    const result = await callTool("yahoo_past_standings", { year });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" disabled={data.year <= 2011 || loading} onClick={() => changeYear(data.year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-bold">{"Standings - " + data.year}</span>
        <Button variant="outline" size="sm" disabled={data.year >= 2026 || loading} onClick={() => changeYear(data.year + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="rounded-md border bg-card overflow-hidden">
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
                        <Badge variant={s.rank <= 3 ? "default" : "secondary"} className="text-xs font-bold">{s.rank}</Badge>
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
    </div>
  );
}
