import { Badge } from "../catalyst/badge";
import { Subheading } from "../catalyst/heading";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { cn } from "../lib/utils";
import { EmptyState } from "../shared/empty-state";
import { formatFixed } from "../shared/number-format";
import { PlayerName } from "../shared/player-name";

interface RosterStatsPlayer {
  name: string;
  player_id: string;
  position: string;
  eligible_positions: string[];
  stats: Record<string, string | number>;
  mlb_id?: number;
}

interface RosterStatsData {
  players: RosterStatsPlayer[];
  period: string;
  week?: string | null;
}

var BATTER_STATS = ["R", "H", "HR", "RBI", "SB", "AVG", "OBP"];
var PITCHER_STATS = ["IP", "W", "K", "ERA", "WHIP", "QS", "SV", "HLD"];
// Stats to hide on mobile to reduce column density
var HIDE_ON_MOBILE: Record<string, boolean> = { H: true, SB: true, W: true, SV: true, HLD: true };
var PITCHER_POSITIONS = ["P", "SP", "RP"];

function isPitcher(position: string): boolean {
  return PITCHER_POSITIONS.indexOf(position) !== -1;
}

function getStatColumns(players: RosterStatsPlayer[], defaultStats: string[]): string[] {
  if (players.length === 0) return defaultStats;
  // Check if any default stat keys exist in the first player's stats
  var firstStats = players[0].stats || {};
  var available = defaultStats.filter(function (s) { return firstStats[s] !== undefined; });
  if (available.length > 0) return available;
  // Fall back to discovering from keys
  return Object.keys(firstStats);
}

function formatStat(value: string | number | undefined): string {
  if (value === undefined || value === null) return "-";
  if (typeof value === "number") {
    // Format rate stats (AVG, OBP, etc.) with 3 decimals, strip leading zero
    if (value > 0 && value < 1) return formatFixed(value, 3, "-").replace(/^0/, "");
    if (value % 1 !== 0) return formatFixed(value, 2, "-");
    return String(value);
  }
  return String(value);
}

function StatsTable({ players, statColumns, app, navigate }: { players: RosterStatsPlayer[]; statColumns: string[]; app?: any; navigate?: (data: any) => void }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Name</TableHeader>
          <TableHeader>Pos</TableHeader>
          {statColumns.map(function (stat) {
            return <TableHeader key={stat} className={cn("text-right", HIDE_ON_MOBILE[stat] && "hidden sm:table-cell")}>{stat}</TableHeader>;
          })}
        </TableRow>
      </TableHead>
      <TableBody>
        {players.map(function (p, i) {
          return (
            <TableRow key={p.player_id || i}>
              <TableCell className="font-medium">
                <PlayerName name={p.name} playerId={p.player_id} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
              </TableCell>
              <TableCell>
                <Badge color="zinc" className="text-xs">{p.position}</Badge>
              </TableCell>
              {statColumns.map(function (stat) {
                return (
                  <TableCell key={stat} className={cn("text-right font-mono text-xs", HIDE_ON_MOBILE[stat] && "hidden sm:table-cell")}>
                    {formatStat((p.stats || {})[stat])}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function RosterStatsView({ data, app, navigate }: { data: RosterStatsData; app?: any; navigate?: (data: any) => void }) {
  var players = data.players || [];
  var batters = players.filter(function (p) { return !isPitcher(p.position); });
  var pitchers = players.filter(function (p) { return isPitcher(p.position); });

  var batterCols = getStatColumns(batters, BATTER_STATS);
  var pitcherCols = getStatColumns(pitchers, PITCHER_STATS);

  var periodLabel = data.period || "Season";
  var weekLabel = data.week ? " - Week " + data.week : "";

  return (
    <div className="space-y-2">
      <Subheading>Roster Stats: {periodLabel}{weekLabel}</Subheading>

      {batters.length > 0 && (
        <div className="space-y-1">
          <Subheading level={3} className="text-sm text-muted-foreground">Batters ({batters.length})</Subheading>
          <StatsTable players={batters} statColumns={batterCols} app={app} navigate={navigate} />
        </div>
      )}

      {pitchers.length > 0 && (
        <div className="space-y-1">
          <Subheading level={3} className="text-sm text-muted-foreground">Pitchers ({pitchers.length})</Subheading>
          <StatsTable players={pitchers} statColumns={pitcherCols} app={app} navigate={navigate} />
        </div>
      )}

      {players.length === 0 && (
        <EmptyState title="No roster stats available for this period" />
      )}
    </div>
  );
}
