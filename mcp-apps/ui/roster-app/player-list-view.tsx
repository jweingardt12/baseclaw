import React, { useState, useCallback } from "react";
import { Button } from "@plexui/ui/components/Button";
import { Input } from "@plexui/ui/components/Input";
import { Badge } from "@plexui/ui/components/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Dialog } from "@plexui/ui/components/Dialog";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerRow, PlayerRowData } from "../shared/player-row";
import { AiInsight } from "../shared/ai-insight";
import { Search, UserPlus, Loader2, ArrowUp, TrendingDown } from "@/shared/icons";
import { PlayerName } from "../shared/player-name";
import { IntelBadge } from "../shared/intel-badge";

var BATTER_POSITIONS = ["B", "C", "1B", "2B", "SS", "3B", "OF", "Util"];
var PITCHER_POSITIONS = ["P", "SP", "RP"];
var ALL_POSITIONS = BATTER_POSITIONS.concat(PITCHER_POSITIONS);

var BATTER_STAT_KEYS = ["R", "H", "HR", "RBI", "K", "TB", "AVG", "OBP", "XBH", "NSB"];
var PITCHER_STAT_KEYS = ["IP", "W", "L", "ER", "K", "HLD", "ERA", "WHIP", "QS", "NSV"];

function isBatterPosition(pos: string) {
  return BATTER_POSITIONS.indexOf(pos) >= 0;
}

interface PlayerListData {
  type: string;
  pos_type?: string;
  count?: number;
  status?: string;
  players?: PlayerRowData[];
  query?: string;
  results?: PlayerRowData[];
  ai_recommendation?: string | null;
}

type SortDir = "asc" | "desc";

