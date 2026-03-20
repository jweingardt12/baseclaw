import React, { useState } from "react";
import { Button } from "../catalyst/button";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { AlertDialog } from "../catalyst/alert-dialog";
import { Subheading } from "../catalyst/heading";
import { Text } from "../catalyst/text";
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
    <div className="space-y-3">
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
          <TableHead>
            <TableRow>
              <TableHeader className="w-14">Pos</TableHeader>
              <TableHeader>Player</TableHeader>
              <TableHeader className="hidden sm:table-cell">Opp</TableHeader>
              <TableHeader className="hidden sm:table-cell text-right">Pre ADP</TableHeader>
              <TableHeader className="hidden md:table-cell text-right">Cur ADP</TableHeader>
              <TableHeader className="hidden md:table-cell text-right">%Start</TableHeader>
              <TableHeader className="text-right">%Own</TableHeader>
              <TableHeader className="w-24">Status</TableHeader>
              <TableHeader className="w-16"></TableHeader>
            </TableRow>
          </TableHead>
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
                    <Button color="red" onClick={() => setDropTarget(p)}>
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
      <AlertDialog
        open={dropTarget !== null}
        onClose={() => setDropTarget(null)}
        onConfirm={handleDrop}
        title="Drop Player"
        description={"Are you sure you want to drop " + (dropTarget ? dropTarget.name : "") + "?"}
        variant="destructive"
        confirmLabel="Drop"
        loading={loading}
      />
    </div>
  );
}
