import fs from "fs";
import https from "https";
import http from "http";
import { URL, URLSearchParams } from "url";
import { OAUTH_FILE, readOAuthFile } from "./config.js";

// Yahoo OAuth 2.0 endpoints
var YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
var YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

interface YahooTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Build the Yahoo authorization URL for the OAuth 2.0 code flow.
 */
export function buildAuthUrl(consumerKey: string, callbackUrl: string): string {
  var params = new URLSearchParams({
    client_id: consumerKey,
    redirect_uri: callbackUrl,
    response_type: "code",
    language: "en-us",
  });
  return YAHOO_AUTH_URL + "?" + params.toString();
}

/**
 * Exchange an authorization code for access/refresh tokens.
 */
export function exchangeCodeForTokens(
  code: string,
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string
): Promise<YahooTokenResponse> {
  return new Promise(function (resolve, reject) {
    var postData = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: callbackUrl,
      client_id: consumerKey,
      client_secret: consumerSecret,
    }).toString();

    var url = new URL(YAHOO_TOKEN_URL);
    var options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    var req = https.request(options, function (res) {
      var body = "";
      res.on("data", function (chunk: Buffer) { body += chunk.toString(); });
      res.on("end", function () {
        try {
          var data = JSON.parse(body);
          if (data.error) {
            reject(new Error("Yahoo OAuth error: " + (data.error_description || data.error)));
            return;
          }
          resolve(data as YahooTokenResponse);
        } catch (e) {
          reject(new Error("Failed to parse Yahoo token response: " + body.slice(0, 200)));
        }
      });
    });

    req.on("error", function (e) {
      reject(new Error("Yahoo token exchange failed: " + e.message));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Save Yahoo OAuth credentials and tokens to the oauth file.
 * The yahoo-oauth Python library expects this specific format.
 */
export function saveOAuthFile(
  consumerKey: string,
  consumerSecret: string,
  tokens?: YahooTokenResponse
): void {
  var data: Record<string, unknown> = {
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
  };
  if (tokens) {
    data.access_token = tokens.access_token;
    data.refresh_token = tokens.refresh_token;
    data.token_type = tokens.token_type || "bearer";
    // The yahoo-oauth library expects token_time as seconds since epoch
    data.token_time = Math.floor(Date.now() / 1000);
  }
  fs.writeFileSync(OAUTH_FILE, JSON.stringify(data, null, 4), "utf-8");
  console.log("[SETUP] Saved OAuth file to " + OAUTH_FILE + " (has_tokens=" + !!tokens + ")");
}

/**
 * Read consumer key/secret from the OAuth file (if they exist).
 */
export function readOAuthConsumerCreds(): { consumerKey: string; consumerSecret: string } | null {
  var data = readOAuthFile();
  if (data && data.consumer_key && data.consumer_secret) {
    return { consumerKey: String(data.consumer_key), consumerSecret: String(data.consumer_secret) };
  }
  return null;
}

/**
 * Use Yahoo API to list the user's fantasy baseball leagues.
 * Calls Yahoo Fantasy API directly via HTTPS.
 */
export function fetchYahooLeagues(accessToken: string): Promise<Array<{ league_key: string; name: string; season: string; num_teams: number }>> {
  return new Promise(function (resolve, reject) {
    var options = {
      hostname: "fantasysports.yahooapis.com",
      path: "/fantasy/v2/users;use_login=1/games;game_keys=mlb/leagues?format=json",
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
    };

    var req = https.request(options, function (res) {
      var body = "";
      res.on("data", function (chunk: Buffer) { body += chunk.toString(); });
      res.on("end", function () {
        try {
          var data = JSON.parse(body);
          var leagues: Array<{ league_key: string; name: string; season: string; num_teams: number }> = [];

          // Navigate the deeply nested Yahoo API response
          var users = data.fantasy_content && data.fantasy_content.users;
          if (!users) { resolve([]); return; }

          var user = users["0"] && users["0"].user;
          if (!user) { resolve([]); return; }

          var games = user[1] && user[1].games;
          if (!games) { resolve([]); return; }

          // Iterate through games (each MLB season is a "game")
          var gameCount = parseInt(games.count || "0");
          for (var gi = 0; gi < gameCount; gi++) {
            var game = games[String(gi)] && games[String(gi)].game;
            if (!game) continue;

            var gameLeagues = game[1] && game[1].leagues;
            if (!gameLeagues) continue;

            var leagueCount = parseInt(gameLeagues.count || "0");
            for (var li = 0; li < leagueCount; li++) {
              var league = gameLeagues[String(li)] && gameLeagues[String(li)].league;
              if (!league || !league[0]) continue;

              var info = league[0];
              leagues.push({
                league_key: info.league_key || "",
                name: info.name || "",
                season: info.season || "",
                num_teams: parseInt(info.num_teams || "0"),
              });
            }
          }

          resolve(leagues);
        } catch (e) {
          reject(new Error("Failed to parse Yahoo leagues response: " + (e as Error).message));
        }
      });
    });

    req.on("error", function (e) {
      reject(new Error("Yahoo leagues fetch failed: " + e.message));
    });

    req.end();
  });
}

/**
 * Use Yahoo API to list teams in a specific league.
 */
export function fetchYahooTeams(accessToken: string, leagueKey: string): Promise<Array<{ team_key: string; name: string; manager: string; is_owned_by_current_login: boolean }>> {
  return new Promise(function (resolve, reject) {
    var encodedKey = encodeURIComponent(leagueKey);
    var options = {
      hostname: "fantasysports.yahooapis.com",
      path: "/fantasy/v2/league/" + encodedKey + "/teams?format=json",
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
    };

    var req = https.request(options, function (res) {
      var body = "";
      res.on("data", function (chunk: Buffer) { body += chunk.toString(); });
      res.on("end", function () {
        try {
          var data = JSON.parse(body);
          var teams: Array<{ team_key: string; name: string; manager: string; is_owned_by_current_login: boolean }> = [];

          var league = data.fantasy_content && data.fantasy_content.league;
          if (!league) { resolve([]); return; }

          var teamsData = league[1] && league[1].teams;
          if (!teamsData) { resolve([]); return; }

          var teamCount = parseInt(teamsData.count || "0");
          for (var i = 0; i < teamCount; i++) {
            var team = teamsData[String(i)] && teamsData[String(i)].team;
            if (!team || !team[0]) continue;

            var info = team[0];
            // Team info is an array of objects with different properties
            var teamKey = "";
            var teamName = "";
            var managerName = "";
            var isOwned = false;

            for (var j = 0; j < info.length; j++) {
              var item = info[j];
              if (typeof item === "object" && item !== null) {
                if (item.team_key) teamKey = item.team_key;
                if (item.name) teamName = item.name;
                if (item.is_owned_by_current_login !== undefined) {
                  isOwned = item.is_owned_by_current_login === 1 || item.is_owned_by_current_login === "1";
                }
                if (item.managers) {
                  var mgr = item.managers[0] && item.managers[0].manager;
                  if (mgr) managerName = mgr.nickname || "";
                }
              }
            }

            teams.push({
              team_key: teamKey,
              name: teamName,
              manager: managerName,
              is_owned_by_current_login: isOwned,
            });
          }

          resolve(teams);
        } catch (e) {
          reject(new Error("Failed to parse Yahoo teams response: " + (e as Error).message));
        }
      });
    });

    req.on("error", function (e) {
      reject(new Error("Yahoo teams fetch failed: " + e.message));
    });

    req.end();
  });
}

/**
 * Read the access token from the OAuth file.
 */
export function getAccessToken(): string | null {
  var data = readOAuthFile();
  return (data && typeof data.access_token === "string") ? data.access_token : null;
}
