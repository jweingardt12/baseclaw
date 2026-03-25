import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeConfig, getSetupStatus, escapeHtml } from "./config.js";
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  saveOAuthFile,
  readOAuthConsumerCreds,
  fetchYahooLeagues,
  fetchYahooTeams,
  getAccessToken,
} from "./yahoo-oauth-web.js";

export function createSetupRouter(serverUrl: string): Router {
  var router = Router();

  // Serve the wizard HTML app
  router.get("/setup", (_req: Request, res: Response) => {
    var __dirname = path.dirname(fileURLToPath(import.meta.url));
    var wizardPath = path.join(__dirname, "..", "..", "setup-wizard.html");
    if (fs.existsSync(wizardPath)) {
      res.type("html").sendFile(wizardPath);
    } else {
      res.type("html").send(buildFallbackWizardHtml(serverUrl));
    }
  });

  // Return setup state
  router.get("/setup/status", (_req: Request, res: Response) => {
    var status = getSetupStatus();
    res.json(status);
  });

  // Step 1: Save Yahoo consumer key/secret, return auth URL
  router.post("/setup/credentials", (req: Request, res: Response) => {
    var consumerKey = (req.body.consumer_key || "").trim();
    var consumerSecret = (req.body.consumer_secret || "").trim();
    if (!consumerKey || !consumerSecret) {
      res.status(400).json({ error: "consumer_key and consumer_secret are required" });
      return;
    }

    var callbackUrl = serverUrl + "/setup/yahoo-callback";
    saveOAuthFile(consumerKey, consumerSecret);

    var authUrl = buildAuthUrl(consumerKey, callbackUrl);
    console.log("[SETUP] Generated Yahoo auth URL for consumer_key=" + consumerKey.slice(0, 8) + "...");
    res.json({ auth_url: authUrl, callback_url: callbackUrl });
  });

  // Step 1b: Yahoo OAuth callback — exchange code for tokens
  router.get("/setup/yahoo-callback", async (req: Request, res: Response) => {
    var code = req.query.code as string;
    if (!code) {
      res.status(400).type("html").send(buildErrorHtml("Missing authorization code from Yahoo. Please try again."));
      return;
    }

    var creds = readOAuthConsumerCreds();
    if (!creds) {
      res.status(400).type("html").send(buildErrorHtml("No Yahoo credentials found. Please start the setup again."));
      return;
    }

    try {
      var callbackUrl = serverUrl + "/setup/yahoo-callback";
      var tokens = await exchangeCodeForTokens(code, creds.consumerKey, creds.consumerSecret, callbackUrl);
      saveOAuthFile(creds.consumerKey, creds.consumerSecret, tokens);
      console.log("[SETUP] Yahoo OAuth tokens saved successfully");
      // Redirect back to wizard
      res.redirect(serverUrl + "/setup?step=league#oauth-success");
    } catch (err) {
      console.error("[SETUP] Yahoo OAuth token exchange failed:", err);
      res.status(500).type("html").send(buildErrorHtml("Failed to exchange authorization code: " + (err as Error).message));
    }
  });

  // Step 2: List user's Yahoo Fantasy leagues
  router.get("/setup/leagues", async (_req: Request, res: Response) => {
    var accessToken = getAccessToken();
    if (!accessToken) {
      res.status(401).json({ error: "No Yahoo access token. Complete OAuth first." });
      return;
    }

    try {
      var leagues = await fetchYahooLeagues(accessToken);
      res.json({ leagues: leagues });
    } catch (err) {
      console.error("[SETUP] Failed to fetch leagues:", err);
      res.status(500).json({ error: "Failed to fetch leagues: " + (err as Error).message });
    }
  });

  // Step 2b: List teams in a league
  router.get("/setup/teams/:leagueKey", async (req: Request, res: Response) => {
    var leagueKey = String(req.params.leagueKey);
    var accessToken = getAccessToken();
    if (!accessToken) {
      res.status(401).json({ error: "No Yahoo access token. Complete OAuth first." });
      return;
    }

    try {
      var teams = await fetchYahooTeams(accessToken, leagueKey);
      res.json({ teams: teams });
    } catch (err) {
      console.error("[SETUP] Failed to fetch teams:", err);
      res.status(500).json({ error: "Failed to fetch teams: " + (err as Error).message });
    }
  });

  // Step 2c: Save league/team selection
  router.post("/setup/league", (req: Request, res: Response) => {
    var leagueId = (req.body.league_id || "").trim();
    var teamId = (req.body.team_id || "").trim();
    if (!leagueId || !teamId) {
      res.status(400).json({ error: "league_id and team_id are required" });
      return;
    }

    writeConfig({ league_id: leagueId, team_id: teamId });
    console.log("[SETUP] League/team saved: " + leagueId + " / " + teamId);
    res.json({ ok: true, league_id: leagueId, team_id: teamId });
  });

  // Step 3: Save MCP auth password
  router.post("/setup/password", (req: Request, res: Response) => {
    var password = (req.body.password || "").trim();
    if (!password || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    writeConfig({ mcp_auth_password: password });
    console.log("[SETUP] MCP auth password saved");
    res.json({ ok: true });
  });

  // Step 3b: Generate a random password suggestion
  router.get("/setup/generate-password", (_req: Request, res: Response) => {
    var password = crypto.randomBytes(16).toString("base64url");
    res.json({ password: password });
  });

  // Step 4: Complete setup — finalize and restart
  router.post("/setup/complete", (_req: Request, res: Response) => {
    var status = getSetupStatus();
    if (!status.yahoo_oauth) {
      res.status(400).json({ error: "Yahoo OAuth is not configured" });
      return;
    }
    if (!status.league_selected) {
      res.status(400).json({ error: "League/team not selected" });
      return;
    }
    if (!status.password_set) {
      res.status(400).json({ error: "MCP password not set" });
      return;
    }

    console.log("[SETUP] Setup complete!");
    res.json({
      ok: true,
      message: "Setup complete! The server will restart into MCP mode.",
      mcp_url: serverUrl + "/mcp",
    });

    // Graceful restart — let the response finish, then exit.
    // The container orchestrator (Docker/Railway) will restart the process.
    setTimeout(function () {
      console.log("[SETUP] Restarting server into MCP mode...");
      process.exit(0);
    }, 1500);
  });

  return router;
}

function buildErrorHtml(message: string): string {
  return "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    + "<title>Setup Error</title>"
    + "<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;font-family:system-ui,-apple-system,sans-serif;"
    + "background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:24px}"
    + ".card{max-width:480px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:40px 32px;text-align:center}"
    + "h1{font-size:20px;color:#ef4444;margin-bottom:16px}"
    + "p{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:24px}"
    + "a{color:#3b82f6;text-decoration:none}a:hover{text-decoration:underline}"
    + "</style></head><body>"
    + "<div class='card'><h1>Setup Error</h1><p>" + escapeHtml(message) + "</p>"
    + "<a href='/setup'>Back to Setup</a></div></body></html>";
}

function buildFallbackWizardHtml(serverUrl: string): string {
  // Minimal fallback if the built wizard HTML isn't available
  return "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    + "<title>BaseClaw Setup</title>"
    + "<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;font-family:system-ui,-apple-system,sans-serif;"
    + "background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:24px}"
    + ".card{max-width:480px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:40px 32px;text-align:center}"
    + "h1{font-size:22px;margin-bottom:8px}p{font-size:14px;color:#94a3b8;margin-bottom:16px}"
    + "</style></head><body>"
    + "<div class='card'><h1>BaseClaw Setup</h1>"
    + "<p>The setup wizard UI is not built yet. Run <code>npm run build</code> in mcp-apps/ to build it.</p>"
    + "</div></body></html>";
}

