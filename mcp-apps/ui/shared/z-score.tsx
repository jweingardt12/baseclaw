import { formatFixed } from "./number-format";

export function getTier(z: number | null): string {
  if (z == null) return "?";
  if (z >= 2.0) return "Elite";
  if (z >= 1.0) return "Strong";
  if (z >= 0) return "Solid";
  return "Below";
}

export function tierGrade(z: number | null): string {
  if (z == null) return "?";
  if (z >= 2.0) return "ELITE";
  if (z >= 1.0) return "GOOD";
  if (z >= 0) return "FAIR";
  return "POOR";
}

export function tierColor(z: number | null): string {
  if (z == null) return "bg-muted-foreground/30";
  if (z >= 2.0) return "bg-sem-warning";
  if (z >= 1.0) return "bg-sem-success";
  if (z >= 0) return "bg-sem-info";
  return "bg-sem-risk";
}

export function tierTextColor(z: number | null): string {
  if (z == null) return "text-muted-foreground";
  if (z >= 2.0) return "text-sem-warning";
  if (z >= 1.0) return "text-sem-success";
  if (z >= 0) return "text-sem-info";
  return "text-sem-risk";
}

export function ZScoreBar({ z }: { z: number | null }) {
  if (z == null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const pct = Math.max(0, Math.min(100, ((z + 1) / 5) * 100));
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-2 w-14 rounded-full overflow-hidden bg-muted">
        <div className={"rounded-full " + tierColor(z)} style={{ width: pct + "%" }} />
      </div>
      <span className="font-mono text-xs w-10 text-right">{formatFixed(z, 2, "0.00")}</span>
    </div>
  );
}

export function ZScoreBadge({ z, size }: { z: number | null; size?: "sm" | "md" }) {
  if (z == null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const isSmall = size === "sm";
  return (
    <span className={"inline-flex items-center gap-1 rounded-sm font-mono uppercase " + tierColor(z) + " text-white " + (isSmall ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs")}>
      <span className="font-medium">{getTier(z)}</span>
      <span>{formatFixed(z, 2, "0.00")}</span>
    </span>
  );
}

export function ZScoreExplainer() {
  return (
    <p className="text-xs text-muted-foreground">
      Z-Score: standard deviations above league average. Higher = better.
    </p>
  );
}
