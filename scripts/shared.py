#!/usr/bin/env python3
"""Shared utilities for Yahoo Fantasy Baseball scripts.

Consolidates duplicated code that was copy-pasted across
yahoo-fantasy.py, season-manager.py, history.py, intel.py, and mlb-data.py.
"""

import os
import json
import time
import http.client
import ssl
import urllib.request
import threading
import unicodedata

from yahoo_oauth import OAuth2
import yahoo_fantasy_api as yfa

# ---------------------------------------------------------------------------
# Environment / config (env var > baseclaw.json config file > default)
# ---------------------------------------------------------------------------
OAUTH_FILE = os.environ.get("OAUTH_FILE", "/app/config/yahoo_oauth.json")
DATA_DIR = os.environ.get("DATA_DIR", "/app/data")

_BASECLAW_CONFIG_PATH = os.environ.get("BASECLAW_CONFIG_PATH", "/app/config/baseclaw.json")
_baseclaw_config_cache = None

def _read_baseclaw_config():
    """Read the baseclaw.json config file (written by setup wizard). Cached per process."""
    global _baseclaw_config_cache
    if _baseclaw_config_cache is not None:
        return _baseclaw_config_cache
    try:
        with open(_BASECLAW_CONFIG_PATH, "r") as f:
            _baseclaw_config_cache = json.load(f)
            return _baseclaw_config_cache
    except Exception:
        pass
    return {}

def _get_config(env_var, config_key, default=""):
    """Get config value: env var > baseclaw.json > default."""
    val = os.environ.get(env_var, "")
    if val:
        return val
    cfg = _read_baseclaw_config()
    return cfg.get(config_key, default)

LEAGUE_ID = _get_config("LEAGUE_ID", "league_id", "")
TEAM_ID = _get_config("TEAM_ID", "team_id", "")
GAME_KEY = LEAGUE_ID.split(".")[0] if LEAGUE_ID else ""

# ---------------------------------------------------------------------------
# MLB Stats API
# ---------------------------------------------------------------------------
MLB_API = "https://statsapi.mlb.com/api/v1"

USER_AGENT = "YahooFantasyBot/1.0"


def mlb_fetch(endpoint):
    """Fetch JSON from MLB Stats API with User-Agent header."""
    url = MLB_API + endpoint
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print("Warning: MLB API fetch failed for " + endpoint + ": " + str(e))
        return {}


_reddit_circuit_open = False
_reddit_circuit_time = 0


def reddit_get(path):
    """Fetch JSON from Reddit API. Uses http.client to bypass TLS fingerprint blocking.

    Circuit breaker: after a 429, skip all Reddit calls for 60 seconds to avoid
    cascading timeouts that stall the morning briefing and other workflows.
    """
    global _reddit_circuit_open, _reddit_circuit_time
    # Circuit breaker: skip if recently rate-limited
    if _reddit_circuit_open and (time.time() - _reddit_circuit_time) < 60:
        return None
    _reddit_circuit_open = False

    try:
        ctx = ssl.create_default_context()
        conn = http.client.HTTPSConnection("www.reddit.com", timeout=3, context=ctx)
        conn.request("GET", path, headers={"User-Agent": "BaseClaw:v1.0"})
        resp = conn.getresponse()
        if resp.status == 429:
            _reddit_circuit_open = True
            _reddit_circuit_time = time.time()
            conn.close()
            return None
        if resp.status != 200:
            print("Warning: Reddit returned HTTP " + str(resp.status) + " for " + path)
            conn.close()
            return None
        data = json.loads(resp.read().decode())
        conn.close()
        return data
    except Exception as e:
        print("Warning: Reddit fetch failed for " + path + ": " + str(e))
        return None


# ---------------------------------------------------------------------------
# Team key auto-detection
# ---------------------------------------------------------------------------
_auto_team_key = None


def get_team_key(lg=None):
    """Get team key: env var first, then auto-detect from OAuth session.

    Auto-detection calls lg.teams() and finds the team owned by the
    current login.  The result is cached so the extra API call only
    happens once per process.
    """
    global _auto_team_key
    if TEAM_ID:
        return TEAM_ID
    if _auto_team_key:
        return _auto_team_key
    if lg is not None:
        try:
            teams = lg.teams()
            for tk, td in teams.items():
                if td.get("is_owned_by_current_login"):
                    _auto_team_key = tk
                    return tk
        except Exception as e:
            print("Warning: could not auto-detect team key: " + str(e))
    return ""


# ---------------------------------------------------------------------------
# Yahoo OAuth connection
# ---------------------------------------------------------------------------
def get_connection():
    """Get authenticated Yahoo OAuth connection."""
    if not LEAGUE_ID:
        raise RuntimeError("LEAGUE_ID environment variable is required")

    # Yahoo OAuth object creation is relatively expensive and many MCP
    # requests arrive in bursts (e.g. workflow tools). Reuse the same
    # connection for a short TTL and refresh token as needed.
    global _yahoo_cache
    now = time.time()
    with _yahoo_cache_lock:
        cached = _yahoo_cache.get("connection")
        if cached and now - _yahoo_cache.get("connection_time", 0) < _YAHOO_CACHE_TTL_SECONDS:
            sc = cached
        else:
            sc = OAuth2(None, None, from_file=OAUTH_FILE)
            _yahoo_cache["connection"] = sc
            _yahoo_cache["connection_time"] = now
            # League/team objects depend on connection lifecycle; invalidate.
            _yahoo_cache["game"] = None
            _yahoo_cache["league"] = None
            _yahoo_cache["team"] = None
            _yahoo_cache["team_key"] = ""

    if not sc.token_is_valid():
        sc.refresh_access_token()
    return sc


