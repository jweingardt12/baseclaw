import { useState } from "react";
import { Badge } from "../catalyst/badge";
import { Card, CardContent } from "../catalyst/card";
import { Subheading } from "../catalyst/heading";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../catalyst/tabs";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine } from "recharts";

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
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Strongest</p>
              <div className="flex flex-wrap gap-1">
                {(data.strongest || []).map((s) => (
                  <Badge key={s} className="bg-sem-success text-xs">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {(data.weakest || []).length > 0 && (
          <Card className="border-red-500/30 border-t-2 border-t-red-500">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Weakest</p>
              <div className="flex flex-wrap gap-1">
                {(data.weakest || []).map((s) => (
                  <Badge key={s} color="red" className="text-xs">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Batting / Pitching filter */}
      <Tabs value={catFilter} onValueChange={setCatFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({(data.categories || []).length})</TabsTrigger>
          <TabsTrigger value="batting">Batting ({batting.length})</TabsTrigger>
          <TabsTrigger value="pitching">Pitching ({pitching.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Chart Tabs */}
      {chartData.length > 0 && (
        <Tabs value={chartMode} onValueChange={setChartMode}>
          <TabsList>
            <TabsTrigger value="radar">Radar</TabsTrigger>
            <TabsTrigger value="bars">Bars</TabsTrigger>
          </TabsList>
          <TabsContent value="radar">
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, "dataMax"]} />
                  <Radar dataKey="rank" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          <TabsContent value="bars">
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 40, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis type="number" domain={[0, "dataMax"]} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={40} />
                  <ReferenceLine x={medianValue} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "Median", fontSize: 9, fill: "#94a3b8" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {barData.map((entry) => (
                      <Cell key={entry.category} fill={barFill(entry.strength)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Category Table */}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Category</TableHeader>
            <TableHeader className="text-right">Value</TableHeader>
            <TableHeader className="text-center">Rank</TableHeader>
            <TableHeader className="w-24">Rank Bar</TableHeader>
            <TableHeader className="hidden sm:table-cell w-20">Strength</TableHeader>
          </TableRow>
        </TableHead>
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
                {c.strength === "strong" && <Badge className="text-xs bg-green-600">Strong</Badge>}
                {c.strength === "weak" && <Badge color="red" className="text-xs">Weak</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
