import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { LoadingIndicator } from "@/shared/loading-indicator";
import { EmptyMessage } from "@/shared/empty-message";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerCell, PlayerRowData, OwnershipCell } from "../shared/player-row";
import { IntelPanel } from "../shared/intel-panel";

interface FreeAgentsData {
  type: string;
  pos_type?: string;
  count?: number;
  query?: string;
  players?: PlayerRowData[];
  results?: PlayerRowData[];
  ai_recommendation?: string | null;
}

export function FreeAgentsView({ data, app, navigate }: { data: FreeAgentsData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);
  var [searchQuery, setSearchQuery] = useState("");
  var [addTarget, setAddTarget] = useState<PlayerRowData | null>(null);
  var [activeTab, setActiveTab] = useState(data.pos_type || "B");
  var players = data.players || data.results || [];

  var title = data.type === "search"
    ? "Search Results: " + (data.query || "")
    : "Free Agents (" + (data.pos_type === "P" ? "Pitchers" : "Batters") + ")";

  var handleTabChange = async function (value: string) {
    setActiveTab(value);
    var result = await callTool("yahoo_free_agents", { pos_type: value, count: 20 });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  var handleSearch = async function (e: any) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    var result = await callTool("yahoo_search", { player_name: searchQuery });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  var handleAdd = async function () {
    if (!addTarget) return;
    var result = await callTool("yahoo_add", { player_id: addTarget.player_id });
    setAddTarget(null);
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>

      {data.type !== "search" && (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="B">Batters</TabsTrigger>
            <TabsTrigger value="P">Pitchers</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={function (e: any) { setSearchQuery(e.target.value); }}
        />
        <Button type="submit" variant="secondary" disabled={loading}>
          {loading ? <LoadingIndicator size={16} /> : "Search"}
        </Button>
      </form>

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <LoadingIndicator size={20} />
          </div>
        )}
        {players.length === 0 ? (
          <EmptyMessage title="No players found" description="Try a different search or position filter." />
        ) : (
          <div className="w-full overflow-x-auto mcp-app-scroll-x">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="hidden sm:table-cell">Positions</TableHead>
                  <TableHead className="hidden md:table-cell text-right">%Start</TableHead>
                  <TableHead className="text-right">%Own</TableHead>
                  <TableHead className="w-24">Status</TableHead>
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
                  var hasStatus = p.status && p.status !== "Healthy";
                  return (
                    <>
                      <TableRow key={p.player_id}>
                        <TableCell className="font-medium">
                          <PlayerCell player={p} app={app} navigate={navigate} context="free-agents" />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {posDisplay.split(",").map(function (pos) {
                              var trimmed = pos.trim();
                              return trimmed ? <Badge key={trimmed} variant="secondary">{trimmed}</Badge> : null;
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right font-mono text-xs">
                          {p.percent_started != null ? p.percent_started + "%" : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <OwnershipCell player={p} />
                        </TableCell>
                        <TableCell>
                          {hasStatus ? <Badge variant="destructive">{p.status}</Badge> : null}
                        </TableCell>
                        <TableCell>
                          <Button variant="secondary" size="xs" onClick={function () { setAddTarget(p); }}>
                            Add
                          </Button>
                        </TableCell>
                      </TableRow>
                      {p.intel && (
                        <TableRow key={(p.player_id || "") + "-intel"}>
                          <TableCell colSpan={6} className="p-0">
                            <IntelPanel intel={p.intel} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{players.length + " players"}</p>

      <Dialog open={addTarget !== null} onOpenChange={function (open) { if (!open) setAddTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Player</DialogTitle>
            <DialogDescription>{"Add " + (addTarget ? addTarget.name : "") + " to your roster?"}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={function () { setAddTarget(null); }} disabled={loading}>Cancel</Button>
            <Button variant="default" onClick={handleAdd} disabled={loading}>
              {loading ? <LoadingIndicator size={16} /> : null}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