def get_league():
    """Get (sc, gm, lg) — connection, game, and league objects."""
    sc = get_connection()
    now = time.time()

    global _yahoo_cache
    with _yahoo_cache_lock:
        gm = _yahoo_cache.get("game")
        lg = _yahoo_cache.get("league")
        valid = now - _yahoo_cache.get("league_time", 0) < _YAHOO_CACHE_TTL_SECONDS
        if gm is None or lg is None or not valid:
            gm = yfa.Game(sc, "mlb")
            lg = gm.to_league(LEAGUE_ID)
            _yahoo_cache["game"] = gm
            _yahoo_cache["league"] = lg
            _yahoo_cache["league_time"] = now

    return sc, gm, lg


def get_league_context():
    """Get (sc, gm, lg, team) — connection, game, league, and team objects."""
    sc, gm, lg = get_league()
    tk = get_team_key(lg)
    if not tk:
        raise RuntimeError(
            "Could not determine team key. Set TEAM_ID env var or ensure "
            "your OAuth token is for a manager in this league."
        )
    now = time.time()

    global _yahoo_cache
    with _yahoo_cache_lock:
        cached_tk = _yahoo_cache.get("team_key", "")
        team = _yahoo_cache.get("team")
        valid = now - _yahoo_cache.get("team_time", 0) < _YAHOO_CACHE_TTL_SECONDS
        if team is None or cached_tk != tk or not valid:
            team = lg.to_team(tk)
            _yahoo_cache["team"] = team
            _yahoo_cache["team_key"] = tk
            _yahoo_cache["team_time"] = now

    return sc, gm, lg, team


_YAHOO_CACHE_TTL_SECONDS = int(os.environ.get("YAHOO_CONTEXT_CACHE_TTL_SECONDS", "120"))
_yahoo_cache_lock = threading.Lock()
_yahoo_cache = {
    "connection": None,
    "connection_time": 0,
    "game": None,
    "league": None,
    "league_time": 0,
    "team": None,
    "team_key": "",
    "team_time": 0,
}


# ---------------------------------------------------------------------------
# League settings cache (static settings that rarely change mid-season)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Cached lg.teams() / lg.standings() — called by many commands, each makes
# its own Yahoo API call.  A shared cache eliminates massive redundancy.
# ---------------------------------------------------------------------------
_league_data_cache = {}
_league_data_lock = threading.Lock()
_LEAGUE_DATA_TTL = 60


def _get_cached_league_call(key, ttl, call):
    """Thread-safe cache wrapper for expensive league API calls."""
    with _league_data_lock:
        cached = cache_get(_league_data_cache, key, ttl)
        if cached is not None:
            return cached
    result = call()
    with _league_data_lock:
        existing = cache_get(_league_data_cache, key, ttl)
        if existing is not None:
            return existing
        cache_set(_league_data_cache, key, result)
    return result


def get_cached_teams(lg):
    """Cache lg.teams() for 60s — called by many commands."""
    return _get_cached_league_call("teams", _LEAGUE_DATA_TTL, lg.teams)


def get_cached_standings(lg):
    """Cache lg.standings() for 60s."""
    return _get_cached_league_call("standings", _LEAGUE_DATA_TTL, lg.standings)


_LEAGUE_SETTINGS_CACHE_TTL = int(os.environ.get("LEAGUE_SETTINGS_CACHE_TTL", "3600"))
_LEAGUE_SETTINGS_NEGATIVE_TTL = 60  # seconds to cache empty result on API failure
_league_settings_cache = {}


def normalize_team_details(team):
    """Return team.details() normalized to a flat dict."""
    raw = team.details() if hasattr(team, "details") else None
    if not raw:
        return {}
    if isinstance(raw, list) and len(raw) > 0:
        return raw[0] if isinstance(raw[0], dict) else {}
    return raw if isinstance(raw, dict) else {}


