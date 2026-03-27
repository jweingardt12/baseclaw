import { Card, CardContent } from "../components/card";
import { IntelPanel } from "../shared/intel-panel";
import { IntelBadge, type PlayerIntel } from "../shared/intel-badge";
import { PlayerName } from "../shared/player-name";
import { KpiTile } from "../shared/kpi-tile";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "../components/heading";

interface PlayerReportData extends PlayerIntel {
  type: string;
  name: string;
  mlb_id?: number;
  ai_recommendation?: string | null;
  yahoo_stats?: Record<string, unknown>;
  yahoo_player_id?: string;
}

function tierVariant(tier: string): "success" | "info" | "warning" | "risk" | "neutral" {
  var t = (tier || "").toLowerCase();
  if (t === "elite" || t === "great") return "success";
  if (t === "good") return "info";
  if (t === "average" || t === "fair") return "warning";
  if (t === "poor" || t === "bad") return "risk";
  return "neutral";
}

function tierColor(tier: string): "success" | "risk" | "warning" | "info" | "neutral" {
  var t = (tier || "").toLowerCase();
  if (t === "elite" || t === "great" || t === "excellent") return "success";
  if (t === "good" || t === "above average") return "info";
  if (t === "average" || t === "below average") return "warning";
  if (t === "poor" || t === "bad") return "risk";
  return "neutral";
}

function pctColor(pct: number | null | undefined): "success" | "risk" | "warning" | "info" | "neutral" {
  if (pct == null) return "neutral";
  if (pct >= 80) return "success";
  if (pct >= 50) return "info";
  if (pct >= 25) return "warning";
  return "risk";
}

function num(v: unknown, decimals: number = 0): string {
  if (v == null || v === "" || v === "-") return "—";
  var n = Number(v);
  if (isNaN(n)) return String(v);
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-sm font-mono font-semibold">{value}</span>
        {sub && <span className="text-xs text-muted-foreground ml-1">{sub}</span>}
      </div>
    </div>
  );
}

