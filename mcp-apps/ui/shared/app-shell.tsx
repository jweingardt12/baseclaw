import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { Skeleton } from "@plexui/ui/components/Skeleton";
import { Button } from "@plexui/ui/components/Button";
import { Alert } from "@plexui/ui/components/Alert";
import { LoadingIndicator } from "@plexui/ui/components/Indicator";
import { Maximize2, Minimize2 } from "@/shared/icons";
import { useHostLayout } from "./use-host-layout";

var TOOL_LABELS: Record<string, string> = {
  "yahoo_roster": "roster",
  "yahoo_free_agents": "free agents",
  "yahoo_standings": "standings",
  "yahoo_matchups": "matchups",
  "yahoo_scoreboard": "scoreboard",
  "yahoo_scout_opponent": "scout report",
  "yahoo_lineup_optimize": "lineup",
  "yahoo_streaming": "streaming picks",
  "yahoo_waiver_analyze": "waiver analysis",
  "yahoo_trade_eval": "trade evaluation",
  "yahoo_injury_report": "injury report",
  "yahoo_rankings": "rankings",
  "yahoo_compare": "comparison",
  "yahoo_value": "player value",
  "yahoo_daily_update": "daily update",
  "fantasy_player_report": "player report",
  "yahoo_transaction_trends": "transaction trends",
  "yahoo_set_lineup": "set lineup",
  "yahoo_pending_trades": "pending trades",
  "yahoo_propose_trade": "propose trade",
  "yahoo_accept_trade": "accept trade",
  "yahoo_reject_trade": "reject trade",
  "yahoo_whats_new": "what's new",
  "yahoo_trade_finder": "trade finder",
  "yahoo_week_planner": "week planner",
  "yahoo_closer_monitor": "closer monitor",
  "yahoo_pitcher_matchup": "pitcher matchups",
  "yahoo_league_pulse": "league pulse",
  "yahoo_power_rankings": "power rankings",
  "yahoo_season_pace": "season pace",
  "yahoo_waiver_claim": "waiver claim",
  "yahoo_waiver_claim_swap": "waiver claim swap",
  "yahoo_who_owns": "who owns",
  "yahoo_category_trends": "category trends",
  "yahoo_morning_briefing": "morning briefing",
  "yahoo_league_landscape": "league landscape",
  "yahoo_roster_health_check": "roster health check",
  "yahoo_waiver_recommendations": "waiver recommendations",
  "yahoo_auto_lineup": "auto lineup",
  "yahoo_trade_analysis": "trade analysis",
  "yahoo_game_day_manager": "game day manager",
  "yahoo_waiver_deadline_prep": "waiver deadline prep",
  "yahoo_trade_pipeline": "trade pipeline",
  "yahoo_weekly_digest": "weekly digest",
  "yahoo_season_checkpoint": "season checkpoint",
};

function toolLabel(name: string): string | null {
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];
  if (name) return name.replace(/_/g, " ");
  return null;
}

interface AppShellProps {
  name: string;
  version?: string;
  children: (props: { data: any; toolName: string; app: any; navigate: (newData: any) => void }) => ReactNode;
}

