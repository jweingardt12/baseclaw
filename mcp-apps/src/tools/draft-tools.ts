import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { apiGet, toolError } from "../api/python-client.js";
import { generateDraftInsight } from "../insights.js";
import {
  str,
  type DraftStatusResponse,
  type DraftRecommendResponse,
  type DraftRecommendation,
  type CheatsheetResponse,
  type BestAvailableResponse,
} from "../api/types.js";
import { INTEL_URI } from "./intel-tools.js";

export function registerDraftTools(server: McpServer) {
  // yahoo_draft_status
  registerAppTool(
    server,
    "yahoo_draft_status",
    {
      description: "Show current draft status: picks made, your round, roster composition",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: INTEL_URI } },
    },
    async () => {
      try {
        const data = await apiGet<DraftStatusResponse>("/api/draft-status");
        const text = "Draft Status:\n"
          + "  Total Picks: " + data.total_picks + "\n"
          + "  Your Round: " + data.current_round + "\n"
          + "  Hitters: " + data.hitters + "\n"
          + "  Pitchers: " + data.pitchers;
        var ai_recommendation: string | null = null;
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "draft-status", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_draft_recommend
  registerAppTool(
    server,
    "yahoo_draft_recommend",
    {
      description: "Get draft pick recommendation with top available hitters and pitchers by z-score",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<DraftRecommendResponse>("/api/draft-recommend");
        const lines = [
          "Draft Recommendation (Round " + data.round + "):",
          "Recommendation: " + str(data.recommendation),
          "",
          "Top Available Hitters:",
        ];
        for (const h of data.top_hitters.slice(0, 5)) {
          const tier = (h.intel && h.intel.statcast && h.intel.statcast.quality_tier) ? " {" + h.intel.statcast.quality_tier + "}" : "";
          lines.push("  " + str(h.name).padEnd(25) + " " + str((h.positions || []).join(",")).padEnd(12) + " z=" + (h.z_score != null ? h.z_score.toFixed(2) : "N/A") + tier);
        }
        lines.push("", "Top Available Pitchers:");
        for (const p of data.top_pitchers.slice(0, 5)) {
          const tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
          lines.push("  " + str(p.name).padEnd(25) + " " + str((p.positions || []).join(",")).padEnd(12) + " z=" + (p.z_score != null ? p.z_score.toFixed(2) : "N/A") + tier);
        }
        var ai_recommendation = generateDraftInsight(data);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "draft-recommend", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_draft_cheatsheet
  registerAppTool(
    server,
    "yahoo_draft_cheatsheet",
    {
      description: "Show draft strategy cheat sheet with round-by-round targets",
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async () => {
      try {
        const data = await apiGet<CheatsheetResponse>("/api/draft-cheatsheet");
        const lines = ["Draft Cheat Sheet:"];
        lines.push("", "STRATEGY:");
        for (const [rounds, strategy] of Object.entries(data.strategy)) {
          lines.push("  " + rounds.replace(/_/g, " ") + ": " + strategy);
        }
        lines.push("", "TARGETS:");
        for (const [rounds, players] of Object.entries(data.targets)) {
          lines.push("  " + rounds.replace(/_/g, " ") + ": " + players.join(", "));
        }
        if (data.avoid) {
          lines.push("", "AVOID:");
          for (const a of data.avoid) {
            lines.push("  - " + a);
          }
        }
        if (data.opponents) {
          lines.push("", "OPPONENTS:");
          for (const o of data.opponents) {
            lines.push("  " + o.name + ": " + o.tendency);
          }
        }
        var ai_recommendation: string | null = null;
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "draft-cheatsheet", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_best_available
  registerAppTool(
    server,
    "yahoo_best_available",
    {
      description: "Show best available players ranked by z-score. pos_type: B for batters, P for pitchers",
      inputSchema: { pos_type: z.string().describe("B for batters, P for pitchers").default("B"), count: z.number().describe("Number of players to return").default(25) },
      annotations: { readOnlyHint: true },
      _meta: {},
    },
    async ({ pos_type, count }) => {
      try {
        const data = await apiGet<BestAvailableResponse>("/api/best-available", { pos_type, count: String(count) });
        const label = pos_type === "B" ? "Hitters" : "Pitchers";
        const text = "Best Available " + label + ":\n" + data.players.map((p) => {
          const tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
          return "  " + String(p.rank).padStart(3) + ". " + str(p.name).padEnd(25) + " " + str((p.positions || []).join(",")).padEnd(12) + " z=" + (p.z_score != null ? p.z_score.toFixed(2) : "N/A") + tier;
        }).join("\n");
        var ai_recommendation: string | null = null;
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "best-available", ai_recommendation, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );

  // yahoo_draft_board
  registerAppTool(
    server,
    "yahoo_draft_board",
    {
      description: "Show visual draft board with all picks, position tracking, and next pick countdown",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: INTEL_URI } },
    },
    async () => {
      try {
        var data = await apiGet<DraftStatusResponse>("/api/draft-status");
        var totalPicks = data.total_picks || 0;
        var round = data.current_round || 0;
        var text = "Draft Board:\n"
          + "  Total Picks: " + totalPicks + "\n"
          + "  Current Round: " + round + "\n"
          + "  Your Roster: " + (data.hitters || 0) + "H / " + (data.pitchers || 0) + "P";
        if (data.draft_results && data.draft_results.length > 0) {
          text = text + "\n  Picks made: " + data.draft_results.length;
        }
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { type: "draft-board", ai_recommendation: null, ...data },
        };
      } catch (e) { return toolError(e); }
    },
  );
}
