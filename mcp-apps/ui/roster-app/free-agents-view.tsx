import { useState } from "react";
import { Button } from "@plexui/ui/components/Button";
import { Input } from "@plexui/ui/components/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Tabs } from "@plexui/ui/components/Tabs";
import { Badge } from "@plexui/ui/components/Badge";
import { Dialog } from "@plexui/ui/components/Dialog";
import { EmptyMessage } from "@plexui/ui/components/EmptyMessage";
import { LoadingIndicator } from "@plexui/ui/components/Indicator";
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
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="Player type">
          <Tabs.Tab value="B">Batters</Tabs.Tab>
          <Tabs.Tab value="P">Pitchers</Tabs.Tab>
        </Tabs>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={function (e: any) { setSearchQuery(e.target.value); }}
        />
        <Button type="submit" color="secondary" disabled={loading}>
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
                            return trimmed ? <Badge key={trimmed} color="secondary" size="sm">{trimmed}</Badge> : null;
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
                        {hasStatus ? <Badge color="danger" size="sm">{p.status}</Badge> : null}
                      </TableCell>
                      <TableCell>
                        <Button color="secondary" size="xs" onClick={function () { setAddTarget(p); }}>
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
        )}
      </div>

      <p className="text-sm text-muted-foreground">{players.length + " players"}</p>

      <Dialog open={addTarget !== null} onOpenChange={function (open) { if (!open) setAddTarget(null); }}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Add Player</Dialog.Title>
            <Dialog.Description>{"Add " + (addTarget ? addTarget.name : "") + " to your roster?"}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="ghost" color="secondary" onClick={function () { setAddTarget(null); }} disabled={loading}>Cancel</Button>
            <Button color="secondary" onClick={handleAdd} disabled={loading}>
              {loading ? <LoadingIndicator size={16} /> : null}
              Add
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}
