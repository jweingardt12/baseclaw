import { Badge } from "@plexui/ui/components/Badge";
import { Card, CardContent } from "../components/card";
import { Subheading } from "../components/heading";
import { EmptyState } from "../shared/empty-state";
import { KpiTile } from "../shared/kpi-tile";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

function directionColor(direction: string): "success" | "danger" | "warning" | "secondary" {
  if (direction === "rising") return "success";
  if (direction === "falling") return "danger";
  if (direction === "stable") return "warning";
  return "secondary";
}

function directionLabel(direction: string): string {
  if (direction === "rising") return "Rising";
  if (direction === "falling") return "Falling";
  if (direction === "stable") return "Stable";
  return direction;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-background p-2 shadow-md text-xs">
      <p className="font-semibold mb-0.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Owned</span>
        <span className="font-mono font-semibold">{formatFixed(payload[0].value, 1, "0")}%</span>
      </div>
    </div>
  );
}

export function OwnershipTrendsView({ data }: { data: OwnershipTrendsData; app?: any; navigate?: (data: any) => void }) {
  var trend = data.trend || [];
  var hasTrend = trend.length > 0;

  return (
    <div className="space-y-2">
      <Subheading>{data.player_name} - Ownership Trend</Subheading>

      <div className="flex items-center gap-2">
        <Badge color={directionColor(data.direction)} size="sm">
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
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    stroke="var(--color-muted-foreground)"
                    label={{ value: "Own%", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "var(--color-muted-foreground)" } }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="pct_owned"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasTrend && (
        <EmptyState title={data.message || "No ownership trend data available"} description="Data accumulates as you use waiver and trending tools." />
      )}
    </div>
  );
}
