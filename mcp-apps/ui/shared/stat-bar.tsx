import { cn } from "../lib/utils";

interface StatBarProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  label?: string;
  variant?: "default" | "success" | "danger" | "warning";
}

const VARIANT_COLORS: Record<string, string> = {
  default: "bg-primary",
  success: "bg-sem-success",
  danger: "bg-sem-risk",
  warning: "bg-sem-warning",
};

export function StatBar({ value, max = 100, className, barClassName, showLabel, label, variant = "default" }: StatBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLabel && <span className="text-xs text-muted-foreground w-8 text-right">{label || Math.round(pct) + "%"}</span>}
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
        <div
          className={cn("h-full rounded-full transition-all animate-bar-fill", VARIANT_COLORS[variant] || VARIANT_COLORS.default, barClassName)}
          style={{ width: pct + "%" }}
        />
      </div>
    </div>
  );
}
