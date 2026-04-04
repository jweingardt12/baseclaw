#!/usr/bin/env python3
"""Yahoo Fantasy Baseball In-Season Manager"""

import sys
import json
import os
import sqlite3
import importlib
import urllib.request
from datetime import datetime, date, timedelta

import yahoo_fantasy_api as yfa

try:
    import statsapi
except ImportError:
    statsapi = None

from mlb_id_cache import get_mlb_id
from shared import (
    get_connection, get_league_context, get_league, get_team_key,
    get_league_settings, get_regression_adjusted_z, compute_adjusted_z,
    get_cached_teams, get_cached_standings,
    LEAGUE_ID, TEAM_ID, GAME_KEY, DATA_DIR,
    MLB_API, mlb_fetch, TEAM_ALIASES, normalize_team_name,
    get_trend_lookup, enrich_with_intel, enrich_with_trends, enrich_with_context,
    _attach_context_fields, batch_player_news, has_dealbreaker_flag,
    prefetch_context, is_unavailable, attach_context,
)

from yahoo_browser import is_scope_error as _is_scope_error, write_method as _write_method

# Category correlations for punt analysis (shared by cmd_punt_advisor and preseason fallback)
_CATEGORY_CORRELATIONS = {
    "HR": ["RBI", "TB", "XBH"],
    "RBI": ["HR", "TB"],
    "TB": ["HR", "XBH", "RBI"],
    "XBH": ["HR", "TB"],
    "AVG": ["OBP", "H"],
    "OBP": ["AVG"],
    "H": ["AVG", "TB"],
    "R": ["OBP", "H"],
    "NSB": [],
    "K": ["ERA", "WHIP"],
    "ERA": ["WHIP", "K", "QS"],
    "WHIP": ["ERA", "K", "QS"],
    "QS": ["ERA", "WHIP", "W"],
    "W": ["QS"],
    "IP": ["K", "QS", "W"],
    "NSV": ["HLD"],
    "HLD": ["NSV"],
}

ROSTER_SPOT_VALUE = 2.5  # z-score value of an empty roster spot for trade eval
CALLUP_IMMINENT_THRESHOLD = 70  # min call-up probability to inject into optimal moves FA pool
READINESS_TO_Z_DIVISOR = 25.0  # prospect readiness->z conversion (80 readiness ~ 3.2 z)
CAT_HELP_Z_THRESHOLD = 0.3  # min per-category z-score to count as meaningful contribution

CATEGORY_VOLATILITY = {
    "R": 0.15, "H": 0.12, "HR": 0.20, "RBI": 0.15,
    "TB": 0.15, "AVG": 0.08, "OBP": 0.08, "XBH": 0.18, "NSB": 0.25,
    "K": 0.12, "IP": 0.10, "W": 0.25, "QS": 0.20,
    "ERA": 0.15, "WHIP": 0.12, "HLD": 0.25, "NSV": 0.30,
    "SV": 0.30, "SB": 0.25, "ER": 0.15, "L": 0.25,
}

PUNT_VIABILITY = {
    "SV":  {"puntable": True,  "risk": "low",    "reason": "Closer roles volatile, capital better elsewhere"},
    "NSV": {"puntable": True,  "risk": "low",    "reason": "Net saves volatile, same logic as SV"},
    "SB":  {"puntable": True,  "risk": "low",    "reason": "Speed concentrated in few players, frees draft capital"},
    "NSB": {"puntable": True,  "risk": "low",    "reason": "Net steals similar to SB"},
    "W":   {"puntable": True,  "risk": "medium", "reason": "Wins volatile but correlated with QS"},
    "HLD": {"puntable": True,  "risk": "low",    "reason": "Holds streamable and cheap"},
    "AVG": {"puntable": True,  "risk": "medium", "reason": "AVG punt viable but limits hitter pool"},
    "HR":  {"puntable": False, "risk": "high",   "reason": "HR correlates with R and RBI — gutts 3 categories"},
    "R":   {"puntable": False, "risk": "high",   "reason": "Core counting stat correlated with HR and RBI"},
    "RBI": {"puntable": False, "risk": "high",   "reason": "Core counting stat correlated with HR and R"},
    "K":   {"puntable": False, "risk": "high",   "reason": "Most reliable pitching counting stat"},
    "ERA": {"puntable": False, "risk": "high",   "reason": "Punting ERA destroys WHIP too (correlated)"},
    "WHIP":{"puntable": False, "risk": "high",   "reason": "Punting WHIP destroys ERA too (correlated)"},
    "QS":  {"puntable": True,  "risk": "medium", "reason": "QS puntable if going RP-heavy build"},
    "OBP": {"puntable": False, "risk": "high",   "reason": "OBP correlates with R and overall offense"},
    "IP":  {"puntable": True,  "risk": "medium", "reason": "IP puntable with RP-heavy approach"},
    "TB":  {"puntable": False, "risk": "high",   "reason": "TB correlates with HR, XBH, RBI"},
    "XBH": {"puntable": False, "risk": "high",   "reason": "XBH correlates with HR and TB"},
    "H":   {"puntable": False, "risk": "high",   "reason": "H correlates with AVG and R"},
}

# Hardcoded Yahoo stat_id -> display_name for this league's categories.
# Used as fallback when raw settings API fails to return stat IDs.
_YAHOO_STAT_ID_FALLBACK = {
    "7": "R", "8": "H", "12": "HR", "13": "RBI", "16": "SB",
    "3": "AVG", "55": "OBP", "23": "TB", "57": "XBH", "60": "NSB",
    "50": "IP", "28": "W", "29": "L", "37": "ER", "42": "K",
    "48": "HLD", "26": "ERA", "27": "WHIP", "63": "QS", "32": "SV",
    "85": "NSV", "83": "NSV",
}

# Stats where lower values are better (sort_order = 0 in Yahoo API)
_LOWER_IS_BETTER_STATS = {"ERA", "WHIP", "ER", "L", "ER_negative", "L_negative", "K_bat"}

