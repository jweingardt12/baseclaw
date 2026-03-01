export interface PlayerIntel {
  statcast?: {
    barrel_pct_rank?: number | null;
    avg_exit_velo?: number | null;
    ev_pct_rank?: number | null;
    hard_hit_rate?: number | null;
    hh_pct_rank?: number | null;
    xwoba?: number | null;
    xwoba_pct_rank?: number | null;
    xba?: number | null;
    xba_pct_rank?: number | null;
    sprint_speed?: number | null;
    speed_pct_rank?: number | null;
    whiff_rate?: number | null;
    chase_rate?: number | null;
    quality_tier?: string | null;
  };
  trends?: {
    last_14_days?: Record<string, string | number>;
    last_30_days?: Record<string, string | number>;
    vs_last_year?: string;
    hot_cold?: string;
  };
  context?: {
    reddit_mentions?: number;
    reddit_sentiment?: string;
    recent_headlines?: string[];
  };
  discipline?: {
    bb_rate?: number | null;
    k_rate?: number | null;
    o_swing_pct?: number | null;
    z_contact_pct?: number | null;
    swstr_pct?: number | null;
  };
}

export function qualityColor(tier: string | null | undefined): string {
  if (!tier) return "bg-muted-foreground/30";
  if (tier === "elite") return "bg-sem-warning";
  if (tier === "strong") return "bg-sem-success";
  if (tier === "average") return "bg-sem-neutral";
  if (tier === "below") return "bg-sem-warning";
  if (tier === "poor") return "bg-sem-risk";
  return "bg-muted-foreground/30";
}

export function qualityTextColor(tier: string | null | undefined): string {
  if (!tier) return "text-muted-foreground";
  if (tier === "elite") return "text-sem-warning";
  if (tier === "strong") return "text-sem-success";
  if (tier === "average") return "text-sem-neutral";
  if (tier === "below") return "text-sem-warning";
  if (tier === "poor") return "text-sem-risk";
  return "text-muted-foreground";
}

export function hotColdIcon(status: string | null | undefined): string {
  if (!status) return "";
  if (status === "hot") return "\u{1F525}";
  if (status === "warm") return "\u2191";
  if (status === "neutral") return "";
  if (status === "cold") return "\u2744\uFE0F";
  if (status === "ice") return "\u2744\uFE0F\u2744\uFE0F";
  return "";
}

export function hotColdColor(status: string | null | undefined): string {
  if (!status) return "";
  if (status === "hot") return "text-red-500";
  if (status === "warm") return "text-orange-400";
  if (status === "neutral") return "text-muted-foreground";
  if (status === "cold") return "text-blue-400";
  if (status === "ice") return "text-blue-500";
  return "";
}

interface IntelBadgeProps {
  intel?: PlayerIntel | null;
  size?: "sm" | "md";
}

export function IntelBadge({ intel, size = "sm" }: IntelBadgeProps) {
  if (!intel) return null;

  const tier = intel.statcast?.quality_tier;
  const hotCold = intel.trends?.hot_cold;

  if (!tier && !hotCold) return null;

  const isSmall = size === "sm";
  const icon = hotColdIcon(hotCold);
  const iconColor = hotColdColor(hotCold);

  return (
    <span className="inline-flex items-center gap-0.5">
      {tier && (
        <span className={"inline-flex items-center rounded-sm font-semibold font-mono uppercase text-white " + qualityColor(tier) + " " + (isSmall ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1")}>
          {tier}
        </span>
      )}
      {icon && (
        <span className={iconColor + " " + (isSmall ? "text-xs" : "text-xs")}>
          {icon}
        </span>
      )}
    </span>
  );
}
