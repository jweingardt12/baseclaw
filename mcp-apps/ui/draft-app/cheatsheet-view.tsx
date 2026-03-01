import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PlayerName } from "../shared/player-name";
import { AlertTriangle } from "@/shared/icons";
import { parseRoundKey, sortRoundEntries } from "./round-key";

interface CheatsheetData {
  strategy?: Record<string, string>;
  rounds?: Record<string, string>;
  targets?: Record<string, string[]> | string[];
  avoid?: string[];
  opponents?: Array<{ name: string; tendency: string }>;
  ai_recommendation?: string | null;
}

var ROUND_COLORS = [
  "bg-primary/15",
  "bg-sem-success-subtle",
  "bg-blue-500/10",
  "bg-muted",
];

export function CheatsheetView({ data, app, navigate }: { data: CheatsheetData; app?: any; navigate?: (data: any) => void }) {
  var strategyMap = data.strategy || data.rounds || {};
  var roundEntries = sortRoundEntries(Object.entries(strategyMap));

  // Targets can be either Record<string, string[]> or string[]
  var targetMap = data.targets || {};
  var isTargetArray = Array.isArray(targetMap);

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Draft Cheat Sheet</h2>

      {/* Round-by-round strategy */}
      {roundEntries.length > 0 && (
        <div className="space-y-2">
          {roundEntries.map(function (entry, idx) {
            var roundInfo = entry[0];
            var strategy = entry[1];
            var colorClass = ROUND_COLORS[Math.min(idx, ROUND_COLORS.length - 1)];
            return (
              <Card key={roundInfo.rawKey}>
                <div className={"rounded-t-[var(--radius)] px-3 py-2 " + colorClass}>
                  <span className="text-sm font-black tracking-wide uppercase">{roundInfo.label}</span>
                </div>
                <CardContent className="p-3 sm:p-4">
                  <p className="text-sm leading-6 break-words">{strategy}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Targets - array format */}
      {isTargetArray && (targetMap as string[]).length > 0 && (
        <Card className="border-green-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-600 dark:text-green-400">Key Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(targetMap as string[]).map(function (t) {
                return (
                  <div key={t} className="rounded-md border bg-card p-2 px-3 border-l-2 border-l-green-500">
                    <span className="text-sm font-semibold"><PlayerName name={t} app={app} navigate={navigate} context="draft" /></span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Targets - record format */}
      {!isTargetArray && Object.keys(targetMap).length > 0 && (
        <Card className="border-green-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-600 dark:text-green-400">Key Targets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(targetMap as Record<string, string[]>).map(function (entry) {
              var rawCategory = entry[0];
              var category = parseRoundKey(rawCategory).label;
              var players = entry[1];
              return (
                <div key={rawCategory}>
                  <p className="text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">{category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {players.map(function (t) {
                      return (
                        <div key={t} className="rounded-md border bg-card p-1.5 px-2.5 border-l-2 border-l-green-500">
                          <span className="text-xs font-semibold"><PlayerName name={t} app={app} navigate={navigate} context="draft" /></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Avoid List */}
      {(data.avoid || []).length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <CardTitle className="text-base text-yellow-600 dark:text-yellow-400">Avoid</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(data.avoid || []).map(function (name) {
                return (
                  <div key={name} className="rounded-md border bg-card p-1.5 px-2.5 border-l-2 border-l-yellow-500">
                    <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">{name}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opponents */}
      {(data.opponents || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Opponents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {(data.opponents || []).map(function (opp) {
                return (
                  <div key={opp.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{opp.name}</span>
                    <span className="text-xs text-muted-foreground">{opp.tendency}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
