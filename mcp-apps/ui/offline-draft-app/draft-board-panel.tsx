import React, { useRef, useEffect } from "react";

interface BoardData {
  teams: string[];
  num_rounds: number;
  my_team: string;
  snake: boolean;
  grid: Array<{
    round: number;
    picks: Record<string, { player_name: string; position: string; z_score: number | null } | null>;
  }>;
  total_picks: number;
  on_the_clock: { team: string; round: number; overall: number } | null;
}

function posClass(pos: string): string {
  if (!pos) return "";
  var p = pos.split(",")[0].trim().toLowerCase();
  if (p === "c") return "pos-c";
  if (p === "1b") return "pos-1b";
  if (p === "2b") return "pos-2b";
  if (p === "3b") return "pos-3b";
  if (p === "ss") return "pos-ss";
  if (p === "of" || p === "lf" || p === "cf" || p === "rf") return "pos-of";
  if (p === "dh") return "pos-dh";
  if (p === "sp") return "pos-sp";
  if (p === "rp") return "pos-rp";
  if (p === "p") return "pos-p";
  return "";
}

export function DraftBoardPanel({ data, myTeam }: { data: BoardData | null; myTeam: string }) {
  var scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current pick
  useEffect(function () {
    if (!data?.on_the_clock || !scrollRef.current) return;
    var el = scrollRef.current.querySelector(".pick-cell.current");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [data?.total_picks]);

  if (!data || !data.grid) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">Draft Board</h2>
        <p className="text-sm text-muted-foreground">No draft data yet.</p>
      </div>
    );
  }

  var teams = data.teams;
  var clock = data.on_the_clock;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Draft Board</h2>
      </div>
      <div ref={scrollRef} className="overflow-auto max-h-[calc(100vh-280px)]">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground border-b border-border w-12">Rd</th>
              {teams.map(function (team) {
                return (
                  <th
                    key={team}
                    className={
                      "px-2 py-2 text-center font-medium border-b border-border "
                      + (team === myTeam ? "text-primary" : "text-muted-foreground")
                    }
                  >
                    {team.length > 12 ? team.slice(0, 10) + ".." : team}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.grid.map(function (row) {
              var isSnakeReverse = data.snake && row.round % 2 === 0;
              var displayTeams = isSnakeReverse ? [...teams].reverse() : teams;
              return (
                <tr key={row.round}>
                  <td className="px-2 py-1 font-medium text-muted-foreground border-b border-border/50 text-center">
                    {row.round}
                    {isSnakeReverse && <span className="text-[9px] ml-0.5">&larr;</span>}
                  </td>
                  {displayTeams.map(function (team) {
                    var pick = row.picks[team];
                    var isCurrent = clock && clock.team === team && clock.round === row.round;
                    var isMyTeam = team === myTeam;
                    return (
                      <td
                        key={team}
                        className={
                          "pick-cell px-1.5 py-1 border-b border-r border-border/30 "
                          + (pick ? posClass(pick.position) + " " : "")
                          + (isCurrent ? "current " : "")
                          + (isMyTeam ? "my-team " : "")
                        }
                      >
                        {pick ? (
                          <div>
                            <div className="font-medium truncate">{pick.player_name}</div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span>{pick.position}</span>
                              {pick.z_score != null && (
                                <span className={"ml-auto font-mono " + (pick.z_score > 0 ? "text-green-600 dark:text-green-400" : "")}>
                                  {pick.z_score.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : isCurrent ? (
                          <div className="text-center text-primary font-semibold animate-pulse">OTC</div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
