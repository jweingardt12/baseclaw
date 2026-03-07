import React from "react";

interface Pick {
  round: number;
  pick: number;
  overall: number;
  player_name: string;
  position: string;
  z_score: number | null;
}

interface MyTeamData {
  team: string;
  picks: Pick[];
  total_z_score: number;
  hitters: number;
  pitchers: number;
  roster_slots: Record<string, number>;
}

export function MyTeamPanel({ data }: { data: MyTeamData | null }) {
  if (!data || !data.picks) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">My Team</h2>
        </div>
        <div className="px-4 py-3 text-sm text-muted-foreground">No picks yet.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">{data.team}</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{data.hitters}H / {data.pitchers}P</span>
          <span className="font-mono text-foreground">
            Z: {data.total_z_score != null ? data.total_z_score.toFixed(1) : "—"}
          </span>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[350px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">Rd</th>
              <th className="px-2 py-1.5 text-left font-medium">Player</th>
              <th className="px-2 py-1.5 text-left font-medium">Pos</th>
              <th className="px-2 py-1.5 text-right font-medium">Z</th>
            </tr>
          </thead>
          <tbody>
            {data.picks.map(function (p, idx) {
              return (
                <tr key={idx} className="border-t border-border/30">
                  <td className="px-3 py-1.5 text-muted-foreground">{p.round}</td>
                  <td className="px-2 py-1.5 font-medium truncate max-w-[140px]">{p.player_name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.position}</td>
                  <td className={"px-2 py-1.5 text-right font-mono " + (p.z_score != null && p.z_score > 0 ? "text-green-500" : "text-muted-foreground")}>
                    {p.z_score != null ? p.z_score.toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Positional slots summary */}
      {data.roster_slots && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.roster_slots).map(function ([pos, count]) {
              var filled = data.picks.filter(function (p) {
                var pPos = (p.position || "").split(",")[0].trim();
                return pPos === pos;
              }).length;
              var isFull = filled >= (count as number);
              return (
                <span
                  key={pos}
                  className={
                    "text-[10px] px-1.5 py-0.5 rounded font-medium "
                    + (isFull ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground")
                  }
                >
                  {pos}: {filled}/{count as number}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
