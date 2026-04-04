// Tool naming convention:
//   yahoo_*   → Yahoo Fantasy league operations (your team, your league)
//   fantasy_* → Cross-source fantasy intelligence (news, prospects, trends)
//   mlb_*     → MLB reference data (teams, rosters, schedules, stats)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { registerRosterTools } from "./src/tools/roster-tools.js";
import { registerStandingsTools } from "./src/tools/standings-tools.js";
import { registerValuationsTools } from "./src/tools/valuations-tools.js";
import { registerSeasonTools } from "./src/tools/season-tools.js";
import { registerHistoryTools } from "./src/tools/history-tools.js";
import { registerMlbTools } from "./src/tools/mlb-tools.js";
import { registerIntelTools } from "./src/tools/intel-tools.js";
import { registerWorkflowTools } from "./src/tools/workflow-tools.js";
import { registerStrategyTools } from "./src/tools/strategy-tools.js";
import { registerProspectTools } from "./src/tools/prospect-tools.js";
import { registerEnvironmentTools } from "./src/tools/environment-tools.js";
import { registerMetaTools, populateRegistryFromServer } from "./src/tools/meta-tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = __dirname;

const WRITES_ENABLED = process.env.ENABLE_WRITE_OPS === "true";
const HISTORY_ENABLED = process.env.ENABLE_HISTORY === "true";

// Base64-encoded 128x128 PNG logo (pixel-art baseball)
const LOGO_DATA_URI = "data:image/png;base64,"
  + fs.readFileSync(path.join(__dirname, "assets", "logo-128.png")).toString("base64");

export function createServer(enabledTools?: Set<string>): McpServer {
  const server = new McpServer({
    name: "Yahoo Fantasy Baseball",
    version: "1.0.0",
    icons: [{
      src: LOGO_DATA_URI,
      mimeType: "image/png",
      sizes: ["128x128"],
    }],
  });

  // Meta-tools are always registered regardless of toolset profile
  registerMetaTools(server, enabledTools);

  registerRosterTools(server, DIST_DIR, WRITES_ENABLED, enabledTools);
  registerStandingsTools(server, DIST_DIR, enabledTools);
  registerValuationsTools(server, enabledTools);
  registerSeasonTools(server, DIST_DIR, WRITES_ENABLED, enabledTools);
  if (HISTORY_ENABLED) registerHistoryTools(server, enabledTools);
  registerMlbTools(server, enabledTools);
  registerIntelTools(server, DIST_DIR, enabledTools);
  registerWorkflowTools(server, WRITES_ENABLED, enabledTools);
  registerStrategyTools(server, enabledTools);
  registerProspectTools(server, enabledTools);
  registerEnvironmentTools(server, enabledTools);

  // Populate TOOL_REGISTRY with real descriptions from registered tools
  populateRegistryFromServer(server);

  return server;
}