# Team timezone offsets (UTC) for travel fatigue scoring (PNAS study, 46k games)
# Keyed by abbreviation; full names resolved via TEAM_ALIASES in _get_team_tz()
TEAM_TIMEZONE = {
    "ARI": -7, "ATL": -5, "BAL": -5, "BOS": -5, "CHC": -6,
    "CWS": -6, "CIN": -5, "CLE": -5, "COL": -7, "DET": -5,
    "HOU": -6, "KC": -6, "LAA": -8, "LAD": -8, "MIA": -5,
    "MIL": -6, "MIN": -6, "NYM": -5, "NYY": -5, "OAK": -8,
    "PHI": -5, "PIT": -5, "SD": -8, "SF": -8, "SEA": -8,
    "STL": -6, "TB": -5, "TEX": -6, "TOR": -5, "WSH": -5,
}


_stat_id_cache = {}


def _build_stat_id_to_name(lg):
    """Build stat_id -> display_name mapping from raw league settings.

    Parses the raw Yahoo API settings response to extract stat IDs and
    display names. Falls back to _YAHOO_STAT_ID_FALLBACK if the raw
    API call fails or returns no data. Cached per league_id.
    """
    league_key = lg.league_id
    if league_key in _stat_id_cache:
        return _stat_id_cache[league_key]
    stat_lookup = {}
    try:
        handler = lg.yhandler
        raw = handler.get("/league/" + league_key + "/settings")
        fc = raw.get("fantasy_content", raw)
        league_data = fc.get("league", {})
        settings_items = []
        if isinstance(league_data, list):
            for item in league_data:
                if isinstance(item, dict) and "settings" in item:
                    settings_items = item.get("settings", [])
                    break
        elif isinstance(league_data, dict) and "settings" in league_data:
            settings_items = league_data.get("settings", [])
        if isinstance(settings_items, list):
            for s in settings_items:
                if isinstance(s, dict) and "stat_categories" in s:
                    cats = s.get("stat_categories", {})
                    stats_list = cats.get("stats", []) if isinstance(cats, dict) else cats
                    if isinstance(stats_list, list):
                        for entry in stats_list:
                            stat = entry.get("stat", entry) if isinstance(entry, dict) else entry
                            if isinstance(stat, dict):
                                sid = str(stat.get("stat_id", ""))
                                name = stat.get("display_name", stat.get("abbr", ""))
                                if sid and name:
                                    stat_lookup[sid] = name
    except Exception:
        pass
    # Fall back to hardcoded mapping if raw parse returned nothing
    if not stat_lookup:
        stat_lookup = dict(_YAHOO_STAT_ID_FALLBACK)
    _stat_id_cache[league_key] = stat_lookup
    return stat_lookup


def _build_lower_is_better_sids(stat_id_to_name):
    """Return set of stat IDs where lower values are better.

    Uses the stat name to determine sort order since the Yahoo
    stat_categories() API does not reliably return sort_order.
    """
    lower_sids = set()
    for sid, name in stat_id_to_name.items():
        if name in _LOWER_IS_BETTER_STATS:
            lower_sids.add(sid)
    return lower_sids


FAAB_BID_RANGES = {
    "new_closer_contender": (0.20, 0.50),
    "breakout_bat":         (0.10, 0.25),
    "breakout_pitcher":     (0.08, 0.20),
    "streaming_pitcher":    (0.01, 0.03),
    "speculative_add":      (0.00, 0.02),
    "replacement_level":    (0.00, 0.01),
}


def get_format_strategy(scoring_type="head"):
    """Return strategy parameters based on league format."""
    if scoring_type == "roto":
        return {
            "streaming_aggression": "conservative",
            "punt_viable": False,
            "trade_timing": "patient",
            "category_balance": "critical",
            "waiver_frequency": "low",
        }
    return {
        "streaming_aggression": "aggressive",
        "punt_viable": True,
        "trade_timing": "aggressive",
        "category_balance": "moderate",
        "waiver_frequency": "high",
    }


def get_custom_category_adjustments(stat_categories):
    """Adjust strategy for non-standard category sets."""
    adjustments = {}
    cat_names = [c.get("display_name", c.get("name", "")) if isinstance(c, dict) else str(c) for c in stat_categories]
    if "QS" in cat_names and "W" not in cat_names:
        adjustments["sp_value_boost"] = 1.15
    if "OBP" in cat_names and "AVG" not in cat_names:
        adjustments["obp_build"] = True
    if "HLD" in cat_names or "NSV" in cat_names:
        adjustments["reliever_pool_expanded"] = True
        adjustments["closer_premium_reduced"] = 0.80
    if "NSB" in cat_names:
        adjustments["sb_threshold"] = 0.75
    return adjustments


def _annotate_sgp_efficiency(cat_dict, cat_name):
    """Add SGP efficiency data to a category dict."""
    try:
        from valuations import GENERIC_SGP_DENOMINATORS_12
        sgp_denom = GENERIC_SGP_DENOMINATORS_12.get(cat_name, None)
        if sgp_denom:
            cat_dict["sgp_denominator"] = sgp_denom
            if sgp_denom < 10:
                cat_dict["sgp_efficiency"] = "high"
            elif sgp_denom < 50:
                cat_dict["sgp_efficiency"] = "medium"
            else:
                cat_dict["sgp_efficiency"] = "low"
    except Exception:
        pass


def _get_park_factor(team_name):
    """Look up park factor for a team name, reusing valuations.get_park_factor."""
    try:
        from valuations import get_park_factor
        return get_park_factor(team_name)
    except Exception:
        return 1.0


def _get_team_tz(team_name):
    """Look up UTC offset for a team, trying direct match then aliases."""
    if not team_name:
        return None
    # Direct lookup
    tz = TEAM_TIMEZONE.get(team_name)
    if tz is not None:
        return tz
    # Try full name via aliases
    full = TEAM_ALIASES.get(team_name, team_name)
    tz = TEAM_TIMEZONE.get(full)
    if tz is not None:
        return tz
    # Try normalized matching against all keys
    norm = normalize_team_name(team_name)
    for key, val in TEAM_TIMEZONE.items():
        if normalize_team_name(key) == norm:
            return val
    return None


