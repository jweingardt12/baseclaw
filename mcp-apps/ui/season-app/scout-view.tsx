import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../catalyst/card";
import { Badge } from "../catalyst/badge";
import { Button } from "../catalyst/button";
import { Subheading } from "../catalyst/heading";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { useCallTool } from "../shared/use-call-tool";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { Shield, TrendingUp, TrendingDown, Target, AlertTriangle, Loader2, RefreshCw } from "@/shared/icons";

interface ScoutCategory {
  name: string;
  my_value: string;
  opp_value: string;
  result: "win" | "loss" | "tie";
  margin: "close" | "comfortable" | "dominant";
}

interface ScoutOpponentData {
  week: number;
  opponent: string;
  score: { wins: number; losses: number; ties: number };
  categories: ScoutCategory[];
  opp_strengths: string[];
  opp_weaknesses: string[];
  strategy: string[];
  ai_recommendation?: string | null;
}

function scoreBadgeColor(wins: number, losses: number): string {
  if (wins > losses) return "bg-sem-success";
  if (losses > wins) return "bg-sem-risk";
  return "bg-sem-warning";
}

function scoreLabel(wins: number, losses: number): string {
  if (wins > losses) return "Winning";
  if (losses > wins) return "Losing";
  return "Tied";
}

function rowBg(result: string, margin: string): string {
  if (result === "win") {
    if (margin === "close") return "bg-sem-success-subtle";
    return "bg-green-500/15";
  }
  if (result === "loss") {
    if (margin === "close") return "bg-red-500/10";
    return "bg-red-500/15";
  }
  return "bg-sem-warning-subtle";
}

export function ScoutView({ data, app, navigate }: { data: ScoutOpponentData; app?: any; navigate?: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);
  const [localData, setLocalData] = useState<ScoutOpponentData | null>(null);
  const d = localData || data;

  const handleRefresh = async () => {
    const result = await callTool("yahoo_scout_opponent");
    if (result && result.structuredContent) {
      setLocalData(result.structuredContent as ScoutOpponentData);
    }
  };

  const score = d.score || { wins: 0, losses: 0, ties: 0 };

  var weaknessCount = (d.opp_weaknesses || []).length;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={d.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={weaknessCount} label="Opp Weaknesses" color={weaknessCount > 0 ? "success" : "neutral"} />
        <KpiTile value={score.wins} label="Wins" color="success" />
        <KpiTile value={score.losses} label="Losses" color="risk" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <Subheading>Opponent Scout Report</Subheading>
        </div>
        {app && (
          <Button outline onClick={handleRefresh} disabled={loading} className="h-8 text-xs gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        )}
      </div>

      {/* Opponent + Week */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Week {d.week}</p>
          <p className="font-semibold">vs. {d.opponent}</p>
        </div>
        <Badge className={"text-sm px-3 py-1 " + scoreBadgeColor(score.wins, score.losses)}>
          {scoreLabel(score.wins, score.losses)}{" "}
          {score.wins}-{score.losses}{score.ties > 0 ? "-" + score.ties : ""}
        </Badge>
      </div>

      {/* Score Card */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Wins</p>
              <p className="text-2xl font-bold font-mono text-sem-success">{score.wins}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Losses</p>
              <p className="text-2xl font-bold font-mono text-sem-risk">{score.losses}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Ties</p>
              <p className="text-2xl font-bold font-mono text-yellow-500">{score.ties}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Category</TableHeader>
                <TableHeader className="text-right">You</TableHeader>
                <TableHeader className="text-right">Opp</TableHeader>
                <TableHeader className="text-center">Status</TableHeader>
                <TableHeader className="text-center hidden sm:table-cell">Margin</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {(d.categories || []).map((c, i) => (
                <TableRow key={i + "-" + c.name} className={rowBg(c.result, c.margin)}>
                  <TableCell className="font-medium text-sm">{c.name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{c.my_value}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{c.opp_value}</TableCell>
                  <TableCell className="text-center">
                    {c.result === "win" && <TrendingUp className="h-4 w-4 text-sem-success inline" />}
                    {c.result === "loss" && <TrendingDown className="h-4 w-4 text-sem-risk inline" />}
                    {c.result === "tie" && <span className="text-xs text-sem-warning font-medium">TIE</span>}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {c.margin === "close" && <Badge color="zinc" className="text-xs border-yellow-500 text-sem-warning">Close</Badge>}
                    {c.margin === "comfortable" && <Badge color="zinc" className="text-xs">Comf.</Badge>}
                    {c.margin === "dominant" && <Badge color="zinc" className="text-xs border-red-500 text-sem-risk">Dom.</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Strengths / Weaknesses Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(d.opp_strengths || []).length > 0 && (
          <Card className="border-red-500/30 bg-sem-risk-subtle">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-sem-risk" />
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">Their Strengths</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {(d.opp_strengths || []).map((s) => (
                  <Badge key={s} color="red" className="text-xs">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {(d.opp_weaknesses || []).length > 0 && (
          <Card className="border-green-500/30 bg-sem-success-subtle">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="h-3.5 w-3.5 text-sem-success" />
                <p className="text-xs font-semibold text-sem-success">Their Weaknesses</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {(d.opp_weaknesses || []).map((s) => (
                  <Badge key={s} className="bg-sem-success text-xs">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Strategy Section */}
      {(d.strategy || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Strategy Suggestions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {(d.strategy || []).map((s, idx) => (
                <li key={idx} className="flex gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground mt-0.5">{idx + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
