import { Badge } from "../catalyst/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../catalyst/card";
import { Subheading } from "../catalyst/heading";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";

interface PlayoffCategoryGap {
  category: string;
  current_rank: number;
  target_rank: number;
  places_to_gain: number;
  gap: string;
  priority: string;
  cost_to_compete: string;
}

interface PlayoffAction {
  action_type: string;
  description: string;
  impact: string;
  priority: string;
}

interface PlayoffPlannerResponse {
  current_rank: number;
  playoff_cutoff: number;
  games_back: number;
  team_name: string;
  record: string;
  num_teams: number;
  category_gaps: PlayoffCategoryGap[];
  recommended_actions: PlayoffAction[];
  target_categories: string[];
  punt_categories: string[];
  playoff_probability: number;
  summary: string;
}

function priorityColor(priority: string): "red" | "yellow" | "zinc" {
  var lower = priority.toLowerCase();
  if (lower === "high" || lower === "critical") return "red";
  if (lower === "medium") return "yellow";
  return "zinc";
}

function priorityOrder(priority: string): number {
  var lower = priority.toLowerCase();
  if (lower === "critical") return 0;
  if (lower === "high") return 1;
  if (lower === "medium") return 2;
  return 3;
}

export function PlayoffPlannerView({ data }: { data: PlayoffPlannerResponse; app?: any; navigate?: (data: any) => void }) {
  var gaps = (data.category_gaps || []).slice().sort(function (a, b) {
    return priorityOrder(a.priority) - priorityOrder(b.priority);
  });
  var actions = data.recommended_actions || [];
  var targetCats = data.target_categories || [];
  var puntCats = data.punt_categories || [];
  var isIn = data.current_rank <= data.playoff_cutoff;
  var probPct = data.playoff_probability != null ? Math.round(data.playoff_probability * 100) : null;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.summary} />

      <div className="kpi-grid">
        <KpiTile value={data.current_rank} label="Current Rank" color={isIn ? "success" : "risk"} />
        <KpiTile value={data.playoff_cutoff} label="Cutoff" color="neutral" />
        <KpiTile value={data.games_back} label="Games Back" color={data.games_back <= 0 ? "success" : "warning"} />
        {probPct != null && (
          <KpiTile value={probPct + "%"} label="Playoff Prob" color={probPct >= 50 ? "success" : "risk"} />
        )}
      </div>

      <Subheading>Playoff Planner - {data.team_name}</Subheading>

      {/* Status banner */}
      <Card className={isIn ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className={"text-sm font-semibold " + (isIn ? "text-sem-success" : "text-sem-risk")}>
                {isIn ? "Currently in Playoff Position" : "Outside Playoff Cutoff"}
              </p>
              <p className="text-xs text-muted-foreground">
                Record: {data.record} | Rank {data.current_rank} of {data.num_teams}
              </p>
            </div>
            <Badge className={isIn ? "bg-sem-success" : "bg-sem-risk"}>
              {isIn ? "IN" : "OUT"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Target / Punt badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {targetCats.length > 0 && (
          <Card className="border-green-500/30 border-t-2 border-t-green-500">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Target Categories</p>
              <div className="flex flex-wrap gap-1">
                {targetCats.map(function (cat) {
                  return <Badge key={cat} variant="success" className="text-xs">{cat}</Badge>;
                })}
              </div>
            </CardContent>
          </Card>
        )}
        {puntCats.length > 0 && (
          <Card className="border-red-500/30 border-t-2 border-t-red-500">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Punt Categories</p>
              <div className="flex flex-wrap gap-1">
                {puntCats.map(function (cat) {
                  return <Badge key={cat} color="red" className="text-xs">{cat}</Badge>;
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category gaps table */}
      {gaps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Category Gaps</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Category</TableHeader>
                  <TableHeader className="text-center">Current</TableHeader>
                  <TableHeader className="text-center">Target</TableHeader>
                  <TableHeader className="text-center">Gap</TableHeader>
                  <TableHeader className="text-center">Priority</TableHeader>
                  <TableHeader className="hidden sm:table-cell">Cost</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {gaps.map(function (g, i) {
                  return (
                    <TableRow key={i + "-" + g.category}>
                      <TableCell className="font-medium text-sm">{g.category}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{g.current_rank}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{g.target_rank}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{g.gap}</TableCell>
                      <TableCell className="text-center">
                        <Badge color={priorityColor(g.priority)} className="text-xs">{g.priority}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{g.cost_to_compete}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recommended actions */}
      {actions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recommended Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actions.map(function (a, i) {
                return (
                  <div key={i} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                    <Badge color={priorityColor(a.priority)} className="text-xs mt-0.5 shrink-0">{a.priority}</Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge color="zinc" className="text-xs">{a.action_type}</Badge>
                        <span className="text-xs text-muted-foreground">{a.impact}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