def get_travel_fatigue_score(team_name, game_date=None, schedule=None):
    """Compute travel fatigue score for a team based on recent schedule.

    Uses trailing 7-day schedule to detect timezone changes, schedule density,
    and day/night game patterns. Based on Northwestern PNAS study (46,535 games).

    Pass schedule= to avoid redundant API calls when scoring multiple teams.
    Returns dict with fatigue_score (0-10), details, games_7d, tz_changes.
    """
    try:
        if game_date is None:
            game_date = date.today()
        elif isinstance(game_date, str):
            game_date = datetime.strptime(game_date, "%Y-%m-%d").date()

        if schedule is None:
            start = game_date - timedelta(days=7)
            schedule = get_schedule_for_range(start.isoformat(), game_date.isoformat())
        if not schedule:
            return {
                "team": team_name,
                "fatigue_score": 0,
                "details": {"note": "No schedule data available"},
                "games_7d": 0,
                "tz_changes": [],
            }

        norm = normalize_team_name(team_name)
        full = TEAM_ALIASES.get(team_name, team_name)
        norm_full = normalize_team_name(full)

        # Collect games for this team in last 7 days, ordered by date
        team_games = []
        for game in schedule:
            away = game.get("away_name", "")
            home = game.get("home_name", "")
            away_norm = normalize_team_name(away)
            home_norm = normalize_team_name(home)

            is_away = (norm in away_norm or norm_full in away_norm)
            is_home = (norm in home_norm or norm_full in home_norm)

            if not is_away and not is_home:
                continue

            gd = game.get("game_date", "")
            game_dt = game.get("game_datetime", "")

            # Determine the city (home team location)
            if is_home:
                city_team = home
            else:
                city_team = home  # away team travels to home city

            team_games.append({
                "date": gd,
                "city_team": city_team,
                "is_home": is_home,
                "game_datetime": game_dt,
            })

        # Sort by date
        team_games.sort(key=lambda x: x.get("date", ""))

        games_7d = len(team_games)

        # Reconstruct timezone changes from city-to-city travel
        tz_changes = []
        prev_tz = None
        prev_city = None
        for g in team_games:
            city = g.get("city_team", "")
            tz = _get_team_tz(city)
            if tz is not None and prev_tz is not None and tz != prev_tz:
                tz_changes.append({
                    "from_city": prev_city,
                    "to_city": city,
                    "from_tz": prev_tz,
                    "to_tz": tz,
                    "zones_crossed": abs(tz - prev_tz),
                    "direction": "east" if tz > prev_tz else "west",
                    "date": g.get("date", ""),
                })
            if tz is not None:
                prev_tz = tz
                prev_city = city

        # --- Timezone penalty (changes in last 3 days) ---
        recent_cutoff = (game_date - timedelta(days=3)).isoformat()
        recent_changes = [c for c in tz_changes if c.get("date", "") >= recent_cutoff]

        timezone_penalty = 0
        direction_multiplier = 1.0
        for change in recent_changes:
            zones = change.get("zones_crossed", 0)
            if zones == 1:
                timezone_penalty += 0.5
            elif zones == 2:
                timezone_penalty += 1.5
            elif zones >= 3:
                timezone_penalty += 3.0
            # Eastward travel is harder (PNAS finding)
            if change.get("direction") == "east":
                direction_multiplier = max(direction_multiplier, 1.5)

        tz_score = timezone_penalty * direction_multiplier

        # --- Day-after-night penalty ---
        day_after_night_penalty = 0
        if len(team_games) >= 2:
            yesterday_games = [g for g in team_games
                               if g.get("date", "") == (game_date - timedelta(days=1)).isoformat()]
            today_games = [g for g in team_games
                           if g.get("date", "") == game_date.isoformat()]

            yesterday_late = False
            for g in yesterday_games:
                gdt = g.get("game_datetime", "")
                if gdt:
                    try:
                        # game_datetime is UTC ISO format from statsapi
                        dt = datetime.fromisoformat(gdt.replace("Z", "+00:00"))
                        city_tz = _get_team_tz(g.get("city_team", ""))
                        if city_tz is not None:
                            local_hour = dt.hour + city_tz  # approximate local hour
                            if local_hour < 0:
                                local_hour += 24
                            if local_hour >= 19:  # 7pm or later local
                                yesterday_late = True
                    except (ValueError, TypeError):
                        pass
                else:
                    # No time data — assume night game if not a weekend matinee
                    yesterday_late = True

            today_early = False
            for g in today_games:
                gdt = g.get("game_datetime", "")
                if gdt:
                    try:
                        dt = datetime.fromisoformat(gdt.replace("Z", "+00:00"))
                        city_tz = _get_team_tz(g.get("city_team", ""))
                        if city_tz is not None:
                            local_hour = dt.hour + city_tz
                            if local_hour < 0:
                                local_hour += 24
                            if local_hour < 16:  # before 4pm local
                                today_early = True
                    except (ValueError, TypeError):
                        pass

            if yesterday_late and today_early:
                day_after_night_penalty = 2.0

        # --- Density penalty ---
        # 0.5 per game above 6 in trailing 7 days
        density_penalty = max(0, (games_7d - 6) * 0.5)

        # --- Final score ---
        fatigue_score = tz_score + day_after_night_penalty + density_penalty
        fatigue_score = min(fatigue_score, 10.0)
        fatigue_score = round(fatigue_score, 1)

        return {
            "team": team_name,
            "fatigue_score": fatigue_score,
            "details": {
                "tz_score": round(tz_score, 1),
                "day_after_night_penalty": day_after_night_penalty,
                "density_penalty": round(density_penalty, 1),
                "direction_multiplier": direction_multiplier,
                "recent_tz_changes": len(recent_changes),
            },
            "games_7d": games_7d,
            "tz_changes": tz_changes,
        }
    except Exception as e:
        print("Warning: travel fatigue calculation failed for " + str(team_name) + ": " + str(e))
        return {
            "team": team_name,
            "fatigue_score": 0,
            "details": {"error": str(e)},
            "games_7d": 0,
            "tz_changes": [],
        }


