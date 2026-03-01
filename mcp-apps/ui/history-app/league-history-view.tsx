import { Badge } from "../components/ui/badge";
import { Trophy, TrendingUp } from "@/shared/icons";
import { KpiTile } from "../shared/kpi-tile";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

interface SeasonResult {
  year: number;
  champion: string;
  your_finish?: string;
  your_record?: string;
}

// Parse a record string like "10-4-0" into { wins, losses, ties }
function parseRecord(record: string): { wins: number; losses: number; ties: number } | null {
  if (!record || record === "-") {
    return null;
  }
  var parts = record.split("-");
  if (parts.length < 2) {
    return null;
  }
  var wins = parseInt(parts[0], 10);
  var losses = parseInt(parts[1], 10);
  var ties = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  if (isNaN(wins) || isNaN(losses)) {
    return null;
  }
  return { wins: wins, losses: losses, ties: ties };
}

// Parse finish string like "1st", "2nd", "3rd", "4th" into a number
function parseFinish(finish: string): number | null {
  if (!finish || finish === "-") {
    return null;
  }
  var num = parseInt(finish, 10);
  return isNaN(num) ? null : num;
}

function getFinishBadgeVariant(finish: string | undefined): "default" | "secondary" | "outline" {
  var rank = parseFinish(finish || "");
  if (rank === 1) {
    return "default";
  }
  if (rank !== null && rank <= 3) {
    return "secondary";
  }
  return "outline";
}

export function LeagueHistoryView({ data }: { data: { seasons: SeasonResult[] } }) {
  var seasons = data.seasons || [];

  // Build win percentage data for the chart
  var winPctData = seasons
    .map(function (s) {
      var record = parseRecord(s.your_record || "");
      if (!record) {
        return null;
      }
      var totalGames = record.wins + record.losses + record.ties;
      if (totalGames === 0) {
        return null;
      }
      var pct = Math.round((record.wins / totalGames) * 1000) / 10;
      return {
        year: s.year,
        pct: pct,
        record: s.your_record,
        finish: s.your_finish || "-",
      };
    })
    .filter(function (d) { return d !== null; }) as Array<{
      year: number;
      pct: number;
      record: string | undefined;
      finish: string;
    }>;

  // Build finish position data for the line chart
  var finishData = seasons
    .map(function (s) {
      var finish = parseFinish(s.your_finish || "");
      if (finish === null) {
        return null;
      }
      return {
        year: s.year,
        finish: finish,
        isChampion: finish === 1,
        label: s.your_finish || "",
      };
    })
    .filter(function (d) { return d !== null; }) as Array<{
      year: number;
      finish: number;
      isChampion: boolean;
      label: string;
    }>;

  // Sort finish data by year ascending for the line chart
  var sortedFinishData = finishData.slice().sort(function (a, b) { return a.year - b.year; });

  // Calculate max finish for Y-axis domain
  var maxFinish = sortedFinishData.reduce(function (max, d) {
    return d.finish > max ? d.finish : max;
  }, 1);

  // Sort seasons by year descending for timeline (most recent first)
  var sortedSeasons = seasons.slice().sort(function (a, b) { return b.year - a.year; });

  // Sort chart data by year ascending for the bar chart
  var sortedChartData = winPctData.slice().sort(function (a, b) { return a.year - b.year; });

  // Summary stats
  var championships = seasons.filter(function (s) { return parseFinish(s.your_finish || "") === 1; }).length;
  var top3Finishes = seasons.filter(function (s) {
    var rank = parseFinish(s.your_finish || "");
    return rank !== null && rank <= 3;
  }).length;
  var seasonsPlayed = seasons.filter(function (s) {
    return s.your_finish && s.your_finish !== "-";
  }).length;

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      {seasonsPlayed > 0 && (
        <div className="kpi-grid">
          <KpiTile value={championships} label="Titles" color="warning" />
          <KpiTile value={top3Finishes} label="Top 3" color="info" />
          <KpiTile value={seasonsPlayed} label="Seasons" color="neutral" />
        </div>
      )}

      {/* Finish Position Chart */}
      {sortedFinishData.length > 1 && (
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span className="text-base font-bold">Finish by Season</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sortedFinishData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  reversed
                  domain={[1, maxFinish]}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={function (v: number) { return "#" + v; }}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={function (value: number) {
                    return ["#" + value, "Finish"];
                  }}
                  labelFormatter={function (label: number) { return "Season " + label; }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="finish"
                  stroke="var(--sem-info)"
                  strokeWidth={2}
                  dot={function (props: any) {
                    var entry = sortedFinishData[props.index];
                    if (!entry) return <circle key={props.key} />;
                    var isChamp = entry.isChampion;
                    return (
                      <circle
                        key={props.key}
                        cx={props.cx}
                        cy={props.cy}
                        r={isChamp ? 6 : 4}
                        fill={isChamp ? "var(--sem-warning)" : "var(--sem-info)"}
                        stroke={isChamp ? "var(--sem-warning)" : "var(--sem-info)"}
                        strokeWidth={isChamp ? 2 : 1}
                      />
                    );
                  }}
                  activeDot={{ r: 6, fill: "var(--sem-info)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Champion
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Other
            </span>
            <span className="text-muted-foreground/60">(lower is better)</span>
          </div>
        </div>
      )}

      {/* Season Timeline */}
      <div className="space-y-2">
        {sortedSeasons.map(function (s) {
          var rank = parseFinish(s.your_finish || "");
          var isChampion = rank === 1;

          return (
            <div key={s.year} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-3">
                {/* Year badge */}
                <div className={
                  "flex items-center justify-center w-14 h-14 rounded-lg font-bold text-sm shrink-0 " +
                  (isChampion
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-2 border-amber-500"
                    : rank !== null && rank <= 3
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/50"
                      : "bg-muted text-muted-foreground border border-transparent")
                }>
                  {s.year}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Trophy size={14} className="text-amber-500 shrink-0" />
                    <span className="font-semibold text-sm truncate">{s.champion}</span>
                  </div>
                  {s.your_record && s.your_record !== "-" && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{s.your_record}</p>
                  )}
                </div>

                {/* Your finish */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.your_finish && s.your_finish !== "-" ? (
                    <Badge variant={getFinishBadgeVariant(s.your_finish)} className="text-xs font-bold">
                      {s.your_finish}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Win % Trend Chart */}
      {sortedChartData.length > 1 && (
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-base font-bold">Win % by Season</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedChartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={function (v: number) { return v + "%"; }}
                />
                <Tooltip
                  formatter={function (value: number, name: string) {
                    return [value + "%", "Win %"];
                  }}
                  labelFormatter={function (label: number) { return "Season " + label; }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {sortedChartData.map(function (entry) {
                    var finish = parseFinish(entry.finish);
                    var color = "var(--sem-neutral)";
                    if (finish === 1) {
                      color = "var(--sem-warning)";
                    } else if (finish !== null && finish <= 3) {
                      color = "var(--sem-info)";
                    } else if (entry.pct >= 60) {
                      color = "var(--sem-success)";
                    } else if (entry.pct < 40) {
                      color = "var(--sem-risk)";
                    }
                    return <Cell key={entry.year} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              Champion
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              Top 3
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
              {"60%+"}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-gray-500" />
              Other
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              {"<40%"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
