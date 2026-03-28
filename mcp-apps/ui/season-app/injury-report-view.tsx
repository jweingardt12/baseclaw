import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { useCallTool } from "../shared/use-call-tool";

import { IntelBadge } from "../shared/intel-badge";
import { PlayerName } from "../shared/player-name";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { Search, Loader2, CheckCircle } from "@/shared/icons";

interface InjuredPlayer {
  name: string;
  position: string;
  status: string;
  description?: string;
  location: string;
  mlb_id?: number;
  intel?: any;
}

interface InjuryReportData {
  injured_active: InjuredPlayer[];
  healthy_il: InjuredPlayer[];
  injured_bench: InjuredPlayer[];
  il_proper: InjuredPlayer[];
  ai_recommendation?: string | null;
}

function PlayerRow({ player, showFind, onFind, readyToActivate, loading, app, navigate }: { player: InjuredPlayer; showFind?: boolean; onFind?: () => void; readyToActivate?: boolean; loading?: boolean; app?: any; navigate?: (data: any) => void }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b last:border-0">
      <Badge variant="secondary" className="w-8 justify-center">{player.position}</Badge>
      <span className="font-medium text-sm flex-1"><PlayerName name={player.name} mlbId={player.mlb_id} app={app} navigate={navigate} context="roster" /></span>
      {player.intel && <IntelBadge intel={player.intel} size="sm" />}
      <Badge variant="destructive">{player.status}</Badge>
      {player.description && <span className="text-xs text-muted-foreground hidden sm:inline">{player.description}</span>}
      {readyToActivate && (
        <Badge className="bg-sem-success gap-1">
          <CheckCircle className="h-3 w-3" />
          Ready to Activate
        </Badge>
      )}
      {showFind && onFind && (
        <Button variant="outline" size="sm" onClick={onFind} disabled={loading}>
          <Search className="h-3.5 w-3.5" />
          Find FA
        </Button>
      )}
    </div>
  );
}

export function InjuryReportView({ data, app, navigate }: { data: InjuryReportData; app?: any; navigate?: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);
  var hasAnyIssues = (data.injured_active || []).length > 0 || (data.healthy_il || []).length > 0;

  var handleFindReplacement = async (player: InjuredPlayer) => {
    // Determine position type: if position contains SP/RP or is a pitcher position, search pitchers
    var pitcherPositions = ["SP", "RP", "P"];
    var isPitcher = pitcherPositions.some((pp) => player.position.includes(pp));
    var posType = isPitcher ? "P" : "B";
    var result = await callTool("yahoo_waiver_analyze", { pos_type: posType, count: 10 });
    if (result && result.structuredContent && navigate) {
      navigate(result.structuredContent);
    }
  };

  var activeCount = (data.injured_active || []).length;
  var healthyIlCount = (data.healthy_il || []).length;
  var benchCount = (data.injured_bench || []).length;
  var totalInjured = activeCount + healthyIlCount + benchCount;
  var ilCount = (data.il_proper || []).length;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={activeCount} label="Active Injured" color={activeCount > 0 ? "risk" : "success"} />
        <KpiTile value={healthyIlCount} label="Healthy IL" color={healthyIlCount > 0 ? "warning" : "neutral"} />
        <KpiTile value={benchCount} label="Bench Injured" color={benchCount > 0 ? "info" : "neutral"} />
      </div>

      <Subheading>Injury Report</Subheading>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding replacements...
        </div>
      )}

      {(data.injured_active || []).length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-destructive">Injured in Active Lineup</CardTitle>
              <Badge variant="destructive">{(data.injured_active || []).length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(data.injured_active || []).map((p) => (
              <PlayerRow key={p.name} player={p} showFind={!!app} onFind={() => handleFindReplacement(p)} loading={loading} app={app} navigate={navigate} />
            ))}
          </CardContent>
        </Card>
      )}

      {(data.healthy_il || []).length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-sem-warning">On IL - May Be Activatable</CardTitle>
              <Badge variant="secondary">{(data.healthy_il || []).length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(data.healthy_il || []).map((p) => <PlayerRow key={p.name} player={p} readyToActivate app={app} navigate={navigate} />)}
          </CardContent>
        </Card>
      )}

      {(data.injured_bench || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Injured on Bench</CardTitle>
              <Badge variant="secondary">{(data.injured_bench || []).length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(data.injured_bench || []).map((p) => <PlayerRow key={p.name} player={p} app={app} navigate={navigate} />)}
          </CardContent>
        </Card>
      )}

      {(data.il_proper || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">On IL (Proper)</CardTitle>
              <Badge variant="secondary">{(data.il_proper || []).length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(data.il_proper || []).map((p) => <PlayerRow key={p.name} player={p} app={app} navigate={navigate} />)}
          </CardContent>
        </Card>
      )}

      {!hasAnyIssues && (
        <Card>
          <CardContent className="p-4">
            <Text>No injury issues found. Roster is healthy!</Text>
          </CardContent>
        </Card>
      )}

      {(data.injured_active || []).length > 0 && (
        <Button variant="secondary" size="sm" onClick={async function () {
          var result = await callTool("yahoo_waiver_recommendations", { count: 10 });
          if (result && navigate) navigate(result.structuredContent);
        }} disabled={loading}>
          Find Replacements
        </Button>
      )}
    </div>
  );
}
