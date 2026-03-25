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
                  <TableHead style={{ width: 60, paddingLeft: 12, paddingRight: 8 }}>Pos</TableHead>
                  <TableHead style={{ paddingLeft: 8, paddingRight: 8 }}>Player</TableHead>
                  <TableHead style={{ width: 88, paddingLeft: 8, paddingRight: 8 }}>Today</TableHead>
                  <TableHead style={{ width: 96, paddingLeft: 8, paddingRight: 8 }}>Signal</TableHead>
                  <TableHead style={{ width: 88, paddingLeft: 8, paddingRight: 12 }}>Status</TableHead>
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

                      <TableCell style={{ paddingLeft: 8, paddingRight: 8, verticalAlign: "middle" }}>
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
                        </div>
                      </TableCell>

                      <TableCell style={{ paddingLeft: 8, paddingRight: 12, verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                          {hasStatus ? <Badge variant="destructive">{p.status}</Badge> : <span />}
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
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "20px 24px 0" }}>
        {/* Headshot or team logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 12, overflow: "hidden", flexShrink: 0,
          background: "var(--color-surface-2)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {headshot ? (
            <img
              src={headshot}
              alt={player.name}
              style={{ width: 64, height: 64, objectFit: "cover" }}
              onError={function (e: any) { e.target.style.display = "none"; }}
            />
          ) : player.team ? (
            <TeamLogo abbrev={player.team} size={40} />
          ) : (
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-tertiary)" }}>
              {player.name.charAt(0)}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{player.name}</span>
            {hasStatus && <Badge variant="destructive">{player.status}</Badge>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {player.team && <TeamLogo abbrev={player.team} size={16} />}
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {player.team || ""}
            </span>
            <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>{"\u00B7"}</span>
            <Badge variant="secondary" className="font-mono font-bold">
              {pos}
            </Badge>
            {elig.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                {"(" + elig.join(", ") + ")"}
              </span>
            )}
          </div>
          {/* Signal badges */}
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
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
            {player.opponent && (
              <Badge variant="outline">
                {player.opponent}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Season stats */}
      {statKeys.length > 0 && (
        <div style={{ padding: "0 24px" }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-tertiary)", marginBottom: 8 }}>
            Season Stats
          </h4>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 8,
          }}>
            {statKeys.map(function (key) {
              return (
                <div key={key} style={{
                  padding: "6px 8px", borderRadius: 6,
                  background: "var(--color-surface-2)", textAlign: "center",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {String(stats[key])}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                    {key}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Intel panel */}
      {player.intel && (
        <div style={{ padding: "0 24px" }}>
          <IntelPanel intel={player.intel} defaultExpanded={true} />
        </div>
      )}

      {/* Ownership / ADP */}
      {(player.percent_owned != null || player.preseason_pick != null) && (
        <div style={{ padding: "0 24px", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {player.percent_owned != null && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "var(--color-text-tertiary)" }}>Owned: </span>
              <span style={{ fontWeight: 600 }}>{player.percent_owned + "%"}</span>
            </div>
          )}
          {player.percent_started != null && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "var(--color-text-tertiary)" }}>Started: </span>
              <span style={{ fontWeight: 600 }}>{player.percent_started + "%"}</span>
            </div>
          )}
          {player.preseason_pick != null && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "var(--color-text-tertiary)" }}>Pre ADP: </span>
              <span style={{ fontWeight: 600 }}>{player.preseason_pick}</span>
            </div>
          )}
          {player.current_pick != null && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "var(--color-text-tertiary)" }}>Cur ADP: </span>
              <span style={{ fontWeight: 600 }}>{player.current_pick}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: "0 24px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {app && app.sendMessage && (
          <Button
            variant="secondary"
            size="sm"
            onClick={function () {
              app.sendMessage("Tell me about " + player.name + " — Statcast, trends, and fantasy outlook");
            }}
          >
            Ask Claude
          </Button>
        )}
        {app && app.openLink && player.player_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={function () {
              app.openLink("https://sports.yahoo.com/mlb/players/" + player.player_id);
            }}
          >
            Yahoo
          </Button>
        )}
        {app && app.openLink && player.mlb_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={function () {
              app.openLink("https://baseballsavant.mlb.com/savant-player/" + player.mlb_id);
            }}
          >
            Savant
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={onDrop} disabled={loading}>
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
