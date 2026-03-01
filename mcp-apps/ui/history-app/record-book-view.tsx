import { useState } from "react";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Trophy, TrendingUp, Target, Award } from "@/shared/icons";

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

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList behavior="wrap">
          <TabsTrigger value="champions">
            <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" />Champions</span>
          </TabsTrigger>
          <TabsTrigger value="careers">
            <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />Career Leaders</span>
          </TabsTrigger>
          <TabsTrigger value="first_picks">
            <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />First Picks</span>
          </TabsTrigger>
          <TabsTrigger value="playoffs">
            <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" />Playoffs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="champions">
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
                      <p className="text-xs text-muted-foreground mt-0.5">{c.manager}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-mono font-bold text-sm">{c.record}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="careers">
          <div className="rounded-md border bg-card overflow-hidden">
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
                        <Badge variant="secondary" className="text-xs font-bold">{"#" + c.best_finish + " (" + c.best_year + ")"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="first_picks">
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
        </TabsContent>

        <TabsContent value="playoffs">
          <div className="rounded-md border bg-card overflow-hidden">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
