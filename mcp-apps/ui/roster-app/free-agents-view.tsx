import React, { useState } from "react";
import { Button } from "../catalyst/button";
import { Input } from "../catalyst/input";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { Tabs, TabsList, TabsTrigger } from "../catalyst/tabs";
import { AlertDialog } from "../catalyst/alert-dialog";
import { Subheading } from "../catalyst/heading";
import { Text } from "../catalyst/text";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerRow, PlayerRowData } from "../shared/player-row";
import { AiInsight } from "../shared/ai-insight";
import { Search, UserPlus, Loader2 } from "@/shared/icons";

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
  const { callTool, loading } = useCallTool(app);
  const [searchQuery, setSearchQuery] = useState("");
  const [addTarget, setAddTarget] = useState<PlayerRowData | null>(null);
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
      <Subheading>{title}</Subheading>

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
        <Button type="submit" disabled={loading}>
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
          <Text>No players found.</Text>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Player</TableHeader>
                <TableHeader className="hidden sm:table-cell">Positions</TableHeader>
                <TableHeader className="hidden md:table-cell text-right">%Start</TableHeader>
                <TableHeader className="text-right">%Own</TableHeader>
                <TableHeader className="w-24">Status</TableHeader>
                <TableHeader className="w-20"></TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {players.map((p) => (
                <PlayerRow
                  key={p.player_id}
                  player={p}
                  columns={["positions", "fantasy"]}
                  app={app}
                  navigate={navigate}
                  context="free-agents"
                  colSpan={6}
                  actions={
                    <Button onClick={() => setAddTarget(p)} className="font-bold px-3">
                      <UserPlus size={14} className="mr-1" />
                      ADD
                    </Button>
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Text className="mt-2">{players.length + " players"}</Text>
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