def get_league_settings():
    """Get static league settings. Cached for LEAGUE_SETTINGS_CACHE_TTL seconds (default 1 hour).

    Returns a dict with: waiver_type, uses_faab, scoring_type, stat_categories,
    roster_positions, num_teams, max_weekly_adds.
    """
    cached = cache_get(_league_settings_cache, "settings", _LEAGUE_SETTINGS_CACHE_TTL)
    if cached is not None:
        return cached

    result = {}
    try:
        sc, gm, lg = get_league()
        settings = lg.settings()

        # Waiver type detection
        uses_faab_raw = settings.get("uses_faab")
        if uses_faab_raw is not None:
            uses_faab = str(uses_faab_raw) == "1"
        else:
            # Fallback: check if team has faab_balance
            uses_faab = False
            try:
                tk = get_team_key(lg)
                if tk:
                    team = lg.to_team(tk)
                    d = normalize_team_details(team)
                    if d.get("faab_balance") is not None:
                        uses_faab = True
            except Exception as e:
                print("Warning: could not check faab_balance for waiver type detection: " + str(e))

        if uses_faab:
            waiver_type = "faab"
        else:
            waiver_type = "priority"

        scoring_type = settings.get("scoring_type", "head")

        # Stat categories
        stat_categories = []
        try:
            raw_cats = lg.stat_categories()
            if isinstance(raw_cats, list):
                for cat in raw_cats:
                    if isinstance(cat, dict):
                        stat_categories.append({
                            "name": cat.get("display_name", cat.get("name", "?")),
                            "position_type": cat.get("position_type", ""),
                        })
        except Exception as e:
            print("Warning: could not fetch stat categories: " + str(e))

        # Roster positions
        roster_positions = []
        try:
            raw_pos = lg.positions() if hasattr(lg, "positions") else None
            if raw_pos:
                for rp in raw_pos:
                    roster_positions.append({
                        "position": rp.get("position", ""),
                        "count": int(rp.get("count", 1)),
                        "position_type": rp.get("position_type", ""),
                    })
        except Exception as e:
            print("Warning: could not fetch roster positions: " + str(e))

        result = {
            "waiver_type": waiver_type,
            "uses_faab": uses_faab,
            "scoring_type": scoring_type,
            "stat_categories": stat_categories,
            "roster_positions": roster_positions,
            "num_teams": settings.get("num_teams", 0),
            "max_weekly_adds": settings.get("max_weekly_adds", 0),
        }

        cache_set(_league_settings_cache, "settings", result)
    except Exception as e:
        print("Warning: get_league_settings failed: " + str(e))
        # Negative cache: avoid hammering the API on transient failures
        _league_settings_cache["settings"] = (result, time.time() - _LEAGUE_SETTINGS_CACHE_TTL + _LEAGUE_SETTINGS_NEGATIVE_TTL)

    return result


# ---------------------------------------------------------------------------
# Team name normalization
# ---------------------------------------------------------------------------
TEAM_ALIASES = {
    # Nicknames
    "D-backs": "Arizona Diamondbacks",
    "Diamondbacks": "Arizona Diamondbacks",
    "Braves": "Atlanta Braves",
    "Orioles": "Baltimore Orioles",
    "Red Sox": "Boston Red Sox",
    "Cubs": "Chicago Cubs",
    "White Sox": "Chicago White Sox",
    "Reds": "Cincinnati Reds",
    "Guardians": "Cleveland Guardians",
    "Rockies": "Colorado Rockies",
    "Tigers": "Detroit Tigers",
    "Astros": "Houston Astros",
    "Royals": "Kansas City Royals",
    "Angels": "Los Angeles Angels",
    "Dodgers": "Los Angeles Dodgers",
    "Marlins": "Miami Marlins",
    "Brewers": "Milwaukee Brewers",
    "Twins": "Minnesota Twins",
    "Mets": "New York Mets",
    "Yankees": "New York Yankees",
    "Athletics": "Oakland Athletics",
    "Phillies": "Philadelphia Phillies",
    "Pirates": "Pittsburgh Pirates",
    "Padres": "San Diego Padres",
    "Giants": "San Francisco Giants",
    "Mariners": "Seattle Mariners",
    "Cardinals": "St. Louis Cardinals",
    "Rays": "Tampa Bay Rays",
    "Rangers": "Texas Rangers",
    "Blue Jays": "Toronto Blue Jays",
    "Nationals": "Washington Nationals",
    # Yahoo abbreviations
    "AZ": "Arizona Diamondbacks",
    "ARI": "Arizona Diamondbacks",
    "ATL": "Atlanta Braves",
    "BAL": "Baltimore Orioles",
    "BOS": "Boston Red Sox",
    "CHC": "Chicago Cubs",
    "CWS": "Chicago White Sox",
    "CHW": "Chicago White Sox",
    "CIN": "Cincinnati Reds",
    "CLE": "Cleveland Guardians",
    "COL": "Colorado Rockies",
    "DET": "Detroit Tigers",
    "HOU": "Houston Astros",
    "KC": "Kansas City Royals",
    "LAA": "Los Angeles Angels",
    "LAD": "Los Angeles Dodgers",
    "MIA": "Miami Marlins",
    "MIL": "Milwaukee Brewers",
    "MIN": "Minnesota Twins",
    "NYM": "New York Mets",
    "NYY": "New York Yankees",
    "OAK": "Oakland Athletics",
    "PHI": "Philadelphia Phillies",
    "PIT": "Pittsburgh Pirates",
    "SD": "San Diego Padres",
    "SF": "San Francisco Giants",
    "SEA": "Seattle Mariners",
    "STL": "St. Louis Cardinals",
    "TB": "Tampa Bay Rays",
    "TEX": "Texas Rangers",
    "TOR": "Toronto Blue Jays",
    "WSH": "Washington Nationals",
    "WAS": "Washington Nationals",
}


def normalize_team_name(name):
    """Normalize a team name for matching."""
    if not name:
        return ""
    return name.strip().lower()


# ---------------------------------------------------------------------------
# TTL cache helpers (shared across intel.py, news.py, etc.)
# ---------------------------------------------------------------------------
def cache_get(cache_dict, key, ttl_seconds):
    """Get cached value if not expired."""
    entry = cache_dict.get(key)
    if entry is None:
        return None
    data, fetch_time = entry
    if time.time() - fetch_time > ttl_seconds:
        cache_dict.pop(key, None)
        return None
    return data


def cache_set(cache_dict, key, data):
    """Store value in cache with current timestamp."""
    cache_dict[key] = (data, time.time())


