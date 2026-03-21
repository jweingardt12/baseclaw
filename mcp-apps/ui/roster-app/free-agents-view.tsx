import React, { useState } from "react";
import { Button } from "@plexui/ui/components/Button";
import { Input } from "@plexui/ui/components/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Tabs } from "@plexui/ui/components/Tabs";
import { Dialog } from "@plexui/ui/components/Dialog";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
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
  const [activeTab, setActiveTab] = useState(data.pos_type || "B");
  const players = data.players || data.results || [];
  const title = data.type === "search"
    ? "Search Results: " + (data.query || "")
    : "Free Agents (" + (data.pos_type === "P" ? "Pitchers" : "Batters") + ")";

  const handleTabChange = async (value: string) => {
    setActiveTab(value);
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
    <div className="space-y-4">
      <Subheading>{title}</Subheading>

      <AiInsight recommendation={data.ai_recommendation} />

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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
        />
        <Button type="submit" color="secondary" disabled={loading}>
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
                    <Button color="secondary" size="xs" onClick={() => setAddTarget(p)}>
                      <UserPlus size={14} />
                      Add
                    </Button>
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Text className="mt-2">{players.length + " players"}</Text>
      <Dialog open={addTarget !== null} onOpenChange={(open) => { if (!open) setAddTarget(null); }}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Add Player</Dialog.Title>
            <Dialog.Description>{"Add " + (addTarget ? addTarget.name : "") + " to your roster?"}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="ghost" color="secondary" onClick={() => setAddTarget(null)} disabled={loading}>Cancel</Button>
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
