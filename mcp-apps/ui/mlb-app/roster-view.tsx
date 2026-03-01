import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";

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
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 font-bold">#</TableHead>
              <TableHead className="font-bold">Player</TableHead>
              <TableHead className="font-bold">Position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.players || []).map(function (p) {
              return (
                <TableRow key={p.name + p.jersey_number}>
                  <TableCell className="font-mono font-semibold">{p.jersey_number}</TableCell>
                  <TableCell className="font-semibold"><PlayerName name={p.name} app={app} navigate={navigate} context="default" /></TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-bold">{p.position}</Badge>
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
