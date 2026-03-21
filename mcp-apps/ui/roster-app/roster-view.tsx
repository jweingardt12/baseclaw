import React, { useState } from "react";
import { Button } from "@plexui/ui/components/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Dialog } from "@plexui/ui/components/Dialog";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerRow, PlayerRowData, OpponentCell, OwnershipCell, StatCells } from "../shared/player-row";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { Users, UserMinus, Loader2 } from "@/shared/icons";

export function RosterView({ data, app, navigate }: { data: { players: PlayerRowData[]; ai_recommendation?: string | null }; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);
  const [dropTarget, setDropTarget] = useState<Player | null>(null);

  var players = data.players || [];
  var injuredCount = players.filter(function (p) { return p.status && p.status !== "Healthy"; }).length;
  var ilSlots = players.filter(function (p) { return p.position === "IL" || p.position === "IL+"; }).length;

  const handleDrop = async () => {
    if (!dropTarget) return;
    const result = await callTool("yahoo_drop", { player_id: dropTarget.player_id });
    setDropTarget(null);
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-4">
      <Subheading className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        Current Roster
      </Subheading>

      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={players.length} label="Total Players" color="primary" />
        <KpiTile value={injuredCount} label="Injured" color={injuredCount > 0 ? "risk" : "success"} />
        <KpiTile value={ilSlots} label="IL Slots Used" color="info" />
      </div>

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Pos</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="hidden sm:table-cell">Opp</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Pre ADP</TableHead>
              <TableHead className="hidden md:table-cell text-right">Cur ADP</TableHead>
              <TableHead className="hidden md:table-cell text-right">%Start</TableHead>
              <TableHead className="text-right">%Own</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((p) => (
              <PlayerRow
                key={p.player_id}
                player={p}
                columns={["opponent", "fantasy", "rankings"]}
                app={app}
                navigate={navigate}
                context="roster"
                colSpan={9}
                actions={
                  p.player_id ? (
                    <Button color="danger" size="xs" variant="soft" onClick={() => setDropTarget(p)}>
                      <UserMinus size={14} />
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <Text className="mt-2">{players.length + " players"}</Text>
      <Dialog open={dropTarget !== null} onOpenChange={(open) => { if (!open) setDropTarget(null); }}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Drop Player</Dialog.Title>
            <Dialog.Description>{"Are you sure you want to drop " + (dropTarget ? dropTarget.name : "") + "?"}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="ghost" color="secondary" onClick={() => setDropTarget(null)} disabled={loading}>Cancel</Button>
            <Button color="danger" onClick={handleDrop} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Drop
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}
