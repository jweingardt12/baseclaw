import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Response } from "express";
import { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

const AUTH_STATE_PATH = path.join("/app", "config", "auth-state.json");
const ACCESS_TOKEN_TTL = 604800;    // 7 days
const REFRESH_TOKEN_TTL = 2592000;  // 30 days
const MASTER_TOKEN_TTL = 31536000;  // 1 year
const AUTH_CODE_TTL = 300;          // 5 minutes
const PENDING_AUTH_TTL = 600;       // 10 minutes
const CLEANUP_INTERVAL = 3600000;   // 1 hour
const ACCESS_TOKEN_PREFIX = "yf_";
const REFRESH_TOKEN_PREFIX = "yfr_";

interface PendingAuth {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  resource?: URL;
  expiresAt: number;
}

interface StoredCode {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  resource?: URL;
  expiresAt: number;
}

interface StoredToken {
  clientId: string;
  scopes: string[];
  expiresAt: number;
  resource?: URL;
  refreshToken?: string;
}

interface StoredRefreshToken {
  clientId: string;
  scopes: string[];
  expiresAt: number;
  accessToken: string;
  resource?: URL;
}

interface AuthState {
  clients: Record<string, OAuthClientInformationFull>;
  tokens: Record<string, StoredToken>;
  refreshTokens: Record<string, StoredRefreshToken>;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

class YahooFantasyClientsStore implements OAuthRegisteredClientsStore {
  private clients: Map<string, OAuthClientInformationFull>;
  private onWrite: () => void;

  constructor(clients: Map<string, OAuthClientInformationFull>, onWrite: () => void) {
    this.clients = clients;
    this.onWrite = onWrite;
  }

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return this.clients.get(clientId);
  }

  registerClient(client: OAuthClientInformationFull): OAuthClientInformationFull {
    this.clients.set(client.client_id, client);
    this.onWrite();
    return client;
  }
}

export class YahooFantasyOAuthProvider implements OAuthServerProvider {
  private clients: Map<string, OAuthClientInformationFull> = new Map();
  private _clientsStore: YahooFantasyClientsStore;
  private authCodes: Map<string, StoredCode> = new Map();
  private tokens: Map<string, StoredToken> = new Map();
  private refreshTokens: Map<string, StoredRefreshToken> = new Map();
  private pendingAuths: Map<string, PendingAuth> = new Map();
  private serverUrl: string;
  private password: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(serverUrl: string, password: string) {
    this.serverUrl = serverUrl.replace(/\/+$/, "");
    this.password = password;
    this._clientsStore = new YahooFantasyClientsStore(this.clients, () => this.scheduleSave());
    this.loadState();
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  // --- Persistence ---

  private loadState(): void {
    try {
      if (!fs.existsSync(AUTH_STATE_PATH)) {
        return;
      }
      const raw = fs.readFileSync(AUTH_STATE_PATH, "utf-8");
      const state: AuthState = JSON.parse(raw);
      const now = nowSeconds();
      let loaded = 0;

      if (state.clients) {
        for (const [id, client] of Object.entries(state.clients)) {
          this.clients.set(id, client);
          loaded++;
        }
      }
      if (state.tokens) {
        for (const [token, stored] of Object.entries(state.tokens)) {
          if (stored.expiresAt > now) {
            this.tokens.set(token, stored);
            loaded++;
          }
        }
      }
      if (state.refreshTokens) {
        for (const [token, stored] of Object.entries(state.refreshTokens)) {
          if (stored.expiresAt > now) {
            this.refreshTokens.set(token, stored);
            loaded++;
          }
        }
      }
      console.log("[AUTH] Loaded " + loaded + " entries from " + AUTH_STATE_PATH);
    } catch (err) {
      console.error("[AUTH] Failed to load auth state:", err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      return;
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveState();
    }, 100);
  }

  private saveState(): void {
    try {
      const state: AuthState = {
        clients: Object.fromEntries(this.clients),
        tokens: Object.fromEntries(this.tokens),
        refreshTokens: Object.fromEntries(this.refreshTokens),
      };
      fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
      fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
    } catch (err) {
      console.error("[AUTH] Failed to save auth state:", err);
    }
  }

  private purgeExpired(map: Map<string, { expiresAt: number }>): number {
    const now = nowSeconds();
    let removed = 0;
    for (const [key, entry] of map) {
      if (entry.expiresAt <= now) {
        map.delete(key);
        removed++;
      }
    }
    return removed;
  }

  private cleanup(): void {
    const removed = this.purgeExpired(this.tokens)
      + this.purgeExpired(this.refreshTokens)
      + this.purgeExpired(this.authCodes)
      + this.purgeExpired(this.pendingAuths);
    if (removed > 0) {
      console.log("[AUTH] Cleanup: removed " + removed + " expired entries");
      this.scheduleSave();
    }
  }

  // --- Token Pair ---

  private issueTokenPair(clientId: string, scopes: string[], resource?: URL): OAuthTokens {
    const now = nowSeconds();
    const accessToken = ACCESS_TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
    const refreshToken = REFRESH_TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");

    this.tokens.set(accessToken, {
      clientId,
      scopes,
      expiresAt: now + ACCESS_TOKEN_TTL,
      resource,
      refreshToken,
    });
    this.refreshTokens.set(refreshToken, {
      clientId,
      scopes,
      expiresAt: now + REFRESH_TOKEN_TTL,
      accessToken,
      resource,
    });
    this.scheduleSave();

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }

  // --- OAuth Provider ---

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const state = params.state || crypto.randomBytes(16).toString("hex");
    this.pendingAuths.set(state, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes || [],
      resource: params.resource,
      expiresAt: nowSeconds() + PENDING_AUTH_TTL,
    });
    console.log("[AUTH] authorize: stored state=" + state.slice(0, 8) + "... pendingAuths size=" + this.pendingAuths.size);
    res.redirect(this.serverUrl + "/login?state=" + state);
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const stored = this.authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Invalid authorization code");
    }
    return stored.codeChallenge;
  }

  async exchangeAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const stored = this.authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Invalid authorization code");
    }
    if (stored.expiresAt < nowSeconds()) {
      this.authCodes.delete(authorizationCode);
      throw new Error("Authorization code expired");
    }
    this.authCodes.delete(authorizationCode);
    return this.issueTokenPair(stored.clientId, stored.scopes, stored.resource);
  }

  async exchangeRefreshToken(_client: OAuthClientInformationFull, refreshToken: string, _scopes?: string[], _resource?: URL): Promise<OAuthTokens> {
    const stored = this.refreshTokens.get(refreshToken);
    if (!stored) {
      throw new InvalidTokenError("Invalid refresh token");
    }
    if (stored.expiresAt < nowSeconds()) {
      this.refreshTokens.delete(refreshToken);
      this.scheduleSave();
      throw new InvalidTokenError("Refresh token expired");
    }

    // Revoke old pair
    this.tokens.delete(stored.accessToken);
    this.refreshTokens.delete(refreshToken);

    console.log("[AUTH] Refreshed token for client=" + stored.clientId);
    return this.issueTokenPair(stored.clientId, stored.scopes, stored.resource);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    // Master token bypass (using the password directly)
    if (token === this.password) {
      return {
        token,
        clientId: "master",
        scopes: ["baseclaw"],
        expiresAt: nowSeconds() + MASTER_TOKEN_TTL,
      };
    }

    const stored = this.tokens.get(token);
    if (!stored) {
      throw new InvalidTokenError("Invalid token");
    }
    if (stored.expiresAt < nowSeconds()) {
      this.tokens.delete(token);
      this.scheduleSave();
      throw new InvalidTokenError("Token expired");
    }
    return {
      token,
      clientId: stored.clientId,
      scopes: stored.scopes,
      expiresAt: stored.expiresAt,
      resource: stored.resource,
    };
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    let changed = false;
    const tokenData = this.tokens.get(request.token);
    if (tokenData) {
      if (tokenData.refreshToken) {
        this.refreshTokens.delete(tokenData.refreshToken);
      }
      this.tokens.delete(request.token);
      changed = true;
    }
    const refreshData = this.refreshTokens.get(request.token);
    if (refreshData) {
      this.tokens.delete(refreshData.accessToken);
      this.refreshTokens.delete(request.token);
      changed = true;
    }
    if (changed) {
      this.scheduleSave();
    }
  }

  handleLogin(state: string, password: string): string {
    console.log("[AUTH] handleLogin: state=" + state.slice(0, 8) + "... pendingAuths size=" + this.pendingAuths.size + " keys=" + [...this.pendingAuths.keys()].map(k => k.slice(0, 8)).join(","));
    const pending = this.pendingAuths.get(state);
    if (!pending) {
      throw new Error("Invalid state");
    }
    const a = Buffer.from(password);
    const b = Buffer.from(this.password);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("Wrong password");
    }
    const code = ACCESS_TOKEN_PREFIX + crypto.randomBytes(16).toString("hex");
    this.authCodes.set(code, {
      clientId: pending.clientId,
      codeChallenge: pending.codeChallenge,
      redirectUri: pending.redirectUri,
      scopes: pending.scopes,
      resource: pending.resource,
      expiresAt: nowSeconds() + AUTH_CODE_TTL,
    });
    this.pendingAuths.delete(state);
    const url = new URL(String(pending.redirectUri));
    url.searchParams.set("code", code);
    url.searchParams.set("state", state);
    return url.toString();
  }
}
