type ViewApiEntry = {
  path: string;
  type: string;
  method?: "GET" | "POST";
  body?: Record<string, any>;
};

const VIEW_API_MAP: Record<string, ViewApiEntry> = {
  "roster":              { path: "/api/roster", type: "roster" },
  "free-agents":         { path: "/api/free-agents?pos_type=B&count=20", type: "free-agents" },
  "player-list":         { path: "/api/player-list?pos_type=B&count=50", type: "player-list" },
  "standings":           { path: "/api/standings", type: "standings" },
  "matchups":            { path: "/api/matchups", type: "matchups" },
  "matchup-detail":      { path: "/api/matchup-detail", type: "matchup-detail" },
  "scoreboard":          { path: "/api/scoreboard", type: "scoreboard" },
  "info":                { path: "/api/info", type: "info" },
  "stat-categories":     { path: "/api/stat-categories", type: "stat-categories" },
  "transactions":        { path: "/api/transactions", type: "transactions" },
  "transaction-trends":  { path: "/api/transaction-trends", type: "transaction-trends" },
  "category-check":      { path: "/api/category-check", type: "category-check" },
  "injury-report":       { path: "/api/injury-report", type: "injury-report" },
  "waiver-analyze":      { path: "/api/waiver-analyze?pos_type=B&count=15", type: "waiver-analyze" },
  "lineup-optimize":     { path: "/api/lineup-optimize", type: "lineup-optimize" },
  "streaming":           { path: "/api/streaming", type: "streaming" },
  "daily-update":        { path: "/api/daily-update", type: "daily-update" },
  "scout-opponent":      { path: "/api/scout-opponent", type: "scout-opponent" },
  "matchup-strategy":    { path: "/api/matchup-strategy", type: "matchup-strategy" },
  "trade-builder":       { path: "/api/roster", type: "roster" },
  "category-simulate":   { path: "/api/category-check", type: "category-check" },
  "trade-eval":          { path: "/api/trade-eval", type: "trade-eval", method: "POST", body: { give_ids: "0", get_ids: "1" } },
  "draft-status":        { path: "/api/draft-status", type: "draft-status" },
  "draft-recommend":     { path: "/api/draft-recommend", type: "draft-recommend" },
  "best-available":      { path: "/api/best-available?pos_type=B&count=25", type: "best-available" },
  "draft-cheatsheet":    { path: "/api/draft-cheatsheet", type: "draft-cheatsheet" },
  "rankings":            { path: "/api/rankings?pos_type=B&count=25", type: "rankings" },
  "compare":             { path: "/api/compare?player1=Shohei+Ohtani&player2=Aaron+Judge", type: "compare" },
  "value":               { path: "/api/value?player_name=Shohei+Ohtani", type: "value" },
  "mlb-teams":           { path: "/api/mlb/teams", type: "mlb-teams" },
  "mlb-roster":          { path: "/api/mlb/roster?team=NYY", type: "mlb-roster" },
  "mlb-player":          { path: "/api/mlb/player?player_id=660271", type: "mlb-player" },
  "mlb-stats":           { path: "/api/mlb/stats?player_id=660271", type: "mlb-stats" },
  "mlb-injuries":        { path: "/api/mlb/injuries", type: "mlb-injuries" },
  "mlb-standings":       { path: "/api/mlb/standings", type: "mlb-standings" },
  "mlb-schedule":        { path: "/api/mlb/schedule", type: "mlb-schedule" },
  "league-history":      { path: "/api/league-history", type: "league-history" },
  "record-book":         { path: "/api/record-book", type: "record-book" },
  "past-standings":      { path: "/api/past-standings?year=2025", type: "past-standings" },
  "past-draft":          { path: "/api/past-draft?year=2025", type: "past-draft" },
  "past-teams":          { path: "/api/past-teams?year=2025", type: "past-teams" },
  "past-trades":         { path: "/api/past-trades?year=2025", type: "past-trades" },
  "past-matchup":        { path: "/api/past-matchup?year=2025&week=1", type: "past-matchup" },
  "intel-player":        { path: "/api/intel/player?name=Shohei+Ohtani", type: "intel-player" },
  "intel-breakouts":     { path: "/api/intel/breakouts?pos_type=B&count=15", type: "intel-breakouts" },
  "intel-busts":         { path: "/api/intel/busts?pos_type=B&count=15", type: "intel-busts" },
  "intel-reddit":        { path: "/api/intel/reddit", type: "intel-reddit" },
  "intel-trending":      { path: "/api/intel/trending", type: "intel-trending" },
  "intel-prospects":     { path: "/api/intel/prospects", type: "intel-prospects" },
  "intel-transactions":  { path: "/api/intel/transactions?days=7", type: "intel-transactions" },
  "set-lineup":          { path: "/api/set-lineup", type: "set-lineup" },
  "pending-trades":      { path: "/api/pending-trades", type: "pending-trades" },
  "trade-action":        { path: "/api/pending-trades", type: "pending-trades" },
  "whats-new":           { path: "/api/whats-new", type: "whats-new" },
  "trade-finder":        { path: "/api/trade-finder", type: "trade-finder" },
  "week-planner":        { path: "/api/week-planner", type: "week-planner" },
  "closer-monitor":      { path: "/api/closer-monitor", type: "closer-monitor" },
  "pitcher-matchup":     { path: "/api/pitcher-matchup", type: "pitcher-matchup" },
  "league-pulse":        { path: "/api/league-pulse", type: "league-pulse" },
  "power-rankings":      { path: "/api/power-rankings", type: "power-rankings" },
  "season-pace":         { path: "/api/season-pace", type: "season-pace" },
  "who-owns":            { path: "/api/who-owns?player_name=Pete+Alonso", type: "who-owns" },
  "morning-briefing":    { path: "/api/workflow/morning-briefing", type: "morning-briefing" },
  "category-trends":     { path: "/api/category-trends", type: "category-trends" },
  "punt-advisor":        { path: "/api/punt-advisor", type: "punt-advisor" },
  "playoff-planner":     { path: "/api/playoff-planner", type: "playoff-planner" },
  "optimal-moves":       { path: "/api/optimal-moves", type: "optimal-moves" },
  "il-stash-advisor":    { path: "/api/il-stash-advisor", type: "il-stash-advisor" },
  "trash-talk":          { path: "/api/trash-talk", type: "trash-talk" },
  "rival-history":       { path: "/api/rival-history", type: "rival-history" },
  "achievements":        { path: "/api/achievements", type: "achievements" },
  "weekly-narrative":    { path: "/api/weekly-narrative", type: "weekly-narrative" },
  "faab-recommend":      { path: "/api/faab-recommend?name=Shohei+Ohtani", type: "faab-recommend" },
  "ownership-trends":    { path: "/api/ownership-trends?name=Shohei+Ohtani", type: "ownership-trends" },
  "roster-stats":        { path: "/api/roster-stats", type: "roster-stats" },
};

