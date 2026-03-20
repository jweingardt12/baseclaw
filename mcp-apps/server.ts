import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { registerRosterTools } from "./src/tools/roster-tools.js";
import { registerStandingsTools } from "./src/tools/standings-tools.js";
import { registerValuationsTools } from "./src/tools/valuations-tools.js";
import { registerSeasonTools } from "./src/tools/season-tools.js";
import { registerDraftTools } from "./src/tools/draft-tools.js";
import { registerHistoryTools } from "./src/tools/history-tools.js";
import { registerMlbTools } from "./src/tools/mlb-tools.js";
import { registerIntelTools } from "./src/tools/intel-tools.js";
import { registerWorkflowTools } from "./src/tools/workflow-tools.js";
import { registerStrategyTools } from "./src/tools/strategy-tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = __dirname;

const WRITES_ENABLED = process.env.ENABLE_WRITE_OPS === "true";

// Base64-encoded 128x128 PNG logo (pixel-art baseball)
const LOGO_DATA_URI = "data:image/png;base64,"
  + fs.readFileSync(path.join(__dirname, "assets", "logo-128.png")).toString("base64");

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Yahoo Fantasy Baseball",
    version: "1.0.0",
    icons: [{
      src: LOGO_DATA_URI,
      mimeType: "image/png",
      sizes: ["128x128"],
    }],
  });

  registerRosterTools(server, DIST_DIR, WRITES_ENABLED);
  registerStandingsTools(server, DIST_DIR);
  registerValuationsTools(server);
  registerSeasonTools(server, DIST_DIR, WRITES_ENABLED);
  registerDraftTools(server);
  registerHistoryTools(server);
  registerMlbTools(server);
  registerIntelTools(server, DIST_DIR);
  registerWorkflowTools(server, WRITES_ENABLED);
  registerStrategyTools(server);

  return server;
}
