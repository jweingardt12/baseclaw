import { createServer } from "./server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { YahooFantasyOAuthProvider } from "./src/auth/oauth-provider.js";
import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function handleMcp(req: Request, res: Response): Promise<void> {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => { transport.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

async function main() {
  if (process.argv.includes("--stdio")) {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    const SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:4951";
    const AUTH_PASSWORD = process.env.MCP_AUTH_PASSWORD;
    if (!AUTH_PASSWORD || AUTH_PASSWORD.length < 8) {
      console.error("ERROR: MCP_AUTH_PASSWORD must be set to a value of 8+ characters in HTTP mode.");
      process.exit(1);
    }
    const provider = new YahooFantasyOAuthProvider(SERVER_URL, AUTH_PASSWORD);

    const app = express();
    app.set("trust proxy", 1);

    // Preview app — gated by ENABLE_PREVIEW env var (defaults to false)
    const enablePreview = process.env.ENABLE_PREVIEW === "true";
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const previewDir = path.join(__dirname, "preview");
    const draftDir = path.join(__dirname, "offline-draft");

    // API proxy — always enabled (needed by preview app and offline draft dashboard)
    app.use("/api", express.json(), (req, res) => {
      const url = "http://localhost:8766" + req.originalUrl;
      const proxyReq = http.request(url, { method: req.method, headers: { "Content-Type": "application/json" } }, (proxyRes) => {
        res.status(proxyRes.statusCode || 500);
        proxyRes.pipe(res);
      });
      proxyReq.on("error", () => res.status(502).json({ error: "Python API unavailable" }));
      if (req.method === "POST" && req.body) proxyReq.write(JSON.stringify(req.body));
      proxyReq.end();
    });

    // Offline draft dashboard — always available at /draft
    app.use("/draft", express.static(draftDir));
    app.get("/draft", (_req, res) => {
      res.sendFile(path.join(draftDir, "offline-draft.html"));
    });
    console.log("Offline draft dashboard available at /draft");

    if (enablePreview) {
      app.use("/preview", express.static(previewDir));
      app.get("/preview", (_req, res) => {
        res.sendFile(path.join(previewDir, "preview.html"));
      });
      console.log("Preview app enabled at /preview");
    }

    app.use(express.json());

    // Health check (unauthenticated)
    app.get("/health", (_req, res) => {
      res.json({ ok: true, writes_enabled: process.env.ENABLE_WRITE_OPS === "true" });
    });

    app.use(mcpAuthRouter({
      provider,
      issuerUrl: new URL(SERVER_URL),
      resourceServerUrl: new URL(SERVER_URL + "/mcp"),
      scopesSupported: ["baseclaw"],
    }));

    app.get("/login", (req, res) => {
      const state = escapeHtml((req.query.state as string) || "");
      console.log("[AUTH] GET /login state=" + (state ? state.slice(0, 8) + "..." : "(empty)"));
      res.type("html").send(
        "<!DOCTYPE html><html><head><title>Fantasy Baseball MCP</title>"
        + "<style>body{font-family:system-ui;max-width:400px;margin:60px auto;"
        + "padding:20px}h2{margin-bottom:4px}input{width:100%;padding:10px;"
        + "margin:8px 0;box-sizing:border-box}button{background:#1a1a2e;"
        + "color:#fff;padding:12px 24px;border:none;cursor:pointer;width:100%;"
        + "margin-top:8px}</style></head><body>"
        + "<h2>Fantasy Baseball MCP</h2>"
        + "<p>Enter your password to authorize access.</p>"
        + "<form action='" + SERVER_URL + "/login/callback' method='post'>"
        + "<input type='hidden' name='state' value='" + state + "'>"
        + "<input type='password' name='password' placeholder='Password' required autofocus>"
        + "<button type='submit'>Authorize</button>"
        + "</form></body></html>"
      );
    });

    app.post("/login/callback", express.urlencoded({ extended: false }), (req, res) => {
      const state = (req.body.state as string) || "";
      const password = (req.body.password as string) || "";
      console.log("[AUTH] POST /login/callback state=" + (state ? state.slice(0, 8) + "..." : "(empty)") + " hasPassword=" + (password.length > 0));
      try {
        const redirectUri = provider.handleLogin(state, password);
        res.redirect(302, redirectUri);
      } catch (e: any) {
        res.status(401).type("html").send(
          "<h2>Error</h2><p>" + escapeHtml(e.message || String(e)) + "</p>"
          + "<a href='javascript:history.back()'>Try again</a>"
        );
      }
    });

    const auth = requireBearerAuth({ verifier: provider, requiredScopes: ["baseclaw"] });
    app.post("/mcp", auth, handleMcp);
    app.get("/mcp", auth, handleMcp);
    app.delete("/mcp", async (_req, res) => {
      res.status(405).send("Method not allowed");
    });

    const port = parseInt(process.env.PORT || "4951");
    app.listen(port, "0.0.0.0", () => {
      console.log("MCP Apps server listening on http://0.0.0.0:" + port + "/mcp");
    });
  }
}

main().catch(console.error);
