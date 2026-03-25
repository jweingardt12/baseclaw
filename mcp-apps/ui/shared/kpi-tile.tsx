import { StatCard } from "@/shared/stat-card";
import { cn } from "../lib/utils";

var COLOR_MAP: Record<string, "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "discovery" | "caution"> = {
  success: "success",
  risk: "danger",
  warning: "warning",
  info: "info",
  primary: "primary",
  neutral: "secondary",
};

interface KpiTileProps {
  value: string | number;
  label: string;
  color?: "success" | "risk" | "warning" | "info" | "primary" | "neutral";
  trend?: { direction: "up" | "down"; delta: string };
  className?: string;
}

export function KpiTile({ value, label, color = "primary", trend, className }: KpiTileProps) {
  var trendProp = trend
    ? { value: trend.direction === "up" ? 1 : -1, label: trend.delta }
    : undefined;

  return (
    <StatCard
      label={label}
      value={value}
      variant="accent"
      accentColor={COLOR_MAP[color] || "primary"}
      trend={trendProp}
      className={cn(className)}
    />
  );
}
