import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@plexui/ui/components/Badge";
import { Button } from "@plexui/ui/components/Button";
import { Subheading } from "../components/heading";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { useCallTool } from "../shared/use-call-tool";
import { mlbHeadshotUrl } from "../shared/mlb-images";
import { TeamLogo } from "../shared/team-logo";
import { IntelBadge } from "../shared/intel-badge";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { FlaskConical, Search, Loader2, TrendingUp, TrendingDown, Minus } from "@/shared/icons";

interface SimulatePlayer {
  name: string;
  team: string;
  positions: string;
  mlb_id?: number;
  intel?: any;
}

interface CategoryRank {
  name: string;
  rank: number;
  total: number;
}

interface SimulatedRank {
  name: string;
  rank: number;
  total: number;
  change: number;
}

interface SimulateData {
  add_player: SimulatePlayer;
  drop_player: SimulatePlayer | null;
  current_ranks: CategoryRank[];
  simulated_ranks: SimulatedRank[];
  summary: string;
  ai_recommendation?: string | null;
}

interface RosterPlayer {
  name: string;
  player_id?: string;
  position?: string;
  team?: string;
  mlb_id?: number;
}

function ChangeIcon({ change }: { change: number }) {
  if (change > 0) return <TrendingUp size={14} className="text-sem-success" />;
  if (change < 0) return <TrendingDown size={14} className="text-red-600 dark:text-red-400" />;
  return <Minus size={14} className="text-muted-foreground" />;
}

function netBadgeColor(n: number): string {
  if (n > 0) return "bg-sem-success";
  if (n < 0) return "bg-red-600 text-white";
  return "bg-muted text-muted-foreground";
}

function ChangeText({ change }: { change: number }) {
  if (change > 0) return <span className="text-sem-success font-medium">{"+" + change}</span>;
  if (change < 0) return <span className="text-red-600 dark:text-red-400 font-medium">{String(change)}</span>;
  return <span className="text-muted-foreground">--</span>;
}

