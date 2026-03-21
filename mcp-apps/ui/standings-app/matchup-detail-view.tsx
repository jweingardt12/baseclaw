import * as React from "react";
import { Card, CardContent } from "../components/card";
import { Badge } from "@plexui/ui/components/Badge";
import { Subheading } from "../components/heading";
import { AiInsight } from "../shared/ai-insight";
import { RefreshButton } from "../shared/refresh-button";

interface MatchupCategory {
  name: string;
  my_value: string;
  opp_value: string;
  result: "win" | "loss" | "tie";
}

interface MatchupDetailData {
  week: string | number;
  my_team: string;
  opponent: string;
  my_team_logo?: string;
  opp_team_logo?: string;
  score: { wins: number; losses: number; ties: number };
  categories: MatchupCategory[];
  ai_recommendation?: string | null;
}

function getSwingCategories(categories: MatchupCategory[]) {
  var scored = categories.map((c) => {
    var myNum = parseFloat(c.my_value) || 0;
    var oppNum = parseFloat(c.opp_value) || 0;
    var diff = Math.abs(myNum - oppNum);
    var avg = (Math.abs(myNum) + Math.abs(oppNum)) / 2;
    var closeness = c.result === "tie" ? 0 : (avg > 0 ? diff / avg : diff);
    return { ...c, closeness };
  });
  return scored.sort((a, b) => a.closeness - b.closeness).slice(0, 3);
}

