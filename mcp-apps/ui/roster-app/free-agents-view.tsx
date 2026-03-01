import React, { useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { AlertDialog } from "../components/ui/alert-dialog";
import { useCallTool } from "../shared/use-call-tool";
import { teamLogoFromAbbrev } from "../shared/mlb-images";
import { IntelBadge } from "../shared/intel-badge";
import { IntelPanel } from "../shared/intel-panel";
import { PlayerName } from "../shared/player-name";
import { TrendIndicator } from "../shared/trend-indicator";
import { AiInsight } from "../shared/ai-insight";
import { Search, UserPlus, Loader2 } from "@/shared/icons";

interface Player {
  name: string;
  player_id: string;
  positions?: string;
  eligible_positions?: string[];
  percent_owned?: number;
  status?: string;
  team?: string;
  mlb_id?: number;
  intel?: any;
  trend?: any;
}

interface FreeAgentsData {
  type: string;
  pos_type?: string;
  count?: number;
  query?: string;
  players?: Player[];
  results?: Player[];
  ai_recommendation?: string | null;
}

export function FreeAgentsView({ data, app, navigate }: { data: FreeAgentsData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);
  const [searchQuery, setSearchQuery] = useState("");
  const [addTarget, setAddTarget] = useState<Player | null>(null);
  const players = data.players || data.results || [];
  const title = data.type === "search"
    ? "Search Results: " + (data.query || "")
    : "Free Agents (" + (data.pos_type === "P" ? "Pitchers" : "Batters") + ")";

  const handleTabChange = async (value: string) => {
    const result = await callTool("yahoo_free_agents", { pos_type: value, count: 20 });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const result = await callTool("yahoo_search", { player_name: searchQuery });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  const handleAdd = async () => {
    if (!addTarget) return;
    const result = await callTool("yahoo_add", { player_id: addTarget.player_id });
    setAddTarget(null);
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>

      <AiInsight recommendation={data.ai_recommendation} />

      {data.type !== "search" && (
        <Tabs defaultValue={data.pos_type || "B"} onValueChange={handleTabChange} className="mb-2">
          <TabsList>
            <TabsTrigger value="B">Batters</TabsTrigger>
            <TabsTrigger value="P">Pitchers</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <form onSubmit={handleSearch} className="flex gap-2 mb-2">
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>
      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {players.length === 0 ? (
          <p className="text-muted-foreground">No players found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Positions</TableHead>
                <TableHead className="text-right">% Owned</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p, idx) => {
                const posDisplay = p.positions || (p.eligible_positions || []).join(", ");
                const logoUrl = p.team ? teamLogoFromAbbrev(p.team) : null;
                return (
                  <React.Fragment key={p.player_id}>
                  <TableRow>
                    <TableCell className="font-medium">
                      <span className="flex items-center" style={{ gap: "4px" }}>
                        {logoUrl && <img src={logoUrl} alt={p.team || ""} width={16} height={16} style={{ display: "inline", flexShrink: 0 }} />}
                        <PlayerName name={p.name} playerId={p.player_id} mlbId={p.mlb_id} app={app} navigate={navigate} context="free-agents" />
                        {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {posDisplay.split(",").map((pos) => (
                          <Badge key={pos.trim()} variant="outline" className="text-xs">{pos.trim()}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className="inline-flex items-center gap-1 justify-end">
                        {p.percent_owned != null ? p.percent_owned + "%" : "-"}
                        <TrendIndicator trend={p.trend} />
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.status && p.status !== "Healthy" && (
                        <Badge variant="destructive" className="text-xs">{p.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => setAddTarget(p)} className="font-bold px-3">
                        <UserPlus size={14} className="mr-1" />
                        ADD
                      </Button>
                    </TableCell>
                  </TableRow>
                  {p.intel && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <IntelPanel intel={p.intel} />
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{players.length + " players"}</p>
      <AlertDialog
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        onConfirm={handleAdd}
        title="Add Player"
        description={"Add " + (addTarget ? addTarget.name : "") + " to your roster?"}
        confirmLabel="Add"
        loading={loading}
      />
    </div>
  );
}
