import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Subheading } from "../components/heading";
import { RadarChart } from "@/charts";
import { ArrowRightLeft, TrendingUp, TrendingDown, Users, Loader2, Check } from "@/shared/icons";
import { useCallTool } from "../shared/use-call-tool";
import { ZScoreBadge, ZScoreExplainer } from "../shared/z-score";
import { IntelBadge } from "../shared/intel-badge";
import { PlayerName } from "../shared/player-name";
import { AiInsight } from "../shared/ai-insight";
import { formatFixed, toFiniteNumber } from "../shared/number-format";
import { mlbHeadshotUrl } from "../shared/mlb-images";

interface ComparePlayer {
  name: string;
  mlb_id?: number;
  z_score: number;
  categories: Record<string, number>;
  intel?: any;
}

interface CompareData {
  player1: ComparePlayer;
  player2: ComparePlayer;
  ai_recommendation?: string | null;
}

interface RosterPlayer {
  name: string;
  player_id?: string;
  position?: string;
  team?: string;
  mlb_id?: number;
}

function noop() {}

export function CompareView({ data, app, navigate }: { data: CompareData; app?: any; navigate?: (data: any) => void }) {
  var callToolResult = useCallTool(app || null);
  var callTool = callToolResult.callTool;
  var loading = callToolResult.loading;
  var rosterModeState = useState(false);
  var rosterMode = rosterModeState[0];
  var setRosterMode = rosterModeState[1];
  var rosterState = useState<RosterPlayer[]>([]);
  var roster = rosterState[0];
  var setRoster = rosterState[1];
  var sp1State = useState<string | null>(null);
  var selectedPlayer1 = sp1State[0];
  var setSelectedPlayer1 = sp1State[1];
  var sp2State = useState<string | null>(null);
  var selectedPlayer2 = sp2State[0];
  var setSelectedPlayer2 = sp2State[1];
  var rlState = useState(false);
  var rosterLoading = rlState[0];
  var setRosterLoading = rlState[1];

  var nav = navigate || noop;

  var handleLoadRoster = async function () {
    setRosterMode(true);
    setRosterLoading(true);
    setSelectedPlayer1(null);
    setSelectedPlayer2(null);
    try {
      var result = await callTool("yahoo_roster", {});
      if (result && result.structuredContent) {
        var players = (result.structuredContent || {}).players || [];
        setRoster(players);
      }
    } catch (_) {
      // handled by useCallTool
    } finally {
      setRosterLoading(false);
    }
  };

  var handleCompare = async function () {
    if (!selectedPlayer1 || !selectedPlayer2) return;
    var result = await callTool("yahoo_compare", { player1: selectedPlayer1, player2: selectedPlayer2 });
    if (result && result.structuredContent) {
      nav(result.structuredContent);
    }
  };

  var handleSelectPlayer = function (name: string, slot: number) {
    if (slot === 1) {
      setSelectedPlayer1(selectedPlayer1 === name ? null : name);
    } else {
      setSelectedPlayer2(selectedPlayer2 === name ? null : name);
    }
  };

  var allCats = Array.from(new Set([
    ...Object.keys(data.player1.categories || {}),
    ...Object.keys(data.player2.categories || {}),
  ]));

  var chartData = allCats.map(function (cat) {
    var obj: Record<string, any> = { category: cat };
    obj[data.player1.name] = (data.player1.categories || {})[cat] || 0;
    obj[data.player2.name] = (data.player2.categories || {})[cat] || 0;
    return obj;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Subheading>Player Comparison</Subheading>
        <ArrowRightLeft size={18} className="text-muted-foreground" />
      </div>

      {/* Compare from Roster button */}
      {app && (
        <Button variant="outline" onClick={handleLoadRoster} disabled={loading || rosterLoading}>
          {rosterLoading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
          <span className="ml-1.5">Compare from Roster</span>
        </Button>
      )}

      {/* Roster selection mode */}
      {rosterMode && roster.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select Two Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Player 1 selection */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Player 1</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {roster.map(function (p) {
                    var isSelected = selectedPlayer1 === p.name;
                    var isOther = selectedPlayer2 === p.name;
                    return (
                      <button
                        key={"p1-" + p.name}
                        onClick={function () { handleSelectPlayer(p.name, 1); }}
                        disabled={isOther}
                        className={"w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 " + (isSelected ? "bg-primary text-primary-foreground" : isOther ? "opacity-40 cursor-not-allowed" : "hover:bg-muted")}
                      >
                        {isSelected && <Check size={12} />}
                        {p.mlb_id && <Avatar className="h-6 w-6"><AvatarImage src={mlbHeadshotUrl(p.mlb_id)} /><AvatarFallback>?</AvatarFallback></Avatar>}
                        <span className="font-medium">{p.name}</span>
                        {p.position && <Badge variant="secondary" className="ml-auto">{p.position}</Badge>}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Player 2 selection */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Player 2</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {roster.map(function (p) {
                    var isSelected = selectedPlayer2 === p.name;
                    var isOther = selectedPlayer1 === p.name;
                    return (
                      <button
                        key={"p2-" + p.name}
                        onClick={function () { handleSelectPlayer(p.name, 2); }}
                        disabled={isOther}
                        className={"w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 " + (isSelected ? "bg-primary text-primary-foreground" : isOther ? "opacity-40 cursor-not-allowed" : "hover:bg-muted")}
                      >
                        {isSelected && <Check size={12} />}
                        {p.mlb_id && <Avatar className="h-6 w-6"><AvatarImage src={mlbHeadshotUrl(p.mlb_id)} /><AvatarFallback>?</AvatarFallback></Avatar>}
                        <span className="font-medium">{p.name}</span>
                        {p.position && <Badge variant="secondary" className="ml-auto">{p.position}</Badge>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Button variant="secondary" onClick={handleCompare} disabled={!selectedPlayer1 || !selectedPlayer2 || loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                <span className="ml-1.5">Compare</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rosterMode && rosterLoading && (
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-sm text-muted-foreground">Loading roster...</span>
          </CardContent>
        </Card>
      )}

      <AiInsight recommendation={data.ai_recommendation} />

      <ZScoreExplainer />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base break-words"><PlayerName name={data.player1.name} mlbId={data.player1.mlb_id} app={app} navigate={navigate} context="default" /></CardTitle>
              {data.player1.intel && <IntelBadge intel={data.player1.intel} size="sm" />}
            </div>
          </CardHeader>
          <CardContent>
            <ZScoreBadge z={data.player1.z_score} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base break-words"><PlayerName name={data.player2.name} mlbId={data.player2.mlb_id} app={app} navigate={navigate} context="default" /></CardTitle>
              {data.player2.intel && <IntelBadge intel={data.player2.intel} size="sm" />}
            </div>
          </CardHeader>
          <CardContent>
            <ZScoreBadge z={data.player2.z_score} />
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <RadarChart
          data={chartData.map(function (d) {
            return { label: d.category, value: d[data.player1.name] || 0 };
          })}
          overlays={[{
            data: chartData.map(function (d) {
              return { label: d.category, value: d[data.player2.name] || 0 };
            }),
            color: "var(--color-destructive)",
            name: data.player2.name,
          }]}
          fillColor="var(--color-primary)"
          strokeColor="var(--color-primary)"
          className="h-48 sm:h-72"
        />
      )}

      <div className="mcp-app-scroll-x">
        <div className="space-y-1">
          {allCats.map(function (cat) {
            var v1 = toFiniteNumber((data.player1.categories || {})[cat], 0);
            var v2 = toFiniteNumber((data.player2.categories || {})[cat], 0);
            var p1Win = v1 > v2;
            var p2Win = v2 > v1;
            var total = Math.abs(v1) + Math.abs(v2);
            var leftPct = total > 0 ? Math.max(15, (Math.max(0, v1 + 2) / (Math.max(0, v1 + 2) + Math.max(0, v2 + 2))) * 100) : 50;

            return (
              <div key={cat} className={"rounded-md p-2 " + (p1Win ? "bg-sem-success-subtle/30" : p2Win ? "bg-sem-risk-subtle/30" : "")}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={"font-mono font-bold " + (p1Win ? "text-sem-success" : "text-muted-foreground")}>
                    {formatFixed(v1, 2, "0.00")}
                    {p1Win && <TrendingUp size={10} className="inline ml-0.5" />}
                  </span>
                  <span className="text-muted-foreground font-semibold uppercase tracking-wide">{cat}</span>
                  <span className={"font-mono font-bold " + (p2Win ? "text-sem-success" : "text-muted-foreground")}>
                    {p2Win && <TrendingUp size={10} className="inline mr-0.5" />}
                    {formatFixed(v2, 2, "0.00")}
                  </span>
                </div>
                <div className="h-2.5 rounded-sm overflow-hidden bg-muted">
                  <div className={"h-full rounded-sm transition-all " + (p1Win ? "bg-sem-success" : p2Win ? "bg-sem-risk" : "bg-sem-warning")} style={{ width: leftPct + "%" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
