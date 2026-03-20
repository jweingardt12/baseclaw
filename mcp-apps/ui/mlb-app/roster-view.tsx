import { Badge } from "../catalyst/badge";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";

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
    <div className="space-y-3">
      <div className="surface-card overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-14 font-bold">#</TableHeader>
              <TableHeader className="font-bold">Player</TableHeader>
              <TableHeader className="font-bold">Position</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data.players || []).map(function (p) {
              return (
                <TableRow key={p.name + p.jersey_number}>
                  <TableCell className="font-mono font-semibold">{p.jersey_number}</TableCell>
                  <TableCell className="font-semibold"><PlayerName name={p.name} app={app} navigate={navigate} context="default" /></TableCell>
                  <TableCell>
                    <Badge color="zinc" className="text-xs font-bold">{p.position}</Badge>
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
