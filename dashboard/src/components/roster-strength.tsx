import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Subheading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Badge } from "@/catalyst/badge";
import * as api from "@/lib/api";

// Map league categories to MLB API stat keys
const BATTING_CAT_MAP: Record<string, { keys: string[]; aggregate: "sum" | "wavg"; label: string; lower?: boolean }> = {
  R:   { keys: ["runs"], aggregate: "sum", label: "Runs" },
  H:   { keys: ["hits"], aggregate: "sum", label: "Hits" },
  HR:  { keys: ["homeRuns"], aggregate: "sum", label: "Home Runs" },
  RBI: { keys: ["rbi"], aggregate: "sum", label: "RBI" },
  K:   { keys: ["strikeOuts"], aggregate: "sum", label: "Strikeouts", lower: true },
  TB:  { keys: ["totalBases"], aggregate: "sum", label: "Total Bases" },
  AVG: { keys: ["avg"], aggregate: "wavg", label: "Batting Avg" },
  OBP: { keys: ["obp"], aggregate: "wavg", label: "On-Base Pct" },
  XBH: { keys: ["doubles", "triples", "homeRuns"], aggregate: "sum", label: "Extra-Base Hits" },
  NSB: { keys: ["stolenBases"], aggregate: "sum", label: "Net Stolen Bases" },
  SB:  { keys: ["stolenBases"], aggregate: "sum", label: "Stolen Bases" },
};

const PITCHING_CAT_MAP: Record<string, { keys: string[]; aggregate: "sum" | "wavg"; label: string; lower?: boolean }> = {
  IP:   { keys: ["inningsPitched"], aggregate: "sum", label: "Innings Pitched" },
  W:    { keys: ["wins"], aggregate: "sum", label: "Wins" },
  L:    { keys: ["losses"], aggregate: "sum", label: "Losses", lower: true },
  ER:   { keys: ["earnedRuns"], aggregate: "sum", label: "Earned Runs", lower: true },
  K:    { keys: ["strikeOuts"], aggregate: "sum", label: "Strikeouts" },
  HLD:  { keys: ["holds"], aggregate: "sum", label: "Holds" },
  ERA:  { keys: ["era"], aggregate: "wavg", label: "ERA", lower: true },
  WHIP: { keys: ["whip"], aggregate: "wavg", label: "WHIP", lower: true },
  QS:   { keys: ["qualityStarts"], aggregate: "sum", label: "Quality Starts" },
  NSV:  { keys: ["saves"], aggregate: "sum", label: "Net Saves" },
  SV:   { keys: ["saves"], aggregate: "sum", label: "Saves" },
};