export function PlayerListView({ data, app, navigate }: { data: PlayerListData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);
  var [activePos, setActivePos] = useState(data.pos_type || "B");
  var [searchQuery, setSearchQuery] = useState("");
  var [isSearchResult, setIsSearchResult] = useState(false);
  var [addTarget, setAddTarget] = useState<PlayerRowData | null>(null);
  var [sortCol, setSortCol] = useState<string>("percent_owned");
  var [sortDir, setSortDir] = useState<SortDir>("desc");

  var rawPlayers = data.players || data.results || [];

  // Sort players
  var players = rawPlayers.slice().sort(function (a, b) {
    var aVal = getSortValue(a, sortCol);
    var bVal = getSortValue(b, sortCol);
    if (aVal === bVal) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (sortDir === "asc") return aVal < bVal ? -1 : 1;
    return aVal > bVal ? -1 : 1;
  });

  var isBatter = isBatterPosition(activePos);
  var statKeys = isBatter ? BATTER_STAT_KEYS : PITCHER_STAT_KEYS;

  var handlePositionChange = useCallback(async function (pos: string) {
    setActivePos(pos);
    setIsSearchResult(false);
    setSearchQuery("");
    var result = await callTool("yahoo_player_list", { pos_type: pos, count: 50, status: "FA" });
    if (result) {
      navigate(result.structuredContent);
    }
  }, [callTool, navigate]);

  var handleSearch = useCallback(async function (e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    var result = await callTool("yahoo_search", { player_name: searchQuery });
    if (result) {
      setIsSearchResult(true);
      navigate(result.structuredContent);
    }
  }, [callTool, navigate, searchQuery]);

  var handleAdd = useCallback(async function () {
    if (!addTarget) return;
    var result = await callTool("yahoo_add", { player_id: addTarget.player_id });
    setAddTarget(null);
    if (result) {
      navigate(result.structuredContent);
    }
  }, [callTool, navigate, addTarget]);

  var handleLoadMore = useCallback(async function () {
    var nextCount = (data.count || 50) + 50;
    var result = await callTool("yahoo_player_list", { pos_type: activePos, count: nextCount, status: "FA" });
    if (result) {
      navigate(result.structuredContent);
    }
  }, [callTool, navigate, activePos, data.count]);

  var handleSort = useCallback(function (col: string) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      // Default desc for numeric columns, asc for names
      setSortDir(col === "name" ? "asc" : "desc");
    }
  }, [sortCol, sortDir]);

  var title = isSearchResult
    ? "Search Results: " + (data.query || searchQuery)
    : "Player List";

  return (
    <div className="space-y-3">
      <Subheading>{title}</Subheading>

      <AiInsight recommendation={data.ai_recommendation} />

      {/* Position filter pills */}
      <div className="flex flex-wrap gap-1">
        {ALL_POSITIONS.map(function (pos) {
          var label = pos === "B" ? "All Batters" : pos === "P" ? "All Pitchers" : pos;
          var isActive = activePos === pos;
          return (
            <Button
              key={pos}
              variant={isActive ? "solid" : "outline"}
              color="secondary"
              className={"text-xs px-2 py-1 h-7" + (isActive ? "" : " text-muted-foreground")}
              onClick={function () { handlePositionChange(pos); }}
              disabled={loading}
            >
              {label}
            </Button>
          );
        })}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={function (e: React.ChangeEvent<HTMLInputElement>) { setSearchQuery(e.target.value); }}
        />
        <Button type="submit" color="secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {/* Player table */}
      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {players.length === 0 ? (
          <Text>No players found.</Text>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead col="name" label="Player" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <TableHead className="hidden sm:table-cell">Pos</TableHead>
                  <SortableHead col="opponent" label="Opp" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  <TableHead className="hidden lg:table-cell text-right">
                    <span className="cursor-pointer select-none" onClick={function () { handleSort("preseason_pick"); }}>
                      Pre ADP{sortCol === "preseason_pick" ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}
                    </span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-right">
                    <span className="cursor-pointer select-none" onClick={function () { handleSort("current_pick"); }}>
                      Curr ADP{sortCol === "current_pick" ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}
                    </span>
                  </TableHead>
                  <SortableHead col="percent_owned" label="%Own" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHead col="percent_started" label="%Start" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell text-right" />
                  {statKeys.map(function (key) {
                    return (
                      <TableHead key={key} className="hidden lg:table-cell text-right font-mono text-xs">
                        <span className="cursor-pointer select-none" onClick={function () { handleSort("stat_" + key); }}>
                          {key}{sortCol === "stat_" + key ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}
                        </span>
                      </TableHead>
                    );
                  })}
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map(function (p) {
                  var posDisplay = "";
                  if (p.eligible_positions) {
                    posDisplay = Array.isArray(p.eligible_positions) ? p.eligible_positions.join(", ") : String(p.eligible_positions);
                  } else if (p.positions) {
                    posDisplay = Array.isArray(p.positions) ? p.positions.join(", ") : String(p.positions);
                  }

                  var isRostered = (p as any).roster_status && (p as any).roster_status !== "FA";

                  return (
                    <TableRow key={p.player_id || p.pid} className={isRostered ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1 min-w-0">
                          {p.team && <img src={"https://www.mlbstatic.com/team-logos/" + getTeamId(p.team) + ".svg"} alt="" className="w-4 h-4" onError={function (e: any) { e.target.style.display = "none"; }} />}
                          <PlayerName name={p.name} playerId={p.player_id || p.pid} mlbId={p.mlb_id} app={app} navigate={navigate} context="free-agents" />
                          {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex gap-0.5 flex-wrap">
                          {posDisplay.split(",").map(function (pos) {
                            var trimmed = pos.trim();
                            return trimmed ? <Badge key={trimmed} color="secondary" className="text-[10px] px-1 py-0">{trimmed}</Badge> : null;
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {p.opponent || <span className="text-muted-foreground">OFF</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right font-mono text-xs">
                        {p.preseason_pick != null ? p.preseason_pick : "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right font-mono text-xs">
                        {p.current_pick != null ? p.current_pick : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {p.percent_owned != null ? p.percent_owned + "%" : (p.pct != null ? p.pct + "%" : "-")}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right font-mono text-xs">
                        {p.percent_started != null ? p.percent_started + "%" : "-"}
                      </TableCell>
                      {statKeys.map(function (key) {
                        var val = p.stats ? p.stats[key] : undefined;
                        return (
                          <TableCell key={key} className="hidden lg:table-cell text-right font-mono text-xs">
                            {val != null ? String(val) : "-"}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        {p.status && p.status !== "Healthy" ? (
                          <Badge color="danger" className="text-[10px] px-1">{p.status}</Badge>
                        ) : isRostered ? (
                          <Badge color="secondary" className="text-[10px] px-1">Rostered</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {!isRostered && (
                          <Button color="secondary" className="h-6 text-xs px-2" onClick={function () { setAddTarget(p); }}>
                            <UserPlus size={12} className="mr-1" />
                            Add
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Text>{players.length + " players"}</Text>
        {!isSearchResult && players.length >= 20 && (
          <Button variant="outline" color="secondary" onClick={handleLoadMore} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Load More
          </Button>
        )}
      </div>

      <Dialog open={addTarget !== null} onOpenChange={function (open) { if (!open) setAddTarget(null); }}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Add Player</Dialog.Title>
            <Dialog.Description>{"Add " + (addTarget ? addTarget.name : "") + " to your roster?"}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="ghost" color="secondary" onClick={function () { setAddTarget(null); }} disabled={loading}>Cancel</Button>
            <Button color="secondary" onClick={handleAdd} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Add
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}

function SortableHead({ col, label, sortCol, sortDir, onSort, className }: {
  col: string;
  label: string;
  sortCol: string;
  sortDir: SortDir;
  onSort: (col: string) => void;
  className?: string;
}) {
  var isActive = sortCol === col;
  return (
    <TableHead className={className || ""}>
      <span className="cursor-pointer select-none" onClick={function () { onSort(col); }}>
        {label}{isActive ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}
      </span>
    </TableHead>
  );
}

function getSortValue(p: PlayerRowData, col: string): any {
  if (col === "name") return (p.name || "").toLowerCase();
  if (col === "percent_owned") return p.percent_owned != null ? p.percent_owned : (p.pct != null ? p.pct : -1);
  if (col === "percent_started") return p.percent_started != null ? p.percent_started : -1;
  if (col === "preseason_pick") return p.preseason_pick != null ? p.preseason_pick : 9999;
  if (col === "current_pick") return p.current_pick != null ? p.current_pick : 9999;
  if (col === "opponent") return p.opponent || "";
  if (col.indexOf("stat_") === 0) {
    var statKey = col.slice(5);
    var val = p.stats ? p.stats[statKey] : undefined;
    if (val == null) return -99999;
    var num = parseFloat(String(val));
    return isNaN(num) ? -99999 : num;
  }
  return 0;
}

// MLB team abbreviation -> team ID mapping for logos
var TEAM_IDS: Record<string, string> = {
  ARI: "109", ATL: "144", BAL: "110", BOS: "111", CHC: "112",
  CWS: "145", CIN: "113", CLE: "114", COL: "115", DET: "116",
  HOU: "117", KC: "118", LAA: "108", LAD: "119", MIA: "146",
  MIL: "158", MIN: "142", NYM: "121", NYY: "147", OAK: "133",
  PHI: "143", PIT: "134", SD: "135", SF: "137", SEA: "136",
  STL: "138", TB: "139", TEX: "140", TOR: "141", WSH: "120",
};

function getTeamId(abbrev: string): string {
  return TEAM_IDS[abbrev] || "0";
}
