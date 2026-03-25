import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { mlbHeadshotUrl } from "./mlb-images";
import { ZScoreBadge } from "./z-score";

interface PlayerCardProps {
  name: string;
  position?: string;
  positions?: string[] | string;
  status?: string;
  team?: string;
  playerId?: string;
  mlbId?: number;
  percentOwned?: number;
  zScore?: number;
  compact?: boolean;
}

export function PlayerCard({ name, position, positions, status, team, mlbId, percentOwned, zScore, compact }: PlayerCardProps) {
  const posArray = Array.isArray(positions) ? positions : positions ? positions.split(",") : position ? [position] : [];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {mlbId && <Avatar><AvatarImage src={mlbHeadshotUrl(mlbId)} /><AvatarFallback>{name.charAt(0)}</AvatarFallback></Avatar>}
        <span className="font-medium">{name}</span>
        {posArray.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
        {status && status !== "Healthy" && <Badge variant="destructive">{status}</Badge>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2">
      {mlbId && <Avatar size="lg"><AvatarImage src={mlbHeadshotUrl(mlbId)} /><AvatarFallback>{name.charAt(0)}</AvatarFallback></Avatar>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{name}</span>
          {team && <span className="text-xs text-muted-foreground">{team}</span>}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {posArray.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
          {status && status !== "Healthy" && <Badge variant="destructive">{status}</Badge>}
          {percentOwned !== undefined && <span className="text-xs text-muted-foreground ml-1">{percentOwned}% owned</span>}
          {zScore !== undefined && <ZScoreBadge z={zScore} size="sm" />}
        </div>
      </div>
    </div>
  );
}
