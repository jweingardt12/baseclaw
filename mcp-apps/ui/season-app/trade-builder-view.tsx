import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@plexui/ui/components/Badge";
import { Button } from "@plexui/ui/components/Button";
import { Subheading } from "../components/heading";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { useCallTool } from "../shared/use-call-tool";

import { IntelBadge } from "../shared/intel-badge";
import { PlayerName } from "../shared/player-name";
import { AiInsight } from "../shared/ai-insight";
import { ArrowRightLeft, Search, Loader2, CheckSquare, Square, TrendingUp, TrendingDown } from "@/shared/icons";
import { formatFixed, toFiniteNumber } from "../shared/number-format";

interface RosterPlayer {
  name: string;
  player_id: string;
  position?: string;
  eligible_positions?: string[];
  team?: string;
  mlb_id?: number;
  intel?: any;
}

interface TradeBuilderData {
  roster?: { players: RosterPlayer[] };
  search_results?: RosterPlayer[];
  evaluation?: any;
  ai_recommendation?: string | null;
}

export function TradeBuilderView({ data, app, navigate }: { data: TradeBuilderData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);
  const [giveIds, setGiveIds] = useState<Set<string>>(new Set());
  const [getIds, setGetIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RosterPlayer[]>(data.search_results || []);
  const [evaluation, setEvaluation] = useState<any>(data.evaluation || null);
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>((data.roster && data.roster.players) || []);

  const toggleGive = (id: string) => {
    const next = new Set(giveIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setGiveIds(next);
    setEvaluation(null);
  };

  const toggleGet = (id: string) => {
    const next = new Set(getIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setGetIds(next);
    setEvaluation(null);
  };

  const handleLoadRoster = async () => {
    const result = await callTool("yahoo_roster", {});
    if (result && result.structuredContent && result.structuredContent.players) {
      setMyRoster(result.structuredContent.players);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const result = await callTool("yahoo_search", { query: searchQuery });
    if (result && result.structuredContent && result.structuredContent.players) {
      setSearchResults(result.structuredContent.players);
    }
  };

  const handleEvaluate = async () => {
    if (giveIds.size === 0 || getIds.size === 0) return;
    const result = await callTool("yahoo_trade_eval", {
      give: Array.from(giveIds).join(","),
      get: Array.from(getIds).join(","),
    });
    if (result && result.structuredContent) {
      setEvaluation(result.structuredContent);
    }
  };

  const givePlayers = myRoster.filter((p) => giveIds.has(p.player_id));
  const getPlayers = searchResults.filter((p) => getIds.has(p.player_id));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-5 w-5" />
        <Subheading>Trade Builder</Subheading>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <AiInsight recommendation={data.ai_recommendation} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Your roster - Give side */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-destructive">You Give</CardTitle>
              {myRoster.length === 0 && app && (
                <Button variant="outline" color="secondary" size="xs" onClick={handleLoadRoster} disabled={loading}>
                  Load Roster
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {myRoster.length === 0 ? (
              <p className="text-xs text-muted-foreground">Load your roster to select players to trade away.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {myRoster.map((p) => {
                  const selected = giveIds.has(p.player_id);
                  return (
                    <button
                      key={p.player_id}
                      onClick={() => toggleGive(p.player_id)}
                      className={"flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors "
                        + (selected ? "bg-destructive/10 border border-destructive/30" : "hover:bg-muted")}
                      style={{ border: selected ? undefined : "1px solid transparent" }}
                    >
                      {selected ? <CheckSquare size={14} className="text-destructive flex-shrink-0" /> : <Square size={14} className="text-muted-foreground flex-shrink-0" />}
                      <span className={"truncate " + (selected ? "font-medium" : "")}><PlayerName name={p.name} playerId={p.player_id} mlbId={p.mlb_id} app={app} navigate={navigate} context="trade" /></span>
                      {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                      {p.position && <Badge color="secondary" size="sm" className="ml-auto flex-shrink-0">{p.position}</Badge>}
                    </button>
                  );
                })}
              </div>
            )}
            {givePlayers.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">{givePlayers.length + " selected"}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search / Get side */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary">You Get</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm"
              />
              <Button variant="outline" color="secondary" size="xs" uniform onClick={handleSearch} disabled={loading}>
                <Search size={14} />
              </Button>
            </div>
            {searchResults.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {searchResults.map((p) => {
                  const selected = getIds.has(p.player_id);
                  return (
                    <button
                      key={p.player_id}
                      onClick={() => toggleGet(p.player_id)}
                      className={"flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors "
                        + (selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted")}
                      style={{ border: selected ? undefined : "1px solid transparent" }}
                    >
                      {selected ? <CheckSquare size={14} className="text-primary flex-shrink-0" /> : <Square size={14} className="text-muted-foreground flex-shrink-0" />}
                      <span className={"truncate " + (selected ? "font-medium" : "")}><PlayerName name={p.name} playerId={p.player_id} mlbId={p.mlb_id} app={app} navigate={navigate} context="trade" /></span>
                      {p.intel && <IntelBadge intel={p.intel} size="sm" />}
                      {p.position && <Badge color="secondary" size="sm" className="ml-auto flex-shrink-0">{p.position}</Badge>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Search for players from other teams to trade for.</p>
            )}
            {getPlayers.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">{getPlayers.length + " selected"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trade Summary */}
      {(givePlayers.length > 0 || getPlayers.length > 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Give</p>
                <div className="flex flex-wrap gap-1">
                  {givePlayers.map((p) => (
                    <Badge key={p.player_id} color="danger" size="sm">{p.name}</Badge>
                  ))}
                  {givePlayers.length === 0 && <span className="text-xs text-muted-foreground">None selected</span>}
                </div>
              </div>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Get</p>
                <div className="flex flex-wrap gap-1">
                  {getPlayers.map((p) => (
                    <Badge key={p.player_id} size="sm">{p.name}</Badge>
                  ))}
                  {getPlayers.length === 0 && <span className="text-xs text-muted-foreground">None selected</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <Button color="secondary" size="sm" onClick={handleEvaluate} disabled={loading || givePlayers.length === 0 || getPlayers.length === 0}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                Evaluate Trade
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evaluation Results */}
      {evaluation && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Trade Evaluation</CardTitle>
              <Badge color={evaluation.net_value >= 0 ? undefined : "red"} className="text-sm">
                {evaluation.grade || (evaluation.net_value >= 0 ? "Good" : "Bad")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3 text-center mb-2">
              <div>
                <p className="text-lg font-bold font-mono text-destructive">{formatFixed(evaluation.give_value, 1, "0.0")}</p>
                <p className="text-xs text-muted-foreground">Give Value</p>
              </div>
              <div>
                <p className="text-lg font-bold font-mono text-primary">{formatFixed(evaluation.get_value, 1, "0.0")}</p>
                <p className="text-xs text-muted-foreground">Get Value</p>
              </div>
              <div>
                <p className={"text-lg font-bold font-mono " + (toFiniteNumber(evaluation.net_value, 0) >= 0 ? "text-sem-success" : "text-sem-risk")}>
                  {toFiniteNumber(evaluation.net_value, 0) >= 0 ? "+" : ""}{formatFixed(evaluation.net_value, 1, "0.0")}
                </p>
                <p className="text-xs text-muted-foreground">Net Value</p>
              </div>
            </div>
            {evaluation.position_impact && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 text-xs">
                {evaluation.position_impact.losing && evaluation.position_impact.losing.length > 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingDown size={12} className="text-destructive" />
                    <span className="text-muted-foreground">Losing:</span>
                    {evaluation.position_impact.losing.map((p: string) => (
                      <Badge key={p} color="secondary" size="sm">{p}</Badge>
                    ))}
                  </div>
                )}
                {evaluation.position_impact.gaining && evaluation.position_impact.gaining.length > 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-primary" />
                    <span className="text-muted-foreground">Gaining:</span>
                    {evaluation.position_impact.gaining.map((p: string) => (
                      <Badge key={p} color="secondary" size="sm">{p}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
