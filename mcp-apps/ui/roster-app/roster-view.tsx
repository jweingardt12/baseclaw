import { useState } from "react";
import { Badge } from "@plexui/ui/components/Badge";
import { Button } from "@plexui/ui/components/Button";
import { Tabs } from "@plexui/ui/components/Tabs";
import { Dialog } from "@plexui/ui/components/Dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { LoadingIndicator } from "@plexui/ui/components/Indicator";
import { EmptyMessage } from "@plexui/ui/components/EmptyMessage";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerRowData } from "../shared/player-row";
import { TeamLogo } from "../shared/team-logo";
import { IntelPanel } from "../shared/intel-panel";
import { mlbHeadshotUrl } from "../shared/mlb-images";

/* ── Position color map ──────────────────────────────────── */

var POS_COLOR: Record<string, "warning" | "info" | "success" | "discovery" | "secondary" | "danger" | "caution"> = {
  C: "warning", "1B": "info", "2B": "info", SS: "info", "3B": "info",
  OF: "success", Util: "discovery", BN: "secondary",
  SP: "danger", RP: "caution", P: "danger",
  IL: "secondary", "IL+": "secondary",
};

var TIER_COLOR: Record<string, "primary" | "success" | "secondary" | "warning" | "danger"> = {
  elite: "primary", strong: "success", average: "secondary", below: "warning", poor: "danger",
};

var TREND_DISPLAY: Record<string, { label: string; color: "danger" | "caution" | "info" | "secondary" }> = {
  hot:  { label: "\u{1F525} Hot",   color: "danger" },
  warm: { label: "\u2191 Warm",     color: "caution" },
  cold: { label: "\u2744\uFE0F Cold", color: "info" },
  ice:  { label: "\u2744\uFE0F Ice",  color: "info" },
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
      <Tabs value={activeTab} onChange={setActiveTab} variant="segmented" size="md" aria-label="Roster sections">
        <Tabs.Tab value="batters" badge={batters.length}>Batters</Tabs.Tab>
        <Tabs.Tab value="pitchers" badge={pitchers.length}>Pitchers</Tabs.Tab>
        {ilPlayers.length > 0 && (
          <Tabs.Tab value="il" badge={{ content: ilPlayers.length, color: "danger" }}>IL</Tabs.Tab>
        )}
      </Tabs>

      {/* Table */}
      <div style={{ position: "relative" }}>
        {loading && <div className="loading-overlay"><LoadingIndicator size={24} /></div>}

        {displayed.length === 0 ? (
          <EmptyMessage title="No players" description="This section is empty." />
        ) : (
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
                        color={POS_COLOR[pos] || "secondary"}
                        size="md"
                        variant="soft"
                        className="font-mono font-bold"
                        style={{ minWidth: 40, justifyContent: "center", display: "inline-flex" }}
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
                          <Badge color={TIER_COLOR[tier] || "secondary"} size="sm" variant="soft" className="font-mono uppercase">
                            {tier}
                          </Badge>
                        )}
                        {trendInfo && (
                          <Badge color={trendInfo.color} size="sm" variant="outline">
                            {trendInfo.label}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell style={{ paddingLeft: 8, paddingRight: 12, verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                        {hasStatus ? <Badge color="danger" size="md">{p.status}</Badge> : <span />}
                        <span style={{ color: "var(--color-text-quaternary)", fontSize: 14 }}>{"\u203A"}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
        width={520}
      >
        {selectedPlayer && (
          <Dialog.Content>
            <PlayerCard
              player={selectedPlayer}
              app={app}
              navigate={navigate}
              onDrop={function () {
                setDropTarget(selectedPlayer);
              }}
              loading={loading}
            />
          </Dialog.Content>
        )}
      </Dialog>

      {/* Drop confirmation */}
      <Dialog open={dropTarget !== null} onOpenChange={function (open) { if (!open) setDropTarget(null); }}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Drop Player</Dialog.Title>
          </Dialog.Header>
          <p style={{ padding: "0 24px 16px" }}>
            {"Are you sure you want to drop " + (dropTarget ? dropTarget.name : "") + "? This cannot be undone."}
          </p>
          <Dialog.Footer>
            <Dialog.Close>
              <Button color="secondary" variant="soft" size="md">Cancel</Button>
            </Dialog.Close>
            <Button color="danger" size="md" onClick={handleDrop} disabled={loading}>
              {loading ? <LoadingIndicator size={16} /> : null}
              Drop Player
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
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
            {hasStatus && <Badge color="danger" size="md">{player.status}</Badge>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {player.team && <TeamLogo abbrev={player.team} size={16} />}
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {player.team || ""}
            </span>
            <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>{"\u00B7"}</span>
            <Badge color={POS_COLOR[pos] || "secondary"} size="sm" variant="soft" className="font-mono font-bold">
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
              <Badge color={TIER_COLOR[tier] || "secondary"} size="md" variant="soft" className="font-mono uppercase">
                {tier}
              </Badge>
            )}
            {trendInfo && (
              <Badge color={trendInfo.color} size="md" variant="outline">
                {trendInfo.label}
              </Badge>
            )}
            {player.opponent && (
              <Badge color="secondary" size="md" variant="outline">
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
            color="primary"
            size="sm"
            variant="soft"
            onClick={function () {
              app.sendMessage("Tell me about " + player.name + " — Statcast, trends, and fantasy outlook");
            }}
          >
            Ask Claude
          </Button>
        )}
        {app && app.openLink && player.player_id && (
          <Button
            color="secondary"
            size="sm"
            variant="outline"
            onClick={function () {
              app.openLink("https://sports.yahoo.com/mlb/players/" + player.player_id);
            }}
          >
            Yahoo
          </Button>
        )}
        {app && app.openLink && player.mlb_id && (
          <Button
            color="secondary"
            size="sm"
            variant="outline"
            onClick={function () {
              app.openLink("https://baseballsavant.mlb.com/savant-player/" + player.mlb_id);
            }}
          >
            Savant
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Button color="danger" size="sm" variant="ghost" onClick={onDrop} disabled={loading}>
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
