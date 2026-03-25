import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { KpiTile } from "../shared/kpi-tile";
import { AiInsight } from "../shared/ai-insight";
import { TrendingUp, TrendingDown, Trophy, Target, BarChart3 } from "@/shared/icons";

interface WeeklyNarrativeCategoryResult {
  name: string;
  your_value: string;
  opp_value: string;
  result: string;
}

interface WeeklyNarrativeResponse {
  week: string | number;
  result: string;
  score: string;
  opponent: string;
  categories: WeeklyNarrativeCategoryResult[];
  mvp_category: { name: string; your_value: string; opp_value: string };
  weakness: { name: string; your_value: string; opp_value: string };
  standings_change: { from: string | number; to: string | number; direction: string };
  current_rank: string | number;
  key_moves: string[];
  narrative: string;
}

function resultColor(result: string): string {
  var r = (result || "").toLowerCase();
  if (r === "win" || r === "w") return "bg-sem-success";
  if (r === "loss" || r === "l") return "bg-sem-risk";
  return "bg-sem-warning";
}

function resultLabel(result: string): string {
  var r = (result || "").toLowerCase();
  if (r === "win" || r === "w") return "WIN";
  if (r === "loss" || r === "l") return "LOSS";
  return "TIE";
}

function catResultBg(result: string): string {
  var r = (result || "").toLowerCase();
  if (r === "win" || r === "w") return "bg-sem-success-subtle";
  if (r === "loss" || r === "l") return "bg-sem-risk-subtle";
  if (r === "tie" || r === "t") return "bg-sem-warning-subtle";
  return "";
}

function standingsDirectionBadge(direction: string, from: string | number, to: string | number) {
  var d = (direction || "").toLowerCase();
  if (d === "up") {
    return <Badge className="bg-sem-success">{from + " -> " + to + " (up)"}</Badge>;
  }
  if (d === "down") {
    return <Badge className="bg-sem-risk">{from + " -> " + to + " (down)"}</Badge>;
  }
  return <Badge variant="secondary">{from + " -> " + to + " (hold)"}</Badge>;
}

export function WeeklyNarrativeView({ data, app, navigate }: { data: WeeklyNarrativeResponse; app?: any; navigate?: (data: any) => void }) {
  var cats = data.categories || [];
  var catWins = cats.filter(function (c) { var r = (c.result || "").toLowerCase(); return r === "win" || r === "w"; }).length;
  var catLosses = cats.filter(function (c) { var r = (c.result || "").toLowerCase(); return r === "loss" || r === "l"; }).length;
  var standings = data.standings_change || { from: "?", to: "?", direction: "hold" };
  var mvp = data.mvp_category || { name: "", your_value: "", opp_value: "" };
  var weak = data.weakness || { name: "", your_value: "", opp_value: "" };

  return (
    <div className="space-y-2">
      <div className="kpi-grid">
        <KpiTile value={catWins} label="Cat Wins" color="success" />
        <KpiTile value={catLosses} label="Cat Losses" color="risk" />
        <KpiTile value={String(data.current_rank)} label="Rank" color="primary" />
      </div>

      {/* Score Banner */}
      <Card className={resultLabel(data.result) === "WIN" ? "border-green-500/30" : resultLabel(data.result) === "LOSS" ? "border-red-500/30" : "border-yellow-500/30"}>
        <CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Week {data.week}</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Badge className={resultColor(data.result) + " text-sm px-3 py-1"}>{resultLabel(data.result)}</Badge>
            <p className="text-xl font-bold font-mono">{data.score}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-1">vs. {data.opponent}</p>
        </CardContent>
      </Card>

      {/* Narrative */}
      {data.narrative && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm leading-relaxed">{data.narrative}</p>
          </CardContent>
        </Card>
      )}

      {/* MVP + Weakness Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mvp.name && (
          <Card className="border-green-500/30 bg-sem-success-subtle">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy className="h-3.5 w-3.5 text-sem-success" />
                <p className="text-xs font-semibold text-sem-success">MVP Category</p>
              </div>
              <p className="font-semibold text-sm">{mvp.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You: <span className="font-mono">{mvp.your_value}</span> / Opp: <span className="font-mono">{mvp.opp_value}</span>
              </p>
            </CardContent>
          </Card>
        )}
        {weak.name && (
          <Card className="border-red-500/30 bg-sem-risk-subtle">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 text-sem-risk" />
                <p className="text-xs font-semibold text-sem-risk">Weakness</p>
              </div>
              <p className="font-semibold text-sm">{weak.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You: <span className="font-mono">{weak.your_value}</span> / Opp: <span className="font-mono">{weak.opp_value}</span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Standings Change */}
      {standings.from && standings.to && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Standings:</span>
          {standingsDirectionBadge(standings.direction, standings.from, standings.to)}
        </div>
      )}

      {/* Category Results Table */}
      {cats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Category Results</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto mcp-app-scroll-x">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">You</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Opp</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cats.map(function (c, idx) {
                    return (
                      <TableRow key={c.name + "-" + idx} className={catResultBg(c.result)}>
                        <TableCell className="font-medium text-sm">{c.name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{c.your_value}</TableCell>
                        <TableCell className="hidden sm:table-cell text-right font-mono text-sm">{c.opp_value}</TableCell>
                        <TableCell className="text-center">
                          {(c.result || "").toLowerCase() === "win" || (c.result || "").toLowerCase() === "w" ? (
                            <TrendingUp className="h-4 w-4 text-sem-success inline" />
                          ) : (c.result || "").toLowerCase() === "loss" || (c.result || "").toLowerCase() === "l" ? (
                            <TrendingDown className="h-4 w-4 text-sem-risk inline" />
                          ) : (
                            <span className="text-xs text-sem-warning font-medium">TIE</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Moves */}
      {(data.key_moves || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Moves</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {(data.key_moves || []).map(function (move, idx) {
                return (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground mt-0.5">{idx + 1}.</span>
                    <span>{move}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
