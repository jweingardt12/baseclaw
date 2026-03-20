import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from "@/catalyst/dialog";
import { Button } from "@/catalyst/button";
import { Badge } from "@/catalyst/badge";
import { Text } from "@/catalyst/text";
import { PlayerAvatar } from "@/components/player-avatar";

// Curated stat configs
const HITTER_STATS = [
  { key: "avg", label: "AVG", fmt: (v: any) => Number(v).toFixed(3) },
  { key: "homeRuns", label: "HR" },
  { key: "rbi", label: "RBI" },
  { key: "runs", label: "R" },
  { key: "stolenBases", label: "SB" },
  { key: "obp", label: "OBP", fmt: (v: any) => Number(v).toFixed(3) },
  { key: "slg", label: "SLG", fmt: (v: any) => Number(v).toFixed(3) },
  { key: "ops", label: "OPS", fmt: (v: any) => Number(v).toFixed(3) },
  { key: "hits", label: "H" },
  { key: "doubles", label: "2B" },
  { key: "baseOnBalls", label: "BB" },
  { key: "strikeOuts", label: "K" },
  { key: "gamesPlayed", label: "GP" },
  { key: "plateAppearances", label: "PA" },
];

const PITCHER_STATS = [
  { key: "era", label: "ERA", fmt: (v: any) => Number(v).toFixed(2) },
  { key: "whip", label: "WHIP", fmt: (v: any) => Number(v).toFixed(2) },
  { key: "wins", label: "W" },
  { key: "losses", label: "L" },
  { key: "strikeOuts", label: "K" },
  { key: "inningsPitched", label: "IP" },
  { key: "saves", label: "SV" },
  { key: "holds", label: "HLD" },
  { key: "qualityStarts", label: "QS" },
  { key: "gamesPlayed", label: "GP" },
];

function tierBadge(tier: string | undefined) {
  if (!tier) return null;
  const colors: Record<string, "green" | "amber" | "red" | "blue" | "zinc"> = {
    elite: "red", great: "red", strong: "green", above_average: "green", above: "green",
    average: "amber", below_average: "blue", below: "blue", poor: "blue",
  };
  const label = tier.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return <Badge color={colors[tier] || "zinc"} className="text-[10px] w-16 justify-center">{label}</Badge>;
}

interface PlayerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  team: string;
  position: string;
  mlbId?: number | string | null;
  currentStats?: Record<string, string | number>;
  statcast?: any;
  eligiblePositions?: string[];
  playerId?: number | string;
  onDrop?: () => void;
  onMoveToPosition?: () => void;
}

