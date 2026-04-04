import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../api/python-client.js";
import { READ_ANNO } from "../api/annotations.js";
import { defineTool } from "../api/define-tool.js";
import {
  str,
  type DraftStatusResponse,
  type DraftRecommendResponse,
  type CheatsheetResponse,
  type BestAvailableResponse,
} from "../api/types.js";
import { INTEL_URI } from "./intel-tools.js";

export function registerDraftTools(server: McpServer) {
  // yahoo_draft_status
  defineTool(
    server,
    "yahoo_draft_status",
    {
      description: "Show current draft status: picks made, your round, roster composition",
      annotations: READ_ANNO,
      _meta: { ui: { resourceUri: INTEL_URI } },
    },
    async () => {
      var data = await apiGet<DraftStatusResponse>("/api/draft-status");
      var text = "Draft Status:\n"
        + "  Total Picks: " + data.total_picks + "\n"
        + "  Your Round: " + data.current_round + "\n"
        + "  Hitters: " + data.hitters + "\n"
        + "  Pitchers: " + data.pitchers;
      return { text };
    },
  );

  // yahoo_draft_recommend
  defineTool(
    server,
    "yahoo_draft_recommend",
    {
      description: "Get draft pick recommendation with top available hitters and pitchers by z-score",
      annotations: READ_ANNO,
      _meta: {},
    },
    async () => {
      var data = await apiGet<DraftRecommendResponse>("/api/draft-recommend");
      var lines = [
        "Draft Recommendation (Round " + data.round + "):",
        "Recommendation: " + str(data.recommendation),
        "",
        "Top Available Hitters:",
      ];
      for (var h of data.top_hitters.slice(0, 5)) {
        var tier = (h.intel && h.intel.statcast && h.intel.statcast.quality_tier) ? " {" + h.intel.statcast.quality_tier + "}" : "";
        lines.push("  " + str(h.name).padEnd(25) + " " + str((h.positions || []).join(",")).padEnd(12) + " z=" + (h.z_score != null ? h.z_score.toFixed(2) : "N/A") + tier);
      }
      lines.push("", "Top Available Pitchers:");
      for (var p of data.top_pitchers.slice(0, 5)) {
        var tier2 = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
        lines.push("  " + str(p.name).padEnd(25) + " " + str((p.positions || []).join(",")).padEnd(12) + " z=" + (p.z_score != null ? p.z_score.toFixed(2) : "N/A") + tier2);
      }
      return { text: lines.join("\n") };
    },
  );

  // yahoo_draft_cheatsheet
  defineTool(
    server,
    "yahoo_draft_cheatsheet",
    {
      description: "Show draft strategy cheat sheet with round-by-round targets",
      annotations: READ_ANNO,
      _meta: {},
    },
    async () => {
      var data = await apiGet<CheatsheetResponse>("/api/draft-cheatsheet");
      var lines = ["Draft Cheat Sheet:"];
      lines.push("", "STRATEGY:");
      for (var [rounds, strategy] of Object.entries(data.strategy)) {
        lines.push("  " + rounds.replace(/_/g, " ") + ": " + strategy);
      }
      lines.push("", "TARGETS:");
      for (var [rounds2, players] of Object.entries(data.targets)) {
        lines.push("  " + rounds2.replace(/_/g, " ") + ": " + players.join(", "));
      }
      if (data.avoid) {
        lines.push("", "AVOID:");
        for (var a of data.avoid) {
          lines.push("  - " + a);
        }
      }
      if (data.opponents) {
        lines.push("", "OPPONENTS:");
        for (var o of data.opponents) {
          lines.push("  " + o.name + ": " + o.tendency);
        }
      }
      return { text: lines.join("\n") };
    },
  );

  // yahoo_best_available
  defineTool(
    server,
    "yahoo_best_available",
    {
      description: "Show best available players ranked by z-score. pos_type: B for batters, P for pitchers",
      inputSchema: { pos_type: z.string().describe("B for batters, P for pitchers").default("B"), count: z.coerce.number().describe("Number of players to return").default(25) },
      annotations: READ_ANNO,
      _meta: {},
    },
    async ({ pos_type, count }) => {
      var data = await apiGet<BestAvailableResponse>("/api/best-available", { pos_type: pos_type as string, count: String(count) });
      var label = (pos_type as string) === "B" ? "Hitters" : "Pitchers";
      var text = "Best Available " + label + ":\n" + data.players.map(function (p) {
        var tier = (p.intel && p.intel.statcast && p.intel.statcast.quality_tier) ? " {" + p.intel.statcast.quality_tier + "}" : "";
        return "  " + String(p.rank).padStart(3) + ". " + str(p.name).padEnd(25) + " " + str((p.positions || []).join(",")).padEnd(12) + " z=" + (p.z_score != null ? p.z_score.toFixed(2) : "N/A") + tier;
      }).join("\n");
      return { text };
    },
  );

  // yahoo_draft_board
  defineTool(
    server,
    "yahoo_draft_board",
    {
      description: "Show visual draft board with all picks, position tracking, and next pick countdown",
      annotations: READ_ANNO,
      _meta: { ui: { resourceUri: INTEL_URI } },
    },
    async () => {
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
      return { text };
    },
  );
}
