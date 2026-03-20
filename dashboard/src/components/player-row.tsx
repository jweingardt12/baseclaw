import { Badge } from "@/catalyst/badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";

const IL_SLOTS = ["IL", "IL+", "NA", "DL"];
const BENCH_SLOTS = ["BN"];

interface PlayerRowProps {
  name: string;
  position: string;
  slot: string;
  team: string;
  mlbId?: number | string | null;
  statLine?: string;
  eligiblePositions?: string[];
  actionMenu?: React.ReactNode;
  onClick?: () => void;
}

function slotColor(slot: string): "red" | "zinc" | "emerald" {
  if (IL_SLOTS.includes(slot)) return "red";
  if (BENCH_SLOTS.includes(slot)) return "zinc";
  return "emerald";
}

export function PlayerRow({
  name,
  position,
  slot,
  team,
  mlbId,
  statLine,
  eligiblePositions,
  actionMenu,
  onClick,
}: PlayerRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-zinc-950/5 dark:border-white/5 px-3 py-2.5 transition-colors",
        "hover:bg-zinc-950/[2.5%] dark:hover:bg-white/[2.5%]"
      )}
    >
      {/* Slot badge */}
      <Badge color={slotColor(slot)} className="w-10 justify-center text-xs font-bold shrink-0">
        {slot}
      </Badge>

      {/* Avatar */}
      <div className="cursor-pointer shrink-0" onClick={onClick}>
        <PlayerAvatar name={name} mlbId={mlbId} size="default" />
      </div>

      {/* Name + position */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm text-zinc-950 dark:text-white truncate">
            {name}
          </span>
          {team && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{team}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <Badge color="zinc" className="text-[10px] px-1 py-0">
            {position}
          </Badge>
          {eligiblePositions
            ?.filter((ep) => ep !== position && ep !== "Util" && ep !== "UTIL")
            .map((ep) => (
              <span key={ep} className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {ep}
              </span>
            ))}
        </div>
        {/* Stats on mobile */}
        {statLine && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums truncate sm:hidden">
            {statLine}
          </p>
        )}
      </div>

      {/* Stats on desktop */}
      {statLine && (
        <div className="hidden sm:block shrink-0 text-right">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
            {statLine}
          </p>
        </div>
      )}

      {/* Action menu */}
      {actionMenu && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {actionMenu}
        </div>
      )}
    </div>
  );
}

export function EmptySlotRow({ slot }: { slot: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2.5">
      <Badge color={slotColor(slot)} className="w-10 justify-center text-xs font-bold shrink-0">
        {slot}
      </Badge>
      <span className="text-sm text-zinc-400 dark:text-zinc-500 italic">Empty</span>
    </div>
  );
}
