import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "../components/heading";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { TeamLogo } from "../shared/team-logo";

interface WeekPlannerPlayer {
  name: string;
  position: string;
  positions: string[];
  mlb_team: string;
  total_games: number;
  games_by_date: Record<string, boolean>;
}

interface WeekPlannerData {
  week: number;
  start_date: string;
  end_date: string;
  dates: string[];
  players: WeekPlannerPlayer[];
  daily_totals: Record<string, number>;
  ai_recommendation?: string | null;
}

function dayLabel(dateStr: string): string {
  return dateStr.slice(5); // MM-DD
}

function dayOfWeek(dateStr: string): string {
  try {
    var d = new Date(dateStr + "T12:00:00");
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] || "";
  } catch {
    return "";
  }
}

function heatmapBg(count: number, max: number): string {
  if (count === 0) return "var(--color-muted)";
  var pct = count / Math.max(1, max);
  // Green gradient from 15% to 80% mix with success color
  var mix = Math.round(15 + pct * 65);
  return "color-mix(in oklab, var(--sem-success) " + mix + "%, var(--color-surface-1))";
}

function heatmapText(count: number, max: number): string {
  if (count === 0) return "var(--color-muted-foreground)";
  var pct = count / Math.max(1, max);
  if (pct > 0.6) return "#fff";
  return "var(--color-foreground)";
}

function playersForDate(players: WeekPlannerPlayer[], dateStr: string): string[] {
  var result: string[] = [];
  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    var isBench = p.position === "BN" || p.position === "IL" || p.position === "IL+" || p.position === "NA";
    if (!isBench && p.games_by_date && p.games_by_date[dateStr]) {
      result.push(p.name);
    }
  }
  return result;
}

