import { Fragment } from "react";
import { Badge } from "../catalyst/badge";
import { Card, CardContent } from "../catalyst/card";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { Tabs, TabsList, TabsTrigger } from "../catalyst/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

import { TeamLogo } from "../shared/team-logo";
import { Subheading } from "../catalyst/heading";
import { BarChart3, Loader2 } from "@/shared/icons";
import { useCallTool } from "../shared/use-call-tool";
import { ZScoreBar, ZScoreExplainer, getTier, tierGrade } from "../shared/z-score";
import { PlayerCell } from "../shared/player-row";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { VerdictBadge } from "../shared/verdict-badge";
import { formatFixed } from "../shared/number-format";

interface RankingEntry {
  rank: number;
  name: string;
  team?: string;
  position?: string;
  z_score: number;
  mlb_id?: number;
  intel?: any;
}

interface RankingsData {
  pos_type: string;
  count: number;
  source: string;
  players: RankingEntry[];
  ai_recommendation?: string | null;
}

export function RankingsView({ data, app, navigate }: { data: RankingsData; app: any; navigate: (content: any) => void }) {
  var callToolResult = useCallTool(app);
  var callTool = callToolResult.callTool;
  var loading = callToolResult.loading;
  var label = data.pos_type === "P" ? "Pitcher" : "Hitter";
  var lastTier = "";
  var players = data.players || [];
  var topPlayer = players.length > 0 ? players[0] : null;
  var chartData = players.slice(0, 15).map(function (p) {
    return {
      name: p.name.length > 12 ? p.name.slice(0, 12) + "..." : p.name,
      z_score: p.z_score,
    };
  });

  var handleTabChange = async function (newValue: string) {
    var result = await callTool("yahoo_rankings", { pos_type: newValue, count: data.count || 25 });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={18} />
        <Subheading>{label} Rankings</Subheading>
        <Badge color="zinc">{data.source}</Badge>
        <span className="text-xs text-muted-foreground">Top {data.count}</span>
      </div>

      {/* KPI */}
      <div className="kpi-grid mb-2">
        {topPlayer && (
          <KpiTile
            value={formatFixed(topPlayer.z_score, 2, "0.00")}
            label={"#1: " + topPlayer.name}
            color="primary"
          />
        )}
        <KpiTile value={players.length} label="Players Ranked" color="info" />
      </div>

      <AiInsight recommendation={data.ai_recommendation} />

      {/* Top player highlight */}
      {topPlayer && (
        <Card className="mb-2 border-primary/40">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground w-6 text-right">#1</span>
            <div className="shrink-0">
              <TeamLogo abbrev={topPlayer.team} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl-app font-bold truncate">
                <PlayerCell player={topPlayer} app={app} navigate={navigate} context="default" />
              </p>
              <div className="flex items-center gap-2 mt-1">
                {topPlayer.position && <Badge color="zinc" className="text-xs">{topPlayer.position}</Badge>}
              </div>
            </div>
            <VerdictBadge grade={formatFixed(topPlayer.z_score, 1, "0.0")} variant={topPlayer.z_score >= 2 ? "success" : topPlayer.z_score >= 1 ? "info" : "warning"} size="lg" />
          </CardContent>
        </Card>
      )}

      <ZScoreExplainer />

      <Tabs value={data.pos_type || "B"} onValueChange={handleTabChange} className="mb-4 mt-2">
        <TabsList>
          <TabsTrigger value="B">Batters</TabsTrigger>
          <TabsTrigger value="P">Pitchers</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {chartData.length > 0 && (
          <div className="mb-4 h-36 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "6px", fontSize: "12px" }} />
                <Bar dataKey="z_score" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">#</TableHeader>
              <TableHeader>Player</TableHeader>
              <TableHeader className="hidden sm:table-cell">Pos</TableHeader>
              <TableHeader className="text-right">Z-Score</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {players.map(function (p) {
              var tier = getTier(p.z_score);
              var showDivider = lastTier !== "" && tier !== lastTier;
              lastTier = tier;
              return (
                <Fragment key={p.rank}>
                  {showDivider && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-0.5 px-0">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-0.5 bg-primary/30" />
                          <VerdictBadge grade={tierGrade(p.z_score)} size="sm" />
                          <div className="flex-1 h-0.5 bg-primary/30" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="font-mono text-xs">{p.rank}</TableCell>
                    <TableCell className="font-medium">
                      <PlayerCell player={p} app={app} navigate={navigate} context="default" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {p.position && <Badge color="zinc" className="text-xs">{p.position}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <ZScoreBar z={p.z_score} />
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
