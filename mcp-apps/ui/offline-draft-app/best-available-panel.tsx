import React, { useCallback, useState } from "react";
import { apiFetch } from "./main";

interface Player {
  name: string;
  team: string;
  position: string;
  z_score: number;
  type: string;
}

interface BestAvailableData {
  pos_type: string;
  players: Player[];
}

var POS_FILTERS = ["All", "B", "P", "C", "1B", "2B", "SS", "3B", "OF", "SP", "RP"];

export function BestAvailablePanel({ data }: { data: BestAvailableData | null }) {
  var [filter, setFilter] = useState("All");
  var [players, setPlayers] = useState<Player[]>(data?.players || []);
  var [loading, setLoading] = useState(false);

  // Update players when data prop changes
  React.useEffect(function () {
    if (data?.players) setPlayers(data.players);
  }, [data]);

  var handleFilterChange = useCallback(async function (pos: string) {
    setFilter(pos);
    setLoading(true);
    try {
      var posType = pos === "All" ? "all" : pos;
      var result: any = await apiFetch("/best-available?pos_type=" + encodeURIComponent(posType) + "&limit=50");
      setPlayers(result.players || []);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Best Available</h2>
      </div>

      {/* Position filter tabs */}
      <div className="px-3 py-2 border-b border-border flex gap-1 flex-wrap">
        {POS_FILTERS.map(function (pos) {
          return (
            <button
              key={pos}
              onClick={function () { handleFilterChange(pos); }}
              className={
                "px-2 py-1 rounded text-xs font-medium transition-colors "
                + (filter === pos
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground")
              }
            >
              {pos}
            </button>
          );
        })}
      </div>

      <div className="overflow-y-auto max-h-[400px]">
        {loading && (
          <div className="px-4 py-3 text-sm text-muted-foreground">Loading...</div>
        )}
        {!loading && players.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted-foreground">No players found</div>
        )}
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">#</th>
              <th className="px-2 py-1.5 text-left font-medium">Player</th>
              <th className="px-2 py-1.5 text-left font-medium">Tm</th>
              <th className="px-2 py-1.5 text-left font-medium">Pos</th>
              <th className="px-2 py-1.5 text-right font-medium">Z</th>
            </tr>
          </thead>
          <tbody>
            {players.map(function (p, idx) {
              return (
                <tr key={p.name + idx} className="border-t border-border/30 hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-muted-foreground">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-medium truncate max-w-[140px]">{p.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.team}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.position}</td>
                  <td className={"px-2 py-1.5 text-right font-mono " + (p.z_score > 0 ? "text-green-500" : "text-muted-foreground")}>
                    {p.z_score != null ? p.z_score.toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
