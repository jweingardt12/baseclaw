import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { ComparisonBar } from "../shared/comparison-bar";

import { IntelBadge } from "../shared/intel-badge";
import { PlayerName } from "../shared/player-name";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { VerdictBadge } from "../shared/verdict-badge";
import { Copy, Check } from "@/shared/icons";
import { formatFixed } from "../shared/number-format";

interface Player {
  name: string;
  player_id?: string;
  eligible_positions?: string[];
  positions?: string[];
  value?: number;
  mlb_id?: number;
  intel?: any;
}

interface TradeEvalData {
  giving?: Player[];
  getting?: Player[];
  give_players?: Player[];
  get_players?: Player[];
  give_value: number;
  get_value: number;
  net_value: number;
  grade: string;
  position_impact?: { losing: string[]; gaining: string[] };
  ai_recommendation?: string | null;
}

function asNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function fmtOne(value: unknown): string {
  return formatFixed(asNumber(value), 1, "0.0");
}

function tradeResult(netValue: number): "win" | "loss" | "tie" {
  if (netValue > 0.5) return "win";
  if (netValue < -0.5) return "loss";
  return "tie";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "bg-sem-success";
  if (grade.startsWith("B")) return "bg-sem-info";
  if (grade.startsWith("C")) return "bg-sem-warning";
  if (grade.startsWith("D")) return "bg-sem-warning";
  return "bg-sem-risk";
}

function PlayerRow({ player, app, navigate }: { player: Player; app?: any; navigate?: (data: any) => void }) {
  const positions = player.positions || player.eligible_positions || [];
  return (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-0">
      <span className="font-medium text-sm flex-1"><PlayerName name={player.name} playerId={player.player_id} mlbId={player.mlb_id} app={app} navigate={navigate} context="trade" /></span>
      {player.intel && <IntelBadge intel={player.intel} size="sm" />}
      <div className="flex gap-1">
        {positions.map((pos) => (
          <Badge key={pos} variant="outline" className="text-xs">{pos}</Badge>
        ))}
      </div>
      {player.value != null && (
        <span className="font-mono text-xs text-muted-foreground" title="Z-Value">z={fmtOne(player.value)}</span>
      )}
    </div>
  );
}

export function TradeEvalView({ data, app, navigate }: { data: TradeEvalData; app?: any; navigate?: (data: any) => void }) {
  const givePlayers = data.give_players || data.giving || [];
  const getPlayers = data.get_players || data.getting || [];
  const impact = data.position_impact;
  const giveValue = asNumber((data as any).give_value);
  const getValue = asNumber((data as any).get_value);
  const netValue = asNumber((data as any).net_value);
  const grade = typeof (data as any).grade === "string" && (data as any).grade.trim() ? (data as any).grade : "N/A";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const giveNames = givePlayers.map((p) => p.name);
    const getNames = getPlayers.map((p) => p.name);
    const text = "Trade: Giving " + giveNames.join(", ") + " (z=" + fmtOne(giveValue) + ") for " + getNames.join(", ") + " (z=" + fmtOne(getValue) + "). Net: " + (netValue >= 0 ? "+" : "") + fmtOne(netValue) + ", Grade: " + grade;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    });
  };

  return (
    <div className="space-y-2">
      <AiInsight recommendation={(data as any).ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={fmtOne(giveValue)} label="Give Z-Score" color="risk" />
        <KpiTile value={fmtOne(getValue)} label="Get Z-Score" color="success" />
        <KpiTile value={(netValue >= 0 ? "+" : "") + fmtOne(netValue)} label="Net Value" color={netValue >= 0 ? "success" : "risk"} />
      </div>

      <h2 className="text-lg font-semibold">Trade Evaluation</h2>

      {/* Grade + Net Value Hero */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Z-Value</p>
              <p className={"text-2xl font-bold font-mono " + (netValue >= 0 ? "text-green-600" : "text-destructive")}>
                {netValue >= 0 ? "+" : ""}{fmtOne(netValue)}
              </p>
              <p className="text-xs text-muted-foreground">Based on z-score projections</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Trade Grade</p>
                <span className={"inline-flex items-center rounded-md px-4 py-2 text-xl font-bold " + gradeColor(grade)}>
                  {grade}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Value Comparison Bar */}
      <Card>
        <CardContent className="p-3">
          <ComparisonBar
            label="Total Value"
            leftValue={fmtOne(giveValue)}
            rightValue={fmtOne(getValue)}
            result={tradeResult(netValue)}
            leftLabel="Giving"
            rightLabel="Getting"
          />
        </CardContent>
      </Card>

      {/* Player Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-destructive/30 border-t-2 border-t-destructive">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-destructive">Giving</CardTitle>
              <span className="font-mono text-sm text-muted-foreground">z={fmtOne(giveValue)}</span>
            </div>
          </CardHeader>
          <CardContent>
            {givePlayers.map((p) => <PlayerRow key={p.name} player={p} app={app} navigate={navigate} />)}
          </CardContent>
        </Card>

        <Card className="border-green-600/30 border-t-2 border-t-green-600">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-sem-success">Getting</CardTitle>
              <span className="font-mono text-sm text-muted-foreground">z={fmtOne(getValue)}</span>
            </div>
          </CardHeader>
          <CardContent>
            {getPlayers.map((p) => <PlayerRow key={p.name} player={p} app={app} navigate={navigate} />)}
          </CardContent>
        </Card>
      </div>

      {/* Position Impact */}
      {impact && ((impact.losing || []).length > 0 || (impact.gaining || []).length > 0) && (
        <Card>
          <CardContent className="p-3">
            <p className="text-sm font-medium mb-2">Position Impact</p>
            <div className="flex gap-3">
              {(impact.losing || []).length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Losing: </span>
                  {(impact.losing || []).map((pos) => (
                    <Badge key={pos} variant="outline" className="text-xs mr-1 border-red-500 text-sem-risk">{pos}</Badge>
                  ))}
                </div>
              )}
              {(impact.gaining || []).length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Gaining: </span>
                  {(impact.gaining || []).map((pos) => (
                    <Badge key={pos} variant="outline" className="text-xs mr-1 border-green-500 text-green-600">{pos}</Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
