import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { LoadingIndicator } from "@/shared/loading-indicator";
import { EmptyMessage } from "@/shared/empty-message";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerRowData } from "../shared/player-row";
import { TeamLogo } from "../shared/team-logo";
import { IntelPanel } from "../shared/intel-panel";
import { mlbHeadshotUrl } from "../shared/mlb-images";

/* ── Position color map ──────────────────────────────────── */

var TREND_DISPLAY: Record<string, { label: string; variant: "destructive" | "outline" | "secondary" }> = {
  hot:  { label: "\u{1F525} Hot",   variant: "destructive" },
  warm: { label: "\u2191 Warm",     variant: "outline" },
  cold: { label: "\u2744\uFE0F Cold", variant: "secondary" },
  ice:  { label: "\u2744\uFE0F Ice",  variant: "secondary" },
};

/* ── Pitcher detection ───────────────────────────────────── */

var PITCHER_POS = ["SP", "RP", "P"];

function isPitcher(p: PlayerRowData): boolean {
  var elig = p.eligible_positions || [];
  if (Array.isArray(elig)) {
    for (var i = 0; i < elig.length; i++) {
      if (PITCHER_POS.indexOf(elig[i]) >= 0) return true;
    }
  }
  return PITCHER_POS.indexOf(p.position || "") >= 0;
}

/* ── Main component ──────────────────────────────────────── */

interface RosterData {
  players: PlayerRowData[];
  ai_recommendation?: string | null;
}