def get_db():
    """Get SQLite connection with tables initialized"""
    db_path = os.path.join(DATA_DIR, "season.db")
    db = sqlite3.connect(db_path)
    db.execute("""CREATE TABLE IF NOT EXISTS ownership_history
                  (player_id TEXT, date TEXT, pct_owned REAL,
                   PRIMARY KEY (player_id, date))""")
    db.execute("""CREATE TABLE IF NOT EXISTS category_history
                  (week INTEGER, category TEXT, value REAL, rank INTEGER,
                   PRIMARY KEY (week, category))""")
    db.commit()
    return db


def _parse_schedule_response(data):
    """Parse MLB Schedule API JSON into a list of game dicts."""
    games = []
    for date_data in data.get("dates", []):
        for game in date_data.get("games", []):
            away = game.get("teams", {}).get("away", {}).get("team", {}).get("name", "")
            home = game.get("teams", {}).get("home", {}).get("team", {}).get("name", "")
            away_pitcher = ""
            home_pitcher = ""
            away_probable = game.get("teams", {}).get("away", {}).get("probablePitcher", {})
            home_probable = game.get("teams", {}).get("home", {}).get("probablePitcher", {})
            if away_probable:
                away_pitcher = away_probable.get("fullName", "")
            if home_probable:
                home_pitcher = home_probable.get("fullName", "")
            games.append({
                "away_name": away,
                "home_name": home,
                "game_date": date_data.get("date", ""),
                "status": game.get("status", {}).get("detailedState", ""),
                "away_probable_pitcher": away_pitcher,
                "home_probable_pitcher": home_pitcher,
            })
    return games


def get_todays_schedule():
    """Get today's MLB schedule with probable pitchers"""
    today = date.today().isoformat()
    return get_schedule_for_range(today, today)


_statsapi_hydrate_works = True

def get_schedule_for_range(start_date, end_date):
    """Get MLB schedule for a date range with probable pitchers"""
    global _statsapi_hydrate_works
    if statsapi:
        if _statsapi_hydrate_works:
            try:
                return statsapi.schedule(start_date=start_date, end_date=end_date, hydrate="probablePitcher,weather,officials")
            except Exception:
                _statsapi_hydrate_works = False
        try:
            return statsapi.schedule(start_date=start_date, end_date=end_date)
        except Exception as e:
            print("  Warning: statsapi range schedule failed: " + str(e))
    # Fallback to raw MLB API
    try:
        data = mlb_fetch("/schedule?sportId=1&startDate=" + start_date + "&endDate=" + end_date + "&hydrate=team,probablePitcher,weather,officials")
        return _parse_schedule_response(data)
    except Exception as e:
        print("  Warning: range schedule fetch failed: " + str(e))
        return []


def team_plays_today(team_name, schedule):
    """Check if an MLB team has a game in the given schedule"""
    if not team_name or not schedule:
        return False
    norm = normalize_team_name(team_name)
    # Also check aliases
    full_name = TEAM_ALIASES.get(team_name, team_name)
    norm_full = normalize_team_name(full_name)
    for game in schedule:
        away = normalize_team_name(game.get("away_name", ""))
        home = normalize_team_name(game.get("home_name", ""))
        if norm in away or norm in home or norm_full in away or norm_full in home:
            return True
    return False


def get_player_team(player):
    """Extract MLB team name from a Yahoo roster player dict"""
    # Yahoo roster entries may have editorial_team_full_name or editorial_team_abbr
    team_name = player.get("editorial_team_full_name", "")
    if not team_name:
        team_name = player.get("editorial_team_abbr", "")
    if not team_name:
        # Try name field patterns
        team_name = player.get("team", "")
    return team_name


_enrich_cache = {}
_ENRICH_TTL = 120

def enrich_roster_teams(roster, lg, team):
    """Add editorial_team_abbr to roster players from Yahoo enriched API.
    Basic team.roster() lacks team data; this fills it in.
    Cached per team_key for 120s to avoid duplicate API calls.
    """
    import time as _time
    cache_key = team.team_key
    now = _time.monotonic()
    cached = _enrich_cache.get(cache_key)
    if cached and (now - cached[0]) < _ENRICH_TTL:
        enriched = cached[1]
    else:
        try:
            yf_mod = importlib.import_module("yahoo-fantasy")
            stat_lookup = yf_mod._get_stat_lookup(lg)
            handler = lg.yhandler
            uri = ("/team/" + team.team_key
                   + "/roster/players;out=percent_started,percent_owned"
                   + "/stats;type=season;season=" + str(date.today().year))
            raw = handler.get(uri)
            enriched = yf_mod._parse_enriched_data(raw, stat_lookup)
            _enrich_cache[cache_key] = (now, enriched)
        except Exception as e:
            print("Warning: roster team enrichment failed: " + str(e))
            return
    for p in roster:
        pid = str(p.get("player_id", ""))
        if pid in enriched and enriched[pid].get("team"):
            p["editorial_team_abbr"] = enriched[pid]["team"]


def get_player_position(player):
    """Get the selected position for a roster player"""
    sp = player.get("selected_position", "?")
    if isinstance(sp, str):
        return sp
    return sp.get("position", "?")


def is_bench(player):
    """Check if player is on the bench"""
    pos = get_player_position(player)
    return pos in ("BN", "Bench")


def is_il(player):
    """Check if player is on injured list or minor league stash (NA) slot"""
    pos = get_player_position(player)
    return pos in ("IL", "IL+", "DL", "DL+", "NA")


def is_active_slot(player):
    """Check if player is in an active (non-bench, non-IL) slot"""
    return not is_bench(player) and not is_il(player)


def is_pitcher_position(positions):
    """Check if eligible positions indicate a pitcher"""
    return any(pos in ("SP", "RP", "P") for pos in positions)


def _player_z_summary(name):
    """Get z-score summary for a player: (z_val, tier, per_category_zscores)."""
    from valuations import get_player_zscore
    z_info = get_player_zscore(name) or {}
    return z_info.get("z_final", 0), z_info.get("tier", "Streamable"), z_info.get("per_category_zscores", {})


