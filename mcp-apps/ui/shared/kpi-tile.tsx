import { cn } from "../lib/utils";
import { TrendingUp, TrendingDown } from "@/shared/icons";

var COLOR_MAP: Record<string, string> = {
  success: "text-sem-success",
  risk: "text-sem-risk",
  warning: "text-sem-warning",
  info: "text-sem-info",
  primary: "text-primary",
  neutral: "text-sem-neutral",
};

var BORDER_MAP: Record<string, string> = {
  success: "border-t-[var(--sem-success)]",
  risk: "border-t-[var(--sem-risk)]",
  warning: "border-t-[var(--sem-warning)]",
  info: "border-t-[var(--sem-info)]",
  primary: "border-t-[var(--color-primary)]",
  neutral: "border-t-[var(--sem-neutral)]",
};

interface KpiTileProps {
  value: string | number;
  label: string;
  color?: "success" | "risk" | "warning" | "info" | "primary" | "neutral";
  trend?: { direction: "up" | "down"; delta: string };
  className?: string;
}

export function KpiTile({ value, label, color = "primary", trend, className }: KpiTileProps) {
  return (
    <div className={cn("rounded-md border bg-card p-3 text-center border-t-2", BORDER_MAP[color] || BORDER_MAP.primary, className)}>
      <div className={cn("text-hero font-mono", COLOR_MAP[color] || COLOR_MAP.primary)}>
        {value}
      </div>
      <div className="app-kicker mt-1">{label}</div>
      {trend && (
        <div className={cn("flex items-center justify-center gap-1 mt-1 text-xs", trend.direction === "up" ? "text-sem-success" : "text-sem-risk")}>
          {trend.direction === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trend.delta}</span>
        </div>
      )}
    </div>
  );
}