# ---------------------------------------------------------------------------
# Player name normalization (shared across intel.py, news.py, etc.)
# ---------------------------------------------------------------------------
def normalize_player_name(name):
    """Normalize player name for matching across sources."""
    if not name:
        return ""
    name = name.strip().lower()
    # Strip accents (e.g. García -> garcia, Muñoz -> munoz)
    name = "".join(c for c in unicodedata.normalize("NFD", name) if unicodedata.category(c) != "Mn")
    # Handle "Last, First" format
    if "," in name:
        parts = name.split(",", 1)
        name = parts[1].strip() + " " + parts[0].strip()
    # Remove Jr., Sr., III, etc.
    for suffix in [" jr.", " sr.", " iii", " ii", " iv"]:
        name = name.replace(suffix, "")
    return name.strip()


# ---------------------------------------------------------------------------
# Transaction trend cache
# ---------------------------------------------------------------------------
_trend_cache = {"data": None, "time": 0}


def get_trend_lookup():
    """Get a name->trend dict from transaction trends, cached 30 min."""
    import importlib
    now = time.time()
    if _trend_cache.get("data") and now - _trend_cache.get("time", 0) < 1800:
        return _trend_cache.get("data", {})
    try:
        yf_mod = importlib.import_module("yahoo-fantasy")
        raw = yf_mod.cmd_transaction_trends([], as_json=True)
        lookup = {}
        for i, p in enumerate(raw.get("most_added", [])):
            lookup[p.get("name", "")] = {
                "direction": "added",
                "delta": p.get("delta", ""),
                "rank": i + 1,
                "percent_owned": p.get("percent_owned", 0),
            }
        for i, p in enumerate(raw.get("most_dropped", [])):
            name = p.get("name", "")
            if name not in lookup:  # added takes priority
                lookup[name] = {
                    "direction": "dropped",
                    "delta": p.get("delta", ""),
                    "rank": i + 1,
                    "percent_owned": p.get("percent_owned", 0),
                }
        _trend_cache["data"] = lookup
        _trend_cache["time"] = now
        return lookup
    except Exception:
        return {}


def get_regression_adjusted_z(player_name, z_final):
    """Adjust a player's z-score based on regression signals.
    Buy-low players (positive regression_score) are worth more than current z.
    Sell-high players (negative score) are worth less.
    Scale: +/-50 regression score = +/-1.0 z adjustment, capped at +/-2.0.
    """
    try:
        from intel import get_regression_signal
        sig = get_regression_signal(player_name)
        if not sig:
            return z_final
        score = sig.get("regression_score")
        if score is None:
            return z_final
        adjustment = min(max(float(score) / 50.0, -2.0), 2.0)
        return round(z_final + adjustment, 2)
    except Exception:
        return z_final


QUALITY_TIER_ADJ = {"elite": 1.5, "strong": 0.75, "below": -0.4, "poor": -0.8}
HOT_COLD_ADJ = {"hot": 0.8, "warm": 0.4, "cold": -0.4, "ice": -0.8}


def compute_adjusted_z(player_name, z_final, quality_tier=None, hot_cold=None, context=None):
    """Compute fully adjusted z-score: regression + Statcast quality + hot/cold + news context.

    Consolidates the adjustment logic into a reusable function.
    The optional ``context`` dict (from ``news.get_player_context()``) feeds
    dealbreaker/warning/info flags, injury severity, and Reddit sentiment
    into the score so that recommendation engines never surface unavailable
    or significantly impaired players.

    Returns (adjusted_z, adjustments_dict) where adjustments_dict shows each modifier.
    """
    adjustments = {}
    adjusted = float(z_final)

    # --- News context adjustments (applied first so dealbreakers short-circuit) ---
    if context and isinstance(context, dict):
        flags = context.get("flags", [])
        injury_sev = context.get("injury_severity")
        reddit = context.get("reddit", {})

        # Dealbreaker flag: DFA'd, released, optioned, season-ending -> effectively zero
        has_dealbreaker = any(f.get("type") == "DEALBREAKER" for f in flags)
        if has_dealbreaker:
            adjustments["dealbreaker"] = -adjusted
            adjusted = 0.0
            return round(adjusted, 2), adjustments

        # Injury severity (from news headlines + MLB transactions)
        if injury_sev == "SEVERE":
            penalty = adjusted * 0.9
            adjusted *= 0.1
            adjustments["injury_severe"] = round(-penalty, 2)
        elif injury_sev == "MODERATE":
            penalty = adjusted * 0.5
            adjusted *= 0.5
            adjustments["injury_moderate"] = round(-penalty, 2)
        elif injury_sev == "MINOR":
            penalty = adjusted * 0.15
            adjusted *= 0.85
            adjustments["injury_minor"] = round(-penalty, 2)

        # Warning flag (IL, DTD, demoted, lost role) -- only if no injury already applied
        if not injury_sev:
            has_warning = any(f.get("type") == "WARNING" for f in flags)
            if has_warning:
                penalty = adjusted * 0.4
                adjusted *= 0.6
                adjustments["warning"] = round(-penalty, 2)

        # Info flag bonus (called up, activated, promoted)
        has_info = any(f.get("type") == "INFO" for f in flags)
        if has_info:
            adjusted += 0.5
            adjustments["positive_news"] = 0.5

        # Reddit sentiment (3+ mentions threshold)
        if reddit.get("mentions", 0) >= 3:
            sentiment = reddit.get("sentiment", "neutral")
            if sentiment == "bullish":
                adjusted += 0.3
                adjustments["reddit_bullish"] = 0.3
            elif sentiment == "bearish":
                adjusted -= 0.3
                adjustments["reddit_bearish"] = -0.3

    # Regression adjustment (+/-2.0 max)
    try:
        from intel import get_regression_signal
        sig = get_regression_signal(player_name)
        if sig and sig.get("regression_score") is not None:
            reg_adj = min(max(float(sig.get("regression_score", 0)) / 50.0, -2.0), 2.0)
            if abs(reg_adj) >= 0.1:
                adjusted += reg_adj
                adjustments["regression"] = round(reg_adj, 2)
    except Exception:
        pass

    # Statcast quality tier adjustment
    if quality_tier:
        q_adj = QUALITY_TIER_ADJ.get(quality_tier, 0)
        if q_adj != 0:
            adjusted += q_adj
            adjustments["quality"] = q_adj

    # Hot/cold momentum adjustment
    if hot_cold:
        hc_adj = HOT_COLD_ADJ.get(hot_cold, 0)
        if hc_adj != 0:
            adjusted += hc_adj
            adjustments["momentum"] = hc_adj

    return round(adjusted, 2), adjustments


