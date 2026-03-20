import { Badge } from "../catalyst/badge";
import { Card, CardHeader, CardTitle, CardContent } from "../catalyst/card";
import { Subheading } from "../catalyst/heading";
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "../catalyst/table";
import { AiInsight } from "../shared/ai-insight";
import { EmptyState } from "../shared/empty-state";
import { KpiTile } from "../shared/kpi-tile";
import { PlayerName } from "../shared/player-name";
import { formatFixed } from "../shared/number-format";

interface ILStashPlayer {
  name: string;
  position: string;
  status: string;
  z_score: number;
  tier: string;
  recommendation: string;
  reasoning: string;
  mlb_id?: number;
  injury_description?: string;
  intel?: any;
}

interface ILStashFACandidate {
  name: string;
  position: string;
  status: string;
  z_score: number;
  tier: string;
  percent_owned: number;
  recommendation: string;
  reasoning: string;
  mlb_id?: number;
  injury_description?: string;
  intel?: any;
}

interface ILStashAdvisorResponse {
  il_slots: { used: number; total: number };
  your_il_players: ILStashPlayer[];
  fa_il_stash_candidates: ILStashFACandidate[];
  summary: string;
}

function recColor(rec: string): "green" | "amber" | "red" | "zinc" {
  var lower = rec.toLowerCase();
  if (lower === "stash" || lower === "hold" || lower === "keep") return "green";
  if (lower === "monitor" || lower === "watch") return "amber";
  if (lower === "drop" || lower === "cut") return "red";
  return "zinc";
}

function tierColor(tier: string): string {
  if (tier === "Untouchable" || tier === "Core") return "text-sem-success";
  if (tier === "Solid") return "text-sem-warning";
  return "text-muted-foreground";
}

export function ILStashAdvisorView({ data, app, navigate }: { data: ILStashAdvisorResponse; app?: any; navigate?: (data: any) => void }) {
  var slots = data.il_slots || { used: 0, total: 0 };
  var yourPlayers = data.your_il_players || [];
  var candidates = data.fa_il_stash_candidates || [];
  var slotsAvailable = slots.total - slots.used;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.summary} />

      <div className="kpi-grid">
        <KpiTile value={slots.used + "/" + slots.total} label="IL Slots" color={slotsAvailable > 0 ? "success" : "warning"} />
        <KpiTile value={slotsAvailable} label="Available" color={slotsAvailable > 0 ? "success" : "risk"} />
        <KpiTile value={yourPlayers.length} label="Your IL" color="neutral" />
        <KpiTile value={candidates.length} label="FA Stashes" color="info" />
      </div>

      <Subheading>IL Stash Advisor</Subheading>

      {/* Current IL players */}
      {yourPlayers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your IL Players</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Player</TableHeader>
                  <TableHeader className="w-14">Pos</TableHeader>
                  <TableHeader className="hidden sm:table-cell">Status</TableHeader>
                  <TableHeader className="text-right">Z-Score</TableHeader>
                  <TableHeader className="hidden sm:table-cell">Tier</TableHeader>
                  <TableHeader className="text-center">Rec</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {yourPlayers.map(function (p, i) {
                  return (
                    <TableRow key={i + "-" + p.name}>
                      <TableCell className="font-medium">
                        <div>
                          <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="roster" />
                          {p.injury_description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{p.injury_description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color="zinc" className="text-xs">{p.position}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge color="red" className="text-xs">{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatFixed(p.z_score, 2, "0.00")}</TableCell>
                      <TableCell className={"hidden sm:table-cell text-xs font-medium " + tierColor(p.tier)}>{p.tier}</TableCell>
                      <TableCell className="text-center">
                        <Badge color={recColor(p.recommendation)} className="text-xs">{p.recommendation}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* FA stash candidates */}
      {candidates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">FA Stash Candidates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Player</TableHeader>
                  <TableHeader className="w-14">Pos</TableHeader>
                  <TableHeader className="hidden sm:table-cell">Status</TableHeader>
                  <TableHeader className="text-right">Z-Score</TableHeader>
                  <TableHeader className="hidden sm:table-cell">Tier</TableHeader>
                  <TableHeader className="text-right">Own%</TableHeader>
                  <TableHeader className="text-center">Rec</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map(function (p, i) {
                  return (
                    <TableRow key={i + "-" + p.name} className={i < 3 ? "bg-sem-success-subtle" : ""}>
                      <TableCell className="font-medium">
                        <div>
                          <PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="waivers" />
                          {p.injury_description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{p.injury_description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color="zinc" className="text-xs">{p.position}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge color="red" className="text-xs">{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatFixed(p.z_score, 2, "0.00")}</TableCell>
                      <TableCell className={"hidden sm:table-cell text-xs font-medium " + tierColor(p.tier)}>{p.tier}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{p.percent_owned != null ? p.percent_owned + "%" : "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge color={recColor(p.recommendation)} className="text-xs">{p.recommendation}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {yourPlayers.length === 0 && candidates.length === 0 && (
        <EmptyState title="No IL players or stash candidates found" />
      )}
    </div>
  );
}
