import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { Trophy, TrendingUp, Target, Award } from "@/shared/icons";

import { BarChart } from "@/charts";

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
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="champions">Champions</TabsTrigger>
          <TabsTrigger value="careers">Career Leaders</TabsTrigger>
          <TabsTrigger value="first_picks">First Picks</TabsTrigger>
          <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
        </TabsList>
      </Tabs>

        {tab === "champions" && (<div>
          {champChartData.length > 1 && (
            <div className="surface-card p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <Subheading>Champion Win % by Year</Subheading>
              </div>
              <BarChart
                data={champChartData.map(function (c) {
                  return { label: String(c.year), value: c.win_pct, color: "var(--sem-warning)" };
                })}
                maxValue={100}
                height={160}
              />
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
              <BarChart
                data={careerChartData.map(function (entry) {
                  var color = "var(--sem-neutral)";
                  if (entry.win_pct >= 60) {
                    color = "var(--sem-success)";
                  } else if (entry.win_pct >= 50) {
                    color = "var(--sem-info)";
                  } else if (entry.win_pct < 40) {
                    color = "var(--sem-risk)";
                  }
                  return { label: entry.manager, value: entry.win_pct, color: color };
                })}
                horizontal
                maxValue={100}
                labelWidth={80}
              />
            </div>
          )}
          <div className="surface-card overflow-hidden">
            <div className="w-full overflow-x-auto mcp-app-scroll-x">
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
                        <Badge variant="secondary" className="font-bold">{"#" + c.best_finish + " (" + c.best_year + ")"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
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
              <BarChart
                data={playoffChartData.map(function (pa) {
                  return { label: pa.manager, value: pa.appearances, color: "var(--sem-info)" };
                })}
                horizontal
                labelWidth={80}
              />
            </div>
          )}
          <div className="surface-card overflow-hidden">
            <div className="w-full overflow-x-auto mcp-app-scroll-x">
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
          </div>
        </div>)}
    </div>
  );
}
