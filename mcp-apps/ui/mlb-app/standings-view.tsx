import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { Subheading } from "../catalyst/heading";

import { TeamLogo } from "../shared/team-logo";

interface DivisionTeam {
  name: string;
  wins: number;
  losses: number;
  games_back: string;
  team_id?: number;
}

interface MlbDivision {
  division: string;
  teams: DivisionTeam[];
}

export function StandingsView({ data }: { data: { divisions: MlbDivision[] } }) {
  return (
    <div className="space-y-3">
      {(data.divisions || []).map(function (div) {
        return (
          <div key={div.division} className="surface-card overflow-hidden">
            <div className="p-3 pb-1">
              <Subheading>{div.division}</Subheading>
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader className="font-bold">Team</TableHeader>
                  <TableHeader className="text-center w-12 font-bold">W</TableHeader>
                  <TableHeader className="hidden sm:table-cell text-center w-12 font-bold">L</TableHeader>
                  <TableHeader className="hidden sm:table-cell text-center w-14 font-bold">GB</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {(div.teams || []).map(function (t) {
                  return (
                    <TableRow key={t.name}>
                      <TableCell className="font-semibold">
                        <span className="flex items-center gap-1.5">
                          <TeamLogo teamId={t.team_id} name={t.name} size={20} />
                          {t.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono font-semibold">{t.wins}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center font-mono font-semibold">{t.losses}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center font-mono text-muted-foreground">{t.games_back}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