export function SimulateView({ data, app, navigate }: { data: SimulateData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);
  const [searchInput, setSearchInput] = useState("");
  const [showDropPicker, setShowDropPicker] = useState(false);
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    const result = await callTool("yahoo_category_simulate", { add_name: searchInput.trim() });
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleLoadRoster = async () => {
    setShowDropPicker(true);
    setRosterLoading(true);
    try {
      const result = await callTool("yahoo_roster", {});
      if (result && result.structuredContent) {
        var players = result.structuredContent.players || [];
        setRosterPlayers(players);
      }
    } catch (_) {
      // handled by useCallTool
    }
    setRosterLoading(false);
  };

  const handleDropSelect = async (playerName: string) => {
    setShowDropPicker(false);
    var addName = data.add_player ? data.add_player.name : "";
    if (!addName) return;
    var result = await callTool("yahoo_category_simulate", { add_name: addName, drop_name: playerName });
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  var netChange = 0;
  for (var i = 0; i < (data.simulated_ranks || []).length; i++) {
    netChange += (data.simulated_ranks[i].change || 0);
  }

  var improved = (data.simulated_ranks || []).filter(function (s) { return s.change > 0; }).length;
  var regressed = (data.simulated_ranks || []).filter(function (s) { return s.change < 0; }).length;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={improved} label="Improved" color={improved > 0 ? "success" : "neutral"} />
        <KpiTile value={regressed} label="Regressed" color={regressed > 0 ? "risk" : "neutral"} />
        <KpiTile value={(netChange > 0 ? "+" : "") + netChange} label="Net Change" color={netChange > 0 ? "success" : netChange < 0 ? "risk" : "neutral"} />
      </div>

      {/* Header */}
      <Subheading className="flex items-center gap-2">
        <FlaskConical size={18} />
        Category Simulator
      </Subheading>

      {/* Player Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Add Player */}
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Adding</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              {data.add_player.mlb_id && (
                <img
                  src={mlbHeadshotUrl(data.add_player.mlb_id)}
                  alt=""
                  className="w-10 h-10 rounded-full bg-muted object-cover flex-shrink-0"
                />
              )}
              <div>
                <p className="font-semibold">
                  {data.add_player.name}
                  {data.add_player.intel && <span className="ml-1.5"><IntelBadge intel={data.add_player.intel} size="sm" /></span>}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <TeamLogo abbrev={data.add_player.team} size={14} />
                    {data.add_player.team}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {(data.add_player.positions || "").split(",").filter(Boolean).map(function (pos) {
                      return <Badge key={pos.trim()} color="secondary" size="sm">{pos.trim()}</Badge>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drop Player */}
        {data.drop_player ? (
          <Card className="border-red-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Dropping</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                {data.drop_player.mlb_id && (
                  <img
                    src={mlbHeadshotUrl(data.drop_player.mlb_id)}
                    alt=""
                    className="w-10 h-10 rounded-full bg-muted object-cover flex-shrink-0"
                  />
                )}
                <div>
                  <p className="font-semibold">
                    {data.drop_player.name}
                    {data.drop_player.intel && <span className="ml-1.5"><IntelBadge intel={data.drop_player.intel} size="sm" /></span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <TeamLogo abbrev={data.drop_player.team} size={14} />
                      {data.drop_player.team}
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {(data.drop_player.positions || "").split(",").filter(Boolean).map(function (pos) {
                        return <Badge key={pos.trim()} color="secondary" size="sm">{pos.trim()}</Badge>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center h-full p-3">
              <Button variant="outline" color="secondary" onClick={handleLoadRoster} disabled={loading}>
                Simulate Drop
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Impact Summary Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge size="sm" className={netBadgeColor(netChange)}>
          {"Net: " + (netChange > 0 ? "+" : "") + netChange}
        </Badge>
        {improved > 0 && (
          <Badge color="secondary" size="sm" className="text-green-600 border-green-500/30">
            {improved + " improved"}
          </Badge>
        )}
        {regressed > 0 && (
          <Badge color="secondary" size="sm" className="text-red-600 border-red-500/30">
            {regressed + " regressed"}
          </Badge>
        )}
      </div>

      {/* Before/After Table */}
      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-center hidden sm:table-cell">Current</TableHead>
              <TableHead className="text-center">Simulated</TableHead>
              <TableHead className="text-center">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.current_ranks || []).map(function (cr, idx) {
              var sr = (data.simulated_ranks || [])[idx] || { name: cr.name, rank: cr.rank, total: cr.total, change: 0 };
              var hasChange = sr.change !== 0;
              var rowClass = "";
              if (sr.change > 0) rowClass = "bg-sem-success-subtle";
              if (sr.change < 0) rowClass = "bg-sem-risk-subtle";
              return (
                <TableRow key={cr.name + "-" + idx} className={rowClass}>
                  <TableCell className="font-medium">{cr.name}</TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    <span className="font-mono">{cr.rank}</span>
                    <span className="text-muted-foreground text-xs">{"/" + cr.total}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={"font-mono " + (hasChange ? "font-semibold" : "")}>{sr.rank}</span>
                    <span className="text-muted-foreground text-xs">{"/" + sr.total}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ChangeIcon change={sr.change} />
                      <ChangeText change={sr.change} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-3">
          <p className="text-sm">{data.summary}</p>
        </CardContent>
      </Card>

      {/* Search for a different player */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Try a different player..."
            value={searchInput}
            onChange={function (e) { setSearchInput(e.target.value); }}
            onKeyDown={handleKeyDown}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pl-8"
          />
        </div>
        <Button color="secondary" onClick={handleSearch} disabled={loading || !searchInput.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simulate"}
        </Button>
      </div>

      {/* Drop Picker Dialog */}
      {showDropPicker && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Select player to drop</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {rosterLoading ? (
              <div className="flex items-center justify-center p-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {rosterPlayers.map(function (p, i) {
                  return (
                    <button
                      key={p.name + "-" + i}
                      onClick={function () { handleDropSelect(p.name); }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.position || ""}</span>
                      <span className="text-xs text-muted-foreground ml-auto flex items-center gap-0.5">
                        <TeamLogo abbrev={p.team} size={14} />
                        {p.team || ""}
                      </span>
                    </button>
                  );
                })}
                {rosterPlayers.length === 0 && (
                  <p className="text-sm text-muted-foreground p-2">No roster data available</p>
                )}
              </div>
            )}
            <div className="mt-2">
              <Button variant="outline" color="secondary" onClick={function () { setShowDropPicker(false); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