# ---------------------------------------------------------------------------
# Unified player profile
# ---------------------------------------------------------------------------

_profile_cache = {}
_PROFILE_TTL = 300  # 5 minutes


def get_player_profile(name):
    """Unified player intelligence: z-score + intel + context + adjusted_z.

    Single entry point that returns everything known about a player.
    Cached for 5 minutes to avoid redundant API calls.
    Returns dict with: z_info, intel, context, adjusted_z, adjustments, has_dealbreaker.
    """
    cache_key = name.lower().strip()
    cached = cache_get(_profile_cache, cache_key, _PROFILE_TTL)
    if cached is not None:
        return cached

    result = {"name": name}

    # Z-score from projections
    try:
        from valuations import get_player_zscore
        z_info = get_player_zscore(name)
        result["z_info"] = z_info
    except Exception:
        z_info = None
        result["z_info"] = None

    # Intel: statcast + trends (lightweight for batch use)
    intel_data = None
    try:
        from intel import player_intel
        intel_data = player_intel(name, include=["statcast", "trends"])
        result["intel"] = intel_data
    except Exception:
        result["intel"] = None

    # News context: flags, injuries, reddit, transactions
    context = None
    try:
        from news import get_player_context
        context = get_player_context(name)
        result["context"] = context
    except Exception:
        result["context"] = None

    # Depth chart position
    try:
        from intel import get_depth_chart_position
        dc = get_depth_chart_position(name)
        result["depth_chart"] = dc
    except Exception:
        result["depth_chart"] = None

    # Compute fully adjusted z-score with all available signals
    z_final = z_info.get("z_final", 0) if z_info else 0
    quality_tier = None
    hot_cold = None
    if intel_data:
        sc = intel_data.get("statcast") or {}
        quality_tier = sc.get("quality_tier")
        tr = intel_data.get("trends") or {}
        hot_cold = tr.get("hot_cold")

    adjusted_z, adj_details = compute_adjusted_z(
        name, z_final, quality_tier, hot_cold, context)
    result["adjusted_z"] = adjusted_z
    result["adjustments"] = adj_details
    result["has_dealbreaker"] = "dealbreaker" in adj_details

    # Cap cache size to prevent unbounded growth in long-running processes
    if len(_profile_cache) > 500:
        _profile_cache.clear()
    cache_set(_profile_cache, cache_key, result)
    return result


def batch_player_profiles(names):
    """Get profiles for multiple players. Returns dict keyed by name."""
    result = {}
    for name in names:
        if not name:
            continue
        try:
            result[name] = get_player_profile(name)
        except Exception as e:
            print("Warning: profile failed for " + str(name) + ": " + str(e))
            result[name] = {"name": name, "error": str(e)}
    return result


def prefetch_context(players):
    """Batch-fetch news context for a list of player dicts (or name strings).

    Returns dict keyed by player name -> context dict.
    Parallel fetch with ThreadPoolExecutor to avoid sequential API call bottleneck.
    """
    result = {}
    try:
        from news import get_player_context
        from concurrent.futures import ThreadPoolExecutor, as_completed
        names = []
        for p in players:
            name = p.get("name", "") if isinstance(p, dict) else str(p)
            if name:
                names.append(name)
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(get_player_context, n): n for n in names}
            for fut in as_completed(futures):
                name = futures[fut]
                try:
                    result[name] = fut.result(timeout=5)
                except Exception:
                    pass
    except Exception:
        pass
    return result


def attach_context(players):
    """Lightweight context attach: sets _context on each player dict for scoring.

    Use this instead of enrich_with_context when you only need context for
    compute_adjusted_z (e.g. _build_roster_profile) and don't need display fields.
    """
    ctx_map = prefetch_context(players)
    for p in players:
        p["_context"] = ctx_map.get(p.get("name", ""))


def is_unavailable(context):
    """Check if a player context indicates they should be filtered from recommendations.

    Returns True if the player has a DEALBREAKER flag or availability is minors/released.
    """
    if not context or not isinstance(context, dict):
        return False
    for f in context.get("flags", []):
        if f.get("type") == "DEALBREAKER":
            return True
    if context.get("availability", "available") in ("minors", "released"):
        return True
    return False