def _check_roster_fit(player_name, player_positions, roster, give_names=None, z_cache=None):
    """Check if an incoming player fits your roster.
    Returns dict: {slot, action, over/blocked_by, warning}.
    give_names: names being traded away (excluded from roster).
    z_cache: optional {name: z_final} dict to avoid repeated lookups.
    """
    from valuations import get_player_zscore
    non_playing = {"BN", "Bench", "IL", "IL+", "DL", "DL+", "NA"}
    give_set = set(n.lower() for n in (give_names or []))
    if z_cache is None:
        z_cache = {}

    def _z(name):
        if name in z_cache:
            return z_cache[name]
        val = (get_player_zscore(name) or {}).get("z_final", 0)
        z_cache[name] = val
        return val

    # Build current position map (excluding players being given away)
    pos_filled = {}
    for rp in roster:
        if rp.get("name", "").lower() in give_set:
            continue
        sel = get_player_position(rp)
        if sel not in non_playing:
            pos_filled.setdefault(sel, []).append(rp.get("name", ""))

    gp_z = _z(player_name)

    for elig_pos in player_positions:
        if elig_pos in ("Util", "BN", "P"):
            continue
        current = pos_filled.get(elig_pos, [])
        if not current:
            return {"player": player_name, "slot": elig_pos, "action": "fill_empty"}
        for curr_name in current:
            if gp_z > _z(curr_name):
                return {"player": player_name, "slot": elig_pos, "action": "upgrade", "over": curr_name}

    has_util = "Util" in player_positions
    first_pos = player_positions[0] if player_positions else "?"
    blocked_by = pos_filled.get(first_pos, ["?"])[0] if first_pos in pos_filled else "?"
    return {
        "player": player_name,
        "slot": "Util" if has_util else "BN",
        "action": "blocked",
        "blocked_by": blocked_by,
        "warning": player_name + " blocked at " + first_pos + " by " + blocked_by + (" — would play Util" if has_util else " — no starting slot"),
    }


def _build_roster_profile(roster):
    """Build competitive intelligence profile from an enriched roster.
    Expects roster already enriched via enrich_roster_teams() and enrich_with_intel().
    """
    from valuations import DEFAULT_BATTING_CATS, DEFAULT_BATTING_CATS_NEGATIVE, DEFAULT_PITCHING_CATS, DEFAULT_PITCHING_CATS_NEGATIVE
    all_cats = (DEFAULT_BATTING_CATS + DEFAULT_BATTING_CATS_NEGATIVE
                + DEFAULT_PITCHING_CATS + DEFAULT_PITCHING_CATS_NEGATIVE)

    quality = {"elite": 0, "strong": 0, "average": 0, "below": 0, "poor": 0}
    total_z = 0.0
    hitting_z = 0.0
    pitching_z = 0.0
    cat_strengths = {}
    regression_flags = []
    hot_players = []
    cold_players = []
    low_conf = 0

    non_playing = {"BN", "Bench", "IL", "IL+", "DL", "DL+", "NA"}

    for p in roster:
        pos = get_player_position(p)
        if pos in non_playing:
            continue
        name = p.get("name", "")
        positions = p.get("eligible_positions", [])
        is_pit = is_pitcher_position(positions)

        z_val, tier, per_cat = _player_z_summary(name)
        intel_data = p.get("intel") or {}
        sc_data = intel_data.get("statcast") or {}
        qt = sc_data.get("quality_tier")
        trends = intel_data.get("trends") or {}
        hot_cold = trends.get("hot_cold") or trends.get("status")
        p_ctx = p.get("_context")

        adj_z, _ = compute_adjusted_z(name, z_val, qt, hot_cold, p_ctx)
        total_z += adj_z
        if is_pit:
            pitching_z += adj_z
        else:
            hitting_z += adj_z

        if qt in quality:
            quality[qt] += 1

        for cat in all_cats:
            if cat in per_cat:
                cat_strengths[cat] = cat_strengths.get(cat, 0) + per_cat[cat]

        if hot_cold in ("hot",):
            hot_players.append(name)
        elif hot_cold in ("cold", "ice"):
            cold_players.append(name)

        sample = p.get("sample") or {}
        if sample.get("confidence") in ("very_low", "low"):
            low_conf += 1

        # Regression signal (in same loop to avoid second pass)
        try:
            from intel import get_regression_signal
            reg = get_regression_signal(name)
            if reg and reg.get("direction") in ("buy_low", "sell_high"):
                regression_flags.append({
                    "name": name,
                    "signal": reg.get("direction", ""),
                    "score": reg.get("regression_score", 0),
                    "detail": reg.get("details", ""),
                })
        except Exception:
            pass

    # Round category strengths
    for k in cat_strengths:
        cat_strengths[k] = round(cat_strengths[k], 2)

    return {
        "quality_breakdown": quality,
        "total_adjusted_z": round(total_z, 2),
        "hitting_adjusted_z": round(hitting_z, 2),
        "pitching_adjusted_z": round(pitching_z, 2),
        "regression_flags": regression_flags,
        "low_confidence_count": low_conf,
        "hot_players": hot_players,
        "cold_players": cold_players,
        "category_strengths": cat_strengths,
    }


def _find_vulnerabilities(profile, categories=None):
    """Identify exploitable weaknesses from a roster profile."""
    vulns = []
    for rf in profile.get("regression_flags", []):
        vulns.append({
            "type": "regression",
            "player": rf.get("name", ""),
            "detail": rf.get("signal", "") + ": " + rf.get("detail", ""),
        })
    if profile.get("low_confidence_count", 0) >= 3:
        vulns.append({
            "type": "sample_size",
            "detail": str(profile.get("low_confidence_count", 0)) + " players with low sample confidence — stats may be noise",
        })
    for p in profile.get("cold_players", []):
        vulns.append({
            "type": "cold_streak",
            "player": p,
            "detail": p + " on a cold streak",
        })
    # Weak categories (negative z-score sum)
    if categories:
        for cat in categories:
            cat_z = profile.get("category_strengths", {}).get(cat, 0)
            if cat_z < -2.0:
                vulns.append({
                    "type": "weak_category",
                    "category": cat,
                    "detail": cat + " roster z-sum is " + str(cat_z) + " — structurally weak",
                })
    return vulns


