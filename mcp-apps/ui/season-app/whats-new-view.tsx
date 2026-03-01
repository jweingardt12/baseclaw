import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { useCallTool } from "../shared/use-call-tool";
import { RefreshButton } from "../shared/refresh-button";
import { PlayerName } from "../shared/player-name";
import { TrendIndicator } from "../shared/trend-indicator";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { AlertTriangle, ArrowRightLeft, Activity, TrendingUp, Star, UserPlus, Loader2 } from "@/shared/icons";
import { TeamLogo } from "../shared/team-logo";

interface WhatsNewInjury {
  name: string;
  status: string;
  position: string;
  section: string;
}

interface WhatsNewActivity {
  type: string;
  player: string;
  team: string;
}

interface WhatsNewTrending {
  name: string;
  direction: string;
  delta: string;
  percent_owned: number;
}

interface WhatsNewProspect {
  player: string;
  type: string;
  team: string;
  description: string;
}

interface TradeProposal {
  transaction_key: string;
  trader_team_name: string;
  tradee_team_name: string;
}

interface WhatsNewData {
  last_check: string;
  check_time: string;
  injuries: WhatsNewInjury[];
  pending_trades: TradeProposal[];
  league_activity: WhatsNewActivity[];
  trending: WhatsNewTrending[];
  prospects: WhatsNewProspect[];
  ai_recommendation?: string | null;
}

export function WhatsNewView({ data, app, navigate }: { data: WhatsNewData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);

  var handleViewTrades = async () => {
    var result = await callTool("yahoo_pending_trades", {});
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  var handleAdd = async (playerName: string) => {
    // Search for the player first, since we only have name
    app.sendMessage("Add " + playerName + " to my roster");
  };

  var totalItems = (data.injuries || []).length + (data.pending_trades || []).length + (data.league_activity || []).length + (data.trending || []).length + (data.prospects || []).length;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={(data.injuries || []).length} label="Injuries" color={(data.injuries || []).length > 0 ? "risk" : "success"} />
        <KpiTile value={(data.pending_trades || []).length} label="Trades" color={(data.pending_trades || []).length > 0 ? "warning" : "neutral"} />
        <KpiTile value={(data.trending || []).length} label="Trending" color="info" />
        <KpiTile value={(data.prospects || []).length} label="Prospects" color="primary" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">What's New</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{data.check_time || data.last_check}</span>
          <RefreshButton app={app} toolName="yahoo_whats_new" navigate={navigate} />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Injuries Card */}
      {data.injuries?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="text-destructive" />
              Injuries
              <Badge variant="destructive" className="text-xs">{data.injuries.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Section</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.injuries || []).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <PlayerName name={p.name} app={app} navigate={navigate} context="roster" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{p.position}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">{p.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{p.section}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pending Trades Card */}
      {data.pending_trades?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRightLeft size={14} />
              Pending Trades
              <Badge variant="secondary" className="text-xs">{data.pending_trades.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              {data.pending_trades.length + " trade proposal" + (data.pending_trades.length > 1 ? "s" : "") + " pending"}
            </p>
            <Button size="sm" variant="outline" onClick={handleViewTrades} disabled={loading}>
              Review Trades
            </Button>
          </CardContent>
        </Card>
      )}

      {/* League Activity Card */}
      {data.league_activity?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity size={14} />
              League Activity
              <Badge variant="secondary" className="text-xs">{data.league_activity.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Type</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.league_activity.slice(0, 10).map((a, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant={a.type === "add" ? "default" : "secondary"} className="text-xs">{a.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <PlayerName name={a.player} app={app} navigate={navigate} context="waivers" />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.team}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Trending Card */}
      {data.trending?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp size={14} />
              Trending Pickups
              <Badge variant="secondary" className="text-xs">{data.trending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Own%</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.trending.slice(0, 10).map((t, i) => (
                  <TableRow key={i} className={i < 3 ? "bg-sem-success-subtle" : ""}>
                    <TableCell className="font-medium">
                      <PlayerName name={t.name} app={app} navigate={navigate} context="waivers" />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{t.percent_owned}%</TableCell>
                    <TableCell className="text-right">
                      <TrendIndicator trend={{ direction: t.direction || "added", delta: t.delta }} />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleAdd(t.name)} disabled={loading} title="Add player">
                        <UserPlus size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Prospects Card */}
      {data.prospects?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star size={14} />
              Prospect Call-Ups
              <Badge variant="secondary" className="text-xs">{data.prospects.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Team</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.prospects || []).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <PlayerName name={p.player} app={app} navigate={navigate} context="waivers" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{p.type}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TeamLogo abbrev={p.team} />
                        {p.team}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state if nothing new */}
      {!(data.injuries?.length || data.pending_trades?.length || data.league_activity?.length
        || data.trending?.length || data.prospects?.length) && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">Nothing new to report</p>
          <p className="text-xs text-muted-foreground mt-1">Check back later for updates</p>
        </div>
      )}
    </div>
  );
}
