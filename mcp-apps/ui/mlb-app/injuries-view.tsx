import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Badge } from "@plexui/ui/components/Badge";

import { TeamLogo } from "../shared/team-logo";

interface MlbInjury {
  player: string;
  team: string;
  description: string;
}

export function InjuriesView({ data }: { data: { injuries: MlbInjury[] } }) {
  if ((data.injuries || []).length === 0) {
    return (
      <div className="space-y-4">
        <div className="surface-card p-5 text-center">
          <p className="text-muted-foreground font-semibold">No injuries reported (may be offseason).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold">Player</TableHead>
              <TableHead className="font-bold">Team</TableHead>
              <TableHead className="hidden sm:table-cell font-bold">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.injuries || []).map(function (inj, i) {
              return (
                <TableRow key={i}>
                  <TableCell className="font-semibold">{inj.player}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <TeamLogo name={inj.team} />
                      <Badge color="secondary" size="sm" className="font-bold">{inj.team}</Badge>
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{inj.description}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
