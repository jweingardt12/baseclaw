import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Heading, Subheading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Badge } from "@/catalyst/badge";
import { Button } from "@/catalyst/button";

import {
  BoltIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  CheckCircleIcon,


  CalendarIcon,
} from "@heroicons/react/20/solid";
import { toast } from "sonner";
import { TeamAvatar } from "@/components/team-avatar";
import { PlayerAvatar } from "@/components/player-avatar";
import { RosterStrength } from "@/components/roster-strength";
import { GamesStrip } from "@/components/games-strip";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import * as api from "@/lib/api";

// Yahoo stat ID → human name mapping
const STAT_ID_MAP: Record<string, string> = {
  "Stat 3": "R", "Stat 4": "H", "Stat 5": "2B", "Stat 6": "3B",
  "Stat 7": "HR", "Stat 8": "RBI", "Stat 9": "BB", "Stat 10": "K",
  "Stat 12": "SB", "Stat 13": "AVG", "Stat 16": "OBP", "Stat 18": "TB",
  "Stat 23": "XBH", "Stat 55": "NSB",
  "Stat 28": "IP", "Stat 29": "W", "Stat 30": "L", "Stat 32": "ER",
  "Stat 42": "K", "Stat 48": "HLD", "Stat 26": "ERA", "Stat 27": "WHIP",
  "Stat 63": "QS", "Stat 57": "NSV",
};

function resolveStatName(name: string): string {
  return STAT_ID_MAP[name] || name;
}

