import { Badge } from "../catalyst/badge";
import { Card, CardContent } from "../catalyst/card";
import { Subheading } from "../catalyst/heading";
import { Text } from "../catalyst/text";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { KpiTile } from "../shared/kpi-tile";
import { formatFixed } from "../shared/number-format";

interface PlayerInfo {
  name: string;
  z_final: number;
  tier: string;
  pos: string;
  team: string;
}

interface CategoryImpact {
  add_z: number;
  drop_z: number;
  delta: number;
  direction: string;
}

interface FaabRecommendData {
  player: PlayerInfo;
  recommended_bid: number;
  bid_range: { low: number; high: number };
  faab_remaining: number;
  faab_after: number;
  pct_of_budget: number;
  reasoning: string[];
  category_impact: Record<string, CategoryImpact>;
  improving_categories: string[];
}

function tierBadgeColor(tier: string): "amber" | "green" | "blue" | "red" {
  if (tier === "Elite") return "amber";
  if (tier === "Strong") return "green";
  if (tier === "Solid") return "blue";
  return "red";
}

function directionArrow(direction: string): string {
  if (direction === "up") return "\u2191";
  if (direction === "down") return "\u2193";
  return "\u2192";
}

function directionColor(direction: string): string {
  if (direction === "up") return "text-sem-success";
  if (direction === "down") return "text-sem-risk";
  return "text-muted-foreground";
}

export function FaabRecommendView({ data }: { data: FaabRecommendData; app?: any; navigate?: (data: any) => void }) {
  var player = data.player || ({} as PlayerInfo);
  var impact = data.category_impact || {};
  var improving = data.improving_categories || [];
  var reasons = data.reasoning || [];

  return (
    <div className="space-y-2">
      <div className="kpi-grid">
        <KpiTile value={"$" + data.recommended_bid} label="Recommended Bid" color="primary" />
        <KpiTile value={data.bid_range ? "$" + data.bid_range.low + "-$" + data.bid_range.high : "N/A"} label="Bid Range" color="neutral" />
        <KpiTile value={formatFixed(data.pct_of_budget, 1, "0") + "%"} label="% of Budget" color={data.pct_of_budget > 25 ? "risk" : "info"} />
      </div>

      {/* Player info card */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <Subheading>{player.name}</Subheading>
              <div className="flex items-center gap-2 mt-1">
                <Badge color="zinc" className="text-xs">{player.pos}</Badge>
                <span className="text-sm text-muted-foreground">{player.team}</span>
              </div>
            </div>
            <div className="text-right">
              <Badge color={tierBadgeColor(player.tier)} className="text-xs mb-1">{player.tier}</Badge>
              <p className="font-mono text-sm text-muted-foreground">z={formatFixed(player.z_final, 2, "0.00")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bid display */}
      <Card>
        <CardContent className="p-3 text-center">
          <Text>Recommended FAAB Bid</Text>
          <p className="text-3xl font-bold font-mono text-primary">${data.recommended_bid}</p>
          {data.bid_range && (
            <p className="text-xs text-muted-foreground mt-1">
              Range: ${data.bid_range.low} - ${data.bid_range.high}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Budget summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">FAAB Remaining</p>
            <p className="text-lg font-bold font-mono">${data.faab_remaining}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">After Bid</p>
            <p className="text-lg font-bold font-mono">${data.faab_after}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reasoning */}
      {reasons.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-sm font-medium mb-2">Reasoning</p>
            <ul className="space-y-1">
              {reasons.map(function (reason, i) {
                return (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary mt-0.5">&#8226;</span>
                    <span>{reason}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Improving categories */}
      {improving.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Improves:</span>
          {improving.map(function (cat) {
            return <Badge key={cat} color="green" className="text-xs">{cat}</Badge>;
          })}
        </div>
      )}

      {/* Category impact table */}
      {Object.keys(impact).length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Category</TableHeader>
              <TableHeader className="text-right hidden sm:table-cell">Add Z</TableHeader>
              <TableHeader className="text-right hidden sm:table-cell">Drop Z</TableHeader>
              <TableHeader className="text-right">Delta</TableHeader>
              <TableHeader className="text-center">Dir</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(impact).map(function (cat) {
              var row = impact[cat];
              return (
                <TableRow key={cat}>
                  <TableCell className="font-medium">{cat}</TableCell>
                  <TableCell className="text-right font-mono text-xs hidden sm:table-cell">{formatFixed(row.add_z, 2, "0.00")}</TableCell>
                  <TableCell className="text-right font-mono text-xs hidden sm:table-cell">{formatFixed(row.drop_z, 2, "0.00")}</TableCell>
                  <TableCell className={"text-right font-mono text-xs font-semibold " + directionColor(row.direction)}>
                    {row.delta >= 0 ? "+" : ""}{formatFixed(row.delta, 2, "0.00")}
                  </TableCell>
                  <TableCell className={"text-center text-lg " + directionColor(row.direction)}>
                    {directionArrow(row.direction)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
