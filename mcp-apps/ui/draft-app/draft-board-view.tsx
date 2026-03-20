import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../catalyst/card";
import { Badge } from "../catalyst/badge";
import { Text } from "../catalyst/text";
import { KpiTile } from "../shared/kpi-tile";
import type { DraftPick, DraftStatusResponse } from "../../src/api/types";

interface DraftBoardData extends DraftStatusResponse {
  ai_recommendation?: string | null;
}

var PITCHER_POSITIONS = ["SP", "RP", "P"];

function isPitcher(position: string | undefined): boolean {
  if (!position) return false;
  return position.split(",").some(function (p) {
    return PITCHER_POSITIONS.indexOf(p.trim()) >= 0;
  });
}

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  // Try last name only
  var parts = name.split(" ");
  if (parts.length > 1) {
    var last = parts[parts.length - 1];
    if (last.length <= maxLen) return last;
    return last.substring(0, maxLen - 1) + "\u2026";
  }
  return name.substring(0, maxLen - 1) + "\u2026";
}

// Count positions drafted from picks
function countPositions(picks: DraftPick[]): Record<string, number> {
  var counts: Record<string, number> = {};
  picks.forEach(function (pick) {
    var pos = pick.position || "?";
    // Use primary position (first one listed)
    var primary = pos.split(",")[0].trim();
    counts[primary] = (counts[primary] || 0) + 1;
  });
  return counts;
}