def _get_transaction_context(lg, my_team_key, opp_team_key=None):
    """Get transaction budget info for matchup context."""
    result = {}
    try:
        settings = get_league_settings()
        max_adds = settings.get("max_weekly_adds")
        if max_adds is not None:
            try:
                result["max_weekly_adds"] = int(max_adds)
            except (ValueError, TypeError):
                pass

        teams = lg.teams() if hasattr(lg, "teams") else {}
        for tk, td in teams.items():
            moves = td.get("number_of_moves", 0)
            trades = td.get("number_of_trades", 0)
            if my_team_key and my_team_key in str(tk):
                result["my_moves"] = int(moves) if moves else 0
                result["my_trades"] = int(trades) if trades else 0
            elif opp_team_key and opp_team_key in str(tk):
                result["opp_moves"] = int(moves) if moves else 0
                result["opp_trades"] = int(trades) if trades else 0
    except Exception as e:
        print("Warning: transaction context failed: " + str(e))
    return result


_cached_positions = None


def get_roster_positions(lg):
    """Get roster position slots from league settings, with fallback"""
    global _cached_positions
    if _cached_positions is not None:
        return _cached_positions
    try:
        raw = lg.positions() if hasattr(lg, "positions") else None
        if raw:
            # lg.positions() returns list of dicts:
            # [{"position": "C", "count": 1, "position_type": "B"}, ...]
            positions = []
            for p in raw:
                pos_name = p.get("position", "")
                count = int(p.get("count", 1))
                for _ in range(count):
                    positions.append(pos_name)
            if positions:
                _cached_positions = positions
                return positions
    except Exception as e:
        print("Warning: could not fetch positions: " + str(e))
    # Fallback to hardcoded
    _cached_positions = [
        "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF",
        "Util", "Util", "BN", "BN", "BN", "BN",
        "SP", "SP", "RP", "RP", "P", "P", "BN", "BN",
        "IL", "IL", "IL",
    ]
    return _cached_positions


def _player_info(p):
    """Build a player info dict for JSON responses"""
    return {
        "name": p.get("name", "Unknown"),
        "position": get_player_position(p),
        "team": get_player_team(p),
        "eligible_positions": p.get("eligible_positions", []),
        "status": p.get("status", ""),
        "headshot": p.get("headshot", {}).get("url", "") if isinstance(p.get("headshot"), dict) else "",
        "mlb_id": get_mlb_id(p.get("name", "")),
    }


# ---------- Schedule Analysis Helpers ----------


def fetch_probable_pitchers(days=7):
    """Fetch probable starters from MLB schedule for the next N days.
    Returns a list of dicts: {date, team, pitcher, opponent, home_away}
    """
    try:
        start = date.today().isoformat()
        end = (date.today() + timedelta(days=days - 1)).isoformat()
        schedule = get_schedule_for_range(start, end)
        pitchers = []
        for game in schedule:
            game_date = game.get("game_date", "")
            away_team = game.get("away_name", "")
            home_team = game.get("home_name", "")
            away_pitcher = game.get("away_probable_pitcher", "")
            home_pitcher = game.get("home_probable_pitcher", "")
            if away_pitcher:
                pitchers.append({
                    "date": game_date,
                    "team": away_team,
                    "pitcher": away_pitcher,
                    "opponent": home_team,
                    "home_away": "away",
                })
            if home_pitcher:
                pitchers.append({
                    "date": game_date,
                    "team": home_team,
                    "pitcher": home_pitcher,
                    "opponent": away_team,
                    "home_away": "home",
                })
        return pitchers
    except Exception as e:
        print("  Warning: probable pitchers fetch failed: " + str(e))
        return []


def analyze_schedule_density(team_name, days=14):
    """Analyze schedule density for a team over the next N days.
    Returns: {team, games_total, games_this_week, games_next_week, off_days, density_rating}
    """
    try:
        start = date.today()
        end = start + timedelta(days=days - 1)
        schedule = get_schedule_for_range(start.isoformat(), end.isoformat())

        norm = normalize_team_name(team_name)
        full_name = TEAM_ALIASES.get(team_name, team_name)
        norm_full = normalize_team_name(full_name)

        # Collect game dates for this team
        game_dates = set()
        for game in schedule:
            away = normalize_team_name(game.get("away_name", ""))
            home = normalize_team_name(game.get("home_name", ""))
            if norm in away or norm in home or norm_full in away or norm_full in home:
                gd = game.get("game_date", "")
                if gd:
                    game_dates.add(gd)

        games_total = len(game_dates)

        # Split into this week (days 0-6) and next week (days 7-13)
        this_week_dates = set()
        next_week_dates = set()
        for i in range(min(days, 7)):
            this_week_dates.add((start + timedelta(days=i)).isoformat())
        for i in range(7, min(days, 14)):
            next_week_dates.add((start + timedelta(days=i)).isoformat())

        games_this_week = len(game_dates & this_week_dates)
        games_next_week = len(game_dates & next_week_dates)

        # Count off days in the full range
        all_range_dates = set()
        for i in range(days):
            all_range_dates.add((start + timedelta(days=i)).isoformat())
        off_days = len(all_range_dates - game_dates)

        # Density rating based on average games per week
        avg_per_week = games_total / max(days / 7.0, 1)
        if avg_per_week >= 7:
            density_rating = "heavy"
        elif avg_per_week <= 5:
            density_rating = "light"
        else:
            density_rating = "normal"

        return {
            "team": team_name,
            "games_total": games_total,
            "games_this_week": games_this_week,
            "games_next_week": games_next_week,
            "off_days": off_days,
            "density_rating": density_rating,
        }
    except Exception as e:
        print("  Warning: schedule density analysis failed: " + str(e))
        return {
            "team": team_name,
            "games_total": 0,
            "games_this_week": 0,
            "games_next_week": 0,
            "off_days": 0,
            "density_rating": "unknown",
        }


