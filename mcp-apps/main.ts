import { createServer } from "./server.js";
import { resolveToolset } from "./src/toolsets.js";
import { createWebhookRouter } from "./src/webhooks.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { YahooFantasyOAuthProvider } from "./src/auth/oauth-provider.js";
import { isSetupComplete, getConfigValue, escapeHtml } from "./src/setup/config.js";
import { createSetupRouter } from "./src/setup/wizard-routes.js";
import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import http from "http";

// Resolve toolset: env var > config file > default
var toolsetConfig = getConfigValue("MCP_TOOLSET", "mcp_toolset", "default");
var enabledTools = toolsetConfig === "all"
  ? undefined // undefined = register everything
  : resolveToolset(toolsetConfig);

async function handleMcp(req: Request, res: Response): Promise<void> {
  var server = createServer(enabledTools);
  var transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => { transport.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

async function main() {
  if (process.argv.includes("--stdio")) {
    var server = createServer(enabledTools);
    var transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    var SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:4951";

    // Check if setup is needed (no Yahoo OAuth tokens)
    var setupNeeded = !isSetupComplete();

    if (setupNeeded) {
      // --- Setup Wizard Mode ---
      console.log("[SETUP] Yahoo OAuth tokens not found. Starting setup wizard...");
      var setupApp = express();
      setupApp.set("trust proxy", 1);
      setupApp.use(express.json());

      // Health check (always available)
      setupApp.get("/health", (_req, res) => {
        res.json({ ok: true, mode: "setup", setup_complete: false });
      });

      // Setup wizard routes
      setupApp.use(createSetupRouter(SERVER_URL));

      // Redirect root to setup
      setupApp.get("/", (_req, res) => { res.redirect("/setup"); });

      // Catch-all: redirect to setup
      setupApp.use((_req, res) => { res.redirect("/setup"); });

      var setupPort = parseInt(process.env.PORT || "4951");
      setupApp.listen(setupPort, "0.0.0.0", () => {
        console.log("[SETUP] Setup wizard available at http://0.0.0.0:" + setupPort + "/setup");
      });
    } else {
      // --- Normal MCP Mode ---
      // Read password from env var or config file
      var AUTH_PASSWORD = getConfigValue("MCP_AUTH_PASSWORD", "mcp_auth_password");
      if (!AUTH_PASSWORD || AUTH_PASSWORD.length < 8) {
        console.error("ERROR: MCP_AUTH_PASSWORD must be set to a value of 8+ characters in HTTP mode.");
        process.exit(1);
      }
      var provider = new YahooFantasyOAuthProvider(SERVER_URL, AUTH_PASSWORD);

      var app = express();
      app.set("trust proxy", 1);

      // Preview app — gated by ENABLE_PREVIEW env var (defaults to false)
      var enablePreview = process.env.ENABLE_PREVIEW === "true";
      var __dirname = path.dirname(fileURLToPath(import.meta.url));
      var previewDir = path.join(__dirname, "preview");

      if (enablePreview) {
        app.use("/preview", express.static(previewDir));
        app.get("/preview", (_req, res) => {
          res.sendFile(path.join(previewDir, "preview.html"));
        });

        // API proxy — before auth since Flask binds to 127.0.0.1 (container-internal only)
        app.use("/api", express.json(), (req, res) => {
          var url = "http://localhost:8766" + req.originalUrl;
          var proxyReq = http.request(url, { method: req.method, headers: { "Content-Type": "application/json" } }, (proxyRes) => {
            res.status(proxyRes.statusCode || 500);
            proxyRes.pipe(res);
          });
          proxyReq.on("error", () => res.status(502).json({ error: "Python API unavailable" }));
          if (req.method === "POST" && req.body) proxyReq.write(JSON.stringify(req.body));
          proxyReq.end();
        });
        console.log("Preview app enabled at /preview");
      }

      app.use(express.json());

      // Health check (unauthenticated)
      app.get("/health", (_req, res) => {
        res.json({ ok: true, mode: "mcp", writes_enabled: process.env.ENABLE_WRITE_OPS === "true" });
      });

      // Webhook endpoints — own auth via WEBHOOK_TOKEN, registered before MCP auth
      if (process.env.WEBHOOK_TOKEN) {
        app.use(createWebhookRouter());
        console.log("Webhook endpoints enabled at /hooks/wake and /hooks/agent");
      }

      app.use(mcpAuthRouter({
        provider,
        issuerUrl: new URL(SERVER_URL),
        resourceServerUrl: new URL(SERVER_URL + "/mcp"),
        scopesSupported: ["baseclaw"],
      }));

      // Logo for login page
      var loginLogoPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets", "logo-128.png");
      var loginLogoB64 = fs.existsSync(loginLogoPath)
        ? "data:image/png;base64," + fs.readFileSync(loginLogoPath).toString("base64")
        : "";

      function loginPageHtml(state: string, error?: string): string {
        var errorBlock = error
          ? "<div style='background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#dc2626;padding:12px 16px;border-radius:10px;font-size:14px;margin-bottom:8px'>" + escapeHtml(error) + "</div>"
          : "";
        return "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>"
          + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
          + "<title>BaseClaw</title>"
          + "<style>"
          + "*{margin:0;padding:0;box-sizing:border-box}"
          + "html{height:100%}"
          + "body{min-height:100%;font-family:system-ui,-apple-system,sans-serif;"
          + "background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:24px}"
          + ".card{width:100%;max-width:380px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:40px 32px;text-align:center}"
          + ".logo{width:72px;height:72px;margin:0 auto 20px;border-radius:16px;background:#0f172a;border:1px solid #334155;display:flex;align-items:center;justify-content:center}"
          + ".logo img{width:48px;height:48px;image-rendering:pixelated}"
          + "h1{font-size:22px;font-weight:700;letter-spacing:-0.02em;margin-bottom:4px}"
          + ".sub{font-size:14px;color:#94a3b8;margin-bottom:24px}"
          + "input[type=password]{width:100%;padding:12px 16px;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#f1f5f9;font-size:16px;outline:none;transition:border-color 0.15s}"
          + "input[type=password]:focus{border-color:#3b82f6}"
          + "input[type=password]::placeholder{color:#64748b}"
          + "button{width:100%;padding:12px;margin-top:12px;background:#3b82f6;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:background 0.15s}"
          + "button:hover{background:#2563eb}"
          + "button:active{background:#1d4ed8}"
          + ".footer{margin-top:24px;font-size:12px;color:#64748b}"
          + "</style></head><body>"
          + "<div class='card'>"
          + (loginLogoB64 ? "<div class='logo'><img src='" + loginLogoB64 + "' alt='BaseClaw'></div>" : "")
          + "<h1>BaseClaw</h1>"
          + "<p class='sub'>Enter your password to connect</p>"
          + errorBlock
          + "<form action='" + SERVER_URL + "/login/callback' method='post'>"
          + "<input type='hidden' name='state' value='" + state + "'>"
          + "<input type='password' name='password' placeholder='Password' required autofocus>"
          + "<button type='submit'>Connect</button>"
          + "</form>"
          + "<p class='footer'>MCP Server</p>"
          + "</div></body></html>";
      }

      app.get("/login", (req, res) => {
        var state = escapeHtml((req.query.state as string) || "");
        console.log("[AUTH] GET /login state=" + (state ? state.slice(0, 8) + "..." : "(empty)"));
        res.type("html").send(loginPageHtml(state));
      });

      app.post("/login/callback", express.urlencoded({ extended: false }), (req, res) => {
        var state = (req.body.state as string) || "";
        var password = (req.body.password as string) || "";
        console.log("[AUTH] POST /login/callback state=" + (state ? state.slice(0, 8) + "..." : "(empty)") + " hasPassword=" + (password.length > 0));
        try {
          var redirectUri = provider.handleLogin(state, password);
          res.redirect(302, redirectUri);
        } catch (e: any) {
          res.status(401).type("html").send(loginPageHtml(state, e.message || String(e)));
        }
      });

      var auth = requireBearerAuth({ verifier: provider, requiredScopes: ["baseclaw"] });
      app.post("/mcp", auth, handleMcp);
      app.get("/mcp", auth, handleMcp);
      app.delete("/mcp", async (_req, res) => {
        res.status(405).send("Method not allowed");
      });

      var port = parseInt(process.env.PORT || "4951");
      app.listen(port, "0.0.0.0", () => {
        console.log("MCP Apps server listening on http://0.0.0.0:" + port + "/mcp");
      });
    }
  }
}

main().catch(console.error);