export function AppShell({ name, version = "1.0.0", children }: AppShellProps) {
  var [data, setData] = useState<any>(null);
  var [toolName, setToolName] = useState<string>("");
  var [timedOut, setTimedOut] = useState(false);
  var [cancelled, setCancelled] = useState(false);
  var [errorMsg, setErrorMsg] = useState<string | null>(null);
  var [displayMode, setDisplayMode] = useState("inline");
  var [hostContext, setHostContext] = useState<any>(null);
  var dataRef = useRef(data);

  useEffect(function () {
    dataRef.current = data;
  }, [data]);

  var { app, error } = useApp({
    appInfo: { name, version },
    capabilities: {
      availableDisplayModes: ["inline", "fullscreen", "pip"],
    },
    onAppCreated: useCallback(function (app: any) {
      app.ontoolresult = function (result: any) {
        var sc = result.structuredContent;
        setTimedOut(false);
        setCancelled(false);

        // Handle errors (with or without structuredContent)
        if (result.isError || (sc && sc.type === "_error")) {
          var msg = (sc && sc.message)
            || (result.content && result.content[0] && result.content[0].text)
            || "Tool execution failed";
          setErrorMsg(msg);
          return;
        }

        if (!sc) return;

        setData(sc);
        setToolName(sc.type || "");
        setErrorMsg(null);
        if (app.updateModelContext) {
          var context: Record<string, any> = { structuredContent: sc };
          if (sc.type) context.view = sc.type;
          if (sc.type === "add" || sc.type === "drop" || sc.type === "swap") {
            context.action_taken = sc.type;
            context.success = sc.success;
            context.suggestions = ["View updated roster", "Check category impact", "Review lineup"];
          }
          var needsAttention: string[] = [];
          if (sc.active_off_day && sc.active_off_day.length > 0) {
            needsAttention.push(sc.active_off_day.length + " active players with no game today");
          }
          if (sc.injured_active && sc.injured_active.length > 0) {
            needsAttention.push(sc.injured_active.length + " injured players in active lineup");
          }
          if (sc.weakest && sc.weakest.length > 0) {
            needsAttention.push("Weak categories: " + sc.weakest.join(", "));
          }
          if (needsAttention.length > 0) {
            context.needs_attention = needsAttention;
          }
          app.updateModelContext(context);
        }
      };

      app.ontoolinputpartial = function (input: any) {
        if (input.name) {
          setToolName(input.name);
        }
      };

      app.ontoolcancelled = function () {
        setTimedOut(false);
        if (!dataRef.current) {
          setCancelled(true);
        }
      };

      app.onteardown = function () {
        setData(null);
        setToolName("");
      };

      app.onhostcontextchanged = function (ctx: any) {
        setHostContext(function (prev: any) {
          return { ...(prev || {}), ...(ctx || {}) };
        });
        if (ctx && ctx.displayMode) {
          setDisplayMode(ctx.displayMode);
        }
      };
    }, []),
  });

  useEffect(function () {
    if (!app || !app.getHostContext) return;
    var initial = app.getHostContext();
    if (initial) {
      setHostContext(initial);
      if (initial.displayMode) {
        setDisplayMode(initial.displayMode);
      }
    }
  }, [app]);

  useHostStyles(app, hostContext || app?.getHostContext?.());
  var layout = useHostLayout(hostContext || app?.getHostContext?.());

  var navigate = useCallback(function (newData: any) {
    if (newData) {
      setData(newData);
      setToolName(newData.type || "");
      // Update model context on navigation too
      if (app && app.updateModelContext) {
        app.updateModelContext({ structuredContent: newData, navigated_to: newData.type || "" });
      }
    }
  }, [app]);

  // Timeout for waiting state
  useEffect(function () {
    if (data || !app) return;
    var timer = setTimeout(function () { setTimedOut(true); }, 5000);
    return function () { clearTimeout(timer); };
  }, [data, app]);

  if (error) {
    return (
      <div className="mcp-app-root mcp-app-content">
        <Alert
          color="danger"
          variant="soft"
          title="Connection Error"
          description={String(error)}
          actions={
            <Button variant="outline" color="secondary" onClick={function () { window.location.reload(); }}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="mcp-app-root mcp-app-content">
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="h-5 w-28 animate-shimmer" />
          <div className="h-4 w-44 animate-shimmer" />
        </div>
        <div className="space-y-2">
          <div className="h-10 w-full animate-shimmer" />
          <div className="h-10 w-full animate-shimmer" />
          <div className="h-10 w-full animate-shimmer" />
          <div className="h-10 w-3/4 animate-shimmer" />
        </div>
        <div className="h-6 w-20 animate-shimmer" />
      </div>
    );
  }

  if (!data) {
    if (cancelled) {
      return (
        <div className="mcp-app-root">
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">Tool call was cancelled.</p>
            <p className="text-xs text-muted-foreground mt-1">Ask Claude to try again.</p>
          </div>
        </div>
      );
    }

    if (errorMsg) {
      return (
        <div className="mcp-app-root mcp-app-content p-4">
          <Alert
            color="danger"
            variant="soft"
            title="Something went wrong"
            description={errorMsg}
          />
          <p className="text-xs text-muted-foreground text-center">Ask Claude to try again.</p>
        </div>
      );
    }

    var label = toolName ? toolLabel(toolName) : null;
    return (
      <div className="mcp-app-root">
        <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <LoadingIndicator size={16} />
            <span className="text-sm uppercase tracking-wide">{label ? "Loading " + label + "..." : "Waiting for data..."}</span>
          </div>
          {timedOut && (
            <p className="text-xs text-muted-foreground">
              Taking longer than expected. Make sure a tool has been called.
            </p>
          )}
        </div>
      </div>
    );
  }

  var rootStyle: Record<string, string> = {
    "--safe-area-top": layout.safeAreaInsets.top + "px",
    "--safe-area-right": layout.safeAreaInsets.right + "px",
    "--safe-area-bottom": layout.safeAreaInsets.bottom + "px",
    "--safe-area-left": layout.safeAreaInsets.left + "px",
  };

  return (
    <div
      className={"mcp-app-root mcp-app-content mcp-app-" + layout.widthBucket}
      data-platform={layout.platform}
      data-display-mode={layout.displayMode}
      data-width-bucket={layout.widthBucket}
      data-touch={layout.touchCapable ? "true" : "false"}
      style={rootStyle}
    >
      {layout.canFullscreen && app.requestDisplayMode && (
        <div className="mcp-app-shell-controls">
          <Button
            variant="ghost"
            color="secondary"
            uniform size="sm"
            onClick={function () {
              var newMode = displayMode === "fullscreen" ? "inline" : "fullscreen";
              if (!layout.availableDisplayModes.includes(newMode as any)) return;
              app.requestDisplayMode({ mode: newMode }).catch(function () { return undefined; });
            }}
            title={displayMode === "fullscreen" ? "Exit fullscreen" : "Fullscreen"}
          >
            {displayMode === "fullscreen" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
        </div>
      )}
      <div key={toolName} className="animate-slide-up">
        {children({ data, toolName, app, navigate })}
      </div>
    </div>
  );
}
