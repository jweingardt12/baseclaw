import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Subheading } from "../components/heading";

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
    <div className="space-y-4">
      {(data.divisions || []).map(function (div) {
        return (
          <div key={div.division} className="surface-card overflow-hidden">
            <div className="p-3 pb-1">
              <Subheading>{div.division}</Subheading>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Team</TableHead>
                  <TableHead className="text-center w-12 font-bold">W</TableHead>
                  <TableHead className="hidden sm:table-cell text-center w-12 font-bold">L</TableHead>
                  <TableHead className="hidden sm:table-cell text-center w-14 font-bold">GB</TableHead>
                </TableRow>
              </TableHeader>
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
