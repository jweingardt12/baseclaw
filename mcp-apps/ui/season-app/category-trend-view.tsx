import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart as LineChartComponent } from "@/charts";
import { Card, CardContent } from "../components/card";
import { Subheading } from "../components/heading";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";

interface CategoryHistoryEntry {
  week: number;
  value: number;
  rank: number;
}

interface CategoryTrend {
  name: string;
  history: CategoryHistoryEntry[];
  current_rank: number;
  best_rank: number;
  worst_rank: number;
  trend: string;
}

interface CategoryTrendData {
  categories: CategoryTrend[];
  message?: string;
  ai_recommendation?: string | null;
}

// Batting categories in warm tones
var BATTING_CATS = ["R", "H", "HR", "RBI", "K_negative", "TB", "AVG", "OBP", "XBH", "NSB"];
// Pitching categories in cool tones
var PITCHING_CATS = ["IP", "W", "L_negative", "ER_negative", "K", "HLD", "ERA", "WHIP", "QS", "NSV"];

var CATEGORY_COLORS: Record<string, string> = {
  // Batting - warm tones
  HR: "#ef4444",
  RBI: "#f97316",
  R: "#eab308",
  H: "#f59e0b",
  AVG: "#84cc16",
  OBP: "#22c55e",
  TB: "#14b8a6",
  XBH: "#06b6d4",
  NSB: "#3b82f6",
  K_negative: "#a855f7",
  // Pitching - cool tones
  ERA: "#6366f1",
  WHIP: "#8b5cf6",
  K: "#ec4899",
  W: "#f43f5e",
  QS: "#10b981",
  NSV: "#0ea5e9",
  HLD: "#64748b",
  IP: "#78716c",
  L_negative: "#9ca3af",
  ER_negative: "#d946ef",
};

function isBattingCat(name: string): boolean {
  return BATTING_CATS.indexOf(name) !== -1;
}

function isPitchingCat(name: string): boolean {
  return PITCHING_CATS.indexOf(name) !== -1;
}

function getColor(name: string): string {
  return CATEGORY_COLORS[name] || "#64748b";
}

function trendBadge(trend: string) {
  if (trend === "improving") return <Badge className="bg-green-600">Improving</Badge>;
  if (trend === "declining") return <Badge variant="destructive">Declining</Badge>;
  return <Badge variant="secondary">Stable</Badge>;
}

export function CategoryTrendView({ data }: { data: CategoryTrendData }) {
  var [catFilter, setCatFilter] = useState("all");

  var categories = data.categories || [];

  if (categories.length === 0) {
    return (
      <div className="space-y-2">
        <AiInsight recommendation={data.ai_recommendation} />
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            {data.message || "No category history recorded yet. Run category-check during the season to build history."}
          </CardContent>
        </Card>
      </div>
    );
  }

  var batting = categories.filter(function (c) { return isBattingCat(c.name); });
  var pitching = categories.filter(function (c) { return isPitchingCat(c.name); });
  var filtered = catFilter === "batting" ? batting : catFilter === "pitching" ? pitching : categories;

  var improving = categories.filter(function (c) { return c.trend === "improving"; });
  var declining = categories.filter(function (c) { return c.trend === "declining"; });
  var stable = categories.filter(function (c) { return c.trend === "stable"; });

  // Build chart data: each point is a week with all category ranks
  var weekSet: Record<number, Record<string, number>> = {};
  for (var ci = 0; ci < filtered.length; ci++) {
    var cat = filtered[ci];
    var history = cat.history || [];
    for (var hi = 0; hi < history.length; hi++) {
      var entry = history[hi];
      if (!weekSet[entry.week]) {
        weekSet[entry.week] = {};
      }
      weekSet[entry.week][cat.name] = entry.rank;
    }
  }

  var weeks = Object.keys(weekSet).map(function (w) { return Number(w); });
  weeks.sort(function (a, b) { return a - b; });

  var chartData = weeks.map(function (week) {
    var point: Record<string, any> = { week: "Wk " + week };
    for (var fi = 0; fi < filtered.length; fi++) {
      var ranks = weekSet[week];
      if (ranks && ranks[filtered[fi].name] !== undefined) {
        point[filtered[fi].name] = ranks[filtered[fi].name];
      }
    }
    return point;
  });

  // Find max rank for YAxis domain (usually 12 for 12-team league)
  var maxRank = 12;
  for (var wi = 0; wi < weeks.length; wi++) {
    var ranks = weekSet[weeks[wi]];
    var vals = Object.values(ranks);
    for (var vi = 0; vi < vals.length; vi++) {
      if (vals[vi] > maxRank) maxRank = vals[vi];
    }
  }

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={improving.length} label="Improving" color="success" />
        <KpiTile value={declining.length} label="Declining" color="risk" />
        <KpiTile value={stable.length} label="Stable" color="neutral" />
      </div>

      <Subheading>Category Rank Trends</Subheading>

      {/* Improving / Declining summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {improving.length > 0 && (
          <Card className="border-green-500/30 border-t-2 border-t-green-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1.5">Improving</p>
              <div className="flex flex-wrap gap-1">
                {improving.map(function (c) {
                  return <Badge key={c.name} className="bg-sem-success">{c.name}</Badge>;
                })}
              </div>
            </CardContent>
          </Card>
        )}
        {declining.length > 0 && (
          <Card className="border-red-500/30 border-t-2 border-t-red-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1.5">Declining</p>
              <div className="flex flex-wrap gap-1">
                {declining.map(function (c) {
                  return <Badge key={c.name} variant="destructive">{c.name}</Badge>;
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Batting / Pitching filter */}
      <Tabs value={catFilter} onValueChange={setCatFilter}>
        <TabsList>
          <TabsTrigger value="all">{"All (" + categories.length + ")"}</TabsTrigger>
          <TabsTrigger value="batting">{"Batting (" + batting.length + ")"}</TabsTrigger>
          <TabsTrigger value="pitching">{"Pitching (" + pitching.length + ")"}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Line Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <LineChartComponent
              data={chartData.map(function (d) { var out: Record<string, any> = { label: d.week }; for (var k in d) { if (k !== "week") out[k] = d[k]; } return out; })}
              series={filtered.map(function (cat) { return { key: cat.name, color: getColor(cat.name) }; })}
              reversed
              yDomain={[1, maxRank]}
              yLabel="Rank"
              connectNulls
              height={320}
            />
          </CardContent>
        </Card>
      )}

      {/* Single data point message */}
      {chartData.length === 1 && (
        <Card>
          <CardContent className="p-3 text-center text-sm text-muted-foreground">
            Only one week of data recorded. Trends will appear after multiple weeks.
          </CardContent>
        </Card>
      )}

      {/* Category detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map(function (cat) {
          return (
            <Card key={cat.name}>
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getColor(cat.name) }}
                    />
                    <span className="font-medium text-sm">{cat.name}</span>
                  </div>
                  {trendBadge(cat.trend)}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>Current: <span className="font-mono font-semibold text-foreground">#{cat.current_rank}</span></span>
                  <span>Best: <span className="font-mono font-semibold text-green-600">#{cat.best_rank}</span></span>
                  <span>Worst: <span className="font-mono font-semibold text-red-500">#{cat.worst_rank}</span></span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