function humanizeActionItem(item: { message: string; type: string; player_id?: string }): {
  text: string;
  icon: "warning" | "suggestion" | "success";
  color: "amber" | "red" | "blue";
} {
  const msg = item.message;

  // Injury alerts
  if (item.type === "injury" || msg.includes("injured") || msg.includes("DTD") || msg.includes("IL")) {
    const playerMatch = msg.match(/^([A-Za-z\s.''-]+)\s*\(/);
    const player = playerMatch ? playerMatch[1].trim() : "";
    return {
      text: player ? `${player} is injured — consider moving to IL or bench` : msg.replace(" - move to IL or bench", " — move to IL or bench"),
      icon: "warning",
      color: "red",
    };
  }

  // Lineup alerts
  if (item.type === "lineup" || msg.includes("off today") || msg.includes("auto_lineup")) {
    const countMatch = msg.match(/(\d+)\s+starter/);
    const count = countMatch ? countMatch[1] : "";
    return {
      text: count ? `${count} of your starters are off today` : "Some starters don't have games today",
      icon: "warning",
      color: "amber",
    };
  }

  // Waiver recommendations
  if (item.type === "waiver" || msg.includes("pickup")) {
    // "Top batter pickup: Nolan Arenado (id:9105) score=87.9"
    const nameMatch = msg.match(/pickup:\s*([A-Za-z\s.''-]+)\s*\(/);
    const name = nameMatch ? nameMatch[1].trim() : "";
    const scoreMatch = msg.match(/score=([\d.]+)/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]).toFixed(0) : "";
    return {
      text: name
        ? `Consider picking up ${name}${score ? ` (score: ${score})` : ""}`
        : msg,
      icon: "suggestion",
      color: "blue",
    };
  }

  return { text: msg, icon: "warning", color: "amber" };
}

export function TodayPage() {
  const briefing = useQuery({ queryKey: ["briefing"], queryFn: api.getMorningBriefing, staleTime: 300_000, refetchInterval: 300_000 });
  const matchup = useQuery({ queryKey: ["matchup"], queryFn: api.getMatchup, staleTime: 30_000, refetchInterval: 30_000 });
  const scoreboard = useQuery({ queryKey: ["scoreboard"], queryFn: api.getScoreboard, staleTime: 30_000, refetchInterval: 30_000 });
  const transactions = useQuery({ queryKey: ["activityFeed"], queryFn: () => api.getTransactions("all", "15"), staleTime: 120_000, refetchInterval: 120_000 });
  const leagueCtx = useQuery({ queryKey: ["leagueContext"], queryFn: api.getLeagueContext, staleTime: 600_000 });
  const roster = useQuery({ queryKey: ["roster"], queryFn: api.getRoster, staleTime: 60_000 });
  const weekPlanner = useQuery({ queryKey: ["weekPlanner"], queryFn: api.getWeekPlanner, staleTime: 300_000 });
  const news = useQuery({ queryKey: ["newsLatest"], queryFn: api.getNewsLatest, staleTime: 300_000 });
  const injuryReport = useQuery({ queryKey: ["injuryReport"], queryFn: api.getInjuryReport, staleTime: 300_000 });

  const optimizeMutation = useMutation({
    mutationFn: api.autoOptimizeLineup,
    onSuccess: (data) => {
      if (data.changes?.length > 0) toast.success("Lineup optimized: " + data.changes.join(", "));
      else toast.success("Lineup already optimal!");
    },
    onError: (err: Error) => toast.error("Optimize failed: " + err.message),
  });

  // Determine if season is active
  const seasonStarted = useMemo(() => {
    const cats = matchup.data?.categories;
    if (!cats || cats.length === 0) return false;
    return cats.some((c: any) => c.my_value !== "" && c.my_value !== "0" && c.my_value !== 0);
  }, [matchup.data]);

  // Resolve matchup categories with real names
  const matchupCategories = useMemo(() => {
    const cats = matchup.data?.categories ?? [];
    return cats.map((c: any) => ({
      ...c,
      name: resolveStatName(c.name),
    }));
  }, [matchup.data]);

  // Injured players on roster
  const injuredActive = useMemo((): any[] => {
    const injury = (briefing.data as any)?.injury;
    return Array.isArray(injury?.injured_active) ? injury.injured_active : [];
  }, [briefing.data]);

  // Humanize action items
  const actionItems = useMemo(() => {
    return (briefing.data?.action_items ?? []).map(humanizeActionItem);
  }, [briefing.data]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading>Today</Heading>
          <Text>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {!seasonStarted && " · Season starts March 25"}
          </Text>
        </div>
        <Button
          color="blue"
          onClick={() => optimizeMutation.mutate()}
          disabled={optimizeMutation.isPending}
        >
          <BoltIcon data-slot="icon" />
          {optimizeMutation.isPending ? "Optimizing…" : "Optimize"}
        </Button>
      </div>

      <GamesStrip roster={roster.data ?? []} />

      {/* Action Items */}
      {briefing.isLoading ? (
        <LoadingSkeleton />
      ) : actionItems.length > 0 ? (
        <div className="space-y-2">
          {actionItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg px-4 py-3 ${
                item.color === "red"
                  ? "bg-red-500/10 dark:bg-red-500/10"
                  : item.color === "blue"
                  ? "bg-blue-500/10 dark:bg-blue-500/10"
                  : "bg-amber-500/10 dark:bg-amber-400/10"
              }`}
            >
              {item.icon === "warning" ? (
                <ExclamationTriangleIcon className={`size-5 shrink-0 mt-0.5 ${
                  item.color === "red" ? "text-red-500" : "text-amber-500"
                }`} />
              ) : item.icon === "suggestion" ? (
                <LightBulbIcon className="size-5 text-blue-500 shrink-0 mt-0.5" />
              ) : (
                <CheckCircleIcon className="size-5 text-green-500 shrink-0 mt-0.5" />
              )}
              <span className="text-sm text-zinc-800 dark:text-zinc-200">{item.text}</span>
            </div>
          ))}
        </div>
      ) : briefing.data ? (
        <div className="flex items-center gap-3 rounded-lg bg-green-500/10 px-4 py-3">
          <CheckCircleIcon className="size-5 text-green-500 shrink-0" />
          <span className="text-sm text-zinc-800 dark:text-zinc-200">
            No action items — you're all set!
          </span>
        </div>
      ) : null}

      {/* Injured Players Detail */}
      {injuredActive.length > 0 && (
        <div className="rounded-lg border border-red-500/20 dark:border-red-500/10 p-4">
          <Subheading className="text-red-600 dark:text-red-400 mb-3">Injured Players (Active Roster)</Subheading>
          <div className="space-y-2">
            {injuredActive.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <PlayerAvatar name={p.intel?.name || p.name || "?"} mlbId={p.intel?.mlb_id || p.mlb_id} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {p.intel?.name || p.name || "Unknown"}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {(p.eligible_positions || []).join(", ")}
                  </span>
                </div>
                <Badge color="red" className="text-xs">{p.status || "DTD"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster Strength (pre-season projection) */}
      {!seasonStarted && <RosterStrength />}

      {/* Enrichment Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Week Planner */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
          <Subheading>Week Planner</Subheading>
          {weekPlanner.isLoading ? (
            <LoadingSkeleton lines={3} />
          ) : weekPlanner.data && weekPlanner.data.length > 0 ? (
            <div className="space-y-1">
              {weekPlanner.data.slice(0, 7).map((day) => (
                <div key={day.date} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 w-16">{day.dayOfWeek.slice(0, 3)}</span>
                  <div className="flex-1 mx-2">
                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.min((day.games / 15) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="tabular-nums text-zinc-700 dark:text-zinc-300 font-medium">{day.games}</span>
                </div>
              ))}
            </div>
          ) : (
            <Text className="text-xs">No planner data</Text>
          )}
        </div>

        {/* News Headlines */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
          <Subheading>News</Subheading>
          {news.isLoading ? (
            <LoadingSkeleton lines={3} />
          ) : news.data && news.data.length > 0 ? (
            <div className="space-y-2">
              {news.data.slice(0, 5).map((item, i) => (
                <div key={i} className="text-xs">
                  <p className="text-zinc-900 dark:text-zinc-100 font-medium leading-snug">{item.headline}</p>
                  {item.playerName && (
                    <span className="text-zinc-400">{item.playerName}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Text className="text-xs">No news</Text>
          )}
        </div>

        {/* Injury Report */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
          <Subheading>Injury Report</Subheading>
          {injuryReport.isLoading ? (
            <LoadingSkeleton lines={3} />
          ) : injuryReport.data ? (
            <div className="space-y-1.5">
              {(injuryReport.data.injured_active ?? []).slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-900 dark:text-zinc-100 font-medium truncate">{p.name}</span>
                  <Badge color="red" className="text-[10px] shrink-0">{p.status || "IL"}</Badge>
                </div>
              ))}
              {(injuryReport.data.healthy_il ?? []).slice(0, 3).map((p, i) => (
                <div key={`h-${i}`} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 truncate">{p.name}</span>
                  <Badge color="green" className="text-[10px] shrink-0">Healthy on IL</Badge>
                </div>
              ))}
              {(injuryReport.data.injured_active ?? []).length === 0 && (injuryReport.data.healthy_il ?? []).length === 0 && (
                <Text className="text-xs">No injuries</Text>
              )}
            </div>
          ) : (
            <Text className="text-xs">No injury data</Text>
          )}
        </div>
      </div>

      {/* Two-column: Matchup + Scoreboard */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Matchup Snapshot */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          <Subheading>Week {matchup.data?.week || leagueCtx.data?.current_week || 1} Matchup</Subheading>
          {matchup.isLoading ? (
            <LoadingSkeleton lines={4} />
          ) : matchup.data ? (
            <>
              {/* Teams */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TeamAvatar teamName={matchup.data.my_team} teamLogoUrl={matchup.data.my_team_logo} size="sm" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-white truncate max-w-24">
                    {matchup.data.my_team}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-lg font-bold tabular-nums">
                  <span className="text-green-600 dark:text-green-400">{matchup.data.score?.wins ?? 0}</span>
                  <span className="text-zinc-300 dark:text-zinc-600">–</span>
                  <span className="text-red-500">{matchup.data.score?.losses ?? 0}</span>
                  {(matchup.data.score?.ties ?? 0) > 0 && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-600">–</span>
                      <span className="text-zinc-400 text-sm">{matchup.data.score.ties}T</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white truncate max-w-24">
                    {matchup.data.opponent}
                  </span>
                  <TeamAvatar teamName={matchup.data.opponent} teamLogoUrl={matchup.data.opp_team_logo} size="sm" />
                </div>
              </div>

              {/* Category breakdown */}
              {seasonStarted ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {matchupCategories.map((cat: any) => (
                    <div key={cat.name} className="flex items-center gap-2 text-xs">
                      <span className={`w-3 text-center font-bold ${
                        cat.result === "win" ? "text-green-600 dark:text-green-400" :
                        cat.result === "loss" ? "text-red-500" : "text-zinc-400"
                      }`}>
                        {cat.result === "win" ? "W" : cat.result === "loss" ? "L" : "T"}
                      </span>
                      <span className="w-10 text-zinc-500 dark:text-zinc-400">{cat.name}</span>
                      <div className="flex-1 flex items-center justify-center gap-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                        <span>{cat.my_value || "–"}</span>
                        <span className="text-zinc-300 dark:text-zinc-600">vs</span>
                        <span>{cat.opp_value || "–"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CalendarIcon className="size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                  <Text className="text-xs">Season hasn't started yet — categories will populate once games begin</Text>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <Text>No matchup data available</Text>
            </div>
          )}
        </div>

        {/* League Scoreboard */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <Subheading>League Scoreboard</Subheading>
          {scoreboard.data?.matchups && scoreboard.data.matchups.length > 0 ? (
            <div className="space-y-2">
              {scoreboard.data.matchups.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="flex-1 flex items-center gap-1.5 justify-end">
                    <span className="truncate max-w-28 text-right text-zinc-700 dark:text-zinc-300 text-xs">
                      {m.team1}
                    </span>
                    {m.team1_logo && (
                      <img src={m.team1_logo} className="size-5 rounded-full" alt="" />
                    )}
                  </div>
                  <Badge color="zinc" className="text-[10px] shrink-0">
                    {m.status === "preevent" ? "vs" : m.score1 ?? "vs"}
                  </Badge>
                  <div className="flex-1 flex items-center gap-1.5">
                    {m.team2_logo && (
                      <img src={m.team2_logo} className="size-5 rounded-full" alt="" />
                    )}
                    <span className="truncate max-w-28 text-zinc-700 dark:text-zinc-300 text-xs">
                      {m.team2}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Text>No scoreboard data</Text>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <Subheading className="mb-3">Recent Activity</Subheading>
        {transactions.isLoading ? (
          <LoadingSkeleton lines={5} />
        ) : (
          <div className="space-y-1.5">
            {(Array.isArray(transactions.data) ? transactions.data : [])
              .slice(0, 10)
              .map((tx: any, i: number) => {
                const players = tx.players || [];
                const timestamp = tx.timestamp
                  ? new Date(Number(tx.timestamp) * 1000).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })
                  : "";

                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
                    <Badge color={tx.type?.includes("trade") ? "purple" : "zinc"} className="text-[10px] shrink-0 w-16 justify-center">
                      {tx.type || "?"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      {players.length > 0 ? (
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {players.map((p: any, j: number) => (
                            <span key={j}>
                              {j > 0 && ", "}
                              <span className={p.move_type === "add" ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                                {p.move_type === "add" ? "+" : "−"}
                              </span>
                              {" "}{p.name} <span className="text-zinc-400 text-xs">({p.team_abbr})</span>
                            </span>
                          ))}
                          {players[0]?.dest_team && (
                            <span className="text-zinc-400 text-xs"> → {players[0].dest_team}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-zinc-500">{tx.player || "Unknown"}</span>
                      )}
                    </div>
                    {timestamp && (
                      <span className="text-[11px] text-zinc-400 shrink-0">{timestamp}</span>
                    )}
                  </div>
                );
              })}
            {(!transactions.data || (Array.isArray(transactions.data) && transactions.data.length === 0)) && (
              <Text>No recent activity</Text>
            )}
          </div>
        )}
      </div>
    </div>
  );
}