# ---------- Commands ----------

# Position slot names that are not active lineup slots
_INACTIVE_SLOTS = {"bn", "il", "il+", "na", "dl"}

# Yahoo injury designation statuses
_IL_STATUSES = ("IL", "IL+", "IL10", "IL15", "IL60", "DL", "NA")

# Position types eligible for Util slot
_UTIL_POSITIONS = {"c", "1b", "2b", "3b", "ss", "of", "util", "lf", "cf", "rf", "dh"}


def _is_eligible_for_slot(eligible_positions, slot):
    """Check if a player's eligible positions allow them to fill a given slot."""
    slot_lower = slot.lower()
    if slot_lower in _INACTIVE_SLOTS:
        return False
    elig = [ep.lower() for ep in eligible_positions]
    if slot_lower == "util":
        return any(p in elig for p in _UTIL_POSITIONS)
    return slot_lower in elig


def _optimize_lineup_ilp(roster, active_slots, day_scores):
    """ILP-based lineup optimizer using scipy.optimize.milp.

    Finds globally optimal player-to-slot assignment maximizing total day score.
    Returns {lineup: {slot_idx: player}, bench: [...], total_ev: float, method: "ilp"}
    """
    try:
        from scipy.optimize import milp, LinearConstraint, Bounds
        import numpy as np
    except ImportError:
        return None  # Fall back to greedy

    n_players = len(roster)
    n_slots = len(active_slots)
    if n_players == 0 or n_slots == 0:
        return None

    # Build cost matrix (negative because milp minimizes)
    # Variable x[i*n_slots + j] = 1 if player i is in slot j
    n_vars = n_players * n_slots
    costs = np.zeros(n_vars)

    for i, player in enumerate(roster):
        pid = player.get("player_id", "") or player.get("name", "")
        player_score = day_scores.get(pid, 0)
        player_elig = player.get("eligible_positions", [])
        is_il_player = player.get("status", "") in _IL_STATUSES

        for j, slot in enumerate(active_slots):
            idx = i * n_slots + j
            eligible = (not is_il_player) and _is_eligible_for_slot(player_elig, slot)

            if eligible:
                costs[idx] = -player_score  # Negative for minimization
            else:
                costs[idx] = 999999  # Penalty for ineligible

    # Constraint 1: each slot filled by at most one player
    # Sum over all players for each slot <= 1
    slot_constraint_matrix = np.zeros((n_slots, n_vars))
    for j in range(n_slots):
        for i in range(n_players):
            slot_constraint_matrix[j, i * n_slots + j] = 1

    # Constraint 2: each player in at most one slot
    player_constraint_matrix = np.zeros((n_players, n_vars))
    for i in range(n_players):
        for j in range(n_slots):
            player_constraint_matrix[i, i * n_slots + j] = 1

    A = np.vstack([slot_constraint_matrix, player_constraint_matrix])
    b_upper = np.ones(n_slots + n_players)
    b_lower = np.zeros(n_slots + n_players)
    # Each slot should be filled by exactly 1 player (if possible)
    b_lower[:n_slots] = 1

    constraints = LinearConstraint(A, b_lower, b_upper)
    integrality = np.ones(n_vars)  # All binary
    bounds = Bounds(lb=0, ub=1)

    result = milp(c=costs, constraints=constraints, integrality=integrality, bounds=bounds)

    if not result.success:
        return None

    # Parse solution
    lineup = {}
    assigned_players = set()
    total_ev = 0
    for i in range(n_players):
        for j in range(n_slots):
            idx = i * n_slots + j
            if result.x[idx] > 0.5:
                lineup[j] = roster[i]
                assigned_players.add(i)
                pid = roster[i].get("player_id", "") or roster[i].get("name", "")
                total_ev += day_scores.get(pid, 0)

    bench = [roster[i] for i in range(n_players) if i not in assigned_players]

    return {
        "lineup": lineup,
        "bench": bench,
        "total_ev": round(total_ev, 2),
        "method": "ilp",
    }


def _optimize_lineup_greedy(roster, active_slots, day_scores):
    """Greedy lineup optimizer — fallback when scipy is unavailable.

    Sorts players by score descending, fills slots in order.
    Returns {lineup: {slot_idx: player}, bench: [...], total_ev: float, method: "greedy"}
    """
    # Sort players by day score descending
    sorted_players = sorted(
        range(len(roster)),
        key=lambda i: day_scores.get(
            roster[i].get("player_id", "") or roster[i].get("name", ""), 0
        ),
        reverse=True,
    )

    lineup = {}
    assigned_players = set()
    total_ev = 0

    for i in sorted_players:
        player = roster[i]
        is_il_player = player.get("status", "") in _IL_STATUSES
        if is_il_player:
            continue

        pid = player.get("player_id", "") or player.get("name", "")
        player_score = day_scores.get(pid, 0)
        player_elig = player.get("eligible_positions", [])

        for j, slot in enumerate(active_slots):
            if j in lineup:
                continue

            if _is_eligible_for_slot(player_elig, slot):
                lineup[j] = player
                assigned_players.add(i)
                total_ev += player_score
                break

    bench = [roster[i] for i in range(len(roster)) if i not in assigned_players]

    return {
        "lineup": lineup,
        "bench": bench,
        "total_ev": round(total_ev, 2),
        "method": "greedy",
    }


# ============================================================
# Strategic Intelligence Helpers
# ============================================================

