import { useState } from "react";
import { Badge } from "@plexui/ui/components/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Tabs } from "@plexui/ui/components/Tabs";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { Trophy, TrendingUp, Target, Award } from "@/shared/icons";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { formatFixed } from "../shared/number-format";

interface CareerEntry {
  manager: string;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  playoffs: number;
  best_finish: number;
  best_year: number;
}

interface ChampionEntry {
  year: number;
  team_name: string;
  manager: string;
  record: string;
  win_pct: number;
}

interface RecordBookData {
  careers: CareerEntry[];
  champions: ChampionEntry[];
  first_picks: Array<{ year: number; player: string }>;
  playoff_appearances: Array<{ manager: string; appearances: number }>;
}

export function RecordBookView({ data }: { data: RecordBookData }) {
  const [tab, setTab] = useState("champions");

  // Prepare career chart data - top 10 by win%, sorted ascending so highest is at top of horizontal bar
  var careerChartData = (data.careers || [])
    .slice(0, 10)
    .map(function (c) {
      return {
        manager: c.manager,
        win_pct: c.win_pct,
        seasons: c.seasons,
      };
    })
    .sort(function (a, b) { return a.win_pct - b.win_pct; });

  // Prepare champion win% chart data - sorted by year ascending
  var champChartData = (data.champions || [])
    .slice()
    .sort(function (a, b) { return a.year - b.year; })
    .map(function (c) {
      return {
        year: c.year,
        win_pct: c.win_pct,
        manager: c.manager,
        team_name: c.team_name,
        record: c.record,
      };
    });

  // Prepare playoff chart data - sorted ascending so highest at top
  var playoffChartData = (data.playoff_appearances || [])
    .slice()
    .sort(function (a, b) { return a.appearances - b.appearances; });

  return (
    <div className="space-y-4">
      <Tabs value={tab} onChange={setTab} aria-label="Record book sections">
        <Tabs.Tab value="champions">Champions</Tabs.Tab>
        <Tabs.Tab value="careers">Career Leaders</Tabs.Tab>
        <Tabs.Tab value="first_picks">First Picks</Tabs.Tab>
        <Tabs.Tab value="playoffs">Playoffs</Tabs.Tab>
      </Tabs>

        {tab === "champions" && (<div>
          {champChartData.length > 1 && (
            <div className="surface-card p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <Subheading>Champion Win % by Year</Subheading>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={champChartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={function (v: number) { return v + "%"; }}
                    />
                    <Tooltip
                      formatter={function (value: number) {
                        return [value + "%", "Win %"];
                      }}
                      labelFormatter={function (label: number) { return String(label); }}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="win_pct" radius={[4, 4, 0, 0]} maxBarSize={28} fill="var(--sem-warning)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {(data.champions || []).map(function (c) {
              return (
                <div key={c.year} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border-2 border-amber-500 font-bold text-sm shrink-0">
                      {c.year}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Trophy size={14} className="text-amber-500 shrink-0" />
                        <span className="font-bold text-sm truncate">{c.team_name}</span>
                      </div>
                      <Text className="mt-0.5">{c.manager}</Text>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-mono font-bold text-sm">{c.record}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>)}

        {tab === "careers" && (<div>
          {careerChartData.length > 1 && (
            <div className="surface-card p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <Subheading>Career Win %</Subheading>
              </div>
              <div style={{ height: Math.max(careerChartData.length * 28, 120) + "px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={careerChartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 5 }}>
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={function (v: number) { return v + "%"; }}
                    />
                    <YAxis
                      type="category"
                      dataKey="manager"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      formatter={function (value: number, name: string, props: any) {
                        return [value + "% (" + props.payload.seasons + " seasons)", "Win %"];
                      }}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="win_pct" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {careerChartData.map(function (entry) {
                        var color = "var(--sem-neutral)";
                        if (entry.win_pct >= 60) {
                          color = "var(--sem-success)";
                        } else if (entry.win_pct >= 50) {
                          color = "var(--sem-info)";
                        } else if (entry.win_pct < 40) {
                          color = "var(--sem-risk)";
                        }
                        return <Cell key={entry.manager} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="surface-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Manager</TableHead>
                  <TableHead className="text-center font-bold">Seasons</TableHead>
                  <TableHead className="text-center font-bold">W</TableHead>
                  <TableHead className="text-center font-bold">L</TableHead>
                  <TableHead className="hidden sm:table-cell text-center font-bold">T</TableHead>
                  <TableHead className="text-right font-bold">Win%</TableHead>
                  <TableHead className="hidden sm:table-cell text-center font-bold">Playoffs</TableHead>
                  <TableHead className="hidden sm:table-cell text-center font-bold">Best</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.careers || []).map(function (c) {
                  return (
                    <TableRow key={c.manager}>
                      <TableCell className="font-semibold">{c.manager}</TableCell>
                      <TableCell className="text-center font-mono">{c.seasons}</TableCell>
                      <TableCell className="text-center font-mono">{c.wins}</TableCell>
                      <TableCell className="text-center font-mono">{c.losses}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center font-mono">{c.ties}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatFixed(c.win_pct, 1, "0.0")}%</TableCell>
                      <TableCell className="hidden sm:table-cell text-center font-mono">{c.playoffs}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center">
                        <Badge color="secondary" size="sm" className="font-bold">{"#" + c.best_finish + " (" + c.best_year + ")"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>)}

        {tab === "first_picks" && (<div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(data.first_picks || []).map(function (fp) {
              return (
                <div key={fp.year} className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground font-bold">{fp.year}</p>
                  <p className="font-semibold">{fp.player}</p>
                </div>
              );
            })}
          </div>
        </div>)}

        {tab === "playoffs" && (<div>
          {playoffChartData.length > 1 && (
            <div className="surface-card p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-4 w-4 text-muted-foreground" />
                <Subheading>Playoff Appearances</Subheading>
              </div>
              <div style={{ height: Math.max(playoffChartData.length * 28, 120) + "px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={playoffChartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 5 }}>
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="manager"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      formatter={function (value: number) {
                        return [value, "Appearances"];
                      }}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="appearances" radius={[0, 4, 4, 0]} maxBarSize={20} fill="var(--sem-info)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="surface-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Manager</TableHead>
                  <TableHead className="text-right font-bold">Appearances</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.playoff_appearances || []).map(function (pa) {
                  return (
                    <TableRow key={pa.manager}>
                      <TableCell className="font-semibold">{pa.manager}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{pa.appearances}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>)}
    </div>
  );
}
