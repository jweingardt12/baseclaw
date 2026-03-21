import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";

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
    <div className="space-y-4">
      {(data.games || []).length === 0 ? (
        <div className="surface-card p-5 text-center">
          <p className="text-muted-foreground font-semibold">No games scheduled for this date.</p>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold">Away</TableHead>
                <TableHead className="text-center w-10 font-bold">@</TableHead>
                <TableHead className="font-bold">Home</TableHead>
                <TableHead className="hidden sm:table-cell font-bold">Status</TableHead>
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
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground font-semibold">{g.status}</TableCell>
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
