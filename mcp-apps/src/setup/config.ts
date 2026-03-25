import fs from "fs";
import path from "path";

var CONFIG_PATH = process.env.BASECLAW_CONFIG_PATH || "/app/config/baseclaw.json";
export var OAUTH_FILE = process.env.OAUTH_FILE || "/app/config/yahoo_oauth.json";

export interface BaseClawConfig {
  league_id?: string;
  team_id?: string;
  mcp_auth_password?: string;
  enable_write_ops?: boolean;
  mcp_toolset?: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function readConfig(): BaseClawConfig {
  try {
    var raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeConfig(updates: Partial<BaseClawConfig>): BaseClawConfig {
  var existing = readConfig();
  var merged = { ...existing, ...updates };
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
    console.log("[CONFIG] Saved config to " + CONFIG_PATH);
  } catch (err) {
    console.error("[CONFIG] Failed to write " + CONFIG_PATH + ":", err);
    throw err;
  }
  return merged;
}

/**
 * Get a config value with priority: env var > config file > default.
 * This preserves backward compat for Docker Compose users who set env vars.
 */
export function getConfigValue(envVar: string, configKey: keyof BaseClawConfig, defaultValue?: string): string {
  var envVal = process.env[envVar];
  if (envVal !== undefined && envVal !== "") {
    return envVal;
  }
  var config = readConfig();
  var configVal = config[configKey];
  if (configVal !== undefined && configVal !== "") {
    return String(configVal);
  }
  return defaultValue || "";
}

/**
 * Read and parse the OAuth file. Returns null if missing or invalid.
 */
export function readOAuthFile(): Record<string, unknown> | null {
  try {
    var raw = fs.readFileSync(OAUTH_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Check if setup is complete: Yahoo OAuth tokens exist and have an access_token.
 */
export function isSetupComplete(): boolean {
  var data = readOAuthFile();
  if (!data) return false;
  var token = data.access_token;
  return typeof token === "string" && token.length > 0;
}

/**
 * Check which setup steps are complete. Single disk read for config file.
 */
export function getSetupStatus(): { yahoo_oauth: boolean; league_selected: boolean; password_set: boolean; browser_login: boolean } {
  var config = readConfig();
  var hasOAuth = isSetupComplete();
  var hasLeague = !!((process.env.LEAGUE_ID || config.league_id) && (process.env.TEAM_ID || config.team_id));
  var hasPassword = !!(process.env.MCP_AUTH_PASSWORD || config.mcp_auth_password);
  var hasBrowser = false;
  try {
    hasBrowser = fs.statSync("/app/config/yahoo_session.json").size > 10;
  } catch {}
  return {
    yahoo_oauth: hasOAuth,
    league_selected: hasLeague,
    password_set: hasPassword,
    browser_login: hasBrowser,
  };
}
