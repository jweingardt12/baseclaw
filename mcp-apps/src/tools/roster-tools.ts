import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { apiGet, apiPost, toolError } from "../api/python-client.js";
import { pid } from "../api/format-text.js";
import { str, type RosterResponse, type FreeAgentsResponse, type PlayerListResponse, type SearchResponse, type ActionResponse, type WaiverClaimResponse, type WaiverClaimSwapResponse, type WhoOwnsResponse, type PercentOwnedResponse, type ChangeTeamNameResponse, type ChangeTeamLogoResponse, type PlayerStatsResponse, type WaiversResponse, type TakenPlayersResponse } from "../api/types.js";
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export const ROSTER_URI = "ui://baseclaw/roster.html";

export function registerRosterTools(server: McpServer, distDir: string, writesEnabled: boolean = false, enabledTools?: Set<string>) {
  const shouldRegister = (name: string) => _shouldRegister(enabledTools, name);
  // Register the app resource for roster UI
  registerAppResource(
    server,
    "Roster View",
    ROSTER_URI,
    {
      description: "Interactive roster management view",
      _meta: {
        ui: {
          csp: {
            resourceDomains: [
              "img.mlbstatic.com",
              "www.mlbstatic.com",
              "s.yimg.com",
              "securea.mlb.com",
            ],
          },
          permissions: { clipboardWrite: {} },
          prefersBorder: true,
        },
      },
    },
    async () => ({
      contents: [{
        uri: ROSTER_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await fs.readFile(path.join(distDir, "roster.html"), "utf-8"),
      }],
    }),
  );

  // yahoo_roster
  if (shouldRegister("yahoo_roster")) {
  registerAppTool(
    server,
    "yahoo_roster",
    {
      description: "Use this to see your full fantasy roster — every player, their assigned position, eligible positions, injury status, Statcast quality tier, and hot/cold trend. Returns player IDs needed for add/drop/trade tools.",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async () => {
      try {
        const data = await apiGet<RosterResponse>("/api/roster");
        const text = "Current Roster:\n" + data.players.map((p) => {
          let line = "  " + str(p.position || "?").padEnd(4) + " " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",")
            + pid(p.player_id) + (p.status ? " [" + p.status + "]" : "");
          if (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) {
            line += " {" + p.intel.statcast.quality_tier + "}";
          }
          if (p.intel && p.intel.trends && p.intel.trends.hot_cold && p.intel.trends.hot_cold !== "neutral") {
            line += " [" + p.intel.trends.hot_cold + "]";
          }
          return line;
        }).join("\n");
        var injured = (data.players || []).filter(function (p) { return p.status && p.status !== "Healthy"; });
        var ai_recommendation = injured.length > 0
          ? injured.length + " player" + (injured.length === 1 ? "" : "s") + " on your roster " + (injured.length === 1 ? "has" : "have") + " an injury designation. Check IL eligibility."
          : "Roster is fully healthy. No injury concerns.";
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "roster", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_free_agents
  if (shouldRegister("yahoo_free_agents")) {
  registerAppTool(
    server,
    "yahoo_free_agents",
    {
      description: "Use this to browse the best available free agents in the league. Set pos_type='B' for batters or 'P' for pitchers. Returns players sorted by ownership % with stats.",
      inputSchema: {
        pos_type: z.string().describe("B for batters, P for pitchers").default("B"),
        count: z.number().describe("Number of free agents to return").default(20),
        limit: z.number().default(25).describe("Max results to return (default 25, max 50)"),
        offset: z.number().default(0).describe("Offset for pagination"),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async ({ pos_type, count, limit, offset }) => {
      try {
        const data = await apiGet<FreeAgentsResponse>("/api/free-agents", { pos_type, count: String(count), limit: String(limit), offset: String(offset) });
        const label = pos_type === "B" ? "Batters" : "Pitchers";
        const text = "Top " + count + " Free Agent " + label + ":\n" + data.players.map((p) => {
          let line = "  " + str(p.name).padEnd(25) + " " + str(p.positions || "?").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned  (id:" + p.player_id + ")";
          if (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) {
            line += " {" + p.intel.statcast.quality_tier + "}";
          }
          if (p.intel && p.intel.trends && p.intel.trends.hot_cold && p.intel.trends.hot_cold !== "neutral") {
            line += " [" + p.intel.trends.hot_cold + "]";
          }
          return line;
        }).join("\n");
        var top = (data.players || []).slice(0, 3);
        var ai_recommendation: string | null = null;
        if (top.length > 0) {
          ai_recommendation = "Top available: " + top.map(function (p) { return p.name; }).join(", ") + ". These players address roster needs based on ownership trends.";
        }
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            type: "free-agents",
            ai_recommendation,
            ...data,
            _pagination: {
              returned: (data.players || []).length,
              offset: offset,
              has_more: (data.players || []).length >= limit,
            },
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_player_list
  if (shouldRegister("yahoo_player_list")) {
  registerAppTool(
    server,
    "yahoo_player_list",
    {
      description: "Use this to explore the full player universe with granular position filters (C, 1B, 2B, SS, 3B, OF, SP, RP) and ownership stats. Returns enriched player data including stats and Statcast tiers.",
      inputSchema: {
        pos_type: z.string().describe("Position filter: B (all batters), P (all pitchers), C, 1B, 2B, SS, 3B, OF, SP, RP, Util").default("B"),
        count: z.number().describe("Number of players to return").default(50),
        status: z.string().describe("FA for free agents only, ALL for all players").default("FA"),
        limit: z.number().default(25).describe("Max results to return (default 25, max 50)"),
        offset: z.number().default(0).describe("Offset for pagination"),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async ({ pos_type, count, status, limit, offset }) => {
      try {
        const data = await apiGet<PlayerListResponse>("/api/player-list", { pos_type, count: String(count), status, limit: String(limit), offset: String(offset) });
        const label = pos_type === "B" ? "Batters" : pos_type === "P" ? "Pitchers" : pos_type;
        const text = "Player List - " + label + " (" + data.count + " players):\n" + (data.players || []).slice(0, 25).map((p) => {
          let line = "  " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned" + pid(p.player_id);
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
          content: [{ type: "text" as const, text }],
          structuredContent: {
            type: "player-list",
            ai_recommendation,
            ...data,
            _pagination: {
              returned: (data.players || []).length,
              offset: offset,
              has_more: (data.players || []).length >= limit,
            },
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_search
  if (shouldRegister("yahoo_search")) {
  registerAppTool(
    server,
    "yahoo_search",
    {
      description: "Use this to find a specific player by name among free agents. Returns matching players with positions, ownership %, and player IDs.",
      inputSchema: { player_name: z.string().describe("Player name to search for") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name }) => {
      try {
        const data = await apiGet<SearchResponse>("/api/search", { name: player_name });
        const text = data.results && data.results.length > 0
          ? "Free agents matching: " + player_name + "\n" + data.results.map((p) =>
              "  " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned  (id:" + p.player_id + ")"
            ).join("\n")
          : "No free agents found matching: " + player_name;
        var ai_recommendation: string | null = null;
        if (data.results && data.results.length > 0) {
          ai_recommendation = data.results.length + " result" + (data.results.length === 1 ? "" : "s") + " found for \"" + player_name + "\". Review ownership % to gauge value.";
        }
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "search", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  if (writesEnabled) {

  // yahoo_add
  if (shouldRegister("yahoo_add")) {
  registerAppTool(
    server,
    "yahoo_add",
    {
      description: "Use this to add a free agent to your roster. Requires the Yahoo player ID (get it from yahoo_roster, yahoo_search, or yahoo_free_agents).",
      inputSchema: { player_id: z.string().describe("Yahoo player ID to add") },
      annotations: { readOnlyHint: false },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async ({ player_id }) => {
      try {
        const data = await apiPost<ActionResponse>("/api/add", { player_id });
        var ai_recommendation = data.success ? "Player added successfully. Check your lineup for optimal positioning." : null;
        return {
          content: [{ type: "text" as const, text: data.message || "Add result: " + JSON.stringify(data) }],
          structuredContent: { type: "add", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_drop
  if (shouldRegister("yahoo_drop")) {
  registerAppTool(
    server,
    "yahoo_drop",
    {
      description: "Use this to permanently drop a player from your roster. The player becomes a free agent available to other teams. Requires the Yahoo player ID from yahoo_roster.",
      inputSchema: { player_id: z.string().describe("Yahoo player ID to drop") },
      annotations: { readOnlyHint: false, destructiveHint: true },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async ({ player_id }) => {
      try {
        const data = await apiPost<ActionResponse>("/api/drop", { player_id });
        var ai_recommendation = data.success ? "Player dropped. Consider picking up a replacement from free agents." : null;
        return {
          content: [{ type: "text" as const, text: data.message || "Drop result: " + JSON.stringify(data) }],
          structuredContent: { type: "drop", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_swap
  if (shouldRegister("yahoo_swap")) {
  registerAppTool(
    server,
    "yahoo_swap",
    {
      description: "Use this to atomically add a free agent and drop a roster player in one transaction. Guarantees both happen together so your roster stays full. Requires player IDs from yahoo_roster and yahoo_free_agents.",
      inputSchema: { add_id: z.string().describe("Yahoo player ID to add"), drop_id: z.string().describe("Yahoo player ID to drop") },
      annotations: { readOnlyHint: false },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async ({ add_id, drop_id }) => {
      try {
        const data = await apiPost<ActionResponse>("/api/swap", { add_id, drop_id });
        var ai_recommendation = data.success ? "Swap completed. Verify lineup positioning for the new player." : null;
        return {
          content: [{ type: "text" as const, text: data.message || "Swap result: " + JSON.stringify(data) }],
          structuredContent: { type: "swap", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_waiver_claim
  if (shouldRegister("yahoo_waiver_claim")) {
  registerAppTool(
    server,
    "yahoo_waiver_claim",
    {
      description: "Use this to submit a waiver claim for a player in the claim period (not yet a free agent). Supports optional FAAB bid amount and optional drop player for claim+drop combos.",
      inputSchema: { player_id: z.string().describe("Yahoo player ID to claim"), drop_id: z.string().describe("Yahoo player ID to drop (optional, for claim+drop)").optional(), faab: z.number().describe("FAAB bid amount in dollars").optional() },
      annotations: { readOnlyHint: false, destructiveHint: false },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async ({ player_id, drop_id, faab }) => {
      try {
        if (drop_id) {
          const body: Record<string, string> = { add_id: player_id, drop_id };
          if (faab !== undefined) body.faab = String(faab);
          const data = await apiPost<WaiverClaimSwapResponse>("/api/waiver-claim-swap", body);
          var ai_recommendation: string | null = data.message ? "Waiver claim with drop submitted. Results process at the next waiver period." : null;
          return {
            content: [{ type: "text" as const, text: data.message || "Waiver claim+drop result: " + JSON.stringify(data) }],
            structuredContent: { type: "waiver-claim-swap", ai_recommendation, ...data },
          };
        } else {
          const body: Record<string, string> = { player_id };
          if (faab !== undefined) body.faab = String(faab);
          const data = await apiPost<WaiverClaimResponse>("/api/waiver-claim", body);
          var ai_recommendation2: string | null = data.message ? "Waiver claim submitted. Results process at the next waiver period." : null;
          return {
            content: [{ type: "text" as const, text: data.message || "Waiver claim result: " + JSON.stringify(data) }],
            structuredContent: { type: "waiver-claim", ai_recommendation: ai_recommendation2, ...data },
          };
        }
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_browser_status
  if (shouldRegister("yahoo_browser_status")) {
  registerAppTool(
    server,
    "yahoo_browser_status",
    {
      description: "Use this to verify whether the browser session for write operations (add, drop, trade, lineup changes) is still valid. Returns cookie count and session status. Use this before any write operation fails, or when yahoo_add/yahoo_drop/yahoo_propose_trade return auth errors.",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<{ valid: boolean; reason?: string; cookie_count?: number }>("/api/browser-login-status");
        const text = data.valid
          ? "Browser session is valid (" + (data.cookie_count || 0) + " Yahoo cookies)"
          : "Browser session not valid: " + (data.reason || "unknown") + ". Run './yf browser-login' to set up.";
        var ai_recommendation = data.valid ? null : "Browser session expired. Run './yf browser-login' to enable write operations.";
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "browser-status", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_change_team_name
  if (shouldRegister("yahoo_change_team_name")) {
  registerAppTool(
    server,
    "yahoo_change_team_name",
    {
      description: "Use this to update your fantasy team's display name in the league. Takes the new name as a string parameter. Use yahoo_change_team_logo instead when you want to change your team's avatar image.",
      inputSchema: { new_name: z.string().describe("New team name") },
      annotations: { readOnlyHint: false },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async ({ new_name }) => {
      try {
        const data = await apiPost<ChangeTeamNameResponse>("/api/change-team-name", { new_name });
        var ai_recommendation: string | null = null;
        return {
          content: [{ type: "text" as const, text: data.message || "Result: " + JSON.stringify(data) }],
          structuredContent: { type: "change-team-name", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_change_team_logo
  if (shouldRegister("yahoo_change_team_logo")) {
  registerAppTool(
    server,
    "yahoo_change_team_logo",
    {
      description: "Use this to update your fantasy team's logo image. Requires an absolute file path to a PNG or JPG image inside the container. Use yahoo_change_team_name instead when you want to change your team's display name.",
      inputSchema: { image_path: z.string().describe("Absolute path to image file (PNG/JPG) inside the container") },
      annotations: { readOnlyHint: false },
      _meta: { ui: { resourceUri: ROSTER_URI } },
    },
    async ({ image_path }) => {
      try {
        const data = await apiPost<ChangeTeamLogoResponse>("/api/change-team-logo", { image_path });
        var ai_recommendation: string | null = null;
        return {
          content: [{ type: "text" as const, text: data.message || "Result: " + JSON.stringify(data) }],
          structuredContent: { type: "change-team-logo", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  } // end writesEnabled

  // yahoo_who_owns
  if (shouldRegister("yahoo_who_owns")) {
  registerAppTool(
    server,
    "yahoo_who_owns",
    {
      description: "Use this to check whether a specific player is owned, on waivers, or a free agent. Returns the owner's team name if rostered.",
      inputSchema: { player_id: z.string().describe("Yahoo player ID to look up") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_id }) => {
      try {
        const data = await apiGet<WhoOwnsResponse>("/api/who-owns", { player_id });
        let text = "";
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
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "who-owns", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_percent_owned
  if (shouldRegister("yahoo_percent_owned")) {
  registerAppTool(
    server,
    "yahoo_percent_owned",
    {
      description: "Use this to look up ownership percentages across all Yahoo leagues for one or more players by their IDs. Accepts comma-separated player IDs.",
      inputSchema: { ids: z.string().describe("Comma-separated Yahoo player IDs (e.g. '10660,9542')") },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ ids }) => {
      try {
        var data = await apiGet<PercentOwnedResponse>("/api/percent-owned", { ids });
        if (!data.players || data.players.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No ownership data returned" }],
            structuredContent: { type: "percent-owned", ai_recommendation: null, players: [] },
          };
        }
        var lines = ["Percent Owned:"];
        for (var p of data.players) {
          lines.push("  " + str(p.name).padEnd(25) + " " + String(p.percent_owned).padStart(5) + "%  (id:" + str(p.player_id) + ")");
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "percent-owned", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_player_stats
  if (shouldRegister("yahoo_player_stats")) {
  registerAppTool(
    server,
    "yahoo_player_stats",
    {
      description: "Use this to pull a specific player's fantasy stats from Yahoo for any time period (season, lastweek, lastmonth, specific week, or date). Returns all scoring category stats.",
      inputSchema: {
        player_name: z.string().describe("Player name to look up"),
        period: z.string().describe("Stats period: season, average_season, lastweek, lastmonth, week, date").default("season"),
        week: z.string().describe("Week number (when period=week)").default(""),
        date: z.string().describe("Date YYYY-MM-DD (when period=date)").default(""),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ player_name, period, week, date }) => {
      try {
        const params: Record<string, string> = { name: player_name, period };
        if (week) params.week = week;
        if (date) params.date = date;
        const data = await apiGet<PlayerStatsResponse>("/api/player-stats", params);
        const lines = ["Stats for " + data.player_name + " (" + data.period + "):"];
        const stats = data.stats || {};
        for (const [key, val] of Object.entries(stats)) {
          if (key !== "player_id" && key !== "name") {
            lines.push("  " + str(key).padEnd(20) + str(val));
          }
        }
        const ai_recommendation = "Review " + data.player_name + "'s stats to evaluate roster value and trade potential.";
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "player-stats", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_waivers
  if (shouldRegister("yahoo_waivers")) {
  registerAppTool(
    server,
    "yahoo_waivers",
    {
      description: "Use this to see which recently dropped players are currently in the waiver claim period and not yet free agents. Returns player names, positions, ownership %, and IDs needed for yahoo_waiver_claim.",
      inputSchema: {
        limit: z.number().default(20).describe("Max results to return (default 20, max 50)"),
        offset: z.number().default(0).describe("Offset for pagination"),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ limit, offset }) => {
      try {
        const data = await apiGet<WaiversResponse>("/api/waivers", { limit: String(limit), offset: String(offset) });
        const players = data.players || [];
        const text = players.length > 0
          ? "Players on Waivers (" + players.length + "):\n" + players.map((p) => {
              let line = "  " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned  (id:" + p.player_id + ")";
              if (p.status) line += " [" + p.status + "]";
              return line;
            }).join("\n")
          : "No players currently on waivers.";
        const ai_recommendation = players.length > 0
          ? players.length + " player" + (players.length === 1 ? "" : "s") + " on waivers. Submit waiver claims before the deadline to add them."
          : null;
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            type: "waivers",
            ai_recommendation,
            ...data,
            _pagination: {
              returned: players.length,
              offset: offset,
              has_more: players.length >= limit,
            },
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }

  // yahoo_all_rostered
  if (shouldRegister("yahoo_all_rostered")) {
  registerAppTool(
    server,
    "yahoo_all_rostered",
    {
      description: "Use this to see every rostered player across all league teams, optionally filtered by position. Returns player names, owners, and ownership percentages.",
      inputSchema: {
        position: z.string().describe("Filter by position (e.g. OF, SP, C). Empty for all.").default(""),
        limit: z.number().default(25).describe("Max results to return (default 25, max 50)"),
        offset: z.number().default(0).describe("Offset for pagination"),
      },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ position, limit, offset }) => {
      try {
        const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
        if (position) params.position = position;
        const data = await apiGet<TakenPlayersResponse>("/api/taken-players", params);
        const players = data.players || [];
        const label = position ? "Rostered " + position + " Players" : "All Rostered Players";
        const text = label + " (" + data.count + "):\n" + players.slice(0, 50).map((p) => {
          let line = "  " + str(p.name).padEnd(25) + " " + (p.eligible_positions || []).join(",").padEnd(12) + " " + String(p.percent_owned || 0).padStart(3) + "% owned";
          line += pid(p.player_id);
          if (p.owner) line += "  -> " + p.owner;
          return line;
        }).join("\n");
        const ai_recommendation = data.count + " players rostered" + (position ? " at " + position : "") + " across the league. Use this to understand player pool availability.";
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            type: "all-rostered",
            ai_recommendation,
            ...data,
            _pagination: {
              returned: players.length,
              offset: offset,
              has_more: players.length >= limit,
            },
          },
        };
      } catch (e) { return toolError(e); }
    },
  );
  }
}
