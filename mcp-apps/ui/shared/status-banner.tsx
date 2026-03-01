import { cn } from "../lib/utils";

var VARIANT_ACCENT: Record<string, string> = {
  winning: "border-l-[var(--sem-success)]",
  losing: "border-l-[var(--sem-risk)]",
  tied: "border-l-[var(--sem-warning)]",
  alert: "border-l-[var(--sem-risk)]",
  info: "border-l-[var(--sem-info)]",
  success: "border-l-[var(--sem-success)]",
  gold: "border-l-[var(--color-primary)]",
  neutral: "border-l-[var(--sem-neutral)]",
};

interface StatusBannerProps {
  text: string;
  subtitle?: string;
  variant?: "winning" | "losing" | "tied" | "alert" | "info" | "success" | "gold" | "neutral";
  className?: string;
}

export function StatusBanner({ text, subtitle, variant = "info", className }: StatusBannerProps) {
  return (
    <div className={cn("border-l-4 py-2 px-3", VARIANT_ACCENT[variant] || VARIANT_ACCENT.info, className)}>
      <div className="text-lg font-semibold">{text}</div>
      {subtitle && <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>}
    </div>
  );
}
