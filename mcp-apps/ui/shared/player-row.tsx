import * as React from "react";
import { Badge } from "../catalyst/badge";
import { TableRow, TableCell } from "../catalyst/table";
import { PlayerName } from "./player-name";
import { TeamLogo } from "./team-logo";
import { IntelBadge } from "./intel-badge";
import { IntelPanel } from "./intel-panel";
import { TrendIndicator } from "./trend-indicator";
import { formatFixed } from "./number-format";

export interface PlayerRowData {
  name: string;
  player_id?: string;
  pid?: string;
  position?: string;
  positions?: string[] | string;
  eligible_positions?: string[];
  team?: string;
  headshot?: string;
  mlb_id?: number;
  opponent?: string;
  percent_started?: number;
  percent_owned?: number;
  pct?: number;
  preseason_pick?: number;
  current_pick?: number;
  stats?: Record<string, string | number>;
  status?: string;
  intel?: any;
  trend?: any;
  z_score?: number | null;
  score?: number;
  tier?: string;
}

/** Reusable player cell content - name with team logo, headshot, and intel badge */
export function PlayerCell({ player, app, navigate, context }: {
  player: PlayerRowData;
  app?: any;
  navigate?: (data: any) => void;
  context?: string;
}) {
  var pid = player.player_id || player.pid || "";
  return (
    <span className="flex items-center gap-1 min-w-0">
      {player.team && <TeamLogo abbrev={player.team} size={16} />}
      <PlayerName
        name={player.name}
        playerId={pid}
        mlbId={player.mlb_id}
        app={app}
        navigate={navigate}
        context={context}
        showHeadshot={true}
      />
      {player.intel && <IntelBadge intel={player.intel} size="sm" />}
    </span>
  );
}

/** Ownership cell - shows % owned with optional trend indicator */
export function OwnershipCell({ player }: { player: PlayerRowData }) {
  var pct = player.percent_owned != null ? player.percent_owned : player.pct;
  return (
    <span className="inline-flex items-center gap-1 justify-end">
      {pct != null ? pct + "%" : "-"}
      {player.trend && <TrendIndicator trend={player.trend} />}
    </span>
  );
}

/** Opponent cell - shows today's opponent with team logo */
export function OpponentCell({ player }: { player: PlayerRowData }) {
  if (!player.opponent) {
    return <span className="text-xs text-muted-foreground">OFF</span>;
  }
  var oppAbbrev = player.opponent.replace(/^(vs |@)/, "");
  return (
    <span className="flex items-center gap-1">
      <TeamLogo abbrev={oppAbbrev} size={16} />
      <span className="text-xs">{player.opponent}</span>
    </span>
  );
}

/** Stats cells - renders a set of stat values */
export function StatCells({ player, statKeys }: { player: PlayerRowData; statKeys: string[] }) {
  return (
    <>
      {statKeys.map(function (key) {
        var val = player.stats ? player.stats[key] : undefined;
        return (
          <TableCell key={key} className="hidden lg:table-cell text-right font-mono text-xs">
            {val != null ? String(val) : "-"}
          </TableCell>
        );
      })}
    </>
  );
}

/** Full player table row with configurable column groups */
export function PlayerRow({ player, columns, statKeys, app, navigate, context, actions, highlight, rank, colSpan }: {
  player: PlayerRowData;
  columns?: ("opponent" | "rankings" | "fantasy" | "stats" | "positions" | "score" | "z-score")[];
  statKeys?: string[];
  app?: any;
  navigate?: (data: any) => void;
  context?: string;
  actions?: React.ReactNode;
  highlight?: boolean;
  rank?: number;
  colSpan?: number;
}) {
  var cols = columns || [];
  var showOpponent = cols.indexOf("opponent") >= 0;
  var showRankings = cols.indexOf("rankings") >= 0;
  var showFantasy = cols.indexOf("fantasy") >= 0;
  var showStats = cols.indexOf("stats") >= 0;
  var showPositions = cols.indexOf("positions") >= 0;
  var showScore = cols.indexOf("score") >= 0;
  var showZScore = cols.indexOf("z-score") >= 0;

  var posDisplay = "";
  if (player.positions) {
    posDisplay = Array.isArray(player.positions) ? player.positions.join(", ") : player.positions;
  } else if (player.eligible_positions) {
    posDisplay = player.eligible_positions.join(", ");
  }

  var span = colSpan || 20;

  var hasStatus = player.status && player.status !== "Healthy";

  return (
    <React.Fragment>
      <TableRow className={highlight ? "bg-sem-success-subtle" : ""}>
        {rank != null && (
          <TableCell className="font-mono text-xs text-muted-foreground w-8 text-right">{rank}</TableCell>
        )}

        {player.position !== undefined && (
          <TableCell className="w-14">
            <Badge color="zinc" className="font-mono text-xs font-bold">{player.position || "?"}</Badge>
          </TableCell>
        )}

        <TableCell className="font-medium">
          <PlayerCell player={player} app={app} navigate={navigate} context={context} />
        </TableCell>

        {showPositions && (
          <TableCell className="hidden sm:table-cell">
            <div className="flex gap-1 flex-wrap">
              {posDisplay.split(",").map(function (pos) {
                var p = pos.trim();
                return p ? <Badge key={p} color="zinc" className="text-xs">{p}</Badge> : null;
              })}
            </div>
          </TableCell>
        )}

        {showOpponent && (
          <TableCell className="hidden sm:table-cell text-sm">
            <OpponentCell player={player} />
          </TableCell>
        )}

        {showRankings && (
          <>
            <TableCell className="hidden sm:table-cell text-right font-mono text-xs">
              {player.preseason_pick != null ? player.preseason_pick : "-"}
            </TableCell>
            <TableCell className="hidden md:table-cell text-right font-mono text-xs">
              {player.current_pick != null ? player.current_pick : "-"}
            </TableCell>
          </>
        )}

        {showFantasy && (
          <>
            <TableCell className="hidden md:table-cell text-right font-mono text-xs">
              {player.percent_started != null ? player.percent_started + "%" : "-"}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              <OwnershipCell player={player} />
            </TableCell>
          </>
        )}

        {showStats && statKeys && (
          <StatCells player={player} statKeys={statKeys} />
        )}

        {showScore && (
          <TableCell className="text-right font-mono text-xs font-medium">
            {player.score != null ? formatFixed(player.score, 1, "0.0") : "-"}
          </TableCell>
        )}

        {showZScore && (
          <TableCell className="text-right font-mono text-xs font-medium">
            {player.z_score != null ? formatFixed(player.z_score, 2, "0.00") : "-"}
          </TableCell>
        )}

        {hasStatus ? (
          <TableCell>
            <Badge color="red" className="text-xs">{player.status}</Badge>
          </TableCell>
        ) : cols.length > 0 ? (
          <TableCell></TableCell>
        ) : null}

        {actions !== undefined && (
          <TableCell>{actions}</TableCell>
        )}
      </TableRow>

      {player.intel && (
        <TableRow>
          <TableCell colSpan={span} className="p-0">
            <IntelPanel intel={player.intel} />
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}
