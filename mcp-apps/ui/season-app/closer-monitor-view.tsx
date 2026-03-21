import { useState } from "react";
import { Badge } from "@plexui/ui/components/Badge";
import { Button } from "@plexui/ui/components/Button";
import { Subheading } from "../components/heading";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Tabs } from "@plexui/ui/components/Tabs";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerName } from "../shared/player-name";

import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { UserPlus, Loader2, ShieldCheck } from "@/shared/icons";

interface CloserPlayer {
  name: string;
  player_id: string;
  positions: string[];
  percent_owned: number;
  status: string;
  mlb_id?: number;
  ownership: string;
}

interface SavesLeader {
  name: string;
  saves: string;
}

interface CloserMonitorData {
  my_closers: CloserPlayer[];
  available_closers: CloserPlayer[];
  saves_leaders: SavesLeader[];
  ai_recommendation?: string | null;
}

export function CloserMonitorView({ data, app, navigate }: { data: CloserMonitorData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);
  var [tab, setTab] = useState("my");
  var myClosers = data.my_closers || [];
  var available = data.available_closers || [];
  var leaders = data.saves_leaders || [];

  var handleAdd = async (playerId: string) => {
    var result = await callTool("yahoo_add", { player_id: playerId });
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={myClosers.length} label="Your Closers" color="primary" />
        <KpiTile value={available.length} label="FA Closers" color={available.length > 0 ? "success" : "neutral"} />
      </div>

      <Subheading className="flex items-center gap-2">
        <ShieldCheck size={18} />
        Closer Monitor
      </Subheading>

      <Tabs value={tab} onChange={setTab} aria-label="Closer tabs">
        <Tabs.Tab value="my">{"My Closers (" + myClosers.length + ")"}</Tabs.Tab>
        <Tabs.Tab value="available">{"Available (" + available.length + ")"}</Tabs.Tab>
        <Tabs.Tab value="leaders">Saves Leaders</Tabs.Tab>
      </Tabs>

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {tab === "my" && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Positions</TableHead>
                <TableHead className="text-right">Own%</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myClosers.map((p) => (
                <TableRow key={p.player_id}>
                  <TableCell className="font-medium">
                    <PlayerName name={p.name} playerId={p.player_id} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(p.positions || []).map((pos) => (
                        <Badge key={pos} color="secondary" size="sm">{pos}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{p.percent_owned}%</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {p.status && p.status !== "Healthy" && (
                      <Badge color="danger" size="sm">{p.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {myClosers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No closers/RPs on your roster
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {tab === "available" && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Own%</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {available.map((p) => (
                <TableRow key={p.player_id}>
                  <TableCell className="font-medium">
                    <PlayerName name={p.name} playerId={p.player_id} mlbId={p.mlb_id} app={app} navigate={navigate} context="waivers" />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{p.percent_owned}%</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {p.status && p.status !== "Healthy" && (
                      <Badge color="danger" size="sm">{p.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button color="secondary" size="xs" uniform onClick={() => handleAdd(p.player_id)} disabled={loading} title="Add player">
                      <UserPlus size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {available.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No available closers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {tab === "leaders" && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Saves</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaders.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{p.saves}</TableCell>
                </TableRow>
              ))}
              {leaders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No saves leaders data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
