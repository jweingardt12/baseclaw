import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/catalyst/badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { TEAM_ABBREVS } from "@/lib/images";
import * as api from "@/lib/api";
import type { RosterPlayer, MlbScheduleGame } from "@/lib/api";

interface GamesStripProps {
  roster: RosterPlayer[];
}

function teamPlaying(playerTeam: string, games: MlbScheduleGame[]): MlbScheduleGame | null {
  const abbrev = playerTeam?.toUpperCase();
  for (const game of games) {
    const awayAbbrev = TEAM_ABBREVS[game.away] ?? "";
    const homeAbbrev = TEAM_ABBREVS[game.home] ?? "";
    if (awayAbbrev === abbrev || homeAbbrev === abbrev) return game;
  }
  return null;
}

export function GamesStrip({ roster }: GamesStripProps) {
  const schedule = useQuery({
    queryKey: ["mlbSchedule"],
    queryFn: () => api.getMlbSchedule(),
    staleTime: 300_000,
    refetchInterval: 300_000,
  });

  const playingToday = useMemo(() => {
    if (!schedule.data?.games) return [];
    return roster
      .filter((p) => !["BN", "NA", "IL", "IL+"].includes(p.slot || ""))
      .map((p) => ({ player: p, game: teamPlaying(p.team, schedule.data!.games) }))
      .filter((item) => item.game !== null);
  }, [roster, schedule.data]);

  if (schedule.isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 w-24 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!schedule.data?.games || schedule.data.games.length === 0) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">No games scheduled today</p>;
  }

  if (playingToday.length === 0) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">None of your starters play today</p>;
  }

  return (
    <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide">
      {playingToday.map(({ player, game }) => {
        const isHome = TEAM_ABBREVS[game!.home] === player.team?.toUpperCase();
        const opponent = isHome ? TEAM_ABBREVS[game!.away] : TEAM_ABBREVS[game!.home];
        return (
          <div
            key={player.name}
            className="flex-none snap-start w-28 rounded-lg border border-green-500/30 dark:border-green-500/20 bg-white dark:bg-zinc-900 p-2 text-center"
          >
            <PlayerAvatar name={player.name} mlbId={player.mlb_id} size="sm" className="mx-auto" />
            <p className="text-xs font-medium truncate mt-1 text-zinc-950 dark:text-white">
              {player.name.split(" ").pop()}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {isHome ? "vs" : "@"} {opponent || "?"}
            </p>
            <Badge color="emerald" className="text-[10px] mt-0.5">
              {game!.status === "Scheduled" ? "Today" : game!.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