export function WeekPlannerView({ data }: { data: WeekPlannerData }) {
  var dates = data.dates || [];
  var players = data.players || [];
  var totals = data.daily_totals || {};
  var [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Calculate max daily total for color scaling
  var maxTotal = Math.max(1, ...Object.values(totals));
  var totalGames = Object.values(totals).reduce(function (a, b) { return a + b; }, 0);
  var offDays = Object.values(totals).filter(function (v) { return v === 0; }).length;
  var bestDayVal = Math.max(0, ...Object.values(totals));
  var bestDay = "";
  var bestKeys = Object.keys(totals);
  for (var bi = 0; bi < bestKeys.length; bi++) {
    if (totals[bestKeys[bi]] === bestDayVal) { bestDay = bestKeys[bi].slice(5); break; }
  }

  var selectedPlayers = selectedDay ? playersForDate(players, selectedDay) : [];

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={totalGames} label="Total Games" color="primary" />
        <KpiTile value={offDays} label="Off Days" color={offDays > 0 ? "warning" : "success"} />
        <KpiTile value={bestDay || "-"} label="Best Day" color="info" />
      </div>

      {/* Calendar heatmap */}
      <div className="surface-card" style={{ padding: "var(--app-space-2)" }}>
        <div style={{ fontSize: "var(--app-text-xs)", fontWeight: 600, marginBottom: "8px", color: "var(--color-muted-foreground)" }}>
          Games per Day
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(" + dates.length + ", 1fr)", gap: "6px" }}>
          {dates.map(function (d) {
            var count = totals[d] || 0;
            var isSelected = selectedDay === d;
            return (
              <div
                key={d}
                onClick={function () { setSelectedDay(isSelected ? null : d); }}
                style={{
                  background: heatmapBg(count, maxTotal),
                  color: heatmapText(count, maxTotal),
                  borderRadius: "var(--radius)",
                  padding: "8px 4px",
                  textAlign: "center" as "center",
                  cursor: "pointer",
                  border: isSelected ? "2px solid var(--sem-success)" : "2px solid transparent",
                  transition: "border-color 150ms ease, background 150ms ease",
                }}
              >
                <div style={{ fontSize: "var(--app-text-xs)", fontWeight: 600, opacity: 0.8 }}>
                  {dayOfWeek(d)}
                </div>
                <div style={{ fontSize: "var(--app-text-lg)", fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
                  {count}
                </div>
                <div style={{ fontSize: "var(--app-text-xs)", opacity: 0.7 }}>
                  {dayLabel(d)}
                </div>
              </div>
            );
          })}
        </div>
        {selectedDay && selectedPlayers.length > 0 && (
          <div className="animate-fade-in" style={{ marginTop: "8px", padding: "8px", background: "var(--color-surface-2)", borderRadius: "var(--radius)", fontSize: "var(--app-text-xs)" }}>
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
              {dayOfWeek(selectedDay) + " " + dayLabel(selectedDay) + " — " + selectedPlayers.length + " active"}
            </div>
            <div style={{ color: "var(--color-muted-foreground)", lineHeight: 1.5 }}>
              {selectedPlayers.join(", ")}
            </div>
          </div>
        )}
        {selectedDay && selectedPlayers.length === 0 && (
          <div className="animate-fade-in" style={{ marginTop: "8px", padding: "8px", background: "var(--color-surface-2)", borderRadius: "var(--radius)", fontSize: "var(--app-text-xs)", color: "var(--color-muted-foreground)" }}>
            No active players scheduled for {dayOfWeek(selectedDay) + " " + dayLabel(selectedDay)}
          </div>
        )}
      </div>

      <div>
        <Subheading>
          Week {data.week} Planner
        </Subheading>
        <p className="text-xs text-muted-foreground">{data.start_date} to {data.end_date}</p>
      </div>

      <div className="w-full overflow-x-auto mcp-app-scroll-x touch-pan-x">
        <div className="min-w-max">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2 font-medium text-xs sticky left-0 bg-background z-10 min-w-[140px]">Player</th>
                <th className="text-left py-2 pr-2 font-medium text-xs w-10">Pos</th>
                <th className="text-left py-2 pr-2 font-medium text-xs w-10">Team</th>
                {dates.map((d) => (
                  <th key={d} className="text-center py-2 px-1 font-medium text-xs w-12">
                    <div>{dayOfWeek(d)}</div>
                    <div className="text-muted-foreground">{dayLabel(d)}</div>
                  </th>
                ))}
                <th className="text-center py-2 px-2 font-medium text-xs w-10">Tot</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                var isBench = p.position === "BN" || p.position === "IL" || p.position === "IL+" || p.position === "NA";
                return (
                  <tr key={i} className={"border-b " + (isBench ? "opacity-50" : "")}>
                    <td className="py-1.5 pr-2 font-medium sticky left-0 bg-background z-10 truncate max-w-[140px]">
                      {p.name}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge variant="secondary">{p.position}</Badge>
                    </td>
                    <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TeamLogo abbrev={p.mlb_team} />
                        {p.mlb_team}
                      </span>
                    </td>
                    {dates.map((d) => {
                      var hasGame = p.games_by_date && p.games_by_date[d];
                      return (
                        <td key={d} className="text-center py-1.5 px-1">
                          {hasGame
                            ? <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                            : <span className="text-muted-foreground/30">-</span>
                          }
                        </td>
                      );
                    })}
                    <td className="text-center py-1.5 px-2 font-mono text-xs font-semibold">{p.total_games}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <td colSpan={3} className="py-2 font-semibold text-xs sticky left-0 bg-background z-10">Active Games</td>
                {dates.map((d) => {
                  var count = totals[d] || 0;
                  var pct = count / maxTotal;
                  var colorClass = pct < 0.4 ? "text-sem-risk" : pct < 0.7 ? "text-yellow-600" : "text-green-600";
                  return (
                    <td key={d} className={"text-center py-2 px-1 font-mono text-xs font-semibold " + colorClass}>
                      {count}
                    </td>
                  );
                })}
                <td className="text-center py-2 px-2 font-mono text-xs font-semibold">
                  {Object.values(totals).reduce((a, b) => a + b, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
