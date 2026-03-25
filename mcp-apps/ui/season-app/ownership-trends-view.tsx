import { Badge } from "@/components/ui/badge";
import { LineChart as LineChartComponent } from "@/charts";
import { Card, CardContent } from "../components/card";
import { Subheading } from "../components/heading";
import { EmptyState } from "../shared/empty-state";
import { KpiTile } from "../shared/kpi-tile";
import { formatFixed } from "../shared/number-format";

interface TrendEntry {
  date: string;
  pct_owned: number;
}

interface OwnershipTrendsData {
  player_name: string;
  player_id: string;
  trend: TrendEntry[];
  current_pct: number | null;
  direction: string;
  delta_7d: number;
  delta_30d: number;
  message?: string;
}

function directionVariant(direction: string): "default" | "destructive" | "secondary" {
  if (direction === "rising") return "default";
  if (direction === "falling") return "destructive";
  return "secondary";
}

function directionLabel(direction: string): string {
  if (direction === "rising") return "Rising";
  if (direction === "falling") return "Falling";
  if (direction === "stable") return "Stable";
  return direction;
}

export function OwnershipTrendsView({ data }: { data: OwnershipTrendsData; app?: any; navigate?: (data: any) => void }) {
  var trend = data.trend || [];
  var hasTrend = trend.length > 0;

  return (
    <div className="space-y-2">
      <Subheading>{data.player_name} - Ownership Trend</Subheading>

      <div className="flex items-center gap-2">
        <Badge variant={directionVariant(data.direction)}>
          {directionLabel(data.direction)}
        </Badge>
      </div>

      <div className="kpi-grid">
        <KpiTile
          value={data.current_pct != null ? formatFixed(data.current_pct, 1, "0") + "%" : "N/A"}
          label="Current Own%"
          color="primary"
        />
        <KpiTile
          value={(data.delta_7d >= 0 ? "+" : "") + formatFixed(data.delta_7d, 1, "0") + "%"}
          label="7-Day Change"
          color={data.delta_7d > 0 ? "success" : data.delta_7d < 0 ? "risk" : "neutral"}
        />
        <KpiTile
          value={(data.delta_30d >= 0 ? "+" : "") + formatFixed(data.delta_30d, 1, "0") + "%"}
          label="30-Day Change"
          color={data.delta_30d > 0 ? "success" : data.delta_30d < 0 ? "risk" : "neutral"}
        />
      </div>

      {hasTrend && (
        <Card>
          <CardContent className="p-4">
            <LineChartComponent
              data={trend.map(function (t) { return { label: t.date, pct_owned: t.pct_owned }; })}
              series={[{ key: "pct_owned", color: "var(--color-primary, #10b981)" }]}
              yDomain={[0, 100]}
              yLabel="Own%"
              areaFill
            />
          </CardContent>
        </Card>
      )}

      {!hasTrend && (
        <EmptyState title={data.message || "No ownership trend data available"} description="Data accumulates as you use waiver and trending tools." />
      )}
    </div>
  );
}
