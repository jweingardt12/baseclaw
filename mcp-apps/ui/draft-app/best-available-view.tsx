import { useState } from "react";
import { Badge } from "../catalyst/badge";
import { Card, CardContent } from "../catalyst/card";
import { Subheading } from "../catalyst/heading";
import { Tabs, TabsList, TabsTrigger } from "../catalyst/tabs";
import { useCallTool } from "../shared/use-call-tool";

import { getTier, tierGrade, ZScoreBar } from "../shared/z-score";
import { PlayerCell } from "../shared/player-row";
import { VerdictBadge } from "../shared/verdict-badge";
import { formatFixed } from "../shared/number-format";
import { Loader2 } from "@/shared/icons";

interface BestAvailablePlayer {
  rank: number;
  name: string;
  position?: string;
  positions?: string[];
  z_score: number | null;
  mlb_id?: number;
  intel?: any;
}

interface BestAvailableData {
  pos_type: string;
  count?: number;
  players: BestAvailablePlayer[];
  ai_recommendation?: string | null;
}

var POSITION_FILTERS = ["All", "C", "1B", "2B", "SS", "3B", "OF", "SP", "RP"];

export function BestAvailableView({ data, app, navigate }: { data: BestAvailableData; app?: any; navigate?: (data: any) => void }) {
  var callToolResult = useCallTool(app);
  var callTool = callToolResult.callTool;
  var loading = callToolResult.loading;
  var posFilterState = useState("All");
  var posFilter = posFilterState[0];
  var setPosFilter = posFilterState[1];
  var label = data.pos_type === "P" ? "Pitchers" : "Hitters";

  var handleTypeChange = async function (value: string) {
    var result = await callTool("yahoo_best_available", { pos_type: value, count: 25 });
    if (result && result.structuredContent && navigate) {
      navigate(result.structuredContent);
    }
  };

  var filteredPlayers = posFilter === "All"
    ? (data.players || [])
    : (data.players || []).filter(function (p) {
        var positions = p.positions || (p.position ? p.position.split(",") : []);
        return positions.some(function (pos: string) { return pos.trim() === posFilter; });
      });

  var topPlayer = filteredPlayers.length > 0 ? filteredPlayers[0] : null;
  var lastTier = "";

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Subheading>Best Available {label}</Subheading>
        <span className="text-xs text-muted-foreground">Top {data.count || filteredPlayers.length}</span>
      </div>

      {app && (
        <Tabs defaultValue={data.pos_type || "B"} onValueChange={handleTypeChange} className="mb-2">
          <TabsList>
            <TabsTrigger value="B">Hitters</TabsTrigger>
            <TabsTrigger value="P">Pitchers</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="flex gap-1 flex-wrap mb-2">
        {POSITION_FILTERS.map(function (pos) {
          return (
            <Badge
              key={pos}
              color={posFilter === pos ? undefined : "zinc"}
              className="text-xs cursor-pointer"
              onClick={function () { setPosFilter(pos); }}
            >
              {pos}
            </Badge>
          );
        })}
      </div>

      {/* Hero top pick */}
      {topPlayer && (
        <Card className="mb-2 border-primary/40">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground w-6 text-right">#1</span>
            <div className="flex-1 min-w-0">
              <p className="text-xl-app font-bold truncate"><PlayerCell player={topPlayer} app={app} navigate={navigate} context="draft" /></p>
              <div className="flex items-center gap-2 mt-1">
                <Badge color="zinc" className="text-xs">{topPlayer.positions ? topPlayer.positions.join(", ") : (topPlayer.position || "?")}</Badge>
              </div>
            </div>
            {topPlayer.z_score != null && (
              <VerdictBadge grade={formatFixed(topPlayer.z_score, 1, "0.0")} variant={topPlayer.z_score >= 2 ? "success" : topPlayer.z_score >= 1 ? "info" : "warning"} size="lg" />
            )}
          </CardContent>
        </Card>
      )}

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="space-y-0.5">
          {filteredPlayers.slice(topPlayer ? 1 : 0).map(function (p, i) {
            var tier = getTier(p.z_score);
            var showDivider = tier !== lastTier;
            lastTier = tier;
            var posDisplay = p.positions ? p.positions.join(", ") : (p.position || "?");
            var actualIndex = topPlayer ? i + 1 : i;

            return (
              <div key={p.rank}>
                {showDivider && (
                  <div className="flex items-center gap-2 py-1.5">
                    <div className="flex-1 h-0.5 bg-primary/30" />
                    <VerdictBadge grade={tierGrade(p.z_score)} size="sm" />
                    <div className="flex-1 h-0.5 bg-primary/30" />
                  </div>
                )}
                <div className={"flex items-center gap-2 py-1.5 px-2 rounded " + (actualIndex % 2 === 0 ? "bg-muted/30" : "")}>
                  <span className="font-mono text-xs text-muted-foreground w-6 text-right">{p.rank}</span>
                  <span className="text-sm flex-1 truncate font-medium"><PlayerCell player={p} app={app} navigate={navigate} context="draft" /></span>
                  <Badge color="zinc" className="text-xs shrink-0">{posDisplay}</Badge>
                  <ZScoreBar z={p.z_score} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