export function RosterView({ data, app, navigate }: { data: RosterData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);
  var [selectedPlayer, setSelectedPlayer] = useState<PlayerRowData | null>(null);
  var [dropTarget, setDropTarget] = useState<PlayerRowData | null>(null);
  var [activeTab, setActiveTab] = useState("batters");

  var players = data.players || [];
  var ilPlayers = players.filter(function (p) { return p.position === "IL" || p.position === "IL+"; });
  var active = players.filter(function (p) { return p.position !== "IL" && p.position !== "IL+"; });
  var batters = active.filter(function (p) { return !isPitcher(p); });
  var pitchers = active.filter(function (p) { return isPitcher(p); });
  var injuredCount = players.filter(function (p) { return p.status && p.status !== "Healthy"; }).length;
  var displayed = activeTab === "batters" ? batters : activeTab === "pitchers" ? pitchers : ilPlayers;

  var handleDrop = async function () {
    if (!dropTarget) return;
    var result = await callTool("yahoo_drop", { player_id: dropTarget.player_id });
    setDropTarget(null);
    setSelectedPlayer(null);
    if (result) { navigate(result.structuredContent); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Section tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} aria-label="Roster sections">
        <TabsList>
          <TabsTrigger value="batters">{"Batters (" + batters.length + ")"}</TabsTrigger>
          <TabsTrigger value="pitchers">{"Pitchers (" + pitchers.length + ")"}</TabsTrigger>
          {ilPlayers.length > 0 && (
            <TabsTrigger value="il">{"IL (" + ilPlayers.length + ")"}</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Table */}
      <div style={{ position: "relative" }}>
        {loading && <div className="loading-overlay"><LoadingIndicator size={24} /></div>}

        {displayed.length === 0 ? (
          <EmptyMessage title="No players" description="This section is empty." />
        ) : (
          <div className="w-full overflow-x-auto mcp-app-scroll-x">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 sm:w-14">Pos</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="hidden sm:table-cell w-20">Today</TableHead>
                  <TableHead className="w-20 sm:w-24">Signal</TableHead>
                  <TableHead className="w-16 sm:w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map(function (p) {
                  var pos = p.position || "?";
                  var hasStatus = p.status && p.status !== "Healthy";
                  var elig = (p.eligible_positions || []).filter(function (e) {
                    return e !== pos && e !== "Util" && e !== "BN" && e !== "IL" && e !== "IL+" && e !== "DL";
                  });
                  var tier = p.intel && p.intel.statcast && p.intel.statcast.quality_tier || null;
                  var hotCold = p.intel && p.intel.trends && p.intel.trends.hot_cold || null;
                  var trendInfo = hotCold && TREND_DISPLAY[hotCold] ? TREND_DISPLAY[hotCold] : null;

                  return (
                    <TableRow
                      key={p.player_id || p.name}
                      style={{ minHeight: 52, cursor: "pointer" }}
                      onClick={function () { setSelectedPlayer(p); }}
                      className="hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <TableCell style={{ paddingLeft: 12, paddingRight: 8, verticalAlign: "middle" }}>
                        <Badge
                          variant="secondary"
                          className="font-mono font-bold inline-flex justify-center min-w-[40px]"
                        >
                          {pos}
                        </Badge>
                      </TableCell>

                      <TableCell style={{ paddingLeft: 8, paddingRight: 8, verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
                          {p.team && <TeamLogo abbrev={p.team} size={20} />}
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                            {elig.length > 0 && (
                              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", lineHeight: 1 }}>
                                {elig.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell" style={{ paddingLeft: 8, paddingRight: 8, verticalAlign: "middle" }}>
                        <OpponentDisplay opponent={p.opponent} />
                      </TableCell>

                      <TableCell style={{ paddingLeft: 8, paddingRight: 8, verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {tier && (
                            <Badge variant="secondary" className="font-mono uppercase">
                              {tier}
                            </Badge>
                          )}
                          {trendInfo && (
                            <Badge variant={trendInfo.variant}>
                              {trendInfo.label}
                            </Badge>
                          )}
                          {!tier && !trendInfo && (
                            <span className="sm:hidden">
                              <OpponentDisplay opponent={p.opponent} />
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell style={{ paddingLeft: 8, paddingRight: 12, verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          {hasStatus && <Badge variant="destructive" className="text-[10px]">{p.status}</Badge>}
                          <span style={{ color: "var(--color-text-quaternary)", fontSize: 14 }}>{"\u203A"}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "center", paddingTop: 4 }}>
        {players.length + " players"}
        {injuredCount > 0 ? " \u00B7 " + injuredCount + " injured" : ""}
      </div>

      {/* Player card dialog */}
      <Dialog
        open={selectedPlayer !== null}
        onOpenChange={function (open) { if (!open) setSelectedPlayer(null); }}
      >
        {selectedPlayer && (
          <DialogContent className="max-w-[520px]">
            <PlayerCard
              player={selectedPlayer}
              app={app}
              navigate={navigate}
              onDrop={function () {
                setDropTarget(selectedPlayer);
              }}
              loading={loading}
            />
          </DialogContent>
        )}
      </Dialog>

      {/* Drop confirmation */}
      <Dialog open={dropTarget !== null} onOpenChange={function (open) { if (!open) setDropTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drop Player</DialogTitle>
          </DialogHeader>
          <p style={{ padding: "0 24px 16px" }}>
            {"Are you sure you want to drop " + (dropTarget ? dropTarget.name : "") + "? This cannot be undone."}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDrop} disabled={loading}>
              {loading ? <LoadingIndicator size={16} /> : null}
              Drop Player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Player card (shown in dialog) ───────────────────────── */

function PlayerCard({ player, app, navigate, onDrop, loading }: {
  player: PlayerRowData;
  app: any;
  navigate: (data: any) => void;
  onDrop: () => void;
  loading: boolean;
}) {
  var pos = player.position || "?";
  var elig = player.eligible_positions || [];
  var hasStatus = player.status && player.status !== "Healthy";
  var tier = player.intel && player.intel.statcast && player.intel.statcast.quality_tier || null;
  var hotCold = player.intel && player.intel.trends && player.intel.trends.hot_cold || null;
  var trendInfo = hotCold && TREND_DISPLAY[hotCold] ? TREND_DISPLAY[hotCold] : null;
  var stats = player.stats || {};
  var statKeys = Object.keys(stats);
  var headshot = player.mlb_id ? mlbHeadshotUrl(player.mlb_id) : null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-3 items-start px-4 pt-4">
        <div className="size-14 rounded-xl overflow-hidden shrink-0 bg-muted flex items-center justify-center">
          {headshot ? (
            <img src={headshot} alt={player.name} className="size-14 object-cover" onError={function (e: any) { e.target.style.display = "none"; }} />
          ) : player.team ? (
            <TeamLogo abbrev={player.team} size={40} />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground">{player.name.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold leading-tight truncate">{player.name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {player.team && <TeamLogo abbrev={player.team} size={16} />}
            <span className="text-sm text-muted-foreground">{player.team || ""}</span>
            <span className="text-sm text-muted-foreground">{"\u00B7"}</span>
            <Badge variant="secondary" className="font-mono font-bold">{pos}</Badge>
            {elig.length > 0 && (
              <span className="text-xs text-muted-foreground">{"(" + elig.join(", ") + ")"}</span>
            )}
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {hasStatus && <Badge variant="destructive">{player.status}</Badge>}
            {tier && <Badge variant="secondary" className="font-mono uppercase">{tier}</Badge>}
            {trendInfo && <Badge variant={trendInfo.variant}>{trendInfo.label}</Badge>}
            {player.opponent && <Badge variant="outline">{player.opponent}</Badge>}
          </div>
        </div>
      </div>

      {/* Ownership row */}
      {(player.percent_owned != null || player.preseason_pick != null) && (
        <div className="flex items-center gap-4 px-4 flex-wrap">
          {player.percent_owned != null && (
            <span className="text-xs"><span className="text-muted-foreground">Owned: </span><span className="font-semibold">{player.percent_owned + "%"}</span></span>
          )}
          {player.percent_started != null && (
            <span className="text-xs"><span className="text-muted-foreground">Started: </span><span className="font-semibold">{player.percent_started + "%"}</span></span>
          )}
          {player.preseason_pick != null && (
            <span className="text-xs"><span className="text-muted-foreground">ADP: </span><span className="font-semibold">{player.preseason_pick}</span></span>
          )}
        </div>
      )}

      {/* Season stats */}
      {statKeys.length > 0 && (
        <div className="px-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Season Stats</h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
            {statKeys.map(function (key) {
              return (
                <div key={key} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                  <div className="text-sm font-bold tabular-nums">{String(stats[key])}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{key}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Intel panel */}
      {player.intel && (
        <div className="px-4">
          <IntelPanel intel={player.intel} defaultExpanded={true} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
        {app && app.sendMessage && (
          <Button variant="secondary" size="sm" onClick={function () {
            app.sendMessage("Tell me about " + player.name + " — Statcast, trends, and fantasy outlook");
          }}>Ask Claude</Button>
        )}
        {app && app.openLink && player.player_id && (
          <Button variant="outline" size="sm" onClick={function () {
            app.openLink("https://sports.yahoo.com/mlb/players/" + player.player_id);
          }}>Yahoo</Button>
        )}
        {app && app.openLink && player.mlb_id && (
          <Button variant="outline" size="sm" onClick={function () {
            app.openLink("https://baseballsavant.mlb.com/savant-player/" + player.mlb_id);
          }}>Savant</Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-sem-risk" onClick={onDrop} disabled={loading}>
          {loading ? <LoadingIndicator size={14} /> : null}
          Drop
        </Button>
      </div>
    </div>
  );
}

/* ── Opponent display ────────────────────────────────────── */

function OpponentDisplay({ opponent }: { opponent?: string }) {
  if (!opponent) {
    return <span style={{ fontSize: 12, color: "var(--color-text-quaternary)" }}>OFF</span>;
  }
  var isHome = opponent.indexOf("vs ") === 0;
  var abbrev = opponent.replace(/^(vs |@)/, "");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <TeamLogo abbrev={abbrev} size={16} />
      <span>
        <span style={{ color: "var(--color-text-tertiary)" }}>{isHome ? "vs" : "@"}</span>
        {" " + abbrev}
      </span>
    </span>
  );
}