# ---------------------------------------------------------------------------
# Sample size / confidence helpers
# ---------------------------------------------------------------------------

# Average PA/IP needed before current-season stats are more signal than noise
_BATTER_STABILIZATION_PA = 200
_PITCHER_STABILIZATION_BF = 350   # ~117 IP * 3

def add_sample_context(players):
    """Attach sample size + confidence to players that have intel data.

    Reads PA from intel.statcast.expected.pa (batters) or
    intel.statcast.era_analysis.ip (pitchers).
    Adds a 'sample' dict: {size, label, confidence, pct_stabilized}.
    """
    for p in players:
        intel = p.get("intel")
        if not intel or not isinstance(intel, dict):
            continue
        statcast = intel.get("statcast") or {}
        player_type = statcast.get("player_type", "batter")

        pa = None
        ip = None

        expected = statcast.get("expected") or {}
        pa = expected.get("pa")

        era = statcast.get("era_analysis") or {}
        ip = era.get("ip")

        if player_type == "pitcher" and ip is not None:
            try:
                ip_val = float(ip)
            except (TypeError, ValueError):
                continue
            bf_est = ip_val * 3
            pct = min(1.0, bf_est / _PITCHER_STABILIZATION_BF)
            p["sample"] = {
                "size": round(ip_val, 1),
                "label": "IP",
                "confidence": _confidence_label(pct),
                "pct_stabilized": round(pct, 2),
            }
        elif pa is not None:
            try:
                pa_val = int(float(pa))
            except (TypeError, ValueError):
                continue
            pct = min(1.0, pa_val / _BATTER_STABILIZATION_PA)
            p["sample"] = {
                "size": pa_val,
                "label": "PA",
                "confidence": _confidence_label(pct),
                "pct_stabilized": round(pct, 2),
            }


def _confidence_label(pct):
    if pct < 0.25:
        return "very_low"
    if pct < 0.50:
        return "low"
    if pct < 0.75:
        return "medium"
    return "high"


# ---------------------------------------------------------------------------
# Player enrichment helpers
# ---------------------------------------------------------------------------
def enrich_with_intel(players, count=None, boost_scores=False):
    """Add intel data to a list of player dicts.

    Args:
        players: list of player dicts (must have "name" key)
        count: if set, only enrich the first N players
        boost_scores: if True, adjust player "score" key based on quality tier
    """
    from intel import batch_intel
    try:
        subset = players[:count] if count else players
        names = [p.get("name", "") for p in subset]
        intel_data = batch_intel(names, include=["statcast", "trends"])
        for p in subset:
            pi = intel_data.get(p.get("name", ""))
            p["intel"] = pi
            if boost_scores and pi:
                sc = pi.get("statcast", {})
                quality = sc.get("quality_tier", "")
                if quality == "elite":
                    p["score"] = p.get("score", 0) + 15
                elif quality == "strong":
                    p["score"] = p.get("score", 0) + 10
                elif quality == "average":
                    p["score"] = p.get("score", 0) + 5
                # Hot streak bonus
                if pi.get("trends", {}).get("hot_cold") == "hot":
                    p["score"] = p.get("score", 0) + 8
                elif pi.get("trends", {}).get("hot_cold") == "warm":
                    p["score"] = p.get("score", 0) + 4
                # Regression signal adjustment
                try:
                    from intel import get_regression_signal
                    reg = get_regression_signal(p.get("name", ""))
                    if reg and reg.get("regression_score") is not None:
                        reg_score = float(reg.get("regression_score", 0))
                        # +/-50 regression score = +/-10 points to composite score
                        p["score"] = p.get("score", 0) + (reg_score / 5.0)
                        p["regression"] = reg
                except Exception:
                    pass
        add_sample_context(subset)
    except Exception as e:
        print("Warning: intel enrichment failed: " + str(e))


def enrich_with_trends(players, count=None):
    """Add trend data and boost scores based on add/drop momentum."""
    try:
        trend_lookup = get_trend_lookup()
        subset = players[:count] if count else players
        for p in subset:
            trend = trend_lookup.get(p.get("name", ""))
            if trend:
                p["trend"] = trend
                if trend.get("direction") == "added":
                    rank = trend.get("rank", 25)
                    p["score"] = p.get("score", 0) + max(0, 25 - (rank - 1) * 0.8)
                elif trend.get("direction") == "dropped":
                    rank = trend.get("rank", 25)
                    p["score"] = p.get("score", 0) - max(3, 15 - (rank - 1) * 0.5)
    except Exception:
        pass


def has_dealbreaker_flag(player):
    """Check if a player dict has a DEALBREAKER context flag."""
    for f in player.get("context_flags", []):
        if f.get("type") == "DEALBREAKER":
            return True
    return False