export function PlayerDrawer({
  open, onOpenChange, name, team, position, mlbId, currentStats, statcast,
  eligiblePositions, onDrop, onMoveToPosition,
}: PlayerDrawerProps) {
  const isPitcherPos = ["SP", "RP", "P"].some(p =>
    position?.includes(p) || (eligiblePositions ?? []).some(ep => ep === p)
  );

  // Fetch full intel report
  const intel = useQuery({
    queryKey: ["playerIntel", name],
    queryFn: () => fetch(`/dashboard/api/intel/player?name=${encodeURIComponent(name)}`).then(r => r.json()),
    enabled: open && !!name,
    staleTime: 600_000,
  });

  const statConfig = isPitcherPos ? PITCHER_STATS : HITTER_STATS;
  const displayStats = useMemo(() => {
    if (!currentStats) return [];
    return statConfig
      .filter(s => currentStats[s.key] !== undefined && currentStats[s.key] !== null)
      .map(s => ({ ...s, value: s.fmt ? s.fmt(currentStats[s.key]) : String(currentStats[s.key]) }));
  }, [currentStats, statConfig]);

  // Deduplicated eligible positions (remove position itself)
  const extraPositions = useMemo(() => {
    if (!eligiblePositions) return [];
    return eligiblePositions.filter(ep => ep !== position);
  }, [eligiblePositions, position]);

  const expected = statcast?.expected;
  const battedBall = statcast?.batted_ball;
  const discipline = intel.data?.discipline;
  const splits = intel.data?.splits;
  const context = intel.data?.context;
  const trends = intel.data?.trends;

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} size="lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-1">
        <PlayerAvatar name={name} mlbId={mlbId} size="lg" />
        <div>
          <DialogTitle className="!text-lg">{name}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 flex-wrap">
            <span>{position}</span>
            {team && <><span className="text-zinc-300 dark:text-zinc-600">·</span><span>{team}</span></>}
            {extraPositions.length > 0 && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                {extraPositions.map(ep => (
                  <Badge key={ep} color="zinc" className="text-[10px]">{ep}</Badge>
                ))}
              </>
            )}
          </DialogDescription>
        </div>
      </div>

      <DialogBody className="space-y-4">
        {/* Season Stats */}
        {displayStats.length > 0 && (
          <div>
            <SectionLabel>{statcast?.data_season || "2025"} Season</SectionLabel>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-px bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
              {displayStats.map((s) => (
                <div key={s.key} className="bg-white dark:bg-zinc-900 text-center py-2 px-1">
                  <p className="text-[10px] uppercase text-zinc-400 dark:text-zinc-500">{s.label}</p>
                  <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statcast */}
        {(expected || battedBall) && (
          <div>
            <SectionLabel>Statcast</SectionLabel>
            <div className="space-y-1">
              {expected?.xwoba != null && (
                <StatRow label="xwOBA" value={expected.xwoba.toFixed(3)} badge={tierBadge(expected.xwoba_tier)}
                  sub={expected.xwoba_pct != null ? `${expected.xwoba_pct}th percentile` : undefined} />
              )}
              {expected?.xba != null && (
                <StatRow label="xBA" value={expected.xba.toFixed(3)} sub={expected.xba_pct != null ? `${expected.xba_pct}th` : undefined} />
              )}
              {expected?.xslg != null && (
                <StatRow label="xSLG" value={expected.xslg.toFixed(3)} sub={expected.xslg_pct != null ? `${expected.xslg_pct}th` : undefined} />
              )}
              {expected?.xwoba_diff != null && Math.abs(expected.xwoba_diff) > 0.005 && (
                <StatRow label="Luck (wOBA − xwOBA)"
                  value={`${expected.xwoba_diff > 0 ? "+" : ""}${expected.xwoba_diff.toFixed(3)}`}
                  valueClass={expected.xwoba_diff > 0.015 ? "text-red-500" : expected.xwoba_diff < -0.015 ? "text-green-600" : undefined} />
              )}
              {battedBall?.avg_exit_velo != null && (
                <StatRow label="Exit Velocity" value={`${battedBall.avg_exit_velo} mph`} badge={tierBadge(battedBall.ev_tier)} />
              )}
              {battedBall?.barrel_pct != null && (
                <StatRow label="Barrel %" value={`${battedBall.barrel_pct.toFixed(1)}%`} badge={tierBadge(battedBall.barrel_tier)} />
              )}
              {battedBall?.max_exit_velo != null && (
                <StatRow label="Max EV" value={`${battedBall.max_exit_velo} mph`} />
              )}
            </div>
          </div>
        )}

        {/* Plate Discipline */}
        {discipline && typeof discipline === "object" && !Array.isArray(discipline) && (
          <div>
            <SectionLabel>Plate Discipline</SectionLabel>
            <div className="space-y-1">
              {discipline.k_rate != null && (
                <StatRow label="K%" value={`${(discipline.k_rate * 100).toFixed(1)}%`} />
              )}
              {discipline.bb_rate != null && (
                <StatRow label="BB%" value={`${(discipline.bb_rate * 100).toFixed(1)}%`} />
              )}
              {discipline.o_swing_pct != null && (
                <StatRow label="O-Swing%" value={`${(discipline.o_swing_pct * 100).toFixed(1)}%`} sub="chase rate" />
              )}
              {discipline.z_contact_pct != null && (
                <StatRow label="Z-Contact%" value={`${(discipline.z_contact_pct * 100).toFixed(1)}%`} sub="zone contact" />
              )}
              {discipline.swstr_pct != null && (
                <StatRow label="SwStr%" value={`${(discipline.swstr_pct * 100).toFixed(1)}%`} sub="swinging strike" />
              )}
            </div>
          </div>
        )}

        {/* Splits */}
        {splits && typeof splits === "object" && !Array.isArray(splits) && (splits.vs_LHP || splits.vs_RHP) && (
          <div>
            <SectionLabel>Splits</SectionLabel>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-zinc-400">
                    <th className="text-left py-1 pr-3"></th>
                    <th className="text-right py-1 px-2">AVG</th>
                    <th className="text-right py-1 px-2">OBP</th>
                    <th className="text-right py-1 px-2">SLG</th>
                    <th className="text-right py-1 px-2">OPS</th>
                    <th className="text-right py-1 px-2">PA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {splits.vs_LHP && (
                    <tr>
                      <td className="py-1.5 pr-3 text-xs text-zinc-500">vs LHP</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{splits.vs_LHP.avg?.toFixed(3) ?? "–"}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{splits.vs_LHP.obp?.toFixed(3) ?? "–"}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{splits.vs_LHP.slg?.toFixed(3) ?? "–"}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums font-medium">{splits.vs_LHP.ops?.toFixed(3) ?? "–"}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-zinc-400">{splits.vs_LHP.sample_pa ?? "–"}</td>
                    </tr>
                  )}
                  {splits.vs_RHP && (
                    <tr>
                      <td className="py-1.5 pr-3 text-xs text-zinc-500">vs RHP</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{splits.vs_RHP.avg?.toFixed(3) ?? "–"}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{splits.vs_RHP.obp?.toFixed(3) ?? "–"}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{splits.vs_RHP.slg?.toFixed(3) ?? "–"}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums font-medium">{splits.vs_RHP.ops?.toFixed(3) ?? "–"}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-zinc-400">{splits.vs_RHP.sample_pa ?? "–"}</td>
                    </tr>
                  )}
                  {splits.home && splits.away && (
                    <>
                      <tr>
                        <td className="py-1.5 pr-3 text-xs text-zinc-500">Home</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{splits.home.avg?.toFixed(3) ?? "–"}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{splits.home.obp?.toFixed(3) ?? "–"}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{splits.home.slg?.toFixed(3) ?? "–"}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums font-medium">{splits.home.ops?.toFixed(3) ?? "–"}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums text-zinc-400">{splits.home.sample_pa ?? "–"}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-3 text-xs text-zinc-500">Away</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{splits.away.avg?.toFixed(3) ?? "–"}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{splits.away.obp?.toFixed(3) ?? "–"}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums">{splits.away.slg?.toFixed(3) ?? "–"}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums font-medium">{splits.away.ops?.toFixed(3) ?? "–"}</td>
                        <td className="text-right py-1.5 px-2 tabular-nums text-zinc-400">{splits.away.sample_pa ?? "–"}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {splits.platoon_advantage && (
              <p className="text-xs text-zinc-500 mt-1">
                Platoon advantage: <span className="font-medium text-zinc-700 dark:text-zinc-300">{splits.platoon_advantage}</span>
                {splits.platoon_differential != null && (
                  <span> ({splits.platoon_differential > 0 ? "+" : ""}{(splits.platoon_differential * 1000).toFixed(0)} OPS pts)</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* News & Sentiment */}
        {context && typeof context === "object" && !Array.isArray(context) && (
          <div>
            <SectionLabel>News & Sentiment</SectionLabel>
            <div className="flex items-center gap-3 mb-2">
              {context.sentiment && (
                <Badge color={context.sentiment === "positive" ? "green" : context.sentiment === "negative" ? "red" : "zinc"} className="text-xs">
                  {context.sentiment}
                </Badge>
              )}
              {context.mentions != null && (
                <span className="text-xs text-zinc-500">{context.mentions} mentions</span>
              )}
              {context.avg_score != null && (
                <span className="text-xs text-zinc-500">avg score: {Number(context.avg_score).toFixed(0)}</span>
              )}
            </div>
            {context.headlines && Array.isArray(context.headlines) && context.headlines.length > 0 && (
              <ul className="space-y-1">
                {context.headlines.slice(0, 4).map((h: string, i: number) => (
                  <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5">
                    <span className="text-zinc-300 dark:text-zinc-600 mt-0.5">•</span>
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Trends */}
        {trends && typeof trends === "object" && !Array.isArray(trends) && trends.note && trends.note !== "No recent game log data available" && (
          <div>
            <SectionLabel>Trend</SectionLabel>
            <div className="flex items-center gap-2">
              <Badge color={trends.status === "hot" ? "red" : trends.status === "cold" ? "blue" : "zinc"} className="text-xs">
                {trends.status || "neutral"}
              </Badge>
              <Text className="text-sm">{trends.note}</Text>
            </div>
          </div>
        )}
      </DialogBody>

      <DialogActions>
        {onDrop && <Button color="red" onClick={onDrop}>Drop Player</Button>}
        {onMoveToPosition && <Button outline onClick={onMoveToPosition}>Move Position</Button>}
        <Button plain onClick={() => onOpenChange(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Helpers ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">{children}</h3>
  );
}

function StatRow({ label, value, badge, sub, valueClass }: {
  label: string; value: string; badge?: React.ReactNode; sub?: string; valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`tabular-nums text-sm font-medium ${valueClass || "text-zinc-900 dark:text-white"}`}>
          {value}
        </span>
        {sub && <span className="text-[11px] text-zinc-400">{sub}</span>}
        {badge}
      </div>
    </div>
  );
}
