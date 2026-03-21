import { Badge } from "@plexui/ui/components/Badge";
import { Card, CardContent } from "../components/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Subheading } from "../components/heading";
import { mlbHeadshotUrl, teamLogoFromAbbrev } from "../shared/mlb-images";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { TrendingUp, TrendingDown } from "@/shared/icons";

interface TrendPlayer {
  name: string;
  player_id: string;
  team: string;
  position: string;
  percent_owned: number;
  delta: string;
  mlb_id?: number;
}

interface TransactionTrendsData {
  most_added: TrendPlayer[];
  most_dropped: TrendPlayer[];
  ai_recommendation?: string | null;
}

function DeltaBadge({ delta }: { delta: string }) {
  var num = parseFloat(delta);
  if (isNaN(num) || num === 0) {
    return <span className="text-xs text-muted-foreground font-mono">0</span>;
  }
  if (num > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-mono text-green-600">
        <TrendingUp className="h-3 w-3" />
        {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-mono text-sem-risk">
      <TrendingDown className="h-3 w-3" />
      {delta}
    </span>
  );
}

function PercentBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-2 w-16 rounded-full overflow-hidden bg-muted">
        <div className="bg-primary rounded-full" style={{ width: Math.min(value, 100) + "%" }} />
      </div>
      <span className="text-xs font-mono font-bold">{value}%</span>
    </div>
  );
}

function TrendTable({ players, direction }: { players: TrendPlayer[]; direction: "added" | "dropped" }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="hidden sm:table-cell">Pos</TableHead>
          <TableHead className="text-right">% Owned</TableHead>
          <TableHead className="text-right">Change</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(players || []).map(function (p, i) {
          var logoUrl = p.team ? teamLogoFromAbbrev(p.team) : null;
          return (
            <TableRow key={p.player_id || i}>
              <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {p.mlb_id && (
                    <img
                      src={mlbHeadshotUrl(p.mlb_id)}
                      alt=""
                      className="w-7 h-7 rounded-full bg-muted object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {logoUrl && <img src={logoUrl} alt={p.team} width={12} height={12} className="inline shrink-0" />}
                      <span>{p.team}</span>
                      <span className="sm:hidden">{p.position ? " \u00b7 " + p.position : ""}</span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="flex gap-1 flex-wrap">
                  {(p.position || "").split(",").filter(Boolean).map(function (pos) {
                    return <Badge key={pos.trim()} color="secondary" size="sm">{pos.trim()}</Badge>;
                  })}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <PercentBar value={p.percent_owned} />
              </TableCell>
              <TableCell className="text-right">
                <DeltaBadge delta={p.delta} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function TransactionTrendsView({ data }: { data: TransactionTrendsData }) {
  var added = data.most_added || [];
  var dropped = data.most_dropped || [];
  var hottest = added.length > 0 ? added[0] : null;

  return (
    <div className="space-y-4">
      <Subheading>Transaction Trends</Subheading>

      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        {hottest && <KpiTile value={hottest.name} label="Hottest Pickup" color="success" />}
        <KpiTile value={added.length} label="Most Added" color="primary" />
        <KpiTile value={dropped.length} label="Most Dropped" color="risk" />
      </div>

      <div className="flex gap-2 mb-1">
        <Badge size="sm">{added.length + " most added"}</Badge>
        <Badge color="danger" size="sm">{dropped.length + " most dropped"}</Badge>
      </div>

      {/* Most Added */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <Subheading level={3} className="text-sm">Most Added</Subheading>
          </div>
          <TrendTable players={added} direction="added" />
        </CardContent>
      </Card>

      {/* Most Dropped */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <TrendingDown className="h-4 w-4 text-sem-risk" />
            <Subheading level={3} className="text-sm">Most Dropped</Subheading>
          </div>
          <TrendTable players={dropped} direction="dropped" />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {"Showing trends across all Yahoo Fantasy Baseball leagues"}
      </p>
    </div>
  );
}