export function DraftBoardView({ data }: { data: DraftBoardData }) {
  var numTeams = data.num_teams || 12;
  var yourTeamKey = data.your_team_key || "";
  var draftResults = data.draft_results || [];
  var totalRounds = 23; // Standard Yahoo league

  // Determine max round from data
  var maxRound = 0;
  draftResults.forEach(function (pick) {
    if (pick.round > maxRound) maxRound = pick.round;
  });
  var displayRounds = Math.max(maxRound, data.current_round, 1);

  // Build team order from first round picks
  var teamOrder: string[] = [];
  var teamNameMap: Record<string, string> = {};
  draftResults.forEach(function (pick) {
    if (pick.round === 1) {
      teamOrder.push(pick.team_key);
    }
    if (pick.team_key && pick.team_name) {
      teamNameMap[pick.team_key] = pick.team_name;
    }
  });
  // If no first round picks, build from all picks
  if (teamOrder.length === 0) {
    draftResults.forEach(function (pick) {
      if (teamOrder.indexOf(pick.team_key) === -1) {
        teamOrder.push(pick.team_key);
      }
    });
  }

  // Build grid: grid[round][teamKey] = pick
  var grid: Record<number, Record<string, DraftPick>> = {};
  draftResults.forEach(function (pick) {
    if (!grid[pick.round]) grid[pick.round] = {};
    grid[pick.round][pick.team_key] = pick;
  });

  // Count positions for your picks
  var yourPicks = draftResults.filter(function (p) { return p.team_key === yourTeamKey; });
  var posCounts = countPositions(yourPicks);
  var positionOrder = ["C", "1B", "2B", "SS", "3B", "OF", "SP", "RP"];

  // Find your next pick number
  var yourPickNumbers: number[] = [];
  draftResults.forEach(function (p) {
    if (p.team_key === yourTeamKey) {
      yourPickNumbers.push(p.pick);
    }
  });
  var lastOverallPick = 0;
  draftResults.forEach(function (p) {
    if (p.pick > lastOverallPick) lastOverallPick = p.pick;
  });

  // Estimate next pick - in snake draft, pick position alternates
  var yourDraftPosition = -1;
  if (teamOrder.indexOf(yourTeamKey) >= 0) {
    yourDraftPosition = teamOrder.indexOf(yourTeamKey);
  }

  var picksUntilNext: number | null = null;
  if (yourDraftPosition >= 0 && data.current_round <= totalRounds) {
    var currentRound = data.current_round;
    // Snake draft: odd rounds go forward, even rounds go backward
    var pickInRound: number;
    if (currentRound % 2 === 1) {
      pickInRound = yourDraftPosition + 1;
    } else {
      pickInRound = numTeams - yourDraftPosition;
    }
    var nextOverallPick = ((currentRound - 1) * numTeams) + pickInRound;
    picksUntilNext = nextOverallPick - lastOverallPick;
    if (picksUntilNext <= 0) {
      // Try next round
      var nextRound = currentRound + 1;
      if (nextRound <= totalRounds) {
        if (nextRound % 2 === 1) {
          pickInRound = yourDraftPosition + 1;
        } else {
          pickInRound = numTeams - yourDraftPosition;
        }
        nextOverallPick = ((nextRound - 1) * numTeams) + pickInRound;
        picksUntilNext = nextOverallPick - lastOverallPick;
      } else {
        picksUntilNext = null;
      }
    }
  }

  // Mobile/desktop toggle
  var viewState = useState<"grid" | "list">("grid");
  var view = viewState[0];
  var setView = viewState[1];

  return (
    <div className="space-y-2">
      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiTile value={data.current_round} label="Round" color="primary" />
        <KpiTile value={data.total_picks} label="Total Picks" color="info" />
        <KpiTile value={data.hitters + "H / " + data.pitchers + "P"} label="Your Roster" color="success" />
        {picksUntilNext != null && picksUntilNext > 0 && (
          <KpiTile value={picksUntilNext} label="Until Your Pick" color="warning" />
        )}
      </div>

      {/* Position Summary */}
      {yourPicks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your Position Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {positionOrder.map(function (pos) {
                var count = posCounts[pos] || 0;
                var isPit = PITCHER_POSITIONS.indexOf(pos) >= 0;
                return (
                  <Badge
                    key={pos}
                    color={count > 0 ? undefined : "zinc"}
                    className={
                      "text-xs font-mono " +
                      (count > 0
                        ? (isPit ? "bg-orange-500/80 hover:bg-orange-500/80" : "bg-blue-500/80 hover:bg-blue-500/80")
                        : "opacity-50")
                    }
                  >
                    {pos + " " + count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Toggle */}
      <div className="flex gap-1">
        <Badge
          color={view === "grid" ? undefined : "zinc"}
          className="text-xs cursor-pointer"
          onClick={function () { setView("grid"); }}
        >
          Grid
        </Badge>
        <Badge
          color={view === "list" ? undefined : "zinc"}
          className="text-xs cursor-pointer"
          onClick={function () { setView("list"); }}
        >
          List
        </Badge>
      </div>

      {/* Draft Board Grid */}
      {view === "grid" && draftResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Draft Board</CardTitle>
              <Badge color="zinc" className="text-xs font-mono">
                {draftResults.length + " / " + (numTeams * totalRounds) + " picks"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto mcp-app-scroll-x touch-pan-x">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card px-1.5 py-1 text-left text-muted-foreground font-medium border-b border-border w-8">
                      Rd
                    </th>
                    {teamOrder.map(function (teamKey) {
                      var isYou = teamKey === yourTeamKey;
                      var tName = teamNameMap[teamKey] || "?";
                      return (
                        <th
                          key={teamKey}
                          className={
                            "px-1 py-1 text-center font-medium border-b border-border min-w-[72px] max-w-[90px] truncate " +
                            (isYou ? "bg-primary/10 text-primary" : "text-muted-foreground")
                          }
                          title={tName}
                        >
                          {truncateName(tName, 8)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: displayRounds }, function (_, i) { return i + 1; }).map(function (round) {
                    var isCurrentRound = round === data.current_round;
                    return (
                      <tr key={round} className={isCurrentRound ? "bg-primary/5" : ""}>
                        <td className={
                          "sticky left-0 z-10 px-1.5 py-0.5 font-mono font-bold text-center border-b border-border " +
                          (isCurrentRound ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground")
                        }>
                          {round}
                        </td>
                        {teamOrder.map(function (teamKey) {
                          var pick = grid[round] && grid[round][teamKey];
                          var isYou = teamKey === yourTeamKey;

                          if (!pick) {
                            return (
                              <td
                                key={teamKey}
                                className={
                                  "px-1 py-0.5 text-center border-b border-border " +
                                  (isYou ? "bg-primary/5" : "")
                                }
                              >
                                <span className="text-muted-foreground/20">---</span>
                              </td>
                            );
                          }

                          var pitcher = isPitcher(pick.position);
                          var posLabel = pick.position ? pick.position.split(",")[0].trim() : "";

                          return (
                            <td
                              key={teamKey}
                              className={
                                "px-1 py-0.5 border-b border-border " +
                                (isYou ? "bg-primary/10" : "")
                              }
                            >
                              <div className="flex flex-col items-center gap-0">
                                <span
                                  className={
                                    "truncate max-w-[80px] leading-tight " +
                                    (isYou ? "font-semibold" : "font-medium")
                                  }
                                  title={pick.player_name}
                                >
                                  {truncateName(pick.player_name, 10)}
                                </span>
                                {posLabel && (
                                  <span
                                    className={
                                      "text-xs leading-none px-1 rounded " +
                                      (pitcher
                                        ? "text-orange-600 dark:text-orange-400 bg-orange-500/10"
                                        : "text-blue-600 dark:text-blue-400 bg-blue-500/10")
                                    }
                                  >
                                    {posLabel}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Draft Board List (mobile-friendly) */}
      {view === "list" && draftResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pick-by-Pick</CardTitle>
              <Badge color="zinc" className="text-xs font-mono">
                {draftResults.length + " picks"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {Array.from({ length: displayRounds }, function (_, i) { return i + 1; }).map(function (round) {
                var roundPicks = draftResults.filter(function (p) { return p.round === round; });
                if (roundPicks.length === 0) return null;

                return (
                  <div key={round}>
                    <div className="flex items-center gap-2 py-1">
                      <Badge color="zinc" className="text-xs font-mono shrink-0">
                        {"Rd " + round}
                      </Badge>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-0.5 pl-1">
                      {roundPicks.map(function (pick, i) {
                        var isYou = pick.team_key === yourTeamKey;
                        var pitcher = isPitcher(pick.position);
                        var posLabel = pick.position ? pick.position.split(",")[0].trim() : "";

                        return (
                          <div
                            key={pick.pick}
                            className={
                              "flex items-center gap-2 py-0.5 px-1.5 rounded text-sm " +
                              (isYou ? "bg-primary/10 border border-primary/30" : (i % 2 === 0 ? "bg-muted/30" : ""))
                            }
                          >
                            <span className="font-mono text-xs text-muted-foreground w-6 text-right">
                              {pick.pick}
                            </span>
                            <span className={"flex-1 truncate " + (isYou ? "font-semibold" : "font-medium")}>
                              {pick.player_name}
                            </span>
                            {posLabel && (
                              <Badge
                                color="zinc"
                                className={
                                  "text-xs shrink-0 " +
                                  (pitcher
                                    ? "text-orange-600 dark:text-orange-400 border-orange-500/30"
                                    : "text-blue-600 dark:text-blue-400 border-blue-500/30")
                                }
                              >
                                {posLabel}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                              {isYou ? "You" : (pick.team_name || "?")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {draftResults.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Text>No picks yet. The draft board will populate as picks are made.</Text>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
