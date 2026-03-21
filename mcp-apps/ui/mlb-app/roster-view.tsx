import { Badge } from "@plexui/ui/components/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";

import { PlayerName } from "../shared/player-name";

interface MlbRosterPlayer {
  name: string;
  jersey_number: string;
  position: string;
}

interface MlbRosterData {
  team_name: string;
  players: MlbRosterPlayer[];
}

export function RosterView({ data, app, navigate }: { data: MlbRosterData; app?: any; navigate?: (data: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 font-bold">#</TableHead>
              <TableHead className="font-bold">Player</TableHead>
              <TableHead className="hidden sm:table-cell font-bold">Position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.players || []).map(function (p) {
              return (
                <TableRow key={p.name + p.jersey_number}>
                  <TableCell className="font-mono font-semibold">{p.jersey_number}</TableCell>
                  <TableCell className="font-semibold"><PlayerName name={p.name} app={app} navigate={navigate} context="default" /></TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge color="secondary" size="sm" className="font-bold">{p.position}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