function computeCategoryValue(
  stats: Record<string, Record<string, any>>,
  config: { keys: string[]; aggregate: "sum" | "wavg" },
  posType: "B" | "P"
): number | null {
  const entries = Object.values(stats);
  if (entries.length === 0) return null;

  if (config.aggregate === "sum") {
    let total = 0;
    let found = false;
    for (const s of entries) {
      for (const key of config.keys) {
        if (s[key] !== undefined) {
          total += Number(s[key]) || 0;
          found = true;
        }
      }
    }
    return found ? total : null;
  }

  // Weighted average (by AB for batting, IP for pitching)
  const weightKey = posType === "B" ? "atBats" : "inningsPitched";
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of entries) {
    const val = Number(s[config.keys[0]]);
    const weight = Number(s[weightKey]) || 0;
    if (!isNaN(val) && weight > 0) {
      weightedSum += val * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

function formatValue(val: number | null, catName: string): string {
  if (val === null) return "–";
  if (["AVG", "OBP", "WHIP"].includes(catName)) return val.toFixed(3);
  if (["ERA"].includes(catName)) return val.toFixed(2);
  if (["IP"].includes(catName)) return val.toFixed(1);
  return Math.round(val).toLocaleString();
}

// Simple strength indicator based on stat value ranges (rough 12-team benchmarks)
function strengthColor(catName: string, val: number | null, lower?: boolean): "green" | "amber" | "red" | "zinc" {
  if (val === null) return "zinc";
  // These are rough benchmarks for a 12-team roto league (full season per roster slot)
  const benchmarks: Record<string, [number, number]> = {
    HR: [200, 280], RBI: [550, 750], R: [600, 800], H: [900, 1200], SB: [80, 150],
    TB: [1800, 2600], AVG: [0.250, 0.270], OBP: [0.320, 0.345], XBH: [300, 450], NSB: [80, 150],
    W: [50, 80], K: [800, 1100], ERA: [4.20, 3.60], WHIP: [1.30, 1.15], IP: [800, 1100],
    QS: [50, 80], NSV: [20, 45], HLD: [20, 50], L: [60, 40], ER: [400, 300],
  };
  const bench = benchmarks[catName];
  if (!bench) return "zinc";
  const [low, high] = lower ? [bench[1], bench[0]] : bench;
  if (lower) {
    return val <= low ? "green" : val >= high ? "red" : "amber";
  }
  return val >= high ? "green" : val <= low ? "red" : "amber";
}

export function RosterStrength() {
  const roster = useQuery({ queryKey: ["roster"], queryFn: api.getRoster, staleTime: 60_000 });
  const leagueCtx = useQuery({ queryKey: ["leagueContext"], queryFn: api.getLeagueContext, staleTime: 600_000 });
  const statCats = useQuery({ queryKey: ["statCategories"], queryFn: api.getStatCategories, staleTime: 600_000 });

  const mlbIds = useMemo(() => {
    if (!roster.data) return [];
    return roster.data.map((p) => p.mlb_id).filter(Boolean).map(String);
  }, [roster.data]);

  const bulkStats = useQuery({
    queryKey: ["mlbBulkStats", mlbIds.join(",")],
    queryFn: async () => {
      const current = await api.getMlbStatsBulk(mlbIds);
      const hasData = Object.values(current.players || {}).some((p) => Object.keys(p).length > 0);
      if (hasData) return current;
      return api.getMlbStatsBulk(mlbIds, "2025");
    },
    enabled: mlbIds.length > 0,
    staleTime: 300_000,
  });

  // Split players into batters and pitchers
  const { batterStats, pitcherStats } = useMemo(() => {
    if (!roster.data || !bulkStats.data?.players) return { batterStats: {}, pitcherStats: {} };
    const bStats: Record<string, any> = {};
    const pStats: Record<string, any> = {};
    for (const player of roster.data) {
      if (!player.mlb_id) continue;
      const stats = bulkStats.data.players[String(player.mlb_id)];
      if (!stats || Object.keys(stats).length === 0) continue;
      const isPitcher = ["SP", "RP", "P"].some(p =>
        player.position === p || (player.eligible_positions ?? []).includes(p)
      );
      if (isPitcher) {
        pStats[String(player.mlb_id)] = stats;
      } else {
        bStats[String(player.mlb_id)] = stats;
      }
    }
    return { batterStats: bStats, pitcherStats: pStats };
  }, [roster.data, bulkStats.data]);

  // Compute category projections
  const categories = useMemo(() => {
    const raw = statCats.data;
    const cats: any[] = (raw as any)?.categories ?? (Array.isArray(leagueCtx.data?.stat_categories) ? leagueCtx.data!.stat_categories.map((n: string) => ({ name: n })) : []);
    return cats.map((cat: any) => {
      const name = cat.name;
      const posType = cat.position_type;
      const isP = posType === "P" || (!posType && PITCHING_CAT_MAP[name]);
      const config = isP ? PITCHING_CAT_MAP[name] : BATTING_CAT_MAP[name];
      if (!config) return { name, value: null, label: name, lower: false };
      const stats = isP ? pitcherStats : batterStats;
      const value = computeCategoryValue(stats, config, isP ? "P" : "B");
      return { name, value, label: config.label, lower: config.lower, posType: isP ? "P" : "B" };
    });
  }, [statCats.data, leagueCtx.data, batterStats, pitcherStats]);

  const battingCats = categories.filter((c: any) => c.posType === "B");
  const pitchingCats = categories.filter((c: any) => c.posType === "P");

  if (!bulkStats.data || categories.every((c: any) => c.value === null)) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Subheading>Roster Strength</Subheading>
        <Badge color="zinc" className="text-[10px]">Based on {bulkStats.data?.season || "2025"} stats</Badge>
      </div>

      {battingCats.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">Batting</p>
          <div className="grid grid-cols-5 gap-1">
            {battingCats.map((cat: any) => (
              <div key={cat.name} className="text-center py-1.5">
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{cat.name}</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">
                  {formatValue(cat.value, cat.name)}
                </p>
                <div className="mt-0.5">
                  <Badge color={strengthColor(cat.name, cat.value, cat.lower)} className="text-[8px] px-1">
                    {cat.value !== null ? (strengthColor(cat.name, cat.value, cat.lower) === "green" ? "Strong" : strengthColor(cat.name, cat.value, cat.lower) === "red" ? "Weak" : "Avg") : "–"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pitchingCats.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">Pitching</p>
          <div className="grid grid-cols-5 gap-1">
            {pitchingCats.map((cat: any) => (
              <div key={`p-${cat.name}`} className="text-center py-1.5">
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{cat.name}</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">
                  {formatValue(cat.value, cat.name)}
                </p>
                <div className="mt-0.5">
                  <Badge color={strengthColor(cat.name, cat.value, cat.lower)} className="text-[8px] px-1">
                    {cat.value !== null ? (strengthColor(cat.name, cat.value, cat.lower) === "green" ? "Strong" : strengthColor(cat.name, cat.value, cat.lower) === "red" ? "Weak" : "Avg") : "–"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Text className="text-[11px] text-zinc-400">
        Projected totals from your roster's prior season stats. Actual results will vary.
      </Text>
    </div>
  );
}