function CategoryRow({ cat, isSwing }: { cat: MatchupCategory; isSwing: boolean }) {
  var resultLetter = cat.result === "win" ? "W" : cat.result === "loss" ? "L" : "T";
  var resultColor = cat.result === "win" ? "text-sem-success" : cat.result === "loss" ? "text-sem-risk" : "text-sem-warning";
  var rowBg = cat.result === "win" ? "bg-sem-success-subtle" : "";
  var myWeight = cat.result === "win" ? "font-semibold " + resultColor : "";
  var oppWeight = cat.result === "loss" ? "font-semibold text-sem-success" : "";

  return (
    <tr className={"border-b border-border/40 " + rowBg}>
      <td className="px-3 py-2 font-medium">
        <span className="flex items-center gap-1.5">
          {cat.name}
          {isSwing && <span className="text-sem-warning text-xs" title="Swing category">&#9679;</span>}
        </span>
      </td>
      <td className={"text-right px-3 py-2 font-mono text-sm " + myWeight}>{cat.my_value}</td>
      <td className={"hidden sm:table-cell text-right px-3 py-2 font-mono text-sm " + oppWeight}>{cat.opp_value}</td>
      <td className={"text-center px-2 py-2 text-xs font-bold " + resultColor}>{resultLetter}</td>
    </tr>
  );
}

export function MatchupDetailView({ data, app, navigate }: { data: MatchupDetailData; app?: any; navigate?: (data: any) => void }) {
  var score = data.score || { wins: 0, losses: 0, ties: 0 };
  var total = score.wins + score.losses + score.ties;

  var allCategories = data.categories || [];
  var battingCategories = allCategories.slice(0, 10);
  var pitchingCategories = allCategories.slice(10, 20);

  var battingWins = battingCategories.filter((c) => c.result === "win").length;
  var battingLosses = battingCategories.filter((c) => c.result === "loss").length;
  var battingTies = battingCategories.filter((c) => c.result === "tie").length;
  var pitchingWins = pitchingCategories.filter((c) => c.result === "win").length;
  var pitchingLosses = pitchingCategories.filter((c) => c.result === "loss").length;
  var pitchingTies = pitchingCategories.filter((c) => c.result === "tie").length;

  var swingSet = new Set(getSwingCategories(allCategories).map((c) => c.name));

  var winPct = total > 0 ? (score.wins / total) * 100 : 0;
  var tiePct = total > 0 ? (score.ties / total) * 100 : 0;
  var lossPct = total > 0 ? (score.losses / total) * 100 : 0;

  var statusLabel = score.wins > score.losses ? "Winning" : score.losses > score.wins ? "Losing" : "Tied";
  var statusColor = score.wins > score.losses ? "text-sem-success" : score.losses > score.wins ? "text-sem-risk" : "text-sem-warning";

  return (
    <div className="space-y-4 animate-stagger">
      <div className="flex items-center justify-between">
        <Subheading>Week {String(data.week)} Matchup</Subheading>
        {app && navigate && (
          <RefreshButton app={app} toolName="yahoo_my_matchup" navigate={navigate} />
        )}
      </div>

      <AiInsight recommendation={data.ai_recommendation} />

      {/* Scoreboard */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* My team */}
            <div className="flex items-center gap-2 min-w-0">
              {data.my_team_logo && <img src={data.my_team_logo} alt="" width={32} height={32} className="rounded-sm shrink-0" />}
              <p className="font-semibold text-sm truncate">{data.my_team}</p>
            </div>
            {/* Score */}
            <div className="text-center px-2">
              <div className="flex items-baseline justify-center gap-1 font-mono font-bold">
                <span className="text-2xl text-sem-success">{score.wins}</span>
                <span className="text-lg text-muted-foreground">-</span>
                <span className="text-2xl text-sem-risk">{score.losses}</span>
                {score.ties > 0 && (
                  <>
                    <span className="text-lg text-muted-foreground">-</span>
                    <span className="text-2xl text-sem-warning">{score.ties}</span>
                  </>
                )}
              </div>
              <p className={"text-xs font-medium " + statusColor}>{statusLabel}</p>
            </div>
            {/* Opponent */}
            <div className="flex items-center gap-2 min-w-0 justify-end">
              <p className="font-semibold text-sm truncate text-right">{data.opponent}</p>
              {data.opp_team_logo && <img src={data.opp_team_logo} alt="" width={32} height={32} className="rounded-sm shrink-0" />}
            </div>
          </div>

          {/* W-L-T bar */}
          {total > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden mt-3 bg-muted">
              <div className="bg-[var(--sem-success)] transition-all" style={{ width: winPct + "%" }} />
              {score.ties > 0 && <div className="bg-[var(--sem-warning)] transition-all" style={{ width: tiePct + "%" }} />}
              <div className="bg-[var(--sem-risk)] opacity-40 transition-all" style={{ width: lossPct + "%" }} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Cat</th>
                <th className="text-right px-3 py-2 font-medium">You</th>
                <th className="hidden sm:table-cell text-right px-3 py-2 font-medium">Opp</th>
                <th className="text-center px-2 py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {/* Batting section header */}
              <tr>
                <td colSpan={4} className="px-3 pt-3 pb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Batting</span>
                    <Badge color="secondary" size="sm" className="font-mono h-5">
                      {battingWins + "-" + battingLosses + (battingTies > 0 ? "-" + battingTies : "")}
                    </Badge>
                  </div>
                </td>
              </tr>
              {battingCategories.map((cat) => (
                <CategoryRow key={"b-" + cat.name} cat={cat} isSwing={swingSet.has(cat.name)} />
              ))}
              {/* Pitching section header */}
              <tr>
                <td colSpan={4} className="px-3 pt-4 pb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pitching</span>
                    <Badge color="secondary" size="sm" className="font-mono h-5">
                      {pitchingWins + "-" + pitchingLosses + (pitchingTies > 0 ? "-" + pitchingTies : "")}
                    </Badge>
                  </div>
                </td>
              </tr>
              {pitchingCategories.map((cat) => (
                <CategoryRow key={"p-" + cat.name} cat={cat} isSwing={swingSet.has(cat.name)} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Swing categories inline */}
      {swingSet.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs px-1">
          <span className="font-medium text-muted-foreground">Swing cats:</span>
          {Array.from(swingSet).map((name) => {
            var cat = allCategories.find((c) => c.name === name);
            if (!cat) return null;
            var badgeColor = cat.result === "win"
              ? "border-sem-success text-sem-success"
              : cat.result === "loss"
                ? "border-sem-risk text-sem-risk"
                : "border-sem-warning text-sem-warning";
            return (
              <Badge key={name} color="secondary" size="sm" className={badgeColor}>
                {name} {cat.my_value + " v " + cat.opp_value}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
