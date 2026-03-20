import { Badge } from "../catalyst/badge";
import { cn } from "../lib/utils";

const POS_COLORS: Record<string, string> = {
  C: "bg-[#2563eb] text-white border-[#2563eb]",
  "1B": "bg-[#3b82f6] text-white border-[#3b82f6]",
  "2B": "bg-[#1d4ed8] text-white border-[#1d4ed8]",
  SS: "bg-[#1e40af] text-white border-[#1e40af]",
  "3B": "bg-[#60a5fa] text-white border-[#60a5fa]",
  OF: "bg-[#15803d] text-white border-[#15803d]",
  DH: "bg-[#5c7266] text-white border-[#5c7266]",
  UTIL: "bg-[#7d9b88] text-white border-[#7d9b88]",
  SP: "bg-[#c0392b] text-white border-[#c0392b]",
  RP: "bg-[#d4a017] text-white border-[#d4a017]",
  BN: "bg-muted text-muted-foreground",
  IL: "bg-destructive text-destructive-foreground border-destructive",
  "IL+": "bg-destructive text-destructive-foreground border-destructive",
};

interface PositionBadgeProps {
  position: string;
  className?: string;
}

export function PositionBadge({ position, className }: PositionBadgeProps) {
  const colorClass = POS_COLORS[position] || "";
  return (
    <Badge color="zinc" className={cn("text-xs px-1.5 rounded-sm font-mono uppercase", colorClass, className)}>
      {position}
    </Badge>
  );
}