def enrich_with_context(players, count=None, filter_dealbreakers=False):
    """Add qualitative context to a list of player dicts.

    Calls get_player_context for each player and attaches:
        warning: str (first dealbreaker/warning message)
        news: list (top 2 headlines)
        context_flags: list (all flags)
        injury_severity: str (MINOR/MODERATE/SEVERE) or None
        role_change: dict (role_changed, change_type, description)
        reddit: dict (mentions, sentiment, summary)
        context_line: str (synthesized one-liner for display)

    When filter_dealbreakers=True, removes players with DEALBREAKER flags
    from the list in-place and returns {"filtered": [removed players]}.
    Otherwise returns {}.
    """
    try:
        from news import get_player_context
        from concurrent.futures import ThreadPoolExecutor, as_completed
        subset = players[:count] if count else players
        names = [p.get("name", "") for p in subset]

        # Parallel fetch: get_player_context for all players at once
        ctx_map = {}
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(get_player_context, n): n for n in names if n}
            for fut in as_completed(futures):
                name = futures[fut]
                try:
                    ctx_map[name] = fut.result(timeout=5)
                except Exception:
                    ctx_map[name] = {}

        # Apply context to player dicts (sequential, fast — just dict writes)
        for p in subset:
            ctx = ctx_map.get(p.get("name", ""), {})
            p["_context"] = ctx
            if ctx.get("flags"):
                p["context_flags"] = ctx["flags"]
                for f in ctx["flags"]:
                    if f.get("type") in ("DEALBREAKER", "WARNING"):
                        p["warning"] = f.get("message", "")
                        break
            if ctx.get("headlines"):
                p["news"] = ctx["headlines"][:2]
            if ctx.get("injury_severity"):
                p["injury_severity"] = ctx["injury_severity"]
                if ctx.get("headlines"):
                    p["injury_detail"] = ctx["headlines"][0].get("title", "")
            role = detect_role_change(p.get("name", ""), ctx=ctx)
            if role.get("role_changed"):
                p["role_change"] = role
            reddit = ctx.get("reddit", {})
            if reddit.get("mentions", 0) >= 1:
                p["reddit"] = reddit
            p["context_line"] = _build_context_line(p)
    except Exception:
        pass

    if filter_dealbreakers:
        filtered = []
        i = 0
        while i < len(players):
            if has_dealbreaker_flag(players[i]):
                filtered.append(players.pop(i))
            else:
                i += 1
        if filtered:
            return {"filtered": filtered}
    return {}


def detect_role_change(player_name, ctx=None):
    """Check news/transactions for role changes (SP->RP, closer changes, etc.).

    Args:
        player_name: Player name to check.
        ctx: Optional pre-fetched get_player_context() result to avoid re-fetch.

    Returns dict: role_changed (bool), change_type (str), description (str).
    """
    result = {"role_changed": False, "change_type": "", "description": ""}
    try:
        if ctx is None:
            from news import get_player_context
            ctx = get_player_context(player_name)

        # Gather all searchable text from headlines and transactions
        texts = []
        for h in ctx.get("headlines", []):
            title = h.get("title", "")
            if title:
                texts.append(title)
        for tx in ctx.get("transactions", []):
            desc = tx.get("description", "")
            if desc:
                texts.append(desc)

        if not texts:
            return result

        all_text = " ".join(texts).lower()

        # Role change keyword groups: (change_type, keywords, exclusions)
        role_checks = [
            ("sp_to_rp", [
                "bullpen", "relief role", "moved to relief",
                "long relief", "begin in bullpen",
            ], []),
            ("rp_to_closer", [
                "named closer", "closing duties",
                "9th inning", "saves role",
            ], []),
            ("lost_closer", [
                "loses closer", "lost closer", "removed from closer",
            ], []),
            ("added_to_rotation", [
                "rotation", "starting rotation",
                "named starter", "5th starter",
            ], ["removed", "out of"]),
            ("reduced_role", [
                "benched", "platoon", "bench role",
                "losing playing time",
            ], []),
        ]

        for change_type, keywords, exclusions in role_checks:
            for kw in keywords:
                if kw in all_text:
                    # Check exclusions
                    excluded = False
                    for ex in exclusions:
                        if ex in all_text:
                            excluded = True
                            break
                    if excluded:
                        continue
                    # Find the source text for description
                    source = ""
                    for t in texts:
                        if kw in t.lower():
                            source = t
                            break
                    label = change_type.replace("_", " ").title()
                    desc = label + " — " + source if source else label
                    return {
                        "role_changed": True,
                        "change_type": change_type,
                        "description": desc,
                    }
    except Exception:
        pass
    return result


