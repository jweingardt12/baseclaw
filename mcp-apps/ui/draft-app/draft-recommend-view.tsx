import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

import { AiInsight } from "../shared/ai-insight";
import { IntelBadge } from "../shared/intel-badge";
import { PlayerName } from "../shared/player-name";
import { formatFixed } from "../shared/number-format";
import { VerdictBadge } from "../shared/verdict-badge";
import { getTier, tierColor, tierGrade, ZScoreBar } from "../shared/z-score";

interface DraftRecommendation {
  name: string;
  position?: string;
  positions?: string[];
  z_score: number | null;
  pos_type?: string;
  mlb_id?: number;
  intel?: any;
}

interface DraftRecommendData {
  round: number;
  strategy?: string;
  recommendation?: string;
  hitters?: DraftRecommendation[];
  pitchers?: DraftRecommendation[];
  top_hitters?: DraftRecommendation[];
  top_pitchers?: DraftRecommendation[];
  hitters_count?: number;
  pitchers_count?: number;
  top_pick?: { name: string; type: string; z_score: number | null } | null;
  ai_recommendation?: string | null;
}

function PlayerList({ players, showTopHighlight, app, navigate }: { players: DraftRecommendation[]; showTopHighlight: boolean; app?: any; navigate?: (data: any) => void }) {
  var lastTier = "";

  return (
    <div className="space-y-0.5">
      {players.map(function (p, i) {
        var tier = getTier(p.z_score);
        var showDivider = i > 0 && tier !== lastTier;
        lastTier = tier;
        var posDisplay = p.positions ? p.positions.join(", ") : (p.position || "?");
        var isTop = i === 0 && showTopHighlight;

        return (
          <div key={p.name}>
            {showDivider && (
              <div className="flex items-center gap-2 py-1.5">
                <div className="flex-1 h-0.5 bg-primary/30" />
                <VerdictBadge grade={tierGrade(p.z_score)} size="sm" />
                <div className="flex-1 h-0.5 bg-primary/30" />
              </div>
            )}
            <div className={"flex items-center gap-2 py-1 px-1.5 rounded " + (isTop ? "bg-primary/10 border border-primary/30" : "")}>
              <span className={"text-sm flex-1 truncate " + (isTop ? "font-semibold" : "font-medium")}><PlayerName name={p.name} mlbId={p.mlb_id} app={app} navigate={navigate} context="draft" /></span>
              {p.intel && <IntelBadge intel={p.intel} size="sm" />}
              <Badge variant="outline" className="text-xs shrink-0">{posDisplay}</Badge>
              <ZScoreBar z={p.z_score} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DraftRecommendView({ data, app, navigate }: { data: DraftRecommendData; app?: any; navigate?: (data: any) => void }) {
  var strategy = data.recommendation || data.strategy || "";
  var hitters = data.top_hitters || data.hitters || [];
  var pitchers = data.top_pitchers || data.pitchers || [];
  var hittersFirst = strategy.toLowerCase().indexOf("hitter") >= 0;

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      {/* Hero card for top pick */}
      {data.top_pick && (
        <Card className="border-primary/40">
          <CardContent className="p-4 text-center">
            <p className="app-kicker mb-1">Top Pick - Round {data.round}</p>
            <p className="text-2xl-app font-bold">{data.top_pick.name}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">{data.top_pick.type}</Badge>
              {data.top_pick.z_score != null && (
                <VerdictBadge grade={formatFixed(data.top_pick.z_score, 1, "0.0")} variant={data.top_pick.z_score >= 2 ? "success" : data.top_pick.z_score >= 1 ? "info" : "warning"} size="lg" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Round {data.round} Recommendation</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{strategy}</p>
          {data.hitters_count != null && (
            <p className="text-xs text-muted-foreground mt-1">
              Roster: {data.hitters_count} hitters, {data.pitchers_count} pitchers
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            Top Hitters
            {hittersFirst && <Badge variant="default" className="text-xs">Recommended</Badge>}
          </h3>
          <PlayerList players={hitters.slice(0, 8)} showTopHighlight={hittersFirst} app={app} navigate={navigate} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            Top Pitchers
            {!hittersFirst && <Badge variant="default" className="text-xs">Recommended</Badge>}
          </h3>
          <PlayerList players={pitchers.slice(0, 8)} showTopHighlight={!hittersFirst} app={app} navigate={navigate} />
        </div>
      </div>
    </div>
  );
}
