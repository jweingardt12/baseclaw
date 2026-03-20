import { Badge } from "../catalyst/badge";
import { Button } from "../catalyst/button";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { useCallTool } from "../shared/use-call-tool";

import { ChevronLeft, ChevronRight, Loader2 } from "@/shared/icons";

interface PastDraftPick {
  round: number;
  pick: number;
  player_name: string;
  team_name: string;
}

interface PastDraftData {
  year: number;
  picks: PastDraftPick[];
}

export function PastDraftView({ data, app, navigate }: { data: PastDraftData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const changeYear = async (year: number) => {
    const result = await callTool("yahoo_past_draft", { year, count: 25 });
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
        <span className="flex-1 text-center text-sm font-bold">{"Draft - " + data.year}</span>
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
                <TableHeader className="w-12 font-bold">Rd</TableHeader>
                <TableHeader className="hidden sm:table-cell w-14 font-bold">Pick</TableHeader>
                <TableHeader className="font-bold">Player</TableHeader>
                <TableHeader className="font-bold">Team</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.picks || []).map(function (p) {
                return (
                  <TableRow key={p.round + "-" + p.pick}>
                    <TableCell className="font-mono font-bold text-xs">{p.round}</TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">{p.pick}</TableCell>
                    <TableCell className="font-semibold">{p.player_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.team_name}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-semibold">{(data.picks || []).length + " picks"}</p>
      </div>
    </div>
  );
}