export function PlayerReportView({ data, app, navigate }: { data: PlayerReportData; app: any; navigate: (data: any) => void }) {
  var sc = data.statcast || {} as any;
  var trends = data.trends || {} as any;
  var splits = trends.splits || {};
  var ys = data.yahoo_stats || {};
  var isPitcher = sc.player_type === "pitcher" || trends.player_type === "pitcher";
  var yahooTrend = data.yahoo_trend || {} as any;

  var qualityTier = sc.quality_tier || (sc.expected || {}).quality_tier;
  var trendStatus = trends.status || trends.hot_cold;

  return (
    <div className="space-y-2">
      {/* Hero */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold truncate">
                <PlayerName name={data.name} mlbId={data.mlb_id} app={app} navigate={navigate} showHeadshot />
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <IntelBadge intel={data} size="sm" />
                {trendStatus && (
                  <Badge className={trendStatus === "hot" ? "bg-sem-success" : trendStatus === "cold" ? "bg-sem-risk" : "bg-sem-neutral"}>
                    {trendStatus}
                  </Badge>
                )}
                {yahooTrend.direction && (
                  <Badge variant="secondary">{yahooTrend.direction === "added" ? "↑ Rising" : "↓ Falling"}</Badge>
                )}
              </div>
            </div>
            {qualityTier && (
              <div className={"flex flex-col items-center justify-center rounded-lg px-3 py-2 text-center " +
                (tierVariant(qualityTier) === "success" ? "bg-sem-success-subtle" :
                 tierVariant(qualityTier) === "info" ? "bg-sem-info-subtle" :
                 tierVariant(qualityTier) === "warning" ? "bg-sem-warning-subtle" :
                 tierVariant(qualityTier) === "risk" ? "bg-sem-risk-subtle" : "bg-muted")}>
                <span className="text-xs text-muted-foreground">Tier</span>
                <span className="text-sm font-bold">{qualityTier}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Season Stats */}
      {Object.keys(ys).length > 0 && (
        <Card>
          <CardContent className="p-3">
            <Subheading className="mb-1">Season Stats</Subheading>
            {isPitcher ? (
              <div className="grid grid-cols-2 gap-x-4">
                <StatRow label="ERA" value={num(ys.ERA, 2)} />
                <StatRow label="WHIP" value={num(ys.WHIP, 2)} />
                <StatRow label="W" value={num(ys.W)} />
                <StatRow label="K" value={num(ys.K)} />
                <StatRow label="IP" value={num(ys.IP, 1)} />
                <StatRow label="QS" value={num(ys.QS)} />
                <StatRow label="HLD" value={num(ys.HLD)} />
                <StatRow label="NSV" value={num(ys.NSV)} />
                <StatRow label="L" value={num(ys.L)} />
                <StatRow label="ER" value={num(ys.ER)} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4">
                <StatRow label="AVG" value={num(ys.AVG, 3)} />
                <StatRow label="OBP" value={num(ys.OBP, 3)} />
                <StatRow label="HR" value={num(ys.HR)} />
                <StatRow label="RBI" value={num(ys.RBI)} />
                <StatRow label="R" value={num(ys.R)} />
                <StatRow label="H" value={num(ys.H)} sub={ys["H/AB"] ? String(ys["H/AB"]) : undefined} />
                <StatRow label="TB" value={num(ys.TB)} />
                <StatRow label="XBH" value={num(ys.XBH)} />
                <StatRow label="NSB" value={num(ys.NSB)} />
                <StatRow label="K" value={num(ys.K)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Advanced Metrics */}
      {sc && (isPitcher ? (
        <div className="kpi-grid">
          {(sc.era_analysis || {}).era != null && (
            <KpiTile value={num((sc.era_analysis || {}).era, 2)} label="ERA" color={Number((sc.era_analysis || {}).era) < 3.5 ? "success" : Number((sc.era_analysis || {}).era) < 4.5 ? "warning" : "risk"} />
          )}
          {(sc.era_analysis || {}).fip != null && (
            <KpiTile value={num((sc.era_analysis || {}).fip, 2)} label="FIP" color={Number((sc.era_analysis || {}).fip) < 3.5 ? "success" : Number((sc.era_analysis || {}).fip) < 4.5 ? "warning" : "risk"} />
          )}
          {(sc.era_analysis || {}).xera != null && (
            <KpiTile value={num((sc.era_analysis || {}).xera, 2)} label="xERA" color={Number((sc.era_analysis || {}).xera) < 3.5 ? "success" : Number((sc.era_analysis || {}).xera) < 4.5 ? "warning" : "risk"} />
          )}
          {(sc.stuff_metrics || {}).stuff_plus != null && (
            <KpiTile value={num((sc.stuff_metrics || {}).stuff_plus)} label="Stuff+" color={Number((sc.stuff_metrics || {}).stuff_plus) > 110 ? "success" : Number((sc.stuff_metrics || {}).stuff_plus) > 95 ? "info" : "warning"} />
          )}
        </div>
      ) : (
        <div className="kpi-grid">
          {(sc.expected || {}).xba != null && (
            <KpiTile value={num((sc.expected || {}).xba, 3)} label={"xBA" + ((sc.expected || {}).xba_pct != null ? " (" + num((sc.expected || {}).xba_pct) + "th)" : "")} color={pctColor((sc.expected || {}).xba_pct)} />
          )}
          {(sc.expected || {}).xslg != null && (
            <KpiTile value={num((sc.expected || {}).xslg, 3)} label="xSLG" color={pctColor((sc.expected || {}).xslg_pct)} />
          )}
          {(sc.batted_ball || {}).barrel_pct != null && (
            <KpiTile value={num((sc.batted_ball || {}).barrel_pct, 1) + "%"} label={"Barrel%" + ((sc.batted_ball || {}).barrel_pct_rank != null ? " (" + num((sc.batted_ball || {}).barrel_pct_rank) + "th)" : "")} color={pctColor((sc.batted_ball || {}).barrel_pct_rank)} />
          )}
          {(sc.batted_ball || {}).avg_exit_velo != null && (
            <KpiTile value={num((sc.batted_ball || {}).avg_exit_velo, 1)} label={"Exit Velo" + ((sc.batted_ball || {}).ev_pct != null ? " (" + num((sc.batted_ball || {}).ev_pct) + "th)" : "")} color={pctColor((sc.batted_ball || {}).ev_pct)} />
          )}
        </div>
      ))}

      {/* Recent Trends */}
      {splits && Object.keys(splits).length > 0 && (
        <Card>
          <CardContent className="p-3">
            <Subheading className="mb-1">Recent Trends</Subheading>
            {isPitcher ? (
              <div className="grid grid-cols-2 gap-x-4">
                {splits.era_14d != null && <StatRow label="14d ERA" value={num(splits.era_14d, 2)} />}
                {splits.era_30d != null && <StatRow label="30d ERA" value={num(splits.era_30d, 2)} />}
                {splits.k_14d != null && <StatRow label="14d K" value={num(splits.k_14d)} />}
                {splits.k_30d != null && <StatRow label="30d K" value={num(splits.k_30d)} />}
                {splits.whip_14d != null && <StatRow label="14d WHIP" value={num(splits.whip_14d, 2)} />}
                {splits.ip_14d != null && <StatRow label="14d IP" value={num(splits.ip_14d, 1)} />}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4">
                {splits.avg_14d != null && <StatRow label="14d AVG" value={num(splits.avg_14d, 3)} />}
                {splits.avg_30d != null && <StatRow label="30d AVG" value={num(splits.avg_30d, 3)} />}
                {splits.ops_14d != null && <StatRow label="14d OPS" value={num(splits.ops_14d, 3)} />}
                {splits.ops_30d != null && <StatRow label="30d OPS" value={num(splits.ops_30d, 3)} />}
                {splits.hr_14d != null && <StatRow label="14d HR" value={num(splits.hr_14d)} />}
                {splits.rbi_14d != null && <StatRow label="14d RBI" value={num(splits.rbi_14d)} />}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Full Intel Panel (Statcast breakdown, percentiles, etc) */}
      <IntelPanel intel={data} defaultExpanded />
    </div>
  );
}
