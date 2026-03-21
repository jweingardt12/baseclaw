import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Button } from "@/catalyst/button";
import { Badge } from "@/catalyst/badge";
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from "@/catalyst/dialog";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
} from "@/catalyst/dropdown";
import { BoltIcon } from "@heroicons/react/20/solid";
import { MoreHorizontal, ArrowRightLeft, ArrowDown, ArrowUp, UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PlayerDrawer } from "@/components/player-drawer";
import { PlayerAvatar } from "@/components/player-avatar";
import * as api from "@/lib/api";
import type { RosterPlayer } from "@/lib/api";

const BATTER_SLOT_ORDER = ["C", "1B", "2B", "3B", "SS", "OF", "DH", "UTIL", "Util"];
const PITCHER_SLOT_ORDER = ["SP", "RP", "P"];
const BENCH_SLOTS = ["BN"];
const IL_SLOTS = ["IL", "IL+", "NA", "DL"];

function isPitcher(player: RosterPlayer): boolean {
  const pos = player.position || "";
  const elig = player.eligible_positions || [];
  return PITCHER_SLOT_ORDER.includes(pos) || elig.some((e: string) => PITCHER_SLOT_ORDER.includes(e));
}

// Slot badge colors
function slotColor(slot: string): "emerald" | "zinc" | "red" | "amber" {
  if (BENCH_SLOTS.includes(slot)) return "zinc";
  if (IL_SLOTS.includes(slot)) return "red";
  if (PITCHER_SLOT_ORDER.includes(slot)) return "amber";
  return "emerald";
}

// Statcast tier → color class
function tierColor(tier: string | undefined): string {
  if (!tier) return "text-zinc-400";
  switch (tier) {
    case "elite": return "text-red-500 font-semibold";
    case "great": case "strong": return "text-orange-500";
    case "above_average": case "above": return "text-amber-500";
    case "average": return "text-zinc-500";
    case "below_average": case "below": return "text-blue-400";
    case "poor": return "text-blue-600";
    default: return "text-zinc-400";
  }
}

