import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadarChart as RadarChartComponent, BarChart as BarChartComponent } from "@/charts";
import { Card, CardContent } from "../components/card";
import { Subheading } from "../components/heading";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";

interface CategoryRank {
  category?: string;
  name?: string;
  value: string;
  rank: number;
  total: number;
  strength: string;
}

interface CategoryCheckData {
  week: number;
  categories: CategoryRank[];
  strongest: string[];
  weakest: string[];
  ai_recommendation?: string | null;
}

function getCatName(c: CategoryRank): string {
  return c.name || c.category || "?";
}

export function CategoryCheckView({ data }: { data: CategoryCheckData }) {
  const [chartMode, setChartMode] = useState("radar");
  const [catFilter, setCatFilter] = useState("all");

  const batting = (data.categories || []).slice(0, 10);
  const pitching = (data.categories || []).slice(10, 20);
  const filtered = catFilter === "batting" ? batting : catFilter === "pitching" ? pitching : data.categories || [];

  const chartData = filtered.map((c) => ({
    category: getCatName(c),
    rank: c.total - c.rank + 1,
    fullMark: c.total,
    strength: c.strength,
  }));

  const barData = filtered.map((c) => ({
    category: getCatName(c),
    value: c.total - c.rank + 1,
    total: c.total,
    strength: c.strength,
  }));

  // Median line position: rank 6 in a 12-team league = inverted value of 7
  const medianValue = filtered.length > 0 ? Math.ceil(filtered[0].total / 2) : 6;

  const strengthColor = (s: string) => {
    if (s === "strong") return "text-sem-success";
    if (s === "weak") return "text-red-600 dark:text-red-400";
    return "";
  };

  const barFill = (strength: string) => {
    if (strength === "strong") return "#22c55e";
    if (strength === "weak") return "#ef4444";
    return "#64748b";
  };

  const rankBg = (rank: number, total: number) => {
    const pct = rank / total;
    if (pct <= 0.25) return "bg-green-500/15";
    if (pct <= 0.5) return "bg-sem-success-subtle";
    if (pct >= 0.75) return "bg-red-500/15";
    if (pct > 0.5) return "bg-sem-risk-subtle";
    return "";
  };

  var strongCount = (data.strongest || []).length;
  var weakCount = (data.weakest || []).length;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={strongCount} label="Strong" color="success" />
        <KpiTile value={weakCount} label="Weak" color="risk" />
        <KpiTile value={(data.categories || []).length} label="Categories" color="neutral" />
      </div>

      <Subheading>Category Check - Week {data.week}</Subheading>

      {/* Strongest / Weakest summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(data.strongest || []).length > 0 && (
          <Card className="border-green-500/30 border-t-2 border-t-green-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1.5">Strongest</p>
              <div className="flex flex-wrap gap-1">
                {(data.strongest || []).map((s) => (
                  <Badge key={s} className="bg-sem-success">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {(data.weakest || []).length > 0 && (
          <Card className="border-red-500/30 border-t-2 border-t-red-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1.5">Weakest</p>
              <div className="flex flex-wrap gap-1">
                {(data.weakest || []).map((s) => (
                  <Badge key={s} variant="destructive">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Batting / Pitching filter */}
      <Tabs value={catFilter} onValueChange={setCatFilter} aria-label="Category filter">
        <TabsList>
          <TabsTrigger value="all">{"All (" + (data.categories || []).length + ")"}</TabsTrigger>
          <TabsTrigger value="batting">{"Batting (" + batting.length + ")"}</TabsTrigger>
          <TabsTrigger value="pitching">{"Pitching (" + pitching.length + ")"}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Chart Tabs */}
      {chartData.length > 0 && (
        <>
          <Tabs value={chartMode} onValueChange={setChartMode} aria-label="Chart mode">
            <TabsList>
              <TabsTrigger value="radar">Radar</TabsTrigger>
              <TabsTrigger value="bars">Bars</TabsTrigger>
            </TabsList>
          </Tabs>
          {chartMode === "radar" && (
            <RadarChartComponent
              data={chartData.map(function (d) { return { label: d.category, value: d.rank, maxValue: d.fullMark }; })}
              size={260}
            />
          )}
          {chartMode === "bars" && (
            <BarChartComponent
              data={barData.map(function (d) { return { label: d.category, value: d.value, color: barFill(d.strength) }; })}
              horizontal
              referenceLine={{ value: medianValue, label: "Median", color: "#94a3b8" }}
              labelWidth={40}
            />
          )}
        </>
      )}

      {/* Category Table */}
      <div className="w-full overflow-x-auto mcp-app-scroll-x">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-center">Rank</TableHead>
            <TableHead className="w-24">Rank Bar</TableHead>
            <TableHead className="hidden sm:table-cell w-20">Strength</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c, i) => (
            <TableRow key={i + "-" + getCatName(c)} className={rankBg(c.rank, c.total)}>
              <TableCell className={"font-medium " + strengthColor(c.strength)}>{getCatName(c)}</TableCell>
              <TableCell className="text-right font-mono">{c.value}</TableCell>
              <TableCell className="text-center">
                <span className="font-mono">{c.rank}</span>
                <span className="text-muted-foreground text-xs">/{c.total}</span>
              </TableCell>
              <TableCell>
                <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted">
                  <div
                    className={"h-full rounded-full " + (c.strength === "strong" ? "bg-green-500" : c.strength === "weak" ? "bg-red-500" : "bg-slate-400")}
                    style={{ width: ((c.total - c.rank + 1) / c.total * 100) + "%" }}
                  />
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {c.strength === "strong" && <Badge className="bg-green-600">Strong</Badge>}
                {c.strength === "weak" && <Badge variant="destructive">Weak</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
