import { LineupOptimizeView } from "./lineup-optimize-view";
import { InjuryReportView } from "./injury-report-view";
import { Subheading } from "../catalyst/heading";
import { Text } from "../catalyst/text";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";

interface DailyUpdateData {
  lineup: any;
  injuries: any;
  message: string;
  ai_recommendation?: string | null;
}

function noop() {}

export function DailyUpdateView({ data, app, navigate }: { data: DailyUpdateData; app?: any; navigate?: (data: any) => void }) {
  var lineupIssues = data.lineup ? ((data.lineup.active_off_day || []).length + (data.lineup.bench_playing || []).length) : 0;
  var injuredCount = data.injuries ? (data.injuries.injured_active || []).length : 0;
  var gamesCount = data.lineup ? (data.lineup.bench_playing || []).length : 0;

  return (
    <div className="space-y-2 animate-stagger">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={lineupIssues} label="Lineup Issues" color={lineupIssues > 0 ? "risk" : "success"} />
        <KpiTile value={injuredCount} label="Injured Active" color={injuredCount > 0 ? "risk" : "success"} />
        <KpiTile value={gamesCount} label="Bench Games" color={gamesCount > 0 ? "info" : "neutral"} />
      </div>

      <Subheading>Daily Update</Subheading>
      {data.lineup && <LineupOptimizeView data={data.lineup} app={app || null} navigate={navigate || noop} />}
      {data.injuries && <InjuryReportView data={data.injuries} />}
      <Text>{data.message}</Text>
    </div>
  );
}