def _get_category_trajectory(db):
    """Analyze category rank trends from stored history.
    Returns dict: {cat_name: {current_rank, trend, projected_rank, weeks_declining, alert, values}}
    """
    rows = db.execute(
        "SELECT week, category, value, rank FROM category_history ORDER BY week"
    ).fetchall()
    if not rows:
        return {}

    # Group by category
    by_cat = {}
    for week, cat, value, rank in rows:
        if cat not in by_cat:
            by_cat[cat] = []
        by_cat[cat].append({"week": week, "value": value, "rank": rank})

    result = {}
    for cat, points in by_cat.items():
        if len(points) < 1:
            continue
        current = points[-1]
        current_rank = current["rank"]

        # Trend: compare last 3 data points
        if len(points) >= 3:
            recent = [p["rank"] for p in points[-3:]]
            if recent[-1] < recent[0]:
                trend = "improving"
            elif recent[-1] > recent[0]:
                trend = "declining"
            else:
                trend = "stable"
        elif len(points) >= 2:
            if points[-1]["rank"] < points[-2]["rank"]:
                trend = "improving"
            elif points[-1]["rank"] > points[-2]["rank"]:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"

        # Projected rank at season end (simple linear regression on rank)
        projected_rank = current_rank
        if len(points) >= 3:
            n = len(points)
            x_vals = list(range(n))
            y_vals = [p["rank"] for p in points]
            x_mean = sum(x_vals) / n
            y_mean = sum(y_vals) / n
            num = sum((x_vals[i] - x_mean) * (y_vals[i] - y_mean) for i in range(n))
            den = sum((x_vals[i] - x_mean) ** 2 for i in range(n))
            if den > 0:
                slope = num / den
                # Project forward ~10 more weeks
                projected_rank = max(1, min(12, round(y_mean + slope * (n + 10 - x_mean))))

        # Count consecutive declining weeks
        weeks_declining = 0
        for i in range(len(points) - 1, 0, -1):
            if points[i]["rank"] > points[i - 1]["rank"]:
                weeks_declining += 1
            else:
                break

        alert = weeks_declining >= 3 or (trend == "declining" and projected_rank >= 10)

        result[cat] = {
            "current_rank": current_rank,
            "current_value": current["value"],
            "trend": trend,
            "projected_rank": projected_rank,
            "weeks_declining": weeks_declining,
            "alert": alert,
            "history": [{"week": p["week"], "rank": p["rank"]} for p in points[-8:]],
        }

    return result


def _get_season_context(lg):
    """Return season phase context for weighting recommendations.
    Phases: observation (weeks 1-4), adjustment (5-12), midseason, stretch (last 6 weeks).
    """
    try:
        current_week = lg.current_week()
    except Exception:
        current_week = 1
    try:
        settings = lg.settings()
        end_week = int(settings.get("end_week", 22))
    except Exception:
        end_week = 22

    weeks_remaining = max(1, end_week - current_week)
    total_weeks = max(1, end_week)
    pct_complete = round((current_week / total_weeks) * 100)

    if current_week <= 4:
        phase = "observation"
        patience = "high"
        urgency = "low"
        phase_note = ("Week " + str(current_week) + " (observation): Small sample sizes "
                      + "— resist overreacting to early stats. Focus on building roster "
                      + "depth and identifying buy-low targets.")
        min_pa = 150
        z_threshold = 0.5
    elif current_week <= 12:
        phase = "adjustment"
        patience = "medium"
        urgency = "medium"
        phase_note = ("Week " + str(current_week) + " (adjustment): Buy-low window is open "
                      + "— target underperformers with strong underlying metrics. "
                      + "Trade for players others are giving up on too early.")
        min_pa = 100
        z_threshold = 0.3
    elif weeks_remaining <= 6:
        phase = "stretch"
        patience = "low"
        urgency = "high"
        phase_note = ("Week " + str(current_week) + " (stretch run): Every move matters for "
                      + "playoff positioning. Target immediate contributors. "
                      + str(weeks_remaining) + " weeks remaining.")
        min_pa = 0
        z_threshold = 0.1
    else:
        phase = "midseason"
        patience = "medium"
        urgency = "medium"
        phase_note = ("Week " + str(current_week) + " (midseason): Balance long-term value "
                      + "with current needs. Monitor category trends closely.")
        min_pa = 50
        z_threshold = 0.2

    return {
        "phase": phase,
        "week": current_week,
        "end_week": end_week,
        "weeks_remaining": weeks_remaining,
        "pct_complete": pct_complete,
        "patience": patience,
        "urgency": urgency,
        "phase_note": phase_note,
        "min_pa": min_pa,
        "z_threshold": z_threshold,
    }


def _compute_sgp_values(standings, categories):
    """Compute standings-gain-point value for each category.
    SGP = average gap between adjacent teams for each stat.
    Returns dict: {cat_name: {sgp, marginal_value, my_rank, gap_to_next}}.
    """
    if not standings or not categories:
        return {}

    # Build per-team category values from standings
    all_stats = {}
    my_team_stats = {}
    for t in standings:
        team_name = t.get("name", "")
        stats = t.get("stats", {})
        if stats:
            all_stats[team_name] = stats
            # Detect if this is the user's team (first in standings usually has a marker)
            if t.get("is_mine"):
                my_team_stats = stats

    if not all_stats:
        return {}

    result = {}
    num_teams = len(all_stats)
    for cat in categories:
        vals = []
        for team_name, stats in all_stats.items():
            v = stats.get(cat)
            if v is not None:
                try:
                    vals.append(float(v))
                except (ValueError, TypeError):
                    pass

        if len(vals) < 2:
            continue

        vals_sorted = sorted(vals, reverse=True)
        # SGP = average gap between adjacent teams
        gaps = [vals_sorted[i] - vals_sorted[i + 1] for i in range(len(vals_sorted) - 1)]
        sgp = sum(gaps) / len(gaps) if gaps else 1.0
        marginal = 1.0 / sgp if sgp > 0.001 else 0

        # Where does my team rank?
        my_val = 0
        if my_team_stats:
            try:
                my_val = float(my_team_stats.get(cat, 0))
            except (ValueError, TypeError):
                pass

        my_rank = 1
        for v in vals_sorted:
            if my_val < v:
                my_rank += 1
            else:
                break

        # Gap to next position up
        gap_to_next = 0
        if my_rank > 1 and my_rank <= len(vals_sorted):
            gap_to_next = round(vals_sorted[my_rank - 2] - my_val, 2)

        result[cat] = {
            "sgp": round(sgp, 3),
            "marginal_value": round(marginal, 2),
            "my_rank": my_rank,
            "my_value": my_val,
            "gap_to_next": gap_to_next,
            "num_teams": num_teams,
        }

    return result


