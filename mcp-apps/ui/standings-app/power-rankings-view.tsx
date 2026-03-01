import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { formatFixed } from "../shared/number-format";
import { AiInsight } from "../shared/ai-insight";

interface PowerRankingTeam {
  rank: number;
  team_key: string;
  name: string;
  hitting_count: number;
  pitching_count: number;
  roster_size: number;
  avg_owned_pct: number;
  total_score: number;
  is_my_team: boolean;
  team_logo?: string;
  manager_image?: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Badge className="text-xs bg-sem-warning">{rank}</Badge>;
  if (rank === 2) return <Badge className="text-xs bg-sem-neutral">{rank}</Badge>;
  if (rank === 3) return <Badge className="text-xs bg-sem-info">{rank}</Badge>;
  return <Badge variant="secondary" className="text-xs">{rank}</Badge>;
}

function OwnershipBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-16 rounded-full overflow-hidden bg-muted">
        <div className="bg-blue-500 rounded-full" style={{ width: Math.min(100, pct) + "%" }} />
      </div>
      <span className="font-mono text-xs w-10">{formatFixed(pct, 1, "0.0")}%</span>
    </div>
  );
}

export function PowerRankingsView({ data }: { data: { rankings: PowerRankingTeam[]; ai_recommendation?: string | null } }) {
  var rankings = data.rankings || [];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Power Rankings</h2>

      <AiInsight recommendation={data.ai_recommendation} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Hitters</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Pitchers</TableHead>
            <TableHead>Avg Own%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rankings.map((t) => (
            <TableRow
              key={t.team_key}
              className={t.is_my_team ? "border-l-2 border-primary bg-primary/5" : ""}
            >
              <TableCell><RankBadge rank={t.rank} /></TableCell>
              <TableCell className={"font-medium" + (t.is_my_team ? " text-primary" : "")}>
                <span className="flex items-center" style={{ gap: "6px" }}>
                  {t.team_logo && <img src={t.team_logo} alt="" width={28} height={28} className="rounded-sm" style={{ flexShrink: 0 }} />}
                  {t.name}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono text-sm hidden sm:table-cell">{t.hitting_count}</TableCell>
              <TableCell className="text-right font-mono text-sm hidden sm:table-cell">{t.pitching_count}</TableCell>
              <TableCell><OwnershipBar pct={t.avg_owned_pct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
