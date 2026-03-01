import { useState } from "react";
import { ChevronRight } from "@/shared/icons";
import { StatBar } from "./stat-bar";
import { type PlayerIntel, qualityColor, hotColdIcon, hotColdColor } from "./intel-badge";

interface IntelPanelProps {
  intel: PlayerIntel;
  defaultExpanded?: boolean;
}

function rankBarClass(rank: number | null | undefined): string {
  if (rank == null) return "bg-muted-foreground/30";
  if (rank >= 90) return "bg-green-500";
  if (rank >= 70) return "bg-blue-500";
  if (rank >= 40) return "bg-slate-400";
  if (rank >= 20) return "bg-orange-500";
  return "bg-red-500";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function PercentileRow({ label, value, rank, invert }: { label: string; value: string; rank: number | null | undefined; invert?: boolean }) {
  if (rank == null) return null;
  const displayRank = invert ? (100 - rank) : rank;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1">
        <StatBar value={displayRank} max={100} barClassName={rankBarClass(displayRank)} />
      </div>
      <span className="text-xs font-mono w-16 text-right shrink-0">{value}</span>
      <span className={"text-xs font-mono w-12 text-right shrink-0 " + (rankBarClass(displayRank).replace("bg-", "text-").replace("-500", "-600").replace("-400", "-500"))}>
        {"(" + ordinal(Math.round(rank)) + ")"}
      </span>
    </div>
  );
}

function StatcastSection({ statcast }: { statcast: NonNullable<PlayerIntel["statcast"]> }) {
  const hasBatterMetrics = statcast.barrel_pct_rank != null || statcast.ev_pct_rank != null || statcast.hh_pct_rank != null;
  const hasPitcherMetrics = statcast.whiff_rate != null || statcast.chase_rate != null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Statcast</h4>
      {hasBatterMetrics && (
        <div className="space-y-1">
          <PercentileRow
            label="Barrel Rate"
            value={(statcast.barrel_pct_rank != null ? (statcast.barrel_pct_rank + "%") : "—")}
            rank={statcast.barrel_pct_rank}
          />
          <PercentileRow
            label="Exit Velocity"
            value={statcast.avg_exit_velo != null ? String(statcast.avg_exit_velo) : "—"}
            rank={statcast.ev_pct_rank}
          />
          <PercentileRow
            label="Hard Hit %"
            value={statcast.hard_hit_rate != null ? (statcast.hard_hit_rate + "%") : "—"}
            rank={statcast.hh_pct_rank}
          />
          <PercentileRow
            label="xwOBA"
            value={statcast.xwoba != null ? String(statcast.xwoba) : "—"}
            rank={statcast.xwoba_pct_rank}
          />
          <PercentileRow
            label="xBA"
            value={statcast.xba != null ? String(statcast.xba) : "—"}
            rank={statcast.xba_pct_rank}
          />
          <PercentileRow
            label="Sprint Speed"
            value={statcast.sprint_speed != null ? String(statcast.sprint_speed) : "—"}
            rank={statcast.speed_pct_rank}
          />
        </div>
      )}
      {hasPitcherMetrics && (
        <div className="space-y-1">
          <PercentileRow
            label="Whiff Rate"
            value={statcast.whiff_rate != null ? (statcast.whiff_rate + "%") : "—"}
            rank={statcast.whiff_rate != null ? Math.round(statcast.whiff_rate * 2.5) : null}
          />
          <PercentileRow
            label="Chase Rate"
            value={statcast.chase_rate != null ? (statcast.chase_rate + "%") : "—"}
            rank={statcast.chase_rate != null ? Math.round(statcast.chase_rate * 2.5) : null}
          />
          <PercentileRow
            label="xwOBA Against"
            value={statcast.xwoba != null ? String(statcast.xwoba) : "—"}
            rank={statcast.xwoba_pct_rank}
            invert
          />
          <PercentileRow
            label="Avg Exit Velo"
            value={statcast.avg_exit_velo != null ? String(statcast.avg_exit_velo) : "—"}
            rank={statcast.ev_pct_rank}
            invert
          />
        </div>
      )}
    </div>
  );
}

