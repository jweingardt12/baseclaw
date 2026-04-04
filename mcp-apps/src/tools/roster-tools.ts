import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { apiGet, apiPost } from "../api/python-client.js";
import { APP_RESOURCE_DOMAINS } from "../api/csp.js";
import { pid, buildFooter, sampleWarning } from "../api/format-text.js";
import { READ_ANNO, WRITE_ANNO, WRITE_DESTRUCTIVE_ANNO } from "../api/annotations.js";
import { str, type RosterResponse, type FreeAgentsResponse, type PlayerListResponse, type SearchResponse, type ActionResponse, type WaiverClaimResponse, type WaiverClaimSwapResponse, type WhoOwnsResponse, type PercentOwnedResponse, type ChangeTeamNameResponse, type ChangeTeamLogoResponse, type PlayerStatsResponse, type WaiversResponse, type TakenPlayersResponse } from "../api/types.js";
import { defineTool } from "../api/define-tool.js";

export const ROSTER_URI = "ui://baseclaw/roster.html";

export function registerRosterTools(server: McpServer, distDir: string, writesEnabled: boolean = false, enabledTools?: Set<string>) {
  // Register the app resource for roster UI
  registerAppResource(
    server,
    "Roster View",
    ROSTER_URI,
    { description: "Interactive roster management view" },
    async () => ({
      contents: [{
        uri: ROSTER_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await fs.readFile(path.join(distDir, "roster.html"), "utf-8"),
        _meta: {
          ui: {
            csp: {
              resourceDomains: APP_RESOURCE_DOMAINS,
            },
          },
        },
      }],
    }),
  );

  // yahoo_roster
  defineTool(server, "yahoo_roster", {
    description: "Use this to see your full fantasy roster — every player, their assigned position, eligible positions, injury status, Statcast quality tier, and hot/cold trend. Returns player IDs needed for add/drop/trade tools.",
    annotations: READ_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async () => {
    var data = await apiGet<RosterResponse>("/api/roster");
    var text = "Current Roster:\n" + data.players.map((p) => {
      var posLabel = p.position === "NA" ? "NA*" : str(p.position || "?");
      var line = "  " + posLabel.padEnd(4) + " " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",")
        + pid(p.player_id) + (p.status ? " [" + p.status + "]" : "")
        + (p.position === "NA" ? " (minor league stash)" : "");
      if (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) {
        line += " {" + p.intel.statcast.quality_tier + "}";
      }
      if (p.intel && p.intel.trends && p.intel.trends.hot_cold && p.intel.trends.hot_cold !== "neutral") {
        line += " [" + p.intel.trends.hot_cold + "]";
      }
      return line;
    }).join("\n");
    var players = data.players || [];
    var injured = players.filter(function (p) { return p.status && p.status !== "Healthy"; });
    var eliteStrong = players.filter(function (p) { return p.intel && p.intel.statcast && (p.intel.statcast.quality_tier === "elite" || p.intel.statcast.quality_tier === "strong"); }).length;
    var belowPoor = players.filter(function (p) { return p.intel && p.intel.statcast && (p.intel.statcast.quality_tier === "below" || p.intel.statcast.quality_tier === "poor"); }).length;
    var hot = players.filter(function (p) { return p.intel && p.intel.trends && p.intel.trends.hot_cold === "hot"; }).length;
    var cold = players.filter(function (p) { return p.intel && p.intel.trends && (p.intel.trends.hot_cold === "cold" || p.intel.trends.hot_cold === "ice"); }).length;

    var assessment = eliteStrong + " elite/strong quality, " + belowPoor + " below/poor."
      + (injured.length > 0 ? " " + injured.length + " injured." : " Fully healthy.")
      + (hot > 0 ? " " + hot + " hot." : "")
      + (cold > 0 ? " " + cold + " cold." : "");

    var steps: string[] = [];
    if (injured.length > 0) steps.push("Fix " + injured.length + " injur" + (injured.length === 1 ? "y" : "ies") + " -> yahoo_injury_report");
    steps.push("Optimize today's lineup -> yahoo_lineup_optimize");
    if (belowPoor > 0) steps.push("Find upgrades for " + belowPoor + " weak spots -> yahoo_waiver_recommendations");
    if (cold > 0) steps.push("Check regression signals on cold players -> fantasy_regression_candidates");

    var ai_recommendation = "Roster quality: " + assessment
      + (belowPoor > 0 ? " Use yahoo_optimal_moves to find upgrade swaps." : "");

    return {
      text: text + sampleWarning(players) + buildFooter(assessment, steps),
      structured: { type: "roster", ai_recommendation, ...data },
    };
  }, enabledTools);

  // yahoo_free_agents
  defineTool(server, "yahoo_free_agents", {
    description: "Use this to browse the best available free agents in the league. Set pos_type='B' for batters or 'P' for pitchers. Returns players sorted by ownership % with stats.",
    inputSchema: {
      pos_type: z.string().describe("B for batters, P for pitchers").default("B"),
      count: z.coerce.number().describe("Number of free agents to return").default(20),
      limit: z.coerce.number().default(25).describe("Max results to return (default 25, max 50)"),
      offset: z.coerce.number().default(0).describe("Offset for pagination"),
    },
    annotations: READ_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async (args) => {
    var pos_type = args.pos_type as string;
    var count = args.count as number;
    var limit = args.limit as number;
    var offset = args.offset as number;
    var data = await apiGet<FreeAgentsResponse>("/api/free-agents", { pos_type, count: String(count), limit: String(limit), offset: String(offset) });
    var label = pos_type === "B" ? "Batters" : "Pitchers";
    var text = "Top " + count + " Free Agent " + label + ":\n" + data.players.map((p: any) => {
      var line = "  " + str(p.name).padEnd(25) + " " + str(p.positions || "?").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned  (id:" + p.player_id + ")";
      if (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) {
        line += " {" + p.intel.statcast.quality_tier + "}";
      }
      if (p.intel && p.intel.trends && p.intel.trends.hot_cold && p.intel.trends.hot_cold !== "neutral") {
        line += " [" + p.intel.trends.hot_cold + "]";
      }
      // Game info
      if (p.game_time && p.opponent) {
        line += "  " + p.game_time + " " + p.opponent;
      } else if (p.opponent) {
        line += "  " + p.opponent;
      }
      // Advanced stats summary
      var adv: string[] = [];
      if (p.z_score) adv.push("z=" + Number(p.z_score).toFixed(2));
      if (p.advanced) {
        if (p.advanced.babip != null) adv.push("BABIP " + Number(p.advanced.babip).toFixed(3));
        if (p.advanced.hr_fb_rate != null) adv.push("HR/FB " + Number(p.advanced.hr_fb_rate * 100).toFixed(1) + "%");
        if (p.advanced.siera != null) adv.push("SIERA " + Number(p.advanced.siera).toFixed(2));
      }
      var sc = p.intel && p.intel.statcast;
      if (sc && sc.expected && sc.expected.xwoba != null) adv.push("xwOBA " + sc.expected.xwoba);
      if (adv.length > 0) line += "\n    " + adv.join(" | ");
      return line;
    }).join("\n");
    var top = (data.players || []).slice(0, 3);
    var ai_recommendation = top.length > 0
      ? "Top available: " + top.map(function (p) { return p.name; }).join(", ") + ". Use yahoo_waiver_recommendations for z-score ranked picks tailored to your category needs."
      : null;
    var footer = buildFooter(
      data.players.length + " free agent " + label.toLowerCase() + " available.",
      [
        "Z-score ranked recommendations -> yahoo_waiver_recommendations",
        "Deep-dive any player -> fantasy_player_report {player_name}",
        "Add a player -> yahoo_add {player_id} (or yahoo_swap to add+drop atomically)",
      ]
    );
    return {
      text: text + sampleWarning(data.players) + footer,
      structured: { type: "free-agents", ai_recommendation, ...data },
    };
  }, enabledTools);

  // yahoo_player_list
  defineTool(server, "yahoo_player_list", {
    description: "Use this to explore the full player universe with granular position filters (C, 1B, 2B, SS, 3B, OF, SP, RP) and ownership stats. Returns enriched player data including stats and Statcast tiers.",
    inputSchema: {
      pos_type: z.string().describe("Position filter: B (all batters), P (all pitchers), C, 1B, 2B, SS, 3B, OF, SP, RP, Util").default("B"),
      count: z.coerce.number().describe("Number of players to return").default(50),
      status: z.string().describe("FA for free agents only, ALL for all players").default("FA"),
      limit: z.coerce.number().default(25).describe("Max results to return (default 25, max 50)"),
      offset: z.coerce.number().default(0).describe("Offset for pagination"),
    },
    annotations: READ_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async (args) => {
    var pos_type = args.pos_type as string;
    var count = args.count as number;
    var status = args.status as string;
    var limit = args.limit as number;
    var offset = args.offset as number;
    var data = await apiGet<PlayerListResponse>("/api/player-list", { pos_type, count: String(count), status, limit: String(limit), offset: String(offset) });
    var label = pos_type === "B" ? "Batters" : pos_type === "P" ? "Pitchers" : pos_type;
    var text = "Player List - " + label + " (" + data.count + " players):\n" + (data.players || []).slice(0, 25).map((p) => {
      var line = "  " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned" + pid(p.player_id);
      if (p.stats) {
        var statParts: string[] = [];
        for (var [k, v] of Object.entries(p.stats)) {
          statParts.push(k + ":" + v);
        }
        if (statParts.length > 0) line += "  [" + statParts.slice(0, 5).join(" ") + "]";
      }
      return line;
    }).join("\n");
    var top = (data.players || []).slice(0, 3);
    var ai_recommendation: string | null = null;
    if (top.length > 0) {
      ai_recommendation = "Top available: " + top.map(function (p) { return p.name; }).join(", ") + ". Review stats and ownership trends to find the best pickup.";
    }
    return {
      text,
      structured: { type: "player-list", ai_recommendation, ...data },
    };
  }, enabledTools);

  // yahoo_search
  defineTool(server, "yahoo_search", {
    description: "Use this to find a specific player by name among free agents. Returns matching players with positions, ownership %, and player IDs.",
    inputSchema: { player_name: z.string().describe("Player name to search for") },
    annotations: READ_ANNO,
    _meta: {},
  }, async (args) => {
    var player_name = args.player_name as string;
    var data = await apiGet<SearchResponse>("/api/search", { name: player_name });
    var text = data.results && data.results.length > 0
      ? "Free agents matching: " + player_name + "\n" + data.results.map((p) =>
          "  " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned  (id:" + p.player_id + ")"
        ).join("\n")
      : "No free agents found matching: " + player_name;
    var ai_recommendation: string | null = null;
    if (data.results && data.results.length > 0) {
      ai_recommendation = data.results.length + " result" + (data.results.length === 1 ? "" : "s") + " found for \"" + player_name + "\". Review ownership % to gauge value.";
    }
    return {
      text,
      structured: { type: "search", ai_recommendation, ...data },
    };
  }, enabledTools);

  if (writesEnabled) {

  // yahoo_add
  defineTool(server, "yahoo_add", {
    description: "Use this to add a free agent to your roster. Requires the Yahoo player ID (get it from yahoo_roster, yahoo_search, or yahoo_free_agents).",
    inputSchema: { player_id: z.string().describe("Yahoo player ID to add") },
    annotations: WRITE_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async (args) => {
    var player_id = args.player_id as string;
    var data = await apiPost<ActionResponse>("/api/add", { player_id });
    return { text: data.message || "Add result: " + JSON.stringify(data) };
  }, enabledTools);

  // yahoo_drop
  defineTool(server, "yahoo_drop", {
    description: "Use this to permanently drop a player from your roster. The player becomes a free agent available to other teams. Requires the Yahoo player ID from yahoo_roster.",
    inputSchema: { player_id: z.string().describe("Yahoo player ID to drop") },
    annotations: WRITE_DESTRUCTIVE_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async (args) => {
    var player_id = args.player_id as string;
    var data = await apiPost<ActionResponse>("/api/drop", { player_id });
    return { text: data.message || "Drop result: " + JSON.stringify(data) };
  }, enabledTools);

  // yahoo_swap
  defineTool(server, "yahoo_swap", {
    description: "Use this to atomically add a free agent and drop a roster player in one transaction. Guarantees both happen together so your roster stays full. Requires player IDs from yahoo_roster and yahoo_free_agents.",
    inputSchema: { add_id: z.string().describe("Yahoo player ID to add"), drop_id: z.string().describe("Yahoo player ID to drop") },
    annotations: WRITE_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async (args) => {
    var add_id = args.add_id as string;
    var drop_id = args.drop_id as string;
    var data = await apiPost<ActionResponse>("/api/swap", { add_id, drop_id });
    return { text: data.message || "Swap result: " + JSON.stringify(data) };
  }, enabledTools);

  // yahoo_waiver_claim
  defineTool(server, "yahoo_waiver_claim", {
    description: "Use this to submit a waiver claim for a player in the claim period (not yet a free agent). Supports optional FAAB bid amount and optional drop player for claim+drop combos.",
    inputSchema: { player_id: z.string().describe("Yahoo player ID to claim"), drop_id: z.string().describe("Yahoo player ID to drop (optional, for claim+drop)").optional(), faab: z.coerce.number().describe("FAAB bid amount in dollars").optional() },
    annotations: WRITE_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async (args) => {
    var player_id = args.player_id as string;
    var drop_id = args.drop_id as string | undefined;
    var faab = args.faab as number | undefined;
    if (drop_id) {
      var body: Record<string, string> = { add_id: player_id, drop_id };
      if (faab !== undefined) body.faab = String(faab);
      var data = await apiPost<WaiverClaimSwapResponse>("/api/waiver-claim-swap", body);
      return { text: data.message || "Waiver claim+drop result: " + JSON.stringify(data) };
    } else {
      var body2: Record<string, string> = { player_id };
      if (faab !== undefined) body2.faab = String(faab);
      var data2 = await apiPost<WaiverClaimResponse>("/api/waiver-claim", body2);
      return { text: data2.message || "Waiver claim result: " + JSON.stringify(data2) };
    }
  }, enabledTools);

  // yahoo_browser_status
  defineTool(server, "yahoo_browser_status", {
    description: "Use this to verify whether the browser session for write operations (add, drop, trade, lineup changes) is still valid. Returns cookie count and session status. Use this before any write operation fails, or when yahoo_add/yahoo_drop/yahoo_propose_trade return auth errors.",
    annotations: READ_ANNO,
    _meta: {},
  }, async () => {
    var data = await apiGet<{ valid: boolean; reason?: string; cookie_count?: number }>("/api/browser-login-status");
    var text = data.valid
      ? "Browser session is valid (" + (data.cookie_count || 0) + " Yahoo cookies)"
      : "Browser session not valid: " + (data.reason || "unknown") + ". Run './yf browser-login' to set up.";
    return { text };
  }, enabledTools);

  // yahoo_change_team_name
  defineTool(server, "yahoo_change_team_name", {
    description: "Use this to update your fantasy team's display name in the league. Takes the new name as a string parameter. Use yahoo_change_team_logo instead when you want to change your team's avatar image.",
    inputSchema: { new_name: z.string().describe("New team name") },
    annotations: WRITE_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async (args) => {
    var new_name = args.new_name as string;
    var data = await apiPost<ChangeTeamNameResponse>("/api/change-team-name", { new_name });
    return { text: data.message || "Result: " + JSON.stringify(data) };
  }, enabledTools);

  // yahoo_change_team_logo
  defineTool(server, "yahoo_change_team_logo", {
    description: "Use this to update your fantasy team's logo image. Requires an absolute file path to a PNG or JPG image inside the container. Use yahoo_change_team_name instead when you want to change your team's display name.",
    inputSchema: { image_path: z.string().describe("Absolute path to image file (PNG/JPG) inside the container") },
    annotations: WRITE_ANNO,
    _meta: { ui: { resourceUri: ROSTER_URI } },
  }, async (args) => {
    var image_path = args.image_path as string;
    var data = await apiPost<ChangeTeamLogoResponse>("/api/change-team-logo", { image_path });
    return { text: data.message || "Result: " + JSON.stringify(data) };
  }, enabledTools);

  } // end writesEnabled

  // yahoo_who_owns
  defineTool(server, "yahoo_who_owns", {
    description: "Use this to check whether a specific player is owned, on waivers, or a free agent. Returns the owner's team name if rostered.",
    inputSchema: { player_id: z.string().describe("Yahoo player ID to look up") },
    annotations: READ_ANNO,
    _meta: {},
  }, async (args) => {
    var player_id = args.player_id as string;
    var data = await apiGet<WhoOwnsResponse>("/api/who-owns", { player_id });
    var text = "";
    if (data.ownership_type === "team") {
      text = "Player " + player_id + " is owned by: " + data.owner;
    } else if (data.ownership_type === "freeagents") {
      text = "Player " + player_id + " is a free agent";
    } else if (data.ownership_type === "waivers") {
      text = "Player " + player_id + " is on waivers";
    } else {
      text = "Player " + player_id + " ownership: " + data.ownership_type;
    }
    var ai_recommendation: string | null = null;
    if (data.ownership_type === "freeagents") {
      ai_recommendation = "This player is available as a free agent. Consider adding if they fill a roster need.";
    } else if (data.ownership_type === "waivers") {
      ai_recommendation = "This player is on waivers. Submit a waiver claim to add them.";
    }
    return {
      text,
      structured: { type: "who-owns", ai_recommendation, ...data },
    };
  }, enabledTools);

  // yahoo_percent_owned
  defineTool(server, "yahoo_percent_owned", {
    description: "Use this to look up ownership percentages across all Yahoo leagues for one or more players by their IDs. Accepts comma-separated player IDs.",
    inputSchema: { ids: z.string().describe("Comma-separated Yahoo player IDs (e.g. '10660,9542')") },
    annotations: READ_ANNO,
    _meta: {},
  }, async (args) => {
    var ids = args.ids as string;
    var data = await apiGet<PercentOwnedResponse>("/api/percent-owned", { ids });
    if (!data.players || data.players.length === 0) {
      return { text: "No ownership data returned" };
    }
    var lines = ["Percent Owned:"];
    for (var p of data.players) {
      lines.push("  " + str(p.name).padEnd(25) + " " + String(p.percent_owned).padStart(5) + "%  (id:" + str(p.player_id) + ")");
    }
    return { text: lines.join("\n") };
  }, enabledTools);

  // yahoo_player_stats
  defineTool(server, "yahoo_player_stats", {
    description: "Use this to pull a specific player's fantasy stats from Yahoo for any time period (season, lastweek, lastmonth, specific week, or date). Returns all scoring category stats. Use yahoo_value instead for z-score breakdown, or fantasy_player_report for a full scouting report combining stats + Statcast + trends.",
    inputSchema: {
      player_name: z.string().describe("Player name to look up"),
      period: z.string().describe("Stats period: season, average_season, lastweek, lastmonth, week, date").default("season"),
      week: z.string().describe("Week number (when period=week)").default(""),
      date: z.string().describe("Date YYYY-MM-DD (when period=date)").default(""),
    },
    annotations: READ_ANNO,
    _meta: {},
  }, async (args) => {
    var player_name = args.player_name as string;
    var period = args.period as string;
    var week = args.week as string;
    var date = args.date as string;
    var params: Record<string, string> = { name: player_name, period };
    if (week) params.week = week;
    if (date) params.date = date;
    var data = await apiGet<PlayerStatsResponse>("/api/player-stats", params);
    var lines = ["Stats for " + data.player_name + " (" + data.period + "):"];
    var stats = data.stats || {};
    for (var [key, val] of Object.entries(stats)) {
      if (key !== "player_id" && key !== "name") {
        lines.push("  " + str(key).padEnd(20) + str(val));
      }
    }
    return {
      text: lines.join("\n"),
      structured: { ...data },
    };
  }, enabledTools);

  // yahoo_waivers
  defineTool(server, "yahoo_waivers", {
    description: "Use this to see which recently dropped players are currently in the waiver claim period and not yet free agents. Returns player names, positions, ownership %, and IDs needed for yahoo_waiver_claim.",
    inputSchema: {
      limit: z.coerce.number().default(20).describe("Max results to return (default 20, max 50)"),
      offset: z.coerce.number().default(0).describe("Offset for pagination"),
    },
    annotations: READ_ANNO,
    _meta: {},
  }, async (args) => {
    var limit = args.limit as number;
    var offset = args.offset as number;
    var data = await apiGet<WaiversResponse>("/api/waivers", { limit: String(limit), offset: String(offset) });
    var players = data.players || [];
    var text = players.length > 0
      ? "Players on Waivers (" + players.length + "):\n" + players.map((p) => {
          var line = "  " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned  (id:" + p.player_id + ")";
          if (p.status) line += " [" + p.status + "]";
          return line;
        }).join("\n")
      : "No players currently on waivers.";
    var ai_recommendation = players.length > 0
      ? players.length + " player" + (players.length === 1 ? "" : "s") + " on waivers. Submit waiver claims before the deadline to add them."
      : null;
    return {
      text,
      structured: { ai_recommendation, ...data },
    };
  }, enabledTools);

  // yahoo_all_rostered
  defineTool(server, "yahoo_all_rostered", {
    description: "Use this to see every rostered player across all league teams, optionally filtered by position. Returns player names, owners, and ownership percentages.",
    inputSchema: {
      position: z.string().describe("Filter by position (e.g. OF, SP, C). Empty for all.").default(""),
      limit: z.coerce.number().default(25).describe("Max results to return (default 25, max 50)"),
      offset: z.coerce.number().default(0).describe("Offset for pagination"),
    },
    annotations: READ_ANNO,
    _meta: {},
  }, async (args) => {
    var position = args.position as string;
    var limit = args.limit as number;
    var offset = args.offset as number;
    var params: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (position) params.position = position;
    var data = await apiGet<TakenPlayersResponse>("/api/taken-players", params);
    var players = data.players || [];
    var label = position ? "Rostered " + position + " Players" : "All Rostered Players";
    var text = label + " (" + data.count + "):\n" + players.slice(0, 50).map((p) => {
      var line = "  " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned";
      line += pid(p.player_id);
      if (p.owner) line += "  -> " + p.owner;
      return line;
    }).join("\n");
    return {
      text,
      structured: { ...data },
    };
  }, enabledTools);
}