export async function fetchViewData(viewId: string): Promise<any> {
  const entry = VIEW_API_MAP[viewId];
  if (!entry) return null;
  const method = entry.method || "GET";
  const init = method === "POST"
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.body || {}),
      }
    : undefined;
  const res = await fetch(entry.path, init);
  if (!res.ok) throw new Error("API error: " + res.status);
  const data = await res.json();
  return { type: entry.type, ...data };
}

const POST_TOOLS = new Set(["yahoo_add", "yahoo_drop", "yahoo_swap", "yahoo_trade_eval"]);
const PARAM_RENAMES: Record<string, Record<string, string>> = {
  yahoo_search: { player_name: "name" },
  yahoo_value: { player_name: "name" },
  fantasy_player_report: { player_name: "name" },
};

const WORKFLOW_TOOL_MAP: Record<string, { path: string; type: string }> = {
  yahoo_morning_briefing: { path: "/api/workflow/morning-briefing", type: "morning-briefing" },
};

const INTEL_TOOL_MAP: Record<string, { path: string; type: string }> = {
  fantasy_player_report:       { path: "/api/intel/player", type: "intel-player" },
  fantasy_breakout_candidates: { path: "/api/intel/breakouts", type: "intel-breakouts" },
  fantasy_bust_candidates:     { path: "/api/intel/busts", type: "intel-busts" },
  fantasy_reddit_buzz:         { path: "/api/intel/reddit", type: "intel-reddit" },
  fantasy_trending_players:    { path: "/api/intel/trending", type: "intel-trending" },
  fantasy_prospect_watch:      { path: "/api/intel/prospects", type: "intel-prospects" },
  fantasy_transactions:        { path: "/api/intel/transactions", type: "intel-transactions" },
};

export function createLiveApp() {
  return {
    callServerTool: async ({ name, arguments: args }: { name: string; arguments: Record<string, any> }) => {
      let apiPath: string;
      let type: string;
      const workflowEntry = WORKFLOW_TOOL_MAP[name];
      const intelEntry = INTEL_TOOL_MAP[name];
      if (workflowEntry) {
        apiPath = workflowEntry.path;
        type = workflowEntry.type;
      } else if (intelEntry) {
        apiPath = intelEntry.path;
        type = intelEntry.type;
      } else if (name.startsWith("mlb_")) {
        const rest = name.slice(4).replace(/_/g, "-");
        apiPath = "/api/mlb/" + rest;
        type = "mlb-" + rest;
      } else {
        const rest = name.replace(/^yahoo_/, "").replace(/_/g, "-");
        apiPath = "/api/" + rest;
        type = rest;
      }

      const renames = PARAM_RENAMES[name] || {};
      const mapped: Record<string, any> = {};
      for (const [k, v] of Object.entries(args || {})) {
        mapped[renames[k] || k] = v;
      }

      let data: any;
      if (POST_TOOLS.has(name)) {
        const res = await fetch(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mapped),
        });
        data = await res.json();
      } else {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(mapped)) {
          if (v !== undefined && v !== "") params.set(k, String(v));
        }
        const qs = params.toString();
        const res = await fetch(apiPath + (qs ? "?" + qs : ""));
        data = await res.json();
      }

      return { structuredContent: { type, ...data } };
    },
  };
}