function TrendsSection({ trends }: { trends: NonNullable<PlayerIntel["trends"]> }) {
  const last14 = trends.last_14_days;
  const last30 = trends.last_30_days;

  if (!last14 && !last30) return null;

  const statKeys: string[] = [];
  if (last14) {
    Object.keys(last14).forEach(function (k) {
      if (statKeys.indexOf(k) === -1) statKeys.push(k);
    });
  }
  if (last30) {
    Object.keys(last30).forEach(function (k) {
      if (statKeys.indexOf(k) === -1) statKeys.push(k);
    });
  }

  const icon = hotColdIcon(trends.hot_cold);
  const iconColor = hotColdColor(trends.hot_cold);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Trends</h4>
        {icon && <span className={iconColor + " text-xs"}>{icon}</span>}
        {trends.hot_cold && trends.hot_cold !== "neutral" && (
          <span className={iconColor + " text-xs font-medium"}>{trends.hot_cold}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground font-medium py-1 pr-4"></th>
              {last14 && <th className="text-right text-xs text-muted-foreground font-medium py-1 px-2">14-Day</th>}
              {last30 && <th className="text-right text-xs text-muted-foreground font-medium py-1 px-2">30-Day</th>}
            </tr>
          </thead>
          <tbody>
            {statKeys.map(function (key) {
              return (
                <tr key={key} className="border-b border-border/50">
                  <td className="text-xs text-muted-foreground font-medium py-0.5 pr-4">{key}</td>
                  {last14 && <td className="text-right font-mono py-0.5 px-2">{last14[key] != null ? String(last14[key]) : "—"}</td>}
                  {last30 && <td className="text-right font-mono py-0.5 px-2">{last30[key] != null ? String(last30[key]) : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {trends.vs_last_year && (
        <p className="text-xs text-muted-foreground">{"vs. Last Year: " + trends.vs_last_year}</p>
      )}
    </div>
  );
}

function DisciplineSection({ discipline }: { discipline: NonNullable<PlayerIntel["discipline"]> }) {
  const hasData = discipline.bb_rate != null || discipline.k_rate != null || discipline.o_swing_pct != null || discipline.z_contact_pct != null || discipline.swstr_pct != null;
  if (!hasData) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Plate Discipline</h4>
      <div className="space-y-1">
        {discipline.bb_rate != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">BB%</span>
            <div className="flex-1">
              <StatBar value={discipline.bb_rate} max={25} barClassName={discipline.bb_rate >= 12 ? "bg-green-500" : discipline.bb_rate >= 8 ? "bg-blue-500" : "bg-slate-400"} />
            </div>
            <span className="text-xs font-mono w-14 text-right shrink-0">{discipline.bb_rate + "%"}</span>
          </div>
        )}
        {discipline.k_rate != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">K%</span>
            <div className="flex-1">
              <StatBar value={discipline.k_rate} max={40} barClassName={discipline.k_rate <= 15 ? "bg-green-500" : discipline.k_rate <= 22 ? "bg-blue-500" : discipline.k_rate <= 28 ? "bg-orange-500" : "bg-red-500"} />
            </div>
            <span className="text-xs font-mono w-14 text-right shrink-0">{discipline.k_rate + "%"}</span>
          </div>
        )}
        {discipline.o_swing_pct != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">O-Swing%</span>
            <div className="flex-1">
              <StatBar value={discipline.o_swing_pct} max={50} barClassName={discipline.o_swing_pct <= 25 ? "bg-green-500" : discipline.o_swing_pct <= 32 ? "bg-blue-500" : "bg-orange-500"} />
            </div>
            <span className="text-xs font-mono w-14 text-right shrink-0">{discipline.o_swing_pct + "%"}</span>
          </div>
        )}
        {discipline.z_contact_pct != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">Z-Contact</span>
            <div className="flex-1">
              <StatBar value={discipline.z_contact_pct} max={100} barClassName={discipline.z_contact_pct >= 85 ? "bg-green-500" : discipline.z_contact_pct >= 78 ? "bg-blue-500" : "bg-orange-500"} />
            </div>
            <span className="text-xs font-mono w-14 text-right shrink-0">{discipline.z_contact_pct + "%"}</span>
          </div>
        )}
        {discipline.swstr_pct != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">SwStr%</span>
            <div className="flex-1">
              <StatBar value={discipline.swstr_pct} max={20} barClassName={discipline.swstr_pct <= 8 ? "bg-green-500" : discipline.swstr_pct <= 12 ? "bg-blue-500" : "bg-red-500"} />
            </div>
            <span className="text-xs font-mono w-14 text-right shrink-0">{discipline.swstr_pct + "%"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ContextSection({ context }: { context: NonNullable<PlayerIntel["context"]> }) {
  const hasData = (context.reddit_mentions != null && context.reddit_mentions > 0) || (context.recent_headlines && context.recent_headlines.length > 0);
  if (!hasData) return null;

  let sentimentColor = "text-muted-foreground";
  if (context.reddit_sentiment === "positive") sentimentColor = "text-green-600 dark:text-green-400";
  else if (context.reddit_sentiment === "negative") sentimentColor = "text-red-500";

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Reddit Buzz</h4>
      {context.reddit_mentions != null && context.reddit_mentions > 0 && (
        <p className="text-xs">
          <span>{"\u{1F4E3} " + context.reddit_mentions + " mention" + (context.reddit_mentions !== 1 ? "s" : "")}</span>
          {context.reddit_sentiment && (
            <span className={sentimentColor + " ml-1"}>{"(" + context.reddit_sentiment + ")"}</span>
          )}
        </p>
      )}
      {context.recent_headlines && context.recent_headlines.length > 0 && (
        <ul className="space-y-0.5">
          {context.recent_headlines.map(function (headline, i) {
            return (
              <li key={i} className="text-xs text-muted-foreground">
                {"\u2022 " + headline}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function IntelPanel({ intel, defaultExpanded = false }: IntelPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasStatcast = intel.statcast && (
    intel.statcast.barrel_pct_rank != null ||
    intel.statcast.ev_pct_rank != null ||
    intel.statcast.whiff_rate != null ||
    intel.statcast.xwoba_pct_rank != null
  );
  const hasTrends = intel.trends && (intel.trends.last_14_days || intel.trends.last_30_days);
  const hasDiscipline = intel.discipline && (
    intel.discipline.bb_rate != null ||
    intel.discipline.k_rate != null ||
    intel.discipline.o_swing_pct != null
  );
  const hasContext = intel.context && (
    (intel.context.reddit_mentions != null && intel.context.reddit_mentions > 0) ||
    (intel.context.recent_headlines && intel.context.recent_headlines.length > 0)
  );

  const hasAnyData = hasStatcast || hasTrends || hasDiscipline || hasContext;
  if (!hasAnyData) return null;

  const tier = intel.statcast?.quality_tier;

  return (
    <div className="transition-all duration-200 overflow-hidden">
      <button
        type="button"
        onClick={function () { setExpanded(!expanded); }}
        className={"w-full flex items-center gap-2 py-1 px-2 rounded-sm text-left hover:bg-muted/50 transition-colors border bg-card " + (expanded ? "bg-muted/30" : "")}
      >
        <ChevronRight className={"h-3 w-3 transition-transform " + (expanded ? "rotate-90" : "")} />
        <span className="text-xs text-muted-foreground font-medium">Intel</span>
        {tier && (
          <span className={"inline-flex items-center rounded-sm text-xs font-semibold font-mono uppercase text-white px-1.5 py-0.5 " + qualityColor(tier)}>
            {tier}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-2 pb-3 pt-2 space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasStatcast && (
              <div>
                <StatcastSection statcast={intel.statcast!} />
              </div>
            )}
            {hasDiscipline && (
              <div>
                <DisciplineSection discipline={intel.discipline!} />
              </div>
            )}
          </div>
          {hasTrends && <TrendsSection trends={intel.trends!} />}
          {hasContext && <ContextSection context={intel.context!} />}
        </div>
      )}
    </div>
  );
}
