import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";

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
        <div className="surface-card p-4 text-center">
          <p className="text-muted-foreground font-semibold">No games scheduled for this date.</p>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="font-bold">Away</TableHeader>
                <TableHeader className="text-center w-10 font-bold">@</TableHeader>
                <TableHeader className="font-bold">Home</TableHeader>
                <TableHeader className="font-bold">Status</TableHeader>
              </TableRow>
            </TableHead>
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
