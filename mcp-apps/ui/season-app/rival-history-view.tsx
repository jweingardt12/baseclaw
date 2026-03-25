import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { KpiTile } from "../shared/kpi-tile";
import { AiInsight } from "../shared/ai-insight";
import { Users, Trophy, Shield } from "@/shared/icons";

interface RivalOverviewEntry {
  opponent: string;
  record: string;
  wins: number;
  losses: number;
  ties: number;
  last_result: string;
  last_week: string;
  dominance: string;
}

interface RivalMatchupEntry {
  week: string | number;
  score: string;
  result: "win" | "loss" | "tie";
  mvp_category: string;
  note: string;
}

interface RivalHistoryOverviewResponse {
  your_team: string;
  rivals: RivalOverviewEntry[];
  seasons_scanned?: string[];
}

interface RivalHistoryDetailResponse {
  your_team: string;
  opponent: string;
  all_time_record: string;
  wins: number;
  losses: number;
  ties: number;
  matchups: RivalMatchupEntry[];
  category_edge: { you_dominate: string[]; they_dominate: string[] };
  biggest_win: RivalMatchupEntry | null;
  closest_match: RivalMatchupEntry | null;
  narrative: string;
}

type RivalHistoryData = RivalHistoryOverviewResponse & RivalHistoryDetailResponse;

function dominanceBadge(dominance: string) {
  var d = (dominance || "").toLowerCase();
  if (d === "dominant" || d === "strong") {
    return <Badge className="bg-sem-success">{dominance}</Badge>;
  }
  if (d === "dominated" || d === "weak") {
    return <Badge className="bg-sem-risk">{dominance}</Badge>;
  }
  return <Badge className="bg-sem-warning">{dominance}</Badge>;
}

function resultRowBg(result: string): string {
  if (result === "win") return "bg-sem-success-subtle";
  if (result === "loss") return "bg-sem-risk-subtle";
  return "bg-sem-warning-subtle";
}

function resultBadge(result: string) {
  if (result === "win") return <Badge className="bg-sem-success">W</Badge>;
  if (result === "loss") return <Badge className="bg-sem-risk">L</Badge>;
  return <Badge className="bg-sem-warning">T</Badge>;
}

export function RivalHistoryView({ data, app, navigate }: { data: RivalHistoryData; app?: any; navigate?: (data: any) => void }) {
  var isDetail = !!(data as any).opponent;

  if (isDetail) {
    return <RivalDetailView data={data} />;
  }
  return <RivalOverviewView data={data} />;
}

function RivalOverviewView({ data }: { data: RivalHistoryOverviewResponse }) {
  var rivals = data.rivals || [];
  var totalWins = 0;
  var totalLosses = 0;
  for (var i = 0; i < rivals.length; i++) {
    totalWins += rivals[i].wins || 0;
    totalLosses += rivals[i].losses || 0;
  }

  return (
    <div className="space-y-2">
      <div className="kpi-grid">
        <KpiTile value={rivals.length} label="Rivals" color="info" />
        <KpiTile value={totalWins} label="Total Wins" color="success" />
        <KpiTile value={totalLosses} label="Total Losses" color="risk" />
      </div>

      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <Subheading>Rival History</Subheading>
      </div>

      <Text>{data.your_team}</Text>

      {data.seasons_scanned && data.seasons_scanned.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground">Seasons:</span>
          {data.seasons_scanned.map(function (s) {
            return <Badge key={s} variant="secondary">{s}</Badge>;
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto mcp-app-scroll-x">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opponent</TableHead>
                <TableHead className="text-center">Record</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Last</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rivals.map(function (r, idx) {
                return (
                  <TableRow key={r.opponent + "-" + idx}>
                    <TableCell className="font-medium text-sm">{r.opponent}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{r.record}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell text-sm">
                      {r.last_result && resultBadge(r.last_result)}
                      {r.last_week && <span className="text-xs text-muted-foreground ml-1">Wk {r.last_week}</span>}
                    </TableCell>
                    <TableCell className="text-center">{dominanceBadge(r.dominance)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RivalDetailView({ data }: { data: RivalHistoryDetailResponse }) {
  var youDom = (data.category_edge || {}).you_dominate || [];
  var theyDom = (data.category_edge || {}).they_dominate || [];

  return (
    <div className="space-y-2">
      <div className="kpi-grid">
        <KpiTile value={data.wins} label="Wins" color="success" />
        <KpiTile value={data.losses} label="Losses" color="risk" />
        <KpiTile value={data.ties} label="Ties" color="warning" />
      </div>

      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <Subheading>vs. {data.opponent}</Subheading>
      </div>

      {/* Record Banner */}
      <Card>
        <CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">{data.your_team}</p>
          <p className="text-2xl font-bold font-mono">{data.all_time_record}</p>
          <p className="text-xs text-muted-foreground mt-1">All-Time Record</p>
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

      {/* Notable Matchups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.biggest_win && (
          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-sem-success" />
                Biggest Win
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm">{data.biggest_win.score}</p>
              <p className="text-xs text-muted-foreground">Week {data.biggest_win.week}</p>
              {data.biggest_win.note && <p className="text-xs text-muted-foreground mt-1">{data.biggest_win.note}</p>}
            </CardContent>
          </Card>
        )}
        {data.closest_match && (
          <Card className="border-yellow-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-sem-warning" />
                Closest Match
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm">{data.closest_match.score}</p>
              <p className="text-xs text-muted-foreground">Week {data.closest_match.week}</p>
              {data.closest_match.note && <p className="text-xs text-muted-foreground mt-1">{data.closest_match.note}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Edge */}
      {(youDom.length > 0 || theyDom.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {youDom.length > 0 && (
            <Card className="border-green-500/30 bg-sem-success-subtle">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-sem-success mb-1.5">You Dominate</p>
                <div className="flex flex-wrap gap-1">
                  {youDom.map(function (cat) {
                    return <Badge key={cat} className="bg-sem-success">{cat}</Badge>;
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          {theyDom.length > 0 && (
            <Card className="border-red-500/30 bg-sem-risk-subtle">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-sem-risk mb-1.5">They Dominate</p>
                <div className="flex flex-wrap gap-1">
                  {theyDom.map(function (cat) {
                    return <Badge key={cat} variant="destructive">{cat}</Badge>;
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Matchup History Table */}
      {(data.matchups || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Matchup History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto mcp-app-scroll-x">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Result</TableHead>
                  <TableHead className="hidden sm:table-cell">MVP Cat</TableHead>
                  <TableHead className="hidden sm:table-cell">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.matchups || []).map(function (m, idx) {
                  return (
                    <TableRow key={idx + "-wk-" + m.week} className={resultRowBg(m.result)}>
                      <TableCell className="font-medium text-sm">{m.week}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{m.score}</TableCell>
                      <TableCell className="text-center">{resultBadge(m.result)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{m.mvp_category}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{m.note}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
