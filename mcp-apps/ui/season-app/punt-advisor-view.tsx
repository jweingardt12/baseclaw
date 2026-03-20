import { Badge } from "../catalyst/badge";
import { Card, CardContent } from "../catalyst/card";
import { Subheading } from "../catalyst/heading";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { AlertTriangle } from "@/shared/icons";

interface PuntAdvisorCategory {
  name: string;
  rank: number;
  value: string;
  total: number;
  recommendation: string;
  reasoning: string;
  cost_to_compete: string;
  lower_is_better: boolean;
}

interface PuntAdvisorResponse {
  team_name: string;
  current_rank: number | string;
  num_teams: number;
  categories: PuntAdvisorCategory[];
  punt_candidates: string[];
  target_categories: string[];
  correlation_warnings: string[];
  strategy_summary: string;
}

function recommendationColor(rec: string): "red" | "green" | "zinc" {
  var lower = rec.toLowerCase();
  if (lower === "punt") return "red";
  if (lower === "target") return "green";
  return "zinc";
}

function rankBg(rank: number, total: number): string {
  var pct = rank / total;
  if (pct <= 0.25) return "bg-sem-success-subtle";
  if (pct >= 0.75) return "bg-sem-risk-subtle";
  return "";
}

export function PuntAdvisorView({ data }: { data: PuntAdvisorResponse; app?: any; navigate?: (data: any) => void }) {
  var categories = data.categories || [];
  var puntCandidates = data.punt_candidates || [];
  var targetCategories = data.target_categories || [];
  var warnings = data.correlation_warnings || [];

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.strategy_summary} />

      <div className="kpi-grid">
        <KpiTile value={data.current_rank} label="Current Rank" color="primary" />
        <KpiTile value={data.num_teams} label="Teams" color="neutral" />
        <KpiTile value={puntCandidates.length} label="Punt Cats" color="risk" />
        <KpiTile value={targetCategories.length} label="Target Cats" color="success" />
      </div>

      <Subheading>Punt Advisor - {data.team_name}</Subheading>

      {/* Punt / Target badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {puntCandidates.length > 0 && (
          <Card className="border-red-500/30 border-t-2 border-t-red-500">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Punt Candidates</p>
              <div className="flex flex-wrap gap-1">
                {puntCandidates.map(function (cat) {
                  return <Badge key={cat} color="red" className="text-xs">{cat}</Badge>;
                })}
              </div>
            </CardContent>
          </Card>
        )}
        {targetCategories.length > 0 && (
          <Card className="border-green-500/30 border-t-2 border-t-green-500">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Target Categories</p>
              <div className="flex flex-wrap gap-1">
                {targetCategories.map(function (cat) {
                  return <Badge key={cat} variant="success" className="text-xs">{cat}</Badge>;
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category table */}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Category</TableHeader>
            <TableHeader className="text-right">Value</TableHeader>
            <TableHeader className="text-center">Rank</TableHeader>
            <TableHeader className="text-center">Rec</TableHeader>
            <TableHeader className="hidden sm:table-cell">Cost</TableHeader>
            <TableHeader className="hidden sm:table-cell">Reasoning</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {categories.map(function (c, i) {
            return (
              <TableRow key={i + "-" + c.name} className={rankBg(c.rank, c.total)}>
                <TableCell className="font-medium text-sm">{c.name}</TableCell>
                <TableCell className="text-right font-mono text-sm">{c.value}</TableCell>
                <TableCell className="text-center">
                  <span className="font-mono">{c.rank}</span>
                  <span className="text-muted-foreground text-xs">/{c.total}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge color={recommendationColor(c.recommendation)} className="text-xs">
                    {c.recommendation}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{c.cost_to_compete}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{c.reasoning}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Correlation warnings */}
      {warnings.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle size={14} className="text-sem-warning" />
              <span className="text-xs font-semibold text-muted-foreground">Correlation Warnings</span>
            </div>
            <ul className="space-y-1">
              {warnings.map(function (w, i) {
                return <li key={i} className="text-sm text-muted-foreground">{w}</li>;
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