def _build_context_line(player):
    """Build a human-readable one-liner summarizing qualitative context.

    Reads enrichment data already attached to the player dict by
    enrich_with_context, enrich_with_intel, and enrich_with_trends.
    """
    parts = []

    # Status flags (most important)
    for f in player.get("context_flags", []):
        ftype = f.get("type", "")
        msg = f.get("message", "")
        if ftype == "DEALBREAKER" and msg:
            parts.append("DEALBREAKER: " + msg)
            break
        elif ftype == "WARNING" and msg:
            parts.append("WARNING: " + msg)
            break
        elif ftype == "INFO" and msg:
            parts.append(msg)
            break

    # Injury severity
    severity = player.get("injury_severity")
    if severity:
        detail = player.get("injury_detail", "")
        sev_part = "Injury: " + severity
        if detail:
            sev_part = sev_part + " — " + detail[:80]
        parts.append(sev_part)

    # Hot/cold streak from intel enrichment
    intel = player.get("intel")
    if intel and isinstance(intel, dict):
        trends = intel.get("trends", {})
        hot_cold = trends.get("status", "")
        if hot_cold in ("hot", "warm"):
            splits = trends.get("splits", {})
            ops_14d = splits.get("ops_14d")
            avg_14d = splits.get("avg_14d")
            detail = ""
            if ops_14d:
                detail = str(ops_14d) + " OPS (14d)"
            elif avg_14d:
                detail = str(avg_14d) + " AVG (14d)"
            parts.append("Hot streak" + (": " + detail if detail else ""))
        elif hot_cold in ("cold", "ice"):
            splits = trends.get("splits", {})
            ops_14d = splits.get("ops_14d")
            era_14d = splits.get("era_14d")
            detail = ""
            if era_14d:
                detail = str(era_14d) + " ERA (14d)"
            elif ops_14d:
                detail = str(ops_14d) + " OPS (14d)"
            parts.append("Cold streak" + (": " + detail if detail else ""))

    # Role change
    role = player.get("role_change")
    if role and isinstance(role, dict) and role.get("role_changed"):
        parts.append("Role change: " + role.get("description", "")[:80])

    # Yahoo add/drop trend
    trend = player.get("trend")
    if trend and isinstance(trend, dict):
        direction = trend.get("direction", "")
        rank = trend.get("rank")
        if direction == "added" and rank and rank <= 15:
            parts.append("#" + str(rank) + " most-added in Yahoo")
        elif direction == "dropped" and rank and rank <= 15:
            parts.append("#" + str(rank) + " most-dropped in Yahoo")

    # Reddit sentiment (only if notable)
    reddit = player.get("reddit")
    if reddit and isinstance(reddit, dict) and reddit.get("mentions", 0) >= 3:
        parts.append("Reddit: " + reddit.get("summary", str(reddit.get("mentions")) + " mentions"))

    return " | ".join(parts)


def _attach_context_fields(rec, player):
    """Copy qualitative context fields from enriched player dict to output rec."""
    for key in ("warning", "news", "context_flags", "context_line",
                "injury_severity", "injury_detail", "role_change", "reddit"):
        val = player.get(key)
        if val:
            rec[key] = val


# ---------------------------------------------------------------------------
# Player news search (lightweight web search for trade context)
# ---------------------------------------------------------------------------
_news_cache = {}
_NEWS_CACHE_TTL = 600  # 10 minutes


def search_player_news(name, max_results=5):
    """Search for recent fantasy-relevant news about a player using Google News RSS.
    Returns a dict with headlines, sentiment keywords, and flags.
    Results are cached for 10 minutes."""
    import requests as req_lib
    from bs4 import BeautifulSoup

    cache_key = name.lower().strip()
    cached = _news_cache.get(cache_key)
    if cached and time.time() - cached.get("ts", 0) < _NEWS_CACHE_TTL:
        return cached.get("result", {})

    result = {"name": name, "headlines": [], "flags": [], "sentiment": "neutral"}

    try:
        # Google News RSS — no API key needed
        query = name + " fantasy baseball 2026"
        url = ("https://news.google.com/rss/search?q="
               + urllib.request.quote(query)
               + "&hl=en-US&gl=US&ceid=US:en")
        resp = req_lib.get(url, timeout=8, headers={
            "User-Agent": "Mozilla/5.0 (compatible; FantasyBot/1.0)"
        })
        if resp.status_code != 200:
            _news_cache[cache_key] = {"ts": time.time(), "result": result}
            return result

        soup = BeautifulSoup(resp.text, "lxml-xml")
        items = soup.find_all("item")[:max_results]

        headlines = []
        for item in items:
            title = item.find("title")
            if title:
                headlines.append(title.get_text(strip=True))

        result["headlines"] = headlines

        # Scan headlines for sentiment keywords
        all_text = " ".join(headlines).lower()

        negative_keywords = [
            "injury", "injured", "il stint", "out for", "shut down",
            "surgery", "torn", "fracture", "strain", "sprain",
            "demotion", "demoted", "sent down", "optioned",
            "benched", "platoon", "lost job", "loses role",
            "struggling", "slump", "bust", "avoid", "overrated",
            "suspended", "suspension",
        ]
        positive_keywords = [
            "breakout", "surge", "hot streak", "career year",
            "promoted", "called up", "named closer", "closing",
            "everyday", "locked in", "extension", "deal",
            "ace", "dominant", "elite", "sleeper", "must-add",
            "return", "returning", "comeback", "activated",
            "velocity up", "stuff plus",
        ]

        neg_hits = [kw for kw in negative_keywords if kw in all_text]
        pos_hits = [kw for kw in positive_keywords if kw in all_text]

        flags = []
        if neg_hits:
            flags.extend(["news_negative:" + kw for kw in neg_hits[:3]])
        if pos_hits:
            flags.extend(["news_positive:" + kw for kw in pos_hits[:3]])

        if len(neg_hits) > len(pos_hits) + 1:
            result["sentiment"] = "negative"
        elif len(pos_hits) > len(neg_hits) + 1:
            result["sentiment"] = "positive"
        else:
            result["sentiment"] = "mixed" if (neg_hits and pos_hits) else "neutral"

        result["flags"] = flags

    except Exception as e:
        result["error"] = str(e)[:80]

    _news_cache[cache_key] = {"ts": time.time(), "result": result}
    return result


def batch_player_news(names, max_results=3):
    """Search news for multiple players. Returns dict of name -> news result."""
    results = {}
    for name in names:
        if not name:
            continue
        try:
            results[name] = search_player_news(name, max_results)
        except Exception:
            results[name] = {"name": name, "headlines": [], "flags": [], "sentiment": "neutral"}
    return results
