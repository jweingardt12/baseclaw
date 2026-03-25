import { Badge } from "@/components/ui/badge";
import { cn } from "../lib/utils";

const POS_COLORS: Record<string, string> = {
  C: "bg-[#059669] text-white border-[#059669]",
  "1B": "bg-[#10b981] text-white border-[#10b981]",
  "2B": "bg-[#047857] text-white border-[#047857]",
  SS: "bg-[#065f46] text-white border-[#065f46]",
  "3B": "bg-[#34d399] text-white border-[#34d399]",
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
    <Badge variant="secondary" className={cn("px-1.5 rounded-sm font-mono uppercase", colorClass, className)}>
      {position}
    </Badge>
  );
}
