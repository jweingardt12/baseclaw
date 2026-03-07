import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../globals.css";
import "./draft.css";
import { SetupScreen } from "./setup-screen";
import { DraftBoardPanel } from "./draft-board-panel";
import { BestAvailablePanel } from "./best-available-panel";
import { MyTeamPanel } from "./my-team-panel";
import { PickEntry } from "./pick-entry";

const API_BASE = "/api/offline-draft";

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}

interface DraftStatus {
  active: boolean;
  complete?: boolean;
  total_picks?: number;
  total_possible?: number;
  num_teams?: number;
  num_rounds?: number;
  teams?: string[];
  my_team?: string;
  snake?: boolean;
  has_sheet?: boolean;
  on_the_clock?: {
    team: string;
    round: number;
    pick_in_round: number;
    overall: number;
    picks_until_my_turn: number;
  };
}

function App() {
  var [status, setStatus] = useState<DraftStatus | null>(null);
  var [loading, setLoading] = useState(true);
  var [boardData, setBoardData] = useState<any>(null);
  var [bestAvailable, setBestAvailable] = useState<any>(null);
  var [myTeam, setMyTeam] = useState<any>(null);
  var lastPickCount = useRef(-1);
  var [activeTab, setActiveTab] = useState<"board" | "available" | "team">("board");

  var fetchStatus = useCallback(async () => {
    try {
      var s = await apiFetch<DraftStatus>("/status");
      setStatus(s);
      if (s.active && s.total_picks !== lastPickCount.current) {
        lastPickCount.current = s.total_picks || 0;
        // Refresh all panels
        var [b, a, t] = await Promise.all([
          apiFetch("/board"),
          apiFetch("/best-available?pos_type=all&limit=50"),
          apiFetch("/my-team"),
        ]);
        setBoardData(b);
        setBestAvailable(a);
        setMyTeam(t);
      }
      return s;
    } catch (e) {
      console.error("Failed to fetch status:", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Poll every 3 seconds when draft is active
  useEffect(() => {
    if (!status?.active) return;
    var interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [status?.active, fetchStatus]);

  // Sync from sheet every 10 seconds if configured
  useEffect(() => {
    if (!status?.active || !status?.has_sheet) return;
    var interval = setInterval(async () => {
      try {
        await apiFetch("/sync");
        fetchStatus();
      } catch (e) {
        console.error("Sheet sync failed:", e);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [status?.active, status?.has_sheet, fetchStatus]);

  var handleDraftStarted = useCallback(async () => {
    lastPickCount.current = -1;
    await fetchStatus();
  }, [fetchStatus]);

  var handlePickMade = useCallback(async () => {
    lastPickCount.current = -1;
    await fetchStatus();
  }, [fetchStatus]);

  var handleUndo = useCallback(async () => {
    await apiPost("/undo", {});
    lastPickCount.current = -1;
    await fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-lg text-muted-foreground">Loading draft...</div>
      </div>
    );
  }

  if (!status?.active) {
    return <SetupScreen onStarted={handleDraftStarted} />;
  }

  var clock = status.on_the_clock;
  var isMyTurn = clock && clock.team === status.my_team;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* On the Clock Banner */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">On the Clock</span>
            <span className={"text-lg font-bold " + (isMyTurn ? "text-green-500" : "text-foreground")}>
              {clock ? clock.team : "Draft Complete"}
            </span>
          </div>
          {clock && (
            <>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Round <strong className="text-foreground">{clock.round}</strong></span>
                <span>Pick <strong className="text-foreground">{clock.overall}</strong></span>
                <span>
                  {clock.picks_until_my_turn === 0 ? (
                    <span className="text-green-500 font-semibold">YOUR PICK!</span>
                  ) : (
                    <>{clock.picks_until_my_turn} picks until your turn</>
                  )}
                </span>
              </div>
            </>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            <span>{status.total_picks} / {status.total_possible} picks</span>
            {status.has_sheet && <span className="text-green-500" title="Google Sheet connected">Sheet synced</span>}
            <button onClick={handleUndo} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted">
              Undo
            </button>
          </div>
        </div>
      </header>

      {/* Pick Entry */}
      <div className="max-w-[1800px] mx-auto px-4 py-3">
        <PickEntry
          teams={status.teams || []}
          currentTeam={clock?.team || ""}
          onPickMade={handlePickMade}
        />
      </div>

      {/* Tab Navigation (mobile) */}
      <div className="max-w-[1800px] mx-auto px-4 lg:hidden">
        <div className="flex gap-1 border-b border-border mb-3">
          {([["board", "Draft Board"], ["available", "Best Available"], ["team", "My Team"]] as const).map(function ([key, label]) {
            return (
              <button
                key={key}
                onClick={function () { setActiveTab(key); }}
                className={"px-3 py-2 text-sm font-medium border-b-2 transition-colors "
                  + (activeTab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-[1800px] mx-auto px-4 pb-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Left: Draft Board */}
        <div className={"" + (activeTab !== "board" ? " hidden lg:block" : "")}>
          <DraftBoardPanel data={boardData} myTeam={status.my_team || ""} />
        </div>

        {/* Right: Best Available + My Team stacked */}
        <div className="flex flex-col gap-4">
          <div className={"" + (activeTab !== "available" ? " hidden lg:block" : "")}>
            <BestAvailablePanel data={bestAvailable} />
          </div>
          <div className={"" + (activeTab !== "team" ? " hidden lg:block" : "")}>
            <MyTeamPanel data={myTeam} />
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
