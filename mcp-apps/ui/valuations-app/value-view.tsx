import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/charts";
import { BarChart3 } from "@/shared/icons";
import { ZScoreExplainer, tierTextColor, tierColor } from "../shared/z-score";
import { IntelBadge } from "../shared/intel-badge";
import { IntelPanel } from "../shared/intel-panel";
import { PlayerName } from "../shared/player-name";
import { VerdictBadge } from "../shared/verdict-badge";
import { formatFixed, toFiniteNumber } from "../shared/number-format";

interface ValueCategory {
  category: string;
  z_score: number;
  raw_stat: number | null;
}

interface ValueData {
  name: string;
  mlb_id?: number;
  team?: string;
  pos?: string;
  player_type?: string;
  z_final: number;
  categories: ValueCategory[];
  intel?: any;
  ai_recommendation?: string | null;
}

function formatRawStat(val: number | null): string {
  if (val == null) return "-";
  if (val >= 0 && val < 1 && val !== 0) return formatFixed(val, 3, "0.000").replace(/^0/, "");
  return String(val);
}

function zVariant(z: number): "success" | "info" | "warning" | "risk" {
  if (z >= 2.0) return "success";
  if (z >= 1.0) return "info";
  if (z >= 0) return "warning";
  return "risk";
}

function zGrade(z: number): string {
  if (z >= 2.0) return "ELITE";
  if (z >= 1.0) return "GOOD";
  if (z >= 0) return "FAIR";
  return "POOR";
}

export function ValueView({ data, app, navigate }: { data: ValueData; app?: any; navigate?: (data: any) => void }) {
  var chartData = (data.categories || []).map(function (c) {
    return { name: c.category, z_score: c.z_score };
  });

  var details: string[] = [];
  if (data.team) details.push(data.team);
  if (data.pos) details.push(data.pos);

  return (
    <div className="space-y-2">
      {/* Hero card with big z-score */}
      <Card className="border-primary/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <BarChart3 size={20} />
            <div className="flex-1 min-w-0">
              <p className="text-2xl-app font-bold truncate">
                <PlayerName name={data.name} mlbId={data.mlb_id} app={app} navigate={navigate} context="default" />
              </p>
              <div className="flex items-center gap-2 mt-1">
                {details.length > 0 && (
                  <Badge variant="secondary">{details.join(" - ")}</Badge>
                )}
                {data.intel && <IntelBadge intel={data.intel} size="md" />}
              </div>
            </div>
            <div className="text-center shrink-0">
              <div className="text-hero font-mono">{data.z_final >= 0 ? "+" : ""}{formatFixed(toFiniteNumber(data.z_final, 0), 2, "0.00")}</div>
              <VerdictBadge grade={zGrade(data.z_final)} variant={zVariant(data.z_final)} size="sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <ZScoreExplainer />
      {data.intel && <IntelPanel intel={data.intel} />}

      {chartData.length > 0 && (
        <BarChart
          data={chartData.map(function (entry) {
            return {
              label: entry.name,
              value: entry.z_score,
              color: entry.z_score >= 0 ? "var(--color-primary)" : "var(--color-destructive)",
            };
          })}
          height={256}
          rotateLabels={true}
        />
      )}

      <div className="space-y-1.5">
        {(data.categories || []).map(function (c) {
          var pct = Math.max(0, Math.min(100, ((c.z_score + 2) / 6) * 100));
          var barColor = tierColor(c.z_score);
          return (
            <div key={c.category} className="surface-card p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{c.category}</span>
                  {c.raw_stat != null && (
                    <span className="font-mono text-xs text-muted-foreground">{formatRawStat(c.raw_stat)}</span>
                  )}
                </div>
                <span className={"font-mono text-sm font-bold " + tierTextColor(c.z_score)}>
                  {c.z_score >= 0 ? "+" : ""}{formatFixed(toFiniteNumber(c.z_score, 0), 2, "0.00")}
                </span>
              </div>
              <div className="h-3 rounded-sm overflow-hidden bg-muted">
                <div className={"h-full rounded-sm transition-all animate-bar-fill " + barColor} style={{ width: pct + "%" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
