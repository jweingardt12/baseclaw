import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";

import { TeamLogo } from "../shared/team-logo";

interface MlbGame {
  away: string;
  home: string;
  status: string;
  away_id?: number;
  home_id?: number;
}

interface MlbScheduleData {
  date: string;
  games: MlbGame[];
}

export function ScheduleView({ data }: { data: MlbScheduleData }) {
  return (
    <div className="space-y-3">
      {(data.games || []).length === 0 ? (
        <div className="rounded-md border bg-card p-4 text-center">
          <p className="text-muted-foreground font-semibold">No games scheduled for this date.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold">Away</TableHead>
                <TableHead className="text-center w-10 font-bold">@</TableHead>
                <TableHead className="font-bold">Home</TableHead>
                <TableHead className="font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.games || []).map(function (g, i) {
                return (
                  <TableRow key={i}>
                    <TableCell className="font-semibold">
                      <span className="flex items-center gap-1">
                        <TeamLogo teamId={g.away_id} abbrev={g.away} size={18} />
                        {g.away}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground font-bold">@</TableCell>
                    <TableCell className="font-semibold">
                      <span className="flex items-center gap-1">
                        <TeamLogo teamId={g.home_id} abbrev={g.home} size={18} />
                        {g.home}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-semibold">{g.status}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
