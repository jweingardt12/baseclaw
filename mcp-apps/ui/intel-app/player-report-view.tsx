import { useState } from "react";
import { Card, CardContent } from "../catalyst/card";
import { IntelPanel } from "../shared/intel-panel";
import { IntelBadge, type PlayerIntel } from "../shared/intel-badge";
import { PlayerName } from "../shared/player-name";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { VerdictBadge } from "../shared/verdict-badge";
import { Button } from "../catalyst/button";
import { Copy, Check } from "@/shared/icons";
import { Subheading } from "../catalyst/heading";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";

// Data comes from /api/intel/player — it IS the PlayerIntel object with a name
interface PlayerReportData extends PlayerIntel {
  type: string;
  name: string;
  ai_recommendation?: string | null;
}

function tierVariant(tier: string): "success" | "info" | "warning" | "risk" | "neutral" {
  var t = (tier || "").toLowerCase();
  if (t === "elite" || t === "great") return "success";
  if (t === "good") return "info";
  if (t === "average" || t === "fair") return "warning";
  if (t === "poor" || t === "bad") return "risk";
  return "neutral";
}

export function PlayerReportView({ data, app, navigate }: { data: PlayerReportData; app: any; navigate: (data: any) => void }) {
  var copiedState = useState(false);
  var copied = copiedState[0];
  var setCopied = copiedState[1];

  var handleCopy = function () {
    var text = "Player Report: " + data.name;
    if (data.statcast && data.statcast.quality_tier) { text += " - " + data.statcast.quality_tier; }
    if (data.trends && data.trends.hot_cold) { text += " - " + data.trends.hot_cold; }
    navigator.clipboard.writeText(text).then(function () {
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 2000);
    });
  };

  var sc = data.statcast;
  var qualityTier = (sc && sc.quality_tier) || "Unknown";

  return (
    <div className="space-y-2">
      {/* Hero card */}
      <Card className="border-primary/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-2xl-app font-bold truncate">
                <PlayerName name={data.name} app={app} navigate={navigate} context="default" />
              </p>
              <div className="flex items-center gap-2 mt-1">
                <IntelBadge intel={data} size="md" />
                <Button plain className="h-8 w-8 p-0" onClick={handleCopy}>
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
            <VerdictBadge grade={qualityTier.toUpperCase()} variant={tierVariant(qualityTier)} size="lg" />
          </div>
        </CardContent>
      </Card>

      <AiInsight recommendation={data.ai_recommendation} />

      {/* Statcast KPI tiles */}
      {sc && (
        <div className="kpi-grid">
          {sc.xwoba != null && (
            <KpiTile
              value={sc.xwoba.toFixed(3)}
              label={"xwOBA" + (sc.xwoba_pct_rank != null ? " (" + sc.xwoba_pct_rank + "th)" : "")}
              color={sc.xwoba_pct_rank != null && sc.xwoba_pct_rank >= 80 ? "success" : sc.xwoba_pct_rank != null && sc.xwoba_pct_rank >= 50 ? "info" : "warning"}
            />
          )}
          {sc.avg_exit_velo != null && (
            <KpiTile
              value={sc.avg_exit_velo.toFixed(1)}
              label={"Exit Velo" + (sc.ev_pct_rank != null ? " (" + sc.ev_pct_rank + "th)" : "")}
              color={sc.ev_pct_rank != null && sc.ev_pct_rank >= 80 ? "success" : sc.ev_pct_rank != null && sc.ev_pct_rank >= 50 ? "info" : "warning"}
            />
          )}
          {sc.barrel_pct_rank != null && (
            <KpiTile
              value={sc.barrel_pct_rank + "th"}
              label="Barrel Rate"
              color={sc.barrel_pct_rank >= 80 ? "success" : sc.barrel_pct_rank >= 50 ? "info" : "warning"}
            />
          )}
          {sc.hard_hit_rate != null && (
            <KpiTile
              value={sc.hard_hit_rate.toFixed(1) + "%"}
              label={"Hard Hit" + (sc.hh_pct_rank != null ? " (" + sc.hh_pct_rank + "th)" : "")}
              color={sc.hh_pct_rank != null && sc.hh_pct_rank >= 80 ? "success" : sc.hh_pct_rank != null && sc.hh_pct_rank >= 50 ? "info" : "warning"}
            />
          )}
        </div>
      )}

      {/* Statcast Profile radar chart from percentile data */}
      {data.percentiles && data.percentiles.metrics && Object.keys(data.percentiles.metrics).length > 2 && (function () {
        var metrics = data.percentiles.metrics;
        var radarData = Object.entries(metrics).map(function (entry) {
          var key = entry[0];
          var val = entry[1];
          return {
            metric: key.replace(/_/g, " "),
            value: typeof val === "number" ? val : (val && (val as any).percentile ? (val as any).percentile : 0),
            fullMark: 100,
          };
        });
        return (
          <Card>
            <CardContent className="p-4">
              <Subheading className="mb-2">Statcast Profile</Subheading>
              <div className="h-48 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                    <Radar dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <IntelPanel intel={data} defaultExpanded />
    </div>
  );
}
