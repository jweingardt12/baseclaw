import { cn } from "../lib/utils";

var VARIANT_STYLES: Record<string, { bg: string; text: string }> = {
  success: { bg: "bg-sem-success-subtle", text: "text-sem-success" },
  warning: { bg: "bg-sem-warning-subtle", text: "text-sem-warning" },
  risk: { bg: "bg-sem-risk-subtle", text: "text-sem-risk" },
  info: { bg: "bg-sem-info-subtle", text: "text-sem-info" },
  neutral: { bg: "bg-sem-neutral-subtle", text: "text-sem-neutral" },
  gold: { bg: "bg-sem-info-subtle", text: "text-primary" },
};

var SIZE_MAP: Record<string, string> = {
  sm: "text-xs px-2 py-0.5 min-w-[32px]",
  md: "text-sm px-3 py-1 min-w-[44px]",
  lg: "text-lg px-4 py-1.5 min-w-[56px] font-black",
};

interface VerdictBadgeProps {
  grade: string;
  variant?: "success" | "warning" | "risk" | "info" | "neutral" | "gold";
  size?: "sm" | "md" | "lg";
  className?: string;
}

function gradeToVariant(grade: string): string {
  var g = grade.toUpperCase();
  if (g === "A+" || g === "A" || g === "ELITE" || g === "BUY") return "success";
  if (g === "B+" || g === "B" || g === "GOOD") return "info";
  if (g === "C+" || g === "C" || g === "HOLD" || g === "FAIR") return "warning";
  if (g === "D" || g === "F" || g === "SELL" || g === "BUST" || g === "POOR") return "risk";
  return "neutral";
}

export function VerdictBadge({ grade, variant, size = "md", className }: VerdictBadgeProps) {
  var v = variant || gradeToVariant(grade);
  var style = VARIANT_STYLES[v] || VARIANT_STYLES.neutral;

  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-full font-bold tracking-wide text-center",
      style.bg,
      style.text,
      SIZE_MAP[size] || SIZE_MAP.md,
      className,
    )}>
      {grade}
    </span>
  );
}