export function RosterPage() {
  const queryClient = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);
  const [dropTarget, setDropTarget] = useState<RosterPlayer | null>(null);
  const [swapDialogPlayer, setSwapDialogPlayer] = useState<RosterPlayer | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const roster = useQuery({ queryKey: ["roster"], queryFn: api.getRoster, staleTime: 60_000, refetchInterval: 60_000 });
  const leagueCtx = useQuery({ queryKey: ["leagueContext"], queryFn: api.getLeagueContext, staleTime: 600_000 });
  const injuryReport = useQuery({ queryKey: ["injuryReport"], queryFn: api.getInjuryReport, staleTime: 300_000 });

  const mlbIds = useMemo(() => {
    if (!roster.data) return [];
    return roster.data.map((p) => p.mlb_id).filter(Boolean).map(String).sort();
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

  const dropMutation = useMutation({
    mutationFn: (name: string) => api.dropPlayer(name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["roster"] }); toast.success("Dropped " + dropTarget?.name); setDropTarget(null); },
    onError: (err: Error) => toast.error("Failed to drop: " + err.message),
  });

  const optimizeMutation = useMutation({
    mutationFn: () => api.autoOptimizeLineup(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      const changes = data.changes ?? data.suggested_swaps?.map((s: any) => `${s.player}: ${s.from} → ${s.to}`) ?? [];
      if (changes.length > 0) toast.success("Lineup optimized!", { description: changes.join(", ") });
      else toast.info("Lineup is already optimal!");
    },
    onError: (err: Error) => toast.error("Failed to optimize: " + err.message),
  });

  const moveToPositionMutation = useMutation({
    mutationFn: (args: { playerId: string | number; position: string }) =>
      api.setLineup([{ player_id: args.playerId, position: args.position }]),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["roster"] }); toast.success("Lineup updated!"); setSwapDialogPlayer(null); },
    onError: (err: Error) => toast.error("Failed to move: " + err.message),
  });

  const getPlayerStats = useCallback(
    (mlbId?: number | string | null): Record<string, string | number> | undefined => {
      if (!mlbId || !bulkStats.data?.players) return undefined;
      return bulkStats.data.players[String(mlbId)];
    },
    [bulkStats.data]
  );

  const getPlayerInSlot = useCallback(
    (slot: string): RosterPlayer | undefined => {
      return roster.data?.find((p) => p.slot === slot && !BENCH_SLOTS.includes(p.slot) && !IL_SLOTS.includes(p.slot));
    },
    [roster.data]
  );

  // Build slot-aware sections
  type SlotEntry = { slot: string; player: RosterPlayer | null };
  const { batterSlots, pitcherSlots, benchHitters, benchPitchers, ilPlayers } = useMemo(() => {
    const data = roster.data ?? [];
    const positions = leagueCtx.data?.roster_positions ?? [];
    const batterPositions = positions.filter((p) => p.position_type === "B");
    const pitcherPositions = positions.filter((p) => p.position_type === "P");
    const playersBySlot: Record<string, RosterPlayer[]> = {};
    const bench: RosterPlayer[] = [];
    const il: RosterPlayer[] = [];
    for (const player of data) {
      const slot = player.slot || "";
      if (IL_SLOTS.includes(slot)) { il.push(player); continue; }
      if (BENCH_SLOTS.includes(slot)) { bench.push(player); continue; }
      if (!playersBySlot[slot]) playersBySlot[slot] = [];
      playersBySlot[slot].push(player);
    }
    const bSlots: SlotEntry[] = [];
    for (const rp of batterPositions) {
      const players = playersBySlot[rp.position] ?? [];
      for (let i = 0; i < rp.count; i++) bSlots.push({ slot: rp.position, player: players[i] ?? null });
    }
    const pSlots: SlotEntry[] = [];
    for (const rp of pitcherPositions) {
      const players = playersBySlot[rp.position] ?? [];
      for (let i = 0; i < rp.count; i++) pSlots.push({ slot: rp.position, player: players[i] ?? null });
    }
    return {
      batterSlots: bSlots,
      pitcherSlots: pSlots,
      benchHitters: bench.filter((p) => !isPitcher(p)),
      benchPitchers: bench.filter((p) => isPitcher(p)),
      ilPlayers: il,
    };
  }, [roster.data, leagueCtx.data]);

  const renderActionMenu = (player: RosterPlayer) => {
    const isActive = BATTER_SLOT_ORDER.includes(player.slot) || PITCHER_SLOT_ORDER.includes(player.slot);
    const isBench = BENCH_SLOTS.includes(player.slot);
    const isIL = IL_SLOTS.includes(player.slot);
    return (
      <Dropdown>
        <DropdownButton plain className="p-0.5 -m-0.5">
          <MoreHorizontal className="size-4 text-zinc-400" />
        </DropdownButton>
        <DropdownMenu anchor="bottom end">
          {isActive && (
            <DropdownItem onClick={() => player.player_id && moveToPositionMutation.mutate({ playerId: player.player_id, position: "BN" })}>
              <ArrowDown className="size-4" data-slot="icon" />Move to Bench
            </DropdownItem>
          )}
          {isActive && (
            <DropdownItem onClick={() => setSwapDialogPlayer(player)}>
              <ArrowRightLeft className="size-4" data-slot="icon" />Swap Position…
            </DropdownItem>
          )}
          {isBench && (player.eligible_positions ?? []).filter((p: string) => p !== "Util").map((pos: string) => (
            <DropdownItem key={pos} onClick={() => player.player_id && moveToPositionMutation.mutate({ playerId: player.player_id, position: pos })}>
              <ArrowUp className="size-4" data-slot="icon" />Set as {pos}
            </DropdownItem>
          ))}
          {isBench && (player.eligible_positions ?? []).includes("Util") && (
            <DropdownItem onClick={() => player.player_id && moveToPositionMutation.mutate({ playerId: player.player_id, position: "Util" })}>
              <ArrowUp className="size-4" data-slot="icon" />Set as Util
            </DropdownItem>
          )}
          {isIL && (
            <DropdownItem onClick={() => player.player_id && moveToPositionMutation.mutate({ playerId: player.player_id, position: "BN" })}>
              <ArrowUp className="size-4" data-slot="icon" />Activate to Bench
            </DropdownItem>
          )}
          {(isBench || isIL) && (
            <><DropdownDivider />
            <DropdownItem onClick={() => setDropTarget(player)}>
              <UserMinus className="size-4 text-red-500" data-slot="icon" />
              <span className="text-red-600 dark:text-red-400">Drop Player</span>
            </DropdownItem></>
          )}
        </DropdownMenu>
      </Dropdown>
    );
  };

  // === BATTER STAT TABLE ===
  const BatterTable = ({ entries, label }: { entries: (SlotEntry | RosterPlayer)[]; label: string }) => (
    <div>
      <div className="flex items-center gap-2 pt-5 pb-2 first:pt-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <th className="text-left py-1 pr-2 w-9">Pos</th>
              <th className="text-left py-1 pr-2 min-w-[160px]">Player</th>
              {!showAdvanced ? (
                <>
                  <th className="text-right py-1 px-1.5 w-10">GP</th>
                  <th className="text-right py-1 px-1.5 w-12">AVG</th>
                  <th className="text-right py-1 px-1.5 w-8">HR</th>
                  <th className="text-right py-1 px-1.5 w-10">RBI</th>
                  <th className="text-right py-1 px-1.5 w-8">R</th>
                  <th className="text-right py-1 px-1.5 w-8">SB</th>
                  <th className="text-right py-1 px-1.5 w-12">OBP</th>
                  <th className="text-right py-1 px-1.5 w-12">OPS</th>
                </>
              ) : (
                <>
                  <th className="text-right py-1 px-1.5 w-14">xwOBA</th>
                  <th className="text-right py-1 px-1.5 w-14">xBA</th>
                  <th className="text-right py-1 px-1.5 w-14">xSLG</th>
                  <th className="text-right py-1 px-1.5 w-14">EV</th>
                  <th className="text-right py-1 px-1.5 w-14">Brl%</th>
                  <th className="text-right py-1 px-1.5 w-14">HH%</th>
                </>
              )}
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {entries.map((entry, i) => {
              const isSlotEntry = "slot" in entry && "player" in entry;
              const slot = isSlotEntry ? (entry as SlotEntry).slot : (entry as RosterPlayer).slot;
              const player = isSlotEntry ? (entry as SlotEntry).player : (entry as RosterPlayer);
              if (!player) {
                return (
                  <tr key={`empty-${slot}-${i}`} className="text-zinc-300 dark:text-zinc-700">
                    <td className="py-2 pr-2"><Badge color="zinc" className="text-[10px] font-mono">{slot}</Badge></td>
                    <td className="py-2 pr-2 italic text-xs">Empty</td>
                    <td colSpan={showAdvanced ? 6 : 8}></td>
                    <td></td>
                  </tr>
                );
              }
              const stats = getPlayerStats(player.mlb_id);
              const sc = (player as any).intel?.statcast;
              const expected = sc?.expected;
              const bb = sc?.batted_ball;
              return (
                <tr key={`${player.name}-${slot}-${i}`} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="py-1.5 pr-2">
                    <Badge color={slotColor(slot)} className="text-[10px] font-mono w-7 justify-center">{slot}</Badge>
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar name={player.name} mlbId={player.mlb_id} size="sm" />
                      <div className="min-w-0">
                        <button
                          className="text-sm font-medium text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left truncate block max-w-[140px]"
                          onClick={() => setSelectedPlayer(player)}
                        >
                          {player.name}
                        </button>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {player.position}{player.team ? ` · ${player.team}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  {!showAdvanced ? (
                    <>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.gamesPlayed ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums font-medium text-zinc-900 dark:text-white">{stats?.avg ? Number(stats.avg).toFixed(3) : "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-700 dark:text-zinc-300">{stats?.homeRuns ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-700 dark:text-zinc-300">{stats?.rbi ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.runs ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.stolenBases ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.obp ? Number(stats.obp).toFixed(3) : "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.ops ? Number(stats.ops).toFixed(3) : "–"}</td>
                    </>
                  ) : (
                    <>
                      <td className={`text-right py-1.5 px-1.5 tabular-nums ${tierColor(expected?.xwoba_tier)}`}>
                        {expected?.xwoba != null ? expected.xwoba.toFixed(3) : "–"}
                      </td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {expected?.xba != null ? expected.xba.toFixed(3) : "–"}
                      </td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {expected?.xslg != null ? expected.xslg.toFixed(3) : "–"}
                      </td>
                      <td className={`text-right py-1.5 px-1.5 tabular-nums ${tierColor(bb?.ev_tier)}`}>
                        {bb?.avg_exit_velo ?? "–"}
                      </td>
                      <td className={`text-right py-1.5 px-1.5 tabular-nums ${tierColor(bb?.barrel_tier)}`}>
                        {bb?.barrel_pct != null ? bb.barrel_pct.toFixed(1) : "–"}
                      </td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {bb?.hard_hit_pct != null ? bb.hard_hit_pct.toFixed(1) : "–"}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 pl-1">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {renderActionMenu(player)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // === PITCHER STAT TABLE ===
  const PitcherTable = ({ entries, label }: { entries: (SlotEntry | RosterPlayer)[]; label: string }) => (
    <div>
      <div className="flex items-center gap-2 pt-5 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <th className="text-left py-1 pr-2 w-9">Pos</th>
              <th className="text-left py-1 pr-2 min-w-[160px]">Player</th>
              {!showAdvanced ? (
                <>
                  <th className="text-right py-1 px-1.5 w-10">GP</th>
                  <th className="text-right py-1 px-1.5 w-12">ERA</th>
                  <th className="text-right py-1 px-1.5 w-12">WHIP</th>
                  <th className="text-right py-1 px-1.5 w-8">W</th>
                  <th className="text-right py-1 px-1.5 w-10">K</th>
                  <th className="text-right py-1 px-1.5 w-12">IP</th>
                  <th className="text-right py-1 px-1.5 w-8">QS</th>
                  <th className="text-right py-1 px-1.5 w-8">SV</th>
                </>
              ) : (
                <>
                  <th className="text-right py-1 px-1.5 w-14">xwOBA</th>
                  <th className="text-right py-1 px-1.5 w-14">xBA</th>
                  <th className="text-right py-1 px-1.5 w-14">K%</th>
                  <th className="text-right py-1 px-1.5 w-14">BB%</th>
                  <th className="text-right py-1 px-1.5 w-14">EV</th>
                  <th className="text-right py-1 px-1.5 w-14">Brl%</th>
                </>
              )}
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {entries.map((entry, i) => {
              const isSlotEntry = "slot" in entry && "player" in entry;
              const slot = isSlotEntry ? (entry as SlotEntry).slot : (entry as RosterPlayer).slot;
              const player = isSlotEntry ? (entry as SlotEntry).player : (entry as RosterPlayer);
              if (!player) {
                return (
                  <tr key={`empty-${slot}-${i}`} className="text-zinc-300 dark:text-zinc-700">
                    <td className="py-2 pr-2"><Badge color="zinc" className="text-[10px] font-mono">{slot}</Badge></td>
                    <td className="py-2 pr-2 italic text-xs">Empty</td>
                    <td colSpan={showAdvanced ? 6 : 8}></td>
                    <td></td>
                  </tr>
                );
              }
              const stats = getPlayerStats(player.mlb_id);
              const sc = (player as any).intel?.statcast;
              const expected = sc?.expected;
              const bb = sc?.batted_ball;
              const pitching = sc?.pitching;
              return (
                <tr key={`${player.name}-${slot}-${i}`} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="py-1.5 pr-2">
                    <Badge color={slotColor(slot)} className="text-[10px] font-mono w-7 justify-center">{slot}</Badge>
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar name={player.name} mlbId={player.mlb_id} size="sm" />
                      <div className="min-w-0">
                        <button
                          className="text-sm font-medium text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left truncate block max-w-[140px]"
                          onClick={() => setSelectedPlayer(player)}
                        >
                          {player.name}
                        </button>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {player.position}{player.team ? ` · ${player.team}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  {!showAdvanced ? (
                    <>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.gamesPlayed ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums font-medium text-zinc-900 dark:text-white">{stats?.era ? Number(stats.era).toFixed(2) : "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-700 dark:text-zinc-300">{stats?.whip ? Number(stats.whip).toFixed(2) : "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-700 dark:text-zinc-300">{stats?.wins ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-700 dark:text-zinc-300">{stats?.strikeOuts ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.inningsPitched ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.qualityStarts ?? "–"}</td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{stats?.saves ?? "–"}</td>
                    </>
                  ) : (
                    <>
                      <td className={`text-right py-1.5 px-1.5 tabular-nums ${tierColor(expected?.xwoba_tier)}`}>
                        {expected?.xwoba != null ? expected.xwoba.toFixed(3) : "–"}
                      </td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {expected?.xba != null ? expected.xba.toFixed(3) : "–"}
                      </td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {pitching?.k_pct != null ? pitching.k_pct.toFixed(1) + "%" : "–"}
                      </td>
                      <td className="text-right py-1.5 px-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {pitching?.bb_pct != null ? pitching.bb_pct.toFixed(1) + "%" : "–"}
                      </td>
                      <td className={`text-right py-1.5 px-1.5 tabular-nums ${tierColor(bb?.ev_tier)}`}>
                        {bb?.avg_exit_velo ?? "–"}
                      </td>
                      <td className={`text-right py-1.5 px-1.5 tabular-nums ${tierColor(bb?.barrel_tier)}`}>
                        {bb?.barrel_pct != null ? bb.barrel_pct.toFixed(1) : "–"}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 pl-1">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {renderActionMenu(player)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-2 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Heading>My Roster</Heading>
          {bulkStats.data?.season && (
            <Text className="text-xs">Stats: {bulkStats.data.season} season</Text>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            plain
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs"
          >
            {showAdvanced ? "Standard" : "Advanced"}
          </Button>
          <Button
            outline
            onClick={() => optimizeMutation.mutate()}
            disabled={optimizeMutation.isPending || roster.isLoading}
          >
            {optimizeMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" data-slot="icon" />
            ) : (
              <BoltIcon data-slot="icon" />
            )}
            Optimize
          </Button>
        </div>
      </div>

      {/* Roster Health */}
      {injuryReport.data && ((injuryReport.data.injured_active ?? []).length > 0 || (injuryReport.data.healthy_il ?? []).length > 0) && (
        <div className="rounded-lg border border-amber-500/20 dark:border-amber-500/10 bg-amber-50/50 dark:bg-amber-950/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Roster Health</span>
            <Badge color="amber" className="text-[10px]">
              {(injuryReport.data.injured_active ?? []).length} injured
            </Badge>
          </div>
          {(injuryReport.data.injured_active ?? []).length > 0 && (
            <div className="space-y-1">
              {injuryReport.data.injured_active.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar name={p.name || "?"} mlbId={p.mlb_id} size="sm" />
                    <span className="text-zinc-900 dark:text-zinc-100 font-medium">{p.name || "Unknown"}</span>
                  </div>
                  <Badge color="red" className="text-[10px]">{p.status || "Injured"}</Badge>
                </div>
              ))}
            </div>
          )}
          {(injuryReport.data.healthy_il ?? []).length > 0 && (
            <div className="space-y-1 pt-1 border-t border-amber-500/10">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Healthy on IL — activate</p>
              {injuryReport.data.healthy_il.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar name={p.name || "?"} mlbId={p.mlb_id} size="sm" />
                    <span className="text-zinc-900 dark:text-zinc-100 font-medium">{p.name || "Unknown"}</span>
                  </div>
                  <Badge color="green" className="text-[10px]">Ready</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roster Tables */}
      {roster.isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : roster.error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-50 dark:bg-red-950/20 p-4">
          <Text className="text-red-600 dark:text-red-400">Failed to load roster.</Text>
        </div>
      ) : (
        <>
          <BatterTable entries={batterSlots} label="Batters" />
          <PitcherTable entries={pitcherSlots} label="Pitchers" />
          {benchHitters.length > 0 && <BatterTable entries={benchHitters} label="Bench — Hitters" />}
          {benchPitchers.length > 0 && <PitcherTable entries={benchPitchers} label="Bench — Pitchers" />}
          {ilPlayers.length > 0 && (
            isPitcher(ilPlayers[0])
              ? <PitcherTable entries={ilPlayers} label="Injured List" />
              : <BatterTable entries={ilPlayers} label="Injured List" />
          )}
        </>
      )}

      {/* Position Swap Dialog */}
      <PositionSwapDialog
        player={swapDialogPlayer}
        open={!!swapDialogPlayer}
        onOpenChange={(v) => !v && setSwapDialogPlayer(null)}
        roster={roster.data ?? []}
        getPlayerInSlot={getPlayerInSlot}
        onMove={(playerId, position) => moveToPositionMutation.mutate({ playerId, position })}
        isPending={moveToPositionMutation.isPending}
      />

      {/* Player Detail Drawer */}
      {selectedPlayer && (
        <PlayerDrawer
          open={!!selectedPlayer}
          onOpenChange={(v) => !v && setSelectedPlayer(null)}
          name={selectedPlayer.name}
          team={selectedPlayer.team}
          position={selectedPlayer.position}
          mlbId={selectedPlayer.mlb_id}
          currentStats={getPlayerStats(selectedPlayer.mlb_id)}
          statcast={(selectedPlayer as any).intel?.statcast}
          eligiblePositions={selectedPlayer.eligible_positions}
          playerId={selectedPlayer.player_id}
          onDrop={() => { setSelectedPlayer(null); setDropTarget(selectedPlayer); }}
          onMoveToPosition={() => { setSelectedPlayer(null); setSwapDialogPlayer(selectedPlayer); }}
        />
      )}

      {/* Drop Confirmation */}
      <Dialog open={!!dropTarget} onClose={() => setDropTarget(null)} size="sm">
        <DialogTitle>Drop {dropTarget?.name}?</DialogTitle>
        <DialogDescription>This will permanently remove them from your roster.</DialogDescription>
        <DialogActions>
          <Button plain onClick={() => setDropTarget(null)}>Cancel</Button>
          <Button color="red" onClick={() => dropTarget && dropMutation.mutate(dropTarget.name)} disabled={dropMutation.isPending}>
            {dropMutation.isPending && <Loader2 className="size-4 animate-spin" data-slot="icon" />}
            Drop Player
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

// === POSITION SWAP DIALOG ===
interface PositionSwapDialogProps {
  player: RosterPlayer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster: RosterPlayer[];
  getPlayerInSlot: (slot: string) => RosterPlayer | undefined;
  onMove: (playerId: string | number, position: string) => void;
  isPending: boolean;
}

function PositionSwapDialog({ player, open, onOpenChange, roster: _roster, getPlayerInSlot, onMove, isPending }: PositionSwapDialogProps) {
  if (!player) return null;
  const isActive = BATTER_SLOT_ORDER.includes(player.slot) || PITCHER_SLOT_ORDER.includes(player.slot);
  const eligible = player.eligible_positions ?? [];
  const availableSlots = eligible.filter((pos) => pos !== player.slot);

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} size="md">
      <DialogTitle>{isActive ? "Move " : "Set Position — "}{player.name}</DialogTitle>
      <DialogDescription>{eligible.length > 0 && <span>Eligible: {eligible.join(", ")}</span>}</DialogDescription>
      <DialogBody>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {availableSlots.map((pos) => {
            const current = getPlayerInSlot(pos);
            return (
              <button key={pos}
                className="w-full flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                onClick={() => player.player_id && onMove(player.player_id, pos)} disabled={isPending}
              >
                <div className="flex items-center gap-2">
                  <Badge color="emerald" className="text-xs">{pos}</Badge>
                  {current ? <span className="text-sm text-zinc-500">swaps with {current.name}</span>
                    : <span className="text-sm text-green-600 dark:text-green-400">Empty</span>}
                </div>
                <ArrowRightLeft className="size-4 text-zinc-400" />
              </button>
            );
          })}
          {isActive && (
            <button
              className="w-full flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              onClick={() => player.player_id && onMove(player.player_id, "BN")} disabled={isPending}
            >
              <div className="flex items-center gap-2">
                <Badge color="zinc" className="text-xs">BN</Badge>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Move to Bench</span>
              </div>
              <ArrowDown className="size-4 text-zinc-400" />
            </button>
          )}
        </div>
        {isPending && (
          <div className="flex items-center gap-2 mt-3 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />Updating…</div>
        )}
      </DialogBody>
    </Dialog>
  );
}
