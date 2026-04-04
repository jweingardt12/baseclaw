#!/usr/bin/env python3
"""Fantasy Baseball Intelligence Module

Provides Statcast data, trends, Reddit buzz, and advanced analytics
for every player surface in the app.

Data sources:
- Baseball Savant CSV leaderboards (expected stats, statcast, sprint speed)
- FanGraphs via pybaseball (plate discipline)
- Reddit r/fantasybaseball (buzz, sentiment)
- MLB Stats API (transactions, game logs)
"""

import sys
import os
import json
import time
import csv
import io
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mlb_id_cache import get_mlb_id
import sqlite3
from shared import MLB_API, mlb_fetch as _mlb_fetch, USER_AGENT, DATA_DIR, reddit_get, TEAM_ALIASES, normalize_team_name
from shared import normalize_player_name as _normalize_name

# Set of 30 MLB team full names for filtering minor-league noise
_MLB_TEAMS = set(TEAM_ALIASES.values())

# Current year for all API calls
YEAR = date.today().year

# TTL values in seconds
TTL_SAVANT = 21600       # 6 hours
TTL_PYBASEBALL = 3600    # 1 hour
TTL_FANGRAPHS = 21600    # 6 hours
TTL_REDDIT = 900          # 15 minutes
TTL_MLB = 1800            # 30 minutes
TTL_SPLITS = 86400        # 24 hours (splits are stable)
TTL_WAR = 86400           # 24 hours


# ============================================================
# 0. Unified CacheManager (additive — existing caches untouched)
# ============================================================

class CacheManager:
    """Unified cache for expensive API calls with TTL and stats"""
    def __init__(self):
        self._stores = {}

    def get(self, key, ttl=3600):
        entry = self._stores.get(key)
        if entry is None:
            return None
        if (time.time() - entry.get("time", 0)) >= ttl:
            entry["misses"] = entry.get("misses", 0) + 1
            return None
        entry["hits"] = entry.get("hits", 0) + 1
        return entry.get("data")

    def set(self, key, data, ttl=3600):
        self._stores[key] = {"data": data, "time": time.time(), "ttl": ttl, "hits": 0, "misses": 0}

    def stats(self):
        result = {}
        for k, v in self._stores.items():
            age = int(time.time() - v.get("time", 0))
            result[k] = {"hits": v.get("hits", 0), "misses": v.get("misses", 0), "age_seconds": age, "ttl": v.get("ttl", 0), "fresh": age < v.get("ttl", 0)}
        return result

    def clear(self, key=None):
        if key:
            self._stores.pop(key, None)
        else:
            self._stores.clear()

_cache_manager = CacheManager()


# ============================================================
# 1. TTL Cache System
# ============================================================

_cache = {}


def _cache_get(key, ttl_seconds):
    """Get cached value if not expired"""
    entry = _cache.get(key)
    if entry is None:
        return None
    data, fetch_time = entry
    if time.time() - fetch_time > ttl_seconds:
        del _cache[key]
        return None
    return data


def _cache_set(key, data):
    """Store value in cache with current timestamp"""
    _cache[key] = (data, time.time())


# ============================================================
# 1b. Arsenal Snapshot Database
# ============================================================

_intel_db = None


def _get_intel_db():
    """Get SQLite connection for intel snapshots (reuses season.db)"""
    global _intel_db
    if _intel_db is not None:
        return _intel_db
    db_path = os.path.join(DATA_DIR, "season.db")
    _intel_db = sqlite3.connect(db_path, check_same_thread=False)
    _intel_db.execute(
        "CREATE TABLE IF NOT EXISTS arsenal_snapshots "
        "(player_name TEXT, date TEXT, pitch_type TEXT, "
        "usage_pct REAL, velocity REAL, spin_rate REAL, "
        "whiff_rate REAL, "
        "PRIMARY KEY (player_name, date, pitch_type))"
    )
    _intel_db.execute(
        "CREATE TABLE IF NOT EXISTS statcast_snapshots "
        "(player_name TEXT, date TEXT, metric TEXT, value REAL, "
        "PRIMARY KEY (player_name, date, metric))"
    )
    _intel_db.execute(
        "CREATE TABLE IF NOT EXISTS bat_tracking_snapshots "
        "(player_name TEXT, date TEXT, bat_speed REAL, swing_length REAL, "
        "fast_swing_rate REAL, squared_up_rate REAL, blast_pct REAL, "
        "PRIMARY KEY (player_name, date))"
    )
    _intel_db.commit()
    return _intel_db


def _save_statcast_snapshot(name, statcast_data):
    """Save key statcast metrics as a daily snapshot for historical comparison."""
    if not statcast_data or statcast_data.get("error") or statcast_data.get("note"):
        return
    try:
        db = _get_intel_db()
        today_str = date.today().isoformat()
        norm = _normalize_name(name)

        # Collect metrics from the statcast result
        metrics = {}
        expected = statcast_data.get("expected", {})
        if expected:
            if expected.get("xwoba") is not None:
                metrics["xwoba"] = expected.get("xwoba")
            if expected.get("xba") is not None:
                metrics["xba"] = expected.get("xba")
            if expected.get("xslg") is not None:
                metrics["xslg"] = expected.get("xslg")

        batted = statcast_data.get("batted_ball", {})
        if batted:
            if batted.get("avg_exit_velo") is not None:
                metrics["exit_velocity"] = batted.get("avg_exit_velo")
            if batted.get("barrel_pct") is not None:
                metrics["barrel_pct"] = batted.get("barrel_pct")
            if batted.get("hard_hit_pct") is not None:
                metrics["hard_hit_pct"] = batted.get("hard_hit_pct")

        speed = statcast_data.get("speed", {})
        if speed and speed.get("sprint_speed") is not None:
            metrics["sprint_speed"] = speed.get("sprint_speed")

        # Pitcher-specific from era_analysis
        era_info = statcast_data.get("era_analysis", {})
        if era_info:
            if era_info.get("era") is not None:
                metrics["era"] = era_info.get("era")
            if era_info.get("xera") is not None:
                metrics["xera"] = era_info.get("xera")

        for metric_name, value in metrics.items():
            try:
                db.execute(
                    "INSERT OR REPLACE INTO statcast_snapshots "
                    "(player_name, date, metric, value) VALUES (?, ?, ?, ?)",
                    (norm, today_str, metric_name, float(value))
                )
            except (ValueError, TypeError):
                continue
        db.commit()
    except Exception as e:
        print("Warning: _save_statcast_snapshot failed for " + str(name) + ": " + str(e))


# ============================================================
# 2. Baseball Savant CSV Fetchers
# ============================================================

def _fetch_csv(url):
    """Fetch a CSV from a URL and return list of dicts"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(raw))
        return list(reader)
    except Exception as e:
        print("Warning: CSV fetch failed for " + url + ": " + str(e))
        return []


def _is_savant_meta_key(key):
    """Return True for non-player metadata keys in savant dicts (id: refs, __ metadata)."""
    return key.startswith("id:") or key.startswith("__")


def _index_savant_rows(rows):
    """Build dict keyed by 'last_name, first_name' AND by player_id"""
    result = {}
    for row in rows:
        # Savant uses various column names for the player name
        name_key = (
            row.get("last_name, first_name", "")
            or row.get("player_name", "")
            or row.get("name", "")
        )
        if name_key:
            result[name_key] = row
        pid = row.get("player_id", "")
        if pid:
            result["id:" + str(pid)] = row
    return result


def _savant_with_fallback(url_template, cache_prefix, player_type):
    """Fetch Savant data with pre-season fallback to prior year.
    Returns (indexed_rows, data_season) tuple.
    """
    year = YEAR
    cache_key = (cache_prefix, player_type, year)
    cached = _cache_get(cache_key, TTL_SAVANT)
    if cached is not None:
        return cached

    url = url_template.replace("{YEAR}", str(year))
    rows = _fetch_csv(url)
    result = _index_savant_rows(rows)

    # Pre-season fallback: if empty/hollow and before May, try last year.
    # Savant may return rows with player names but all-None stat values preseason.
    _has_data = False
    if result:
        for _k, _v in result.items():
            if _k.startswith("__") or _k.startswith("id:"):
                continue
            if isinstance(_v, dict) and (_v.get("est_woba") is not None
                                         or _v.get("xwoba") is not None
                                         or _v.get("barrel_batted_rate") is not None
                                         or _v.get("sprint_speed") is not None):
                _has_data = True
                break
    if (not result or not _has_data) and date.today().month < 5:
        year = YEAR - 1
        fallback_key = (cache_prefix, player_type, year)
        cached_fb = _cache_get(fallback_key, TTL_SAVANT)
        if cached_fb is not None:
            return cached_fb
        url = url_template.replace("{YEAR}", str(year))
        rows = _fetch_csv(url)
        result = _index_savant_rows(rows)
        if result:
            result["__data_season"] = year
            _cache_set(fallback_key, result)
            _cache_set(cache_key, result)
            return result

    if result:
        result["__data_season"] = year
    _cache_set(cache_key, result)
    return result


def _fetch_savant_expected(player_type):
    """Fetch Baseball Savant expected stats leaderboard.
    player_type: 'batter' or 'pitcher'
    """
    url_template = (
        "https://baseballsavant.mlb.com/leaderboard/expected_statistics"
        "?type=" + player_type
        + "&year={YEAR}"
        + "&position=&team=&min=25&csv=true"
    )
    return _savant_with_fallback(url_template, "savant_expected", player_type)


def _fetch_savant_statcast(player_type):
    """Fetch Baseball Savant statcast leaderboard.
    player_type: 'batter' or 'pitcher'
    """
    url_template = (
        "https://baseballsavant.mlb.com/leaderboard/statcast"
        "?type=" + player_type
        + "&year={YEAR}"
        + "&position=&team=&min=25&csv=true"
    )
    return _savant_with_fallback(url_template, "savant_statcast", player_type)


def _fetch_savant_sprint_speed(player_type):
    """Fetch Baseball Savant sprint speed leaderboard.
    player_type: 'batter' or 'pitcher' (only batters have meaningful data)
    """
    url_template = (
        "https://baseballsavant.mlb.com/leaderboard/sprint_speed"
        "?type=" + player_type
        + "&year={YEAR}"
        + "&position=&team=&min=10&csv=true"
    )
    return _savant_with_fallback(url_template, "savant_sprint", player_type)


def _fetch_savant_bat_tracking():
    """Fetch Baseball Savant bat tracking leaderboard."""
    url_template = (
        "https://baseballsavant.mlb.com/leaderboard/bat-tracking"
        "?attackZone=&batSide=&contactType=&count=&dateStart=&dateEnd="
        "&gameType=&isHardHit=&minSwings=100&minGroupSwings=1"
        "&pitchHand=&pitchType=&playerType=Batter&season={YEAR}"
        "&team=&trimmedSeason=false&csv=true"
    )
    return _savant_with_fallback(url_template, "savant_bat_tracking", "batter")


def _extract_bat_tracking_metrics(row):
    """Extract bat tracking metrics from a Savant CSV row, handling column name variants."""
    return {
        "bat_speed": _safe_float(row.get("avg_bat_speed", row.get("bat_speed_avg"))),
        "swing_length": _safe_float(row.get("swing_length", row.get("swing_length_avg"))),
        "fast_swing_rate": _safe_float(row.get("hard_swing_rate", row.get("fast_swing_rate"))),
        "squared_up_rate": _safe_float(row.get("squared_up_per_swing", row.get("squared_up_rate"))),
        "blast_pct": _safe_float(row.get("blast_per_swing", row.get("blast_pct"))),
    }


def _fetch_savant_pitch_arsenal(player_type="pitcher"):
    """Fetch Baseball Savant pitch arsenal stats.
    Shows pitch mix, velocity, spin rate, whiff rate per pitch type.
    """
    url_template = (
        "https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats"
        "?type=" + player_type
        + "&pitchType=&year={YEAR}"
        + "&team=&min=10&csv=true"
    )
    return _savant_with_fallback(url_template, "savant_pitch_arsenal", player_type)


def _fetch_pitch_arsenal_rows():
    """Fetch raw pitch arsenal CSV rows (all rows, not indexed).
    Returns list of dicts -- one per pitcher per pitch type.
    Caches with same TTL as other Savant data.
    """
    cache_key = ("pitch_arsenal_rows", YEAR)
    cached = _cache_get(cache_key, TTL_SAVANT)
    if cached is not None:
        return cached

    year = YEAR
    url = (
        "https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats"
        "?type=pitcher&pitchType=&year=" + str(year)
        + "&team=&min=10&csv=true"
    )
    rows = _fetch_csv(url)

    # Pre-season fallback
    if not rows and date.today().month < 5:
        year = YEAR - 1
        url = (
            "https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats"
            "?type=pitcher&pitchType=&year=" + str(year)
            + "&team=&min=10&csv=true"
        )
        rows = _fetch_csv(url)

    _cache_set(cache_key, rows)
    return rows


def _find_player_arsenal_rows(name, rows):
    """Find ALL pitch arsenal rows for a player (one per pitch type)"""
    if not rows or not name:
        return []
    norm = _normalize_name(name)
    matched = []
    for row in rows:
        row_name = (
            row.get("last_name, first_name", "")
            or row.get("player_name", "")
            or ""
        )
        if not row_name:
            continue
        if _normalize_name(row_name) == norm:
            matched.append(row)
    # Fuzzy fallback if exact match fails
    if not matched:
        parts = norm.split()
        if parts:
            for row in rows:
                row_name = (
                    row.get("last_name, first_name", "")
                    or row.get("player_name", "")
                    or ""
                )
                if not row_name:
                    continue
                row_norm = _normalize_name(row_name)
                if all(p in row_norm for p in parts):
                    matched.append(row)
    return matched


def _build_arsenal_changes(name):
    """Detect pitch arsenal changes over time for a pitcher.

    Fetches current pitch arsenal, stores snapshot in SQLite,
    compares vs 30+ day old snapshot to detect:
    - Velocity changes > 1 mph
    - Usage shifts > 5%
    - New pitch types
    """
    try:
        rows = _fetch_pitch_arsenal_rows()
        if not rows:
            return {"note": "No pitch arsenal data available"}

        player_rows = _find_player_arsenal_rows(name, rows)
        if not player_rows:
            return {"note": "Player not found in pitch arsenal data"}

        # Build current arsenal dict keyed by pitch_type
        today_str = date.today().isoformat()
        current = {}
        db = _get_intel_db()

        for row in player_rows:
            pitch_type = row.get("pitch_type", "")
            if not pitch_type:
                continue
            usage = _safe_float(row.get("pitch_usage"))
            velo = _safe_float(row.get("pitch_velocity", row.get("velocity")))
            spin = _safe_float(row.get("spin_rate"))
            whiff = _safe_float(row.get("whiff_percent", row.get("whiff_pct")))

            current[pitch_type] = {
                "pitch_name": row.get("pitch_name", pitch_type),
                "usage_pct": usage,
                "velocity": velo,
                "spin_rate": spin,
                "whiff_rate": whiff,
            }

            # Save snapshot
            try:
                db.execute(
                    "INSERT OR REPLACE INTO arsenal_snapshots "
                    "(player_name, date, pitch_type, usage_pct, velocity, "
                    "spin_rate, whiff_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (_normalize_name(name), today_str, pitch_type,
                     usage, velo, spin, whiff)
                )
            except Exception as e:
                print("Warning: arsenal snapshot save failed: " + str(e))
        db.commit()

        # Query for historical snapshot (30+ days ago)
        cutoff = (date.today() - timedelta(days=30)).isoformat()
        try:
            cursor = db.execute(
                "SELECT date, pitch_type, usage_pct, velocity, spin_rate, "
                "whiff_rate FROM arsenal_snapshots "
                "WHERE player_name = ? AND date <= ? "
                "ORDER BY date DESC",
                (_normalize_name(name), cutoff)
            )
            hist_rows = cursor.fetchall()
        except Exception:
            hist_rows = []

        if not hist_rows:
            return {
                "current": current,
                "changes": [],
                "note": "No historical data yet (need 30+ days of snapshots)",
            }

        # Build historical arsenal from the most recent old snapshot date
        hist_date = hist_rows[0][0]
        historical = {}
        for h_row in hist_rows:
            if h_row[0] != hist_date:
                break
            pitch_type = h_row[1]
            historical[pitch_type] = {
                "usage_pct": h_row[2],
                "velocity": h_row[3],
                "spin_rate": h_row[4],
                "whiff_rate": h_row[5],
            }

        # Compare current vs historical
        changes = []
        all_pitch_types = set(list(current.keys()) + list(historical.keys()))

        for pt in sorted(all_pitch_types):
            cur = current.get(pt)
            hist = historical.get(pt)

            if cur and not hist:
                changes.append({
                    "pitch_type": pt,
                    "pitch_name": cur.get("pitch_name", pt),
                    "change_type": "new_pitch",
                    "detail": "New pitch added to arsenal",
                })
                continue

            if hist and not cur:
                changes.append({
                    "pitch_type": pt,
                    "change_type": "dropped_pitch",
                    "detail": "Pitch dropped from arsenal",
                })
                continue

            # Both exist -- check for changes
            pitch_name = cur.get("pitch_name", pt)

            # Velocity change > 1 mph
            cur_velo = cur.get("velocity")
            hist_velo = hist.get("velocity")
            if cur_velo is not None and hist_velo is not None:
                velo_diff = round(cur_velo - hist_velo, 1)
                if abs(velo_diff) > 1.0:
                    direction = "gained" if velo_diff > 0 else "lost"
                    changes.append({
                        "pitch_type": pt,
                        "pitch_name": pitch_name,
                        "change_type": "velocity",
                        "detail": (direction + " " + str(abs(velo_diff))
                                   + " mph (" + str(hist_velo) + " -> "
                                   + str(cur_velo) + ")"),
                        "old_value": hist_velo,
                        "new_value": cur_velo,
                        "diff": velo_diff,
                    })

            # Usage shift > 5%
            cur_usage = cur.get("usage_pct")
            hist_usage = hist.get("usage_pct")
            if cur_usage is not None and hist_usage is not None:
                usage_diff = round(cur_usage - hist_usage, 1)
                if abs(usage_diff) > 5.0:
                    direction = "increased" if usage_diff > 0 else "decreased"
                    changes.append({
                        "pitch_type": pt,
                        "pitch_name": pitch_name,
                        "change_type": "usage",
                        "detail": ("usage " + direction + " "
                                   + str(abs(usage_diff)) + "% ("
                                   + str(hist_usage) + "% -> "
                                   + str(cur_usage) + "%)"),
                        "old_value": hist_usage,
                        "new_value": cur_usage,
                        "diff": usage_diff,
                    })

        return {
            "current": current,
            "historical_date": hist_date,
            "changes": changes,
        }

    except Exception as e:
        return {"error": "Arsenal change detection failed: " + str(e)}


def _fetch_savant_percentile_rankings(player_type):
    """Fetch Baseball Savant percentile rankings.
    The famous Savant percentile cards: xwOBA, xBA, exit velo, barrel%,
    hard hit%, k%, bb%, sprint speed — all as percentiles.
    """
    url_template = (
        "https://baseballsavant.mlb.com/leaderboard/percentile-rankings"
        "?type=" + player_type
        + "&year={YEAR}"
        + "&position=&team=&csv=true"
    )
    return _savant_with_fallback(url_template, "savant_percentiles", player_type)


# ============================================================
# 3. FanGraphs via pybaseball
# ============================================================

def _fetch_fangraphs(stat_func, cache_label):
    """Common FanGraphs fetch logic with pre-season fallback.

    Args:
        stat_func: callable — pybaseball.batting_stats or pitching_stats
        cache_label: string key for the cache (e.g. "fangraphs_batting")
    """
    cache_key = (cache_label, YEAR)
    cached = _cache_get(cache_key, TTL_FANGRAPHS)
    if cached is not None:
        return cached

    def _parse_df(df, season):
        result = {}
        if df is not None:
            for _, row in df.iterrows():
                name = row.get("Name", "")
                if name:
                    result[name.lower()] = {
                        "bb_rate": row.get("BB%", None),
                        "k_rate": row.get("K%", None),
                        "o_swing_pct": row.get("O-Swing%", None),
                        "z_contact_pct": row.get("Z-Contact%", None),
                        "contact_pct": row.get("Contact%", None),
                        "swstr_pct": row.get("SwStr%", None),
                        "data_season": season,
                    }
        return result

    try:
        year = YEAR
        df = stat_func(year, qual=25)
        # Pre-season fallback: if empty and before May, try last year
        if (df is None or len(df) == 0) and date.today().month < 5:
            year = YEAR - 1
            df = stat_func(year, qual=25)
        result = _parse_df(df, year)
        _cache_set(cache_key, result)
        return result
    except Exception as e:
        print("Warning: FanGraphs " + cache_label + " fetch failed: " + str(e))
        if date.today().month < 5:
            try:
                df = stat_func(YEAR - 1, qual=25)
                result = _parse_df(df, YEAR - 1)
                _cache_set(cache_key, result)
                return result
            except Exception:
                pass
        return {}


def _fetch_fangraphs_batting():
    """Fetch FanGraphs batting stats for plate discipline."""
    from pybaseball import batting_stats
    return _fetch_fangraphs(batting_stats, "fangraphs_batting")


def _fetch_fangraphs_pitching():
    """Fetch FanGraphs pitching stats for plate discipline."""
    from pybaseball import pitching_stats
    return _fetch_fangraphs(pitching_stats, "fangraphs_pitching")


def get_fangraphs_recent(stat_type="bat", days=7):
    """Fetch FanGraphs current-season stats via pybaseball.

    stat_type: 'bat' or 'pit'.
    Returns dict keyed by lowercase player name with wRC+/OPS/K%/BB% for batters
    or ERA/FIP/K%/BB%/WHIP for pitchers.
    """
    cache_key = ("fangraphs_recent", stat_type, days, YEAR)
    cached = _cache_get(cache_key, TTL_FANGRAPHS)
    if cached is not None:
        return cached

    result = {}
    try:
        if stat_type == "bat":
            from pybaseball import batting_stats
            df = batting_stats(YEAR, qual=0)
        else:
            from pybaseball import pitching_stats
            df = pitching_stats(YEAR, qual=0)

        if df is None or len(df) == 0:
            _cache_set(cache_key, result)
            return result

        for _, row in df.iterrows():
            name = row.get("Name", "")
            if not name:
                continue
            if stat_type == "bat":
                result[name.lower()] = {
                    "wrc_plus": row.get("wRC+", None),
                    "ops": row.get("OPS", None),
                    "k_rate": row.get("K%", None),
                    "bb_rate": row.get("BB%", None),
                    "avg": row.get("AVG", None),
                    "slg": row.get("SLG", None),
                    "pa": row.get("PA", 0),
                }
            else:
                result[name.lower()] = {
                    "era": row.get("ERA", None),
                    "fip": row.get("FIP", None),
                    "k_rate": row.get("K%", None),
                    "bb_rate": row.get("BB%", None),
                    "whip": row.get("WHIP", None),
                    "ip": row.get("IP", 0),
                }
    except Exception as e:
        print("Warning: FanGraphs recent " + stat_type + " fetch failed: " + str(e))

    _cache_set(cache_key, result)
    return result


# ============================================================
# 3b. FantasyPros Consensus Rankings
# ============================================================

TTL_CONSENSUS = 86400  # 24 hours — rankings update daily


def get_consensus_rankings(position="ALL"):
    """Fetch FantasyPros consensus rest-of-season rankings.

    Returns list of dicts with ecr, rank_min, rank_max, rank_avg, rank_std,
    player_name, position, team, yahoo_id per player.
    rank_std identifies high-disagreement players (breakout/bust candidates).
    """
    cache_key = ("consensus_rankings", position)
    cached = _cache_get(cache_key, TTL_CONSENSUS)
    if cached is not None:
        return cached

    url = ("https://partners.fantasypros.com/api/v1/consensus-rankings.php"
           "?sport=MLB&position=" + str(position)
           + "&scoring=ROTO&type=ros")
    result = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode())
        for p in data.get("players", []):
            result.append({
                "player_name": p.get("player_name", ""),
                "team": p.get("player_team_id", ""),
                "position": p.get("primary_position", ""),
                "positions": p.get("player_positions", ""),
                "ecr": p.get("rank_ecr", 0),
                "rank_min": int(p.get("rank_min", 0)),
                "rank_max": int(p.get("rank_max", 0)),
                "rank_avg": float(p.get("rank_ave", 0)),
                "rank_std": float(p.get("rank_std", 0)),
                "pos_rank": p.get("pos_rank", ""),
                "yahoo_id": p.get("player_yahoo_id", ""),
            })
    except Exception as e:
        print("Warning: FantasyPros consensus fetch failed: " + str(e))

    _cache_set(cache_key, result)
    return result


# ============================================================
# 4. Reddit JSON API Fetcher
# ============================================================

def _fetch_reddit_hot():
    """Fetch hot posts from r/fantasybaseball"""
    cache_key = ("reddit_hot",)
    cached = _cache_get(cache_key, TTL_REDDIT)
    if cached is not None:
        return cached
    data = reddit_get("/r/fantasybaseball/hot.json?limit=50")
    if not data:
        return []
    posts = []
    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        posts.append({
            "title": post.get("title", ""),
            "score": post.get("score", 0),
            "num_comments": post.get("num_comments", 0),
            "url": post.get("url", ""),
            "created_utc": post.get("created_utc", 0),
            "flair": post.get("link_flair_text", ""),
        })
    _cache_set(cache_key, posts)
    return posts


def _search_reddit_player(player_name):
    """Search r/fantasybaseball for a specific player"""
    cache_key = ("reddit_search", player_name.lower())
    cached = _cache_get(cache_key, TTL_REDDIT)
    if cached is not None:
        return cached
    try:
        query = urllib.parse.quote(player_name)
        path = ("/r/fantasybaseball/search.json"
                "?q=" + query
                + "&sort=new&restrict_sr=on&limit=10")
        data = reddit_get(path)
        if not data:
            return []
        posts = []
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            posts.append({
                "title": post.get("title", ""),
                "score": post.get("score", 0),
                "num_comments": post.get("num_comments", 0),
                "created_utc": post.get("created_utc", 0),
            })
        # Filter to posts that actually mention the player
        last_name = player_name.strip().split()[-1].lower()
        posts = [p for p in posts if last_name in p.get("title", "").lower()]
        _cache_set(cache_key, posts)
        return posts
    except Exception as e:
        print("Warning: Reddit search failed: " + str(e))
        return []


# ============================================================
# 5. MLB Stats API Fetchers
# ============================================================

def _fetch_mlb_transactions(days=7):
    """Fetch recent MLB transactions"""
    cache_key = ("mlb_transactions", days)
    cached = _cache_get(cache_key, TTL_MLB)
    if cached is not None:
        return cached
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        endpoint = (
            "/transactions?startDate=" + start_date.strftime("%m/%d/%Y")
            + "&endDate=" + end_date.strftime("%m/%d/%Y")
        )
        data = _mlb_fetch(endpoint)
        transactions = []
        for tx in data.get("transactions", []):
            tx_type = tx.get("typeDesc", "")
            tx_date = tx.get("date", "")
            desc = tx.get("description", "")
            player_info = tx.get("person", tx.get("player", {}))
            player_name = player_info.get("fullName", "")
            team_info = tx.get("toTeam", tx.get("fromTeam", {}))
            team_name = team_info.get("name", "") if team_info else ""
            transactions.append({
                "type": tx_type,
                "date": tx_date,
                "description": desc,
                "player_name": player_name,
                "team": team_name,
            })
        _cache_set(cache_key, transactions)
        return transactions
    except Exception as e:
        print("Warning: MLB transactions fetch failed: " + str(e))
        return []


# ============================================================
# 3b. Depth Charts & Starting Lineups
# ============================================================

# MLB Stats API team IDs
_MLB_TEAM_IDS = {
    "Arizona Diamondbacks": 109, "Atlanta Braves": 144, "Baltimore Orioles": 110,
    "Boston Red Sox": 111, "Chicago Cubs": 112, "Chicago White Sox": 145,
    "Cincinnati Reds": 113, "Cleveland Guardians": 114, "Colorado Rockies": 115,
    "Detroit Tigers": 116, "Houston Astros": 117, "Kansas City Royals": 118,
    "Los Angeles Angels": 108, "Los Angeles Dodgers": 119, "Miami Marlins": 146,
    "Milwaukee Brewers": 158, "Minnesota Twins": 142, "New York Mets": 121,
    "New York Yankees": 147, "Oakland Athletics": 133, "Philadelphia Phillies": 143,
    "Pittsburgh Pirates": 134, "San Diego Padres": 135, "San Francisco Giants": 137,
    "Seattle Mariners": 136, "St. Louis Cardinals": 138, "Tampa Bay Rays": 139,
    "Texas Rangers": 140, "Toronto Blue Jays": 141, "Washington Nationals": 120,
}

TTL_DEPTH_CHART = 21600  # 6 hours


def _fetch_depth_charts():
    """Fetch depth charts for all 30 MLB teams. Cache 6 hours.

    Returns dict keyed by normalized player name:
        {team, position, order (1=starter, 2=backup, ...), role (starter/backup/bench)}
    """
    cache_key = "depth_charts_all"
    cached = _cache_get(cache_key, TTL_DEPTH_CHART)
    if cached is not None:
        return cached

    def _fetch_one_team(team_name, team_id):
        entries = {}
        try:
            endpoint = "/teams/" + str(team_id) + "/roster/depthChart"
            data = _mlb_fetch(endpoint)
            if not data:
                return entries
            for roster_entry in data.get("roster", []):
                person = roster_entry.get("person", {})
                pname = person.get("fullName", "")
                if not pname:
                    continue
                position = roster_entry.get("position", {})
                pos_abbrev = position.get("abbreviation", "")
                pos_type = position.get("type", "")
                depth_order = roster_entry.get("battingOrder") or roster_entry.get("depthOrder") or 99

                if depth_order == 1 or depth_order == "1":
                    role = "starter"
                elif depth_order in (2, 3, "2", "3"):
                    role = "backup"
                else:
                    role = "bench"

                norm = _normalize_name(pname)
                entries[norm] = {
                    "team": team_name,
                    "position": pos_abbrev,
                    "position_type": pos_type,
                    "order": int(depth_order) if str(depth_order).isdigit() else 99,
                    "role": role,
                    "full_name": pname,
                }
        except Exception as e:
            print("Warning: depth chart fetch failed for " + team_name + ": " + str(e))
        return entries

    result = {}
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(_fetch_one_team, tn, tid): tn for tn, tid in _MLB_TEAM_IDS.items()}
        for fut in as_completed(futures):
            result.update(fut.result())

    _cache_set(cache_key, result)
    return result


def _fetch_probable_pitchers():
    """Fetch today's probable pitchers from MLB schedule API. Cache 30 min.

    Returns dict keyed by normalized player name:
        {team, opponent, game_time, confirmed (bool)}
    """
    cache_key = "probable_pitchers_today"
    cached = _cache_get(cache_key, TTL_MLB)
    if cached is not None:
        return cached

    result = {}
    try:
        today_str = date.today().strftime("%Y-%m-%d")
        endpoint = ("/schedule?sportId=1&date=" + today_str
                    + "&hydrate=probablePitcher,lineups,weather,officials")
        data = _mlb_fetch(endpoint)
        if not data:
            return result

        for game_date in data.get("dates", []):
            for game in game_date.get("games", []):
                game_time = game.get("gameDate", "")
                status = game.get("status", {}).get("abstractGameState", "")

                for side in ("away", "home"):
                    team_data = game.get("teams", {}).get(side, {})
                    team_name = team_data.get("team", {}).get("name", "")
                    opp_side = "home" if side == "away" else "away"
                    opp_name = game.get("teams", {}).get(opp_side, {}).get("team", {}).get("name", "")

                    pp = team_data.get("probablePitcher", {})
                    if pp and pp.get("fullName"):
                        norm = _normalize_name(pp.get("fullName", ""))
                        result[norm] = {
                            "team": team_name,
                            "opponent": opp_name,
                            "game_time": game_time,
                            "confirmed": status != "Postponed",
                        }
    except Exception as e:
        print("Warning: probable pitchers fetch failed: " + str(e))

    _cache_set(cache_key, result)
    return result


def get_depth_chart_position(player_name):
    """Get a player's depth chart position and role.

    Returns dict: {team, position, order, role, is_starter, is_probable_pitcher}
    or None if player not found in any depth chart.
    """
    if not player_name:
        return None

    norm = _normalize_name(player_name)
    depth_charts = _fetch_depth_charts()
    entry = depth_charts.get(norm)

    if not entry:
        return None

    result = dict(entry)
    result["is_starter"] = entry.get("role") == "starter"

    # Check probable pitcher status
    probables = _fetch_probable_pitchers()
    pp_entry = probables.get(norm)
    result["is_probable_pitcher"] = pp_entry is not None
    if pp_entry:
        result["opponent"] = pp_entry.get("opponent", "")
        result["game_time"] = pp_entry.get("game_time", "")

    return result


def _fetch_mlb_game_log(mlb_id, stat_group="hitting", days=30):
    """Fetch recent game log for a player"""
    if not mlb_id:
        return []
    cache_key = ("mlb_gamelog", mlb_id, stat_group, days)
    cached = _cache_get(cache_key, TTL_MLB)
    if cached is not None:
        return cached
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        endpoint = (
            "/people/" + str(mlb_id)
            + "/stats?stats=gameLog&group=" + stat_group
            + "&season=" + str(YEAR)
            + "&startDate=" + start_date.strftime("%m/%d/%Y")
            + "&endDate=" + end_date.strftime("%m/%d/%Y")
        )
        data = _mlb_fetch(endpoint)
        games = []
        for split_group in data.get("stats", []):
            for split in split_group.get("splits", []):
                stat = split.get("stat", {})
                game_date = split.get("date", "")
                opponent = split.get("opponent", {}).get("name", "")
                entry = {"date": game_date, "opponent": opponent}
                entry.update(stat)
                games.append(entry)
        _cache_set(cache_key, games)
        return games
    except Exception as e:
        print("Warning: MLB game log fetch failed for " + str(mlb_id) + ": " + str(e))
        return []


_CAREER_HITTING = {"gamesPlayed", "atBats", "hits", "homeRuns", "rbi", "runs",
                   "stolenBases", "avg", "obp", "slg", "ops", "strikeOuts", "baseOnBalls"}
_CAREER_PITCHING = {"gamesPlayed", "gamesStarted", "wins", "losses", "era", "whip",
                    "inningsPitched", "strikeOuts", "saves", "holds", "earnedRuns", "baseOnBalls"}


def _fetch_mlb_career_stats(mlb_id, stat_group="hitting"):
    """Fetch year-by-year MLB career stats for a player"""
    if not mlb_id:
        return []
    cache_key = ("mlb_career", mlb_id, stat_group)
    cached = _cache_get(cache_key, TTL_MLB)
    if cached is not None:
        return cached
    try:
        endpoint = (
            "/people/" + str(mlb_id)
            + "/stats?stats=yearByYear&group=" + stat_group
        )
        data = _mlb_fetch(endpoint)
        ui_fields = _CAREER_PITCHING if stat_group == "pitching" else _CAREER_HITTING
        seasons = []
        for split_group in data.get("stats", []):
            for split in split_group.get("splits", []):
                # Only include MLB-level seasons (sport.id == 1)
                if split.get("sport", {}).get("id") != 1:
                    continue
                stat = split.get("stat", {})
                entry = {
                    "season": split.get("season", ""),
                    "team": split.get("team", {}).get("name", ""),
                }
                for k in ui_fields:
                    if k in stat:
                        entry[k] = stat[k]
                seasons.append(entry)
        _cache_set(cache_key, seasons)
        return seasons
    except Exception as e:
        print("Warning: MLB career stats fetch failed for " + str(mlb_id) + ": " + str(e))
        return []


# ============================================================
# 5b. Regression & Buy-Low/Sell-High Detection
# ============================================================

def _fetch_fangraphs_regression_batting():
    """Fetch FanGraphs batting stats needed for regression detection.
    Extracts BABIP, wOBA, wRC+ for BABIP-based luck signals.
    """
    cache_key = ("fangraphs_regression_batting", YEAR)
    cached = _cache_get(cache_key, TTL_FANGRAPHS)
    if cached is not None:
        return cached
    try:
        from pybaseball import batting_stats
        year = YEAR
        df = None
        try:
            df = batting_stats(year, qual=25)
        except Exception:
            pass
        if (df is None or len(df) == 0) and date.today().month < 5:
            year = YEAR - 1
            df = batting_stats(year, qual=25)
        result = {}
        if df is not None:
            for _, row in df.iterrows():
                name = row.get("Name", "")
                if name:
                    result[name.lower()] = {
                        "babip": row.get("BABIP", None),
                        "woba": row.get("wOBA", None),
                        "wrc_plus": row.get("wRC+", None),
                        "hr_fb_rate": row.get("HR/FB", None),
                        "pa": row.get("PA", None),
                        "o_swing_pct": row.get("O-Swing%", None),
                        "data_season": year,
                    }
        _cache_set(cache_key, result)
        return result
    except Exception as e:
        print("Warning: FanGraphs regression batting fetch failed: " + str(e))
        return {}


def _fetch_fangraphs_career_batting():
    """Fetch FanGraphs batting stats for 3 prior seasons and compute career
    BABIP, BIP, and O-Swing% per player.  Used by regression engine for
    Bayesian shrinkage targets.

    Returns dict keyed by normalized name:
        { "career_babip": float, "career_bip": int, "career_o_swing_pct": float }
    """
    cache_key = ("fangraphs_career_batting", YEAR)
    cached = _cache_get(cache_key, TTL_FANGRAPHS)
    if cached is not None:
        return cached
    try:
        from pybaseball import batting_stats
        # Collect up to 3 prior seasons (e.g. 2023-2025 when YEAR=2026)
        end_year = YEAR - 1 if date.today().month < 5 else YEAR
        start_year = end_year - 2
        accumulated = {}  # name -> {"h_bip": total, "bip": total, "o_swing_sum": total, "seasons": n}
        for yr in range(start_year, end_year + 1):
            try:
                df = batting_stats(yr, qual=25)
                if df is None or len(df) == 0:
                    continue
                for _, row in df.iterrows():
                    name = row.get("Name", "")
                    if not name:
                        continue
                    norm = name.lower()
                    babip_val = row.get("BABIP", None)
                    hr_val = row.get("HR", None)
                    ab_val = row.get("AB", None)
                    sf_val = row.get("SF", None)
                    k_val = row.get("SO", None)
                    o_swing_val = row.get("O-Swing%", None)
                    # Calculate BIP = AB - SO - HR + SF  (balls in play)
                    bip = None
                    try:
                        if ab_val is not None and k_val is not None and hr_val is not None:
                            sf = float(sf_val) if sf_val is not None else 0
                            bip = int(float(ab_val) - float(k_val) - float(hr_val) + sf)
                    except (ValueError, TypeError):
                        pass
                    if norm not in accumulated:
                        accumulated[norm] = {
                            "h_bip": 0,
                            "bip": 0,
                            "o_swing_total": 0.0,
                            "o_swing_seasons": 0,
                        }
                    entry = accumulated[norm]
                    if bip is not None and bip > 0 and babip_val is not None:
                        try:
                            hits_on_bip = float(babip_val) * bip
                            entry["h_bip"] += hits_on_bip
                            entry["bip"] += bip
                        except (ValueError, TypeError):
                            pass
                    if o_swing_val is not None:
                        try:
                            entry["o_swing_total"] += float(o_swing_val)
                            entry["o_swing_seasons"] += 1
                        except (ValueError, TypeError):
                            pass
            except Exception as e:
                print("Warning: FanGraphs career batting fetch for "
                      + str(yr) + " failed: " + str(e))
                continue

        # Build result dict with career aggregates
        result = {}
        for norm, entry in accumulated.items():
            career = {}
            if entry.get("bip", 0) > 0:
                career["career_babip"] = round(
                    entry.get("h_bip", 0) / entry.get("bip", 1), 3
                )
                career["career_bip"] = entry.get("bip", 0)
            if entry.get("o_swing_seasons", 0) > 0:
                career["career_o_swing_pct"] = round(
                    entry.get("o_swing_total", 0) / entry.get("o_swing_seasons", 1), 3
                )
            if career:
                result[norm] = career

        _cache_set(cache_key, result)
        return result
    except Exception as e:
        print("Warning: FanGraphs career batting fetch failed: " + str(e))
        return {}


def _fetch_fangraphs_regression_pitching():
    """Fetch FanGraphs pitching stats needed for regression detection.
    Extracts ERA, FIP, xFIP, BABIP, LOB%, SIERA for luck-based signals.
    """
    cache_key = ("fangraphs_regression_pitching", YEAR)
    cached = _cache_get(cache_key, TTL_FANGRAPHS)
    if cached is not None:
        return cached
    try:
        from pybaseball import pitching_stats
        year = YEAR
        df = None
        try:
            df = pitching_stats(year, qual=25)
        except Exception:
            pass
        if (df is None or len(df) == 0) and date.today().month < 5:
            year = YEAR - 1
            df = pitching_stats(year, qual=25)
        result = {}
        if df is not None:
            for _, row in df.iterrows():
                name = row.get("Name", "")
                if name:
                    result[name.lower()] = {
                        "era": row.get("ERA", None),
                        "fip": row.get("FIP", None),
                        "xfip": row.get("xFIP", None),
                        "babip": row.get("BABIP", None),
                        "lob_pct": row.get("LOB%", None),
                        "siera": row.get("SIERA", None),
                        "hr_fb_rate": row.get("HR/FB", None),
                        "ip": row.get("IP", None),
                        "k_per_9": row.get("K/9", None),
                        "k_rate": row.get("K%", None),
                        "bb_rate": row.get("BB%", None),
                        "stuff_plus": row.get("Stuff+", None),
                        "location_plus": row.get("Location+", None),
                        "pitching_plus": row.get("Pitching+", None),
                        "data_season": year,
                    }
        _cache_set(cache_key, result)
        return result
    except Exception as e:
        print("Warning: FanGraphs regression pitching fetch failed: " + str(e))
        return {}


def compute_hitter_regression_score(player_stats):
    """Compute composite regression score for a hitter (-100 to +100).
    Positive = underperforming expected stats (buy-low).
    Negative = overperforming expected stats (sell-high).

    Signal weights (v1.4 — research-calibrated):
        xwOBA gap       ±15  descriptive, not predictive (Tango)
        BABIP regression ±20  career-regressed target
        HR/FB vs barrels ±20  barrel rate predicts HR/FB
        Plate discipline ±20  O-Swing% r=0.83 YoY
        Hard-hit diverg. ±15  r²=0.67 YoY, stickiest metric
        Sprint speed     ±10  SB sustainability
    """
    score = 0
    signals = []

    # Signal 1: xwOBA vs wOBA (weight: ±15)
    # Descriptive not predictive (Tango) — reduced from ±35
    xwoba = player_stats.get("xwoba", 0)
    woba = player_stats.get("woba", 0)
    if xwoba and woba:
        xwoba_gap = float(xwoba) - float(woba)
        if abs(xwoba_gap) >= 0.020:
            signal_score = min(max(xwoba_gap * 500, -15), 15)
            score += signal_score
            signals.append({
                "name": "xwOBA_gap",
                "value": round(xwoba_gap, 3),
                "direction": "buy-low" if xwoba_gap > 0 else "sell-high",
                "strength": "strong" if abs(xwoba_gap) >= 0.030 else "moderate",
                "contribution": round(signal_score, 1),
            })

    # Signal 2: BABIP vs career-regressed target (weight: ±20)
    # Uses Bayesian shrinkage toward .300 when career data available
    babip = player_stats.get("babip")
    if babip is not None:
        try:
            babip_val = float(babip)
            career_babip = player_stats.get("career_babip")
            career_bip = player_stats.get("career_bip")
            if career_babip is not None and career_bip is not None:
                prior_weight = 820  # ~2 seasons of BIP
                babip_target = (
                    (float(career_babip) * float(career_bip) + 0.300 * prior_weight)
                    / (float(career_bip) + prior_weight)
                )
            else:
                babip_target = 0.300
            babip_gap = babip_target - babip_val
            if abs(babip_gap) >= 0.025:
                signal_score = min(max(babip_gap * 400, -20), 20)
                score += signal_score
                signals.append({
                    "name": "BABIP_regression",
                    "value": round(babip_gap, 3),
                    "target": round(babip_target, 3),
                    "direction": "buy-low" if babip_gap > 0 else "sell-high",
                    "strength": "strong" if abs(babip_gap) >= 0.040 else "moderate",
                    "contribution": round(signal_score, 1),
                })
        except (ValueError, TypeError):
            pass

    # Signal 3: HR/FB% vs barrel rate prediction (weight: ±20)
    barrel_rate = player_stats.get("barrel_pct") or player_stats.get("barrel_rate")
    hr_fb_rate = player_stats.get("hr_fb_rate")
    if barrel_rate is not None and hr_fb_rate is not None:
        try:
            br = float(barrel_rate)
            hrfb = float(hr_fb_rate)
            if br > 0 and hrfb > 0:
                expected_hr_fb = br * 0.85 + 0.02
                hr_fb_gap = expected_hr_fb - hrfb
                if abs(hr_fb_gap) >= 0.03:
                    signal_score = min(max(hr_fb_gap * 400, -20), 20)
                    score += signal_score
                    signals.append({
                        "name": "HR/FB_vs_barrels",
                        "value": round(hr_fb_gap, 3),
                        "direction": "buy-low" if hr_fb_gap > 0 else "sell-high",
                        "strength": "strong" if abs(hr_fb_gap) >= 0.06 else "moderate",
                        "contribution": round(signal_score, 1),
                    })
        except (ValueError, TypeError):
            pass

    # Signal 4: Plate discipline — O-Swing% (weight: ±20)
    # O-Swing% has r=0.83 YoY stability — deviation from baseline is predictive
    o_swing = player_stats.get("o_swing_pct")
    if o_swing is not None:
        try:
            o_swing_val = float(o_swing)
            if o_swing_val > 1:
                o_swing_val = o_swing_val / 100.0
            career_o_swing = player_stats.get("career_o_swing_pct")
            if career_o_swing is not None:
                baseline = float(career_o_swing)
                if baseline > 1:
                    baseline = baseline / 100.0
            else:
                baseline = 0.31  # league average fallback
            # Lower O-Swing% than baseline = better discipline = buy-low
            discipline_gap = baseline - o_swing_val
            if abs(discipline_gap) >= 0.03:
                signal_score = min(max(discipline_gap * 500, -20), 20)
                score += signal_score
                signals.append({
                    "name": "plate_discipline",
                    "value": round(o_swing_val, 3),
                    "baseline": round(baseline, 3),
                    "direction": "buy-low" if discipline_gap > 0 else "sell-high",
                    "strength": "strong" if abs(discipline_gap) >= 0.05 else "moderate",
                    "contribution": round(signal_score, 1),
                })
        except (ValueError, TypeError):
            pass

    # Signal 5: Hard-hit divergence (weight: ±15)
    # Hard-hit% is the stickiest batted-ball metric (r²=0.67 YoY)
    # Divergence between hard-hit quality and actual SLG flags luck
    hard_hit_pct = player_stats.get("hard_hit_pct")
    slg = player_stats.get("slg")
    if hard_hit_pct is not None and slg is not None:
        try:
            hh = float(hard_hit_pct)
            if hh > 1:
                hh = hh / 100.0
            slg_val = float(slg)
            # Expected SLG from hard-hit rate (league avg: .36 HH% -> .400 SLG)
            expected_slg = 0.400 + (hh - 0.36) * 1.2
            divergence = expected_slg - slg_val
            if abs(divergence) >= 0.030:
                signal_score = min(max(divergence * 300, -15), 15)
                score += signal_score
                signals.append({
                    "name": "hard_hit_divergence",
                    "value": round(hh, 3),
                    "expected_slg": round(expected_slg, 3),
                    "actual_slg": round(slg_val, 3),
                    "direction": "buy-low" if divergence > 0 else "sell-high",
                    "strength": "strong" if abs(divergence) >= 0.050 else "moderate",
                    "contribution": round(signal_score, 1),
                })
        except (ValueError, TypeError):
            pass

    # Signal 6: Sprint speed for SB regression (weight: ±10)
    sprint_speed = player_stats.get("sprint_speed")
    stolen_bases = player_stats.get("sb", 0)
    if sprint_speed is not None:
        try:
            ss = float(sprint_speed)
            sb = int(float(stolen_bases)) if stolen_bases else 0
            if ss >= 28.5 and sb < 5:
                score += 10
                signals.append({
                    "name": "speed_underutilized",
                    "value": ss,
                    "direction": "buy-low",
                    "strength": "moderate",
                    "contribution": 10,
                })
            elif ss < 27.0 and sb > 10:
                score -= 10
                signals.append({
                    "name": "speed_unsustainable_sb",
                    "value": ss,
                    "direction": "sell-high",
                    "strength": "moderate",
                    "contribution": -10,
                })
        except (ValueError, TypeError):
            pass

    return {
        "regression_score": round(score, 1),
        "direction": "buy-low" if score > 15 else "sell-high" if score < -15 else "neutral",
        "confidence": "high" if abs(score) > 40 else "medium" if abs(score) > 20 else "low",
        "signals": signals,
    }


def _pitcher_babip_baseline(k_per_9):
    """K-rate adjusted BABIP baseline. High-K pitchers suppress BABIP."""
    if k_per_9 is None:
        return 0.300
    try:
        k9 = float(k_per_9)
    except (ValueError, TypeError):
        return 0.300
    if k9 >= 10.0:
        return 0.288
    if k9 >= 8.5:
        return 0.295
    if k9 <= 6.0:
        return 0.308
    return 0.300


def compute_pitcher_regression_score(player_stats):
    """Compute composite regression score for a pitcher (-100 to +100).
    Positive = underperforming expected (buy-low).
    Negative = overperforming expected (sell-high).

    Signal weights (v1.4 — research-calibrated):
        ERA vs SIERA     ±25  reduced from ±35
        K-BB% vs ERA     ±20  R²=0.224, best ERA predictor
        ERA vs xERA      ±10  not more predictive than FIP
        BABIP against    ±15  K-rate adjusted baseline
        LOB% extremes    ±15  unchanged
        HR/FB%           ±10  unchanged
        Velocity trend    ±5  binary flag for >=1.0 mph YoY
    """
    score = 0
    signals = []

    era = player_stats.get("era")
    siera = player_stats.get("siera")
    xera = player_stats.get("xera") or siera  # SIERA used as xERA proxy

    # Convert era once — callers already pass float, but be defensive
    try:
        era_val = float(era) if era is not None else None
    except (ValueError, TypeError):
        era_val = None

    # Signal 1: ERA vs SIERA (weight: ±25) — reduced from ±35
    if era_val is not None and siera is not None:
        try:
            siera_val = float(siera)
            if era_val > 0 and siera_val > 0:
                era_gap = era_val - siera_val
                if abs(era_gap) >= 0.50:
                    signal_score = min(max(era_gap * 15, -25), 25)
                    score += signal_score
                    signals.append({
                        "name": "ERA_vs_SIERA",
                        "value": round(era_gap, 2),
                        "direction": "buy-low" if era_gap > 0 else "sell-high",
                        "strength": "strong" if abs(era_gap) >= 1.0 else "moderate",
                        "contribution": round(signal_score, 1),
                    })
        except (ValueError, TypeError):
            pass

    # Signal 2: K-BB% vs ERA (weight: ±20) — NEW
    # R²=0.224, single best predictor of future ERA
    k_bb_pct = player_stats.get("k_bb_pct")
    if k_bb_pct is not None and era_val is not None:
        try:
            k_bb_val = float(k_bb_pct)
            if k_bb_val > 1:
                k_bb_val = k_bb_val / 100.0
            # Expected ERA from K-BB%: ~5.0 - K-BB% * 15
            # K-BB% 0.15 -> ERA ~2.75, K-BB% 0.10 -> ERA ~3.50
            expected_era = 5.0 - k_bb_val * 15.0
            k_bb_gap = era_val - expected_era
            if abs(k_bb_gap) >= 0.50:
                signal_score = min(max(k_bb_gap * 15, -20), 20)
                score += signal_score
                signals.append({
                    "name": "K-BB%_vs_ERA",
                    "value": round(k_bb_val, 3),
                    "expected_era": round(expected_era, 2),
                    "actual_era": round(era_val, 2),
                    "direction": "buy-low" if k_bb_gap > 0 else "sell-high",
                    "strength": "strong" if abs(k_bb_gap) >= 1.0 else "moderate",
                    "contribution": round(signal_score, 1),
                })
        except (ValueError, TypeError):
            pass

    # Signal 3: ERA vs xERA (weight: ±10) — reduced from ±25
    # Not more predictive than FIP — supplementary only
    if era_val is not None and xera is not None and xera != siera:
        try:
            xera_val = float(xera)
            if era_val > 0 and xera_val > 0:
                xera_gap = era_val - xera_val
                if abs(xera_gap) >= 0.40:
                    signal_score = min(max(xera_gap * 8, -10), 10)
                    score += signal_score
                    signals.append({
                        "name": "ERA_vs_xERA",
                        "value": round(xera_gap, 2),
                        "direction": "buy-low" if xera_gap > 0 else "sell-high",
                        "strength": "strong" if abs(xera_gap) >= 0.80 else "moderate",
                        "contribution": round(signal_score, 1),
                    })
        except (ValueError, TypeError):
            pass

    # Signal 4: BABIP against (weight: ±15) — K-rate adjusted baseline
    babip = player_stats.get("babip")
    if babip is not None:
        try:
            babip_val = float(babip)
            babip_baseline = _pitcher_babip_baseline(player_stats.get("k_per_9"))
            babip_dev = babip_val - babip_baseline
            if abs(babip_dev) >= 0.025:
                babip_signal = (babip_baseline - babip_val) * 300
                signal_score = min(max(-babip_signal, -15), 15)
                score += signal_score
                if abs(babip_dev) >= 0.030:
                    signals.append({
                        "name": "BABIP_against",
                        "value": round(babip_val, 3),
                        "baseline": round(babip_baseline, 3),
                        "direction": "buy-low" if babip_val > babip_baseline + 0.030 else "sell-high",
                        "strength": "strong" if abs(babip_dev) >= 0.050 else "moderate",
                        "contribution": round(signal_score, 1),
                    })
        except (ValueError, TypeError):
            pass

    # Signal 5: LOB% extremes (weight: ±15)
    lob_pct = player_stats.get("lob_pct")
    if lob_pct is not None:
        try:
            lob_val = float(lob_pct)
            # Normalize: FanGraphs stores as percentage (72.0) not decimal
            if lob_val > 1:
                lob_decimal = lob_val / 100.0
            else:
                lob_decimal = lob_val
            lob_deviation = lob_decimal - 0.72
            if abs(lob_deviation) >= 0.05:
                signal_score = min(max(lob_deviation * -150, -15), 15)
                score += signal_score
                signals.append({
                    "name": "LOB%_extreme",
                    "value": round(lob_val, 1),
                    "direction": "buy-low" if lob_decimal < 0.67 else "sell-high",
                    "strength": "strong" if abs(lob_deviation) >= 0.08 else "moderate",
                    "contribution": round(signal_score, 1),
                })
        except (ValueError, TypeError):
            pass

    # Signal 6: HR/FB% vs league average (weight: ±10)
    hr_fb = player_stats.get("hr_fb_rate")
    if hr_fb is not None:
        try:
            hr_fb_val = float(hr_fb)
            hr_fb_deviation = hr_fb_val - 0.12
            if abs(hr_fb_deviation) >= 0.03:
                signal_score = min(max(hr_fb_deviation * -150, -10), 10)
                score += signal_score
        except (ValueError, TypeError):
            pass

    # Signal 7: Velocity trend (weight: ±5) — binary flag
    # Activates when velo_change_yoy data is available
    velo_change = player_stats.get("velo_change_yoy")
    if velo_change is not None:
        try:
            velo_delta = float(velo_change)
            if abs(velo_delta) >= 1.0:
                signal_score = 5 if velo_delta >= 1.0 else -5
                score += signal_score
                signals.append({
                    "name": "velocity_trend",
                    "value": round(velo_delta, 1),
                    "direction": "buy-low" if velo_delta >= 1.0 else "sell-high",
                    "strength": "moderate",
                    "contribution": signal_score,
                })
        except (ValueError, TypeError):
            pass

    # Signal 8: Stuff+ confidence modifier (weight: ±8, early-season ±12)
    stuff_plus = player_stats.get("stuff_plus")
    ip = player_stats.get("ip")
    if stuff_plus is not None:
        try:
            stuff_val = float(stuff_plus)
            direction = "buy-low" if score > 0 else "sell-high" if score < 0 else None
            stuff_modifier = 0

            if direction == "buy-low" and stuff_val >= 115:
                # Elite stuff confirms buy-low — amplify
                stuff_modifier = min((stuff_val - 115) * 0.8, 8)
            elif direction == "sell-high" and stuff_val < 90:
                # Poor stuff confirms sell-high — amplify
                stuff_modifier = max((stuff_val - 90) * 0.8, -8)
            elif direction == "buy-low" and stuff_val < 90:
                # Poor stuff contradicts buy-low — pull toward neutral
                stuff_modifier = max((stuff_val - 100) * 0.5, -5)
            elif direction == "sell-high" and stuff_val >= 115:
                # Elite stuff contradicts sell-high — pull toward neutral
                stuff_modifier = min((stuff_val - 100) * 0.5, 5)

            # Early-season amplifier: when IP < 30, Stuff+ is more informative
            if ip is not None and float(ip) < 30 and stuff_modifier != 0:
                stuff_modifier *= 1.5
                stuff_modifier = max(min(stuff_modifier, 12), -12)

            if stuff_modifier != 0:
                score += stuff_modifier
                signals.append({
                    "name": "stuff_plus_modifier",
                    "value": stuff_val,
                    "direction": "buy-low" if stuff_modifier > 0 else "sell-high",
                    "strength": "strong" if abs(stuff_modifier) >= 6 else "moderate",
                    "contribution": round(stuff_modifier, 1),
                })

            # Informational signal: Stuff+-Location+ gap
            loc_val = _safe_float(player_stats.get("location_plus")) if player_stats.get("location_plus") is not None else None
            if loc_val is not None and abs(stuff_val - loc_val) >= 12:
                signals.append({
                    "name": "stuff_command_gap",
                    "value": round(stuff_val - loc_val, 1),
                    "direction": "info",
                    "strength": "informational",
                    "contribution": 0,
                })
        except (ValueError, TypeError):
            pass

    return {
        "regression_score": round(score, 1),
        "direction": "buy-low" if score > 15 else "sell-high" if score < -15 else "neutral",
        "confidence": "high" if abs(score) > 40 else "medium" if abs(score) > 20 else "low",
        "signals": signals,
    }


def _regression_fields(reg_result):
    """Extract regression scoring fields from a regression result dict."""
    return {
        "regression_score": reg_result.get("regression_score"),
        "direction": reg_result.get("direction"),
        "confidence": reg_result.get("confidence"),
        "signals": reg_result.get("signals"),
    }


def detect_regression_candidates():
    """Detect buy-low and sell-high candidates based on underlying metrics."""
    cache_key = ("regression_candidates",)
    cached = _cache_get(cache_key, TTL_SAVANT)
    if cached is not None:
        return cached

    result = {
        "buy_low_hitters": [],
        "sell_high_hitters": [],
        "buy_low_pitchers": [],
        "sell_high_pitchers": [],
    }

    # ------------------------------------------------------------------
    # Hitters: combine Savant xwOBA vs wOBA with FanGraphs BABIP
    # ------------------------------------------------------------------
    try:
        savant_bat = _fetch_savant_expected("batter")
        fg_bat = _fetch_fangraphs_regression_batting()
        # Fetch barrel and sprint speed data for composite scoring
        statcast_bat = {}
        sprint_bat = {}
        career_bat = {}
        try:
            statcast_bat = _fetch_savant_statcast("batter") or {}
        except Exception:
            pass
        try:
            sprint_bat = _fetch_savant_sprint_speed("batter") or {}
        except Exception:
            pass
        try:
            career_bat = _fetch_fangraphs_career_batting() or {}
        except Exception:
            pass

        for key, row in (savant_bat or {}).items():
            if _is_savant_meta_key(key):
                continue
            try:
                xwoba = float(row.get("est_woba", 0))
                woba = float(row.get("woba", 0))
                pa = int(float(row.get("pa", 0)))
                if pa < 50:
                    continue
                name = row.get("player_name", key)

                # Look up FanGraphs BABIP and HR/FB for this player
                fg_row = _find_in_fangraphs(name, fg_bat)
                babip = None
                hr_fb_rate = None
                if fg_row:
                    babip_raw = fg_row.get("babip")
                    if babip_raw is not None:
                        try:
                            babip = float(babip_raw)
                        except (ValueError, TypeError):
                            babip = None
                    hr_fb_raw = fg_row.get("hr_fb_rate")
                    if hr_fb_raw is not None:
                        try:
                            hr_fb_rate = float(hr_fb_raw)
                        except (ValueError, TypeError):
                            hr_fb_rate = None

                # Look up barrel rate from statcast data
                barrel_pct = None
                statcast_row = _find_in_savant(name, statcast_bat)
                if statcast_row:
                    barrel_raw = statcast_row.get("brl_percent", statcast_row.get("barrel_batted_rate"))
                    if barrel_raw is not None:
                        try:
                            barrel_pct = float(barrel_raw)
                        except (ValueError, TypeError):
                            barrel_pct = None

                # Look up sprint speed
                sprint_speed = None
                sprint_row = _find_in_savant(name, sprint_bat)
                if sprint_row:
                    sprint_raw = sprint_row.get("hp_to_1b", sprint_row.get("sprint_speed"))
                    if sprint_raw is not None:
                        try:
                            sprint_speed = float(sprint_raw)
                        except (ValueError, TypeError):
                            sprint_speed = None

                # O-Swing% from the same FanGraphs regression fetch
                o_swing_pct = fg_row.get("o_swing_pct") if fg_row else None

                # Look up hard-hit% from statcast data
                hard_hit_pct = None
                if statcast_row:
                    hh_raw = statcast_row.get("hard_hit_percent", statcast_row.get("hard_hit_rate"))
                    if hh_raw is not None:
                        try:
                            hard_hit_pct = float(hh_raw)
                        except (ValueError, TypeError):
                            hard_hit_pct = None

                # Look up career BABIP, BIP, O-Swing% for Bayesian targets
                career_babip = None
                career_bip = None
                career_o_swing_pct = None
                career_row = _find_in_fangraphs(name, career_bat)
                if career_row:
                    career_babip = career_row.get("career_babip")
                    career_bip = career_row.get("career_bip")
                    career_o_swing_pct = career_row.get("career_o_swing_pct")

                # xSLG from Savant expected stats (est_slg field)
                xslg = None
                xslg_raw = row.get("est_slg")
                if xslg_raw is not None:
                    try:
                        xslg = float(xslg_raw)
                    except (ValueError, TypeError):
                        xslg = None

                # Build player_stats dict for composite scoring
                hitter_stats = {
                    "xwoba": xwoba,
                    "woba": woba,
                    "babip": babip,
                    "barrel_pct": barrel_pct,
                    "hr_fb_rate": hr_fb_rate,
                    "sprint_speed": sprint_speed,
                    "sb": row.get("sb", 0),
                    "o_swing_pct": o_swing_pct,
                    "hard_hit_pct": hard_hit_pct,
                    "avg": row.get("ba"),
                    "slg": row.get("slg"),
                    "xslg": xslg,
                    "career_babip": career_babip,
                    "career_bip": career_bip,
                    "career_o_swing_pct": career_o_swing_pct,
                }
                reg_result = compute_hitter_regression_score(hitter_stats)

                woba_diff = xwoba - woba

                # Buy-low hitter: xwOBA >> wOBA AND/OR low BABIP
                if woba_diff >= 0.025:
                    details_parts = [
                        "xwOBA " + str(round(xwoba, 3))
                        + " vs wOBA " + str(round(woba, 3))
                        + " (+" + str(round(woba_diff, 3)) + ")"
                    ]
                    signal = "xwOBA >> wOBA"
                    if babip is not None and babip < 0.260:
                        details_parts.append(
                            "BABIP " + str(round(babip, 3))
                            + " (very low, likely unlucky)"
                        )
                        signal = "xwOBA >> wOBA + low BABIP"
                    elif babip is not None and babip < 0.280:
                        details_parts.append(
                            "BABIP " + str(round(babip, 3)) + " (below avg)"
                        )
                    entry = {
                        "name": name,
                        "signal": signal,
                        "details": "; ".join(details_parts),
                        "xwoba": round(xwoba, 3),
                        "woba": round(woba, 3),
                        "diff": round(woba_diff, 3),
                        "babip": round(babip, 3) if babip is not None else None,
                        "pa": pa,
                        **_regression_fields(reg_result)
                    }
                    result["buy_low_hitters"].append(entry)
                elif babip is not None and babip < 0.260 and woba_diff >= 0.010:
                    # Low BABIP alone with modest xwOBA edge
                    entry = {
                        "name": name,
                        "signal": "low BABIP",
                        "details": (
                            "BABIP " + str(round(babip, 3))
                            + " (very low); xwOBA " + str(round(xwoba, 3))
                            + " vs wOBA " + str(round(woba, 3))
                        ),
                        "xwoba": round(xwoba, 3),
                        "woba": round(woba, 3),
                        "diff": round(woba_diff, 3),
                        "babip": round(babip, 3),
                        "pa": pa,
                        **_regression_fields(reg_result)
                    }
                    result["buy_low_hitters"].append(entry)

                # Sell-high hitter: wOBA >> xwOBA AND/OR high BABIP
                sell_diff = woba - xwoba
                if sell_diff >= 0.025:
                    details_parts = [
                        "wOBA " + str(round(woba, 3))
                        + " vs xwOBA " + str(round(xwoba, 3))
                        + " (-" + str(round(sell_diff, 3)) + ")"
                    ]
                    signal = "wOBA >> xwOBA"
                    if babip is not None and babip > 0.370:
                        details_parts.append(
                            "BABIP " + str(round(babip, 3))
                            + " (very high, likely lucky)"
                        )
                        signal = "wOBA >> xwOBA + high BABIP"
                    elif babip is not None and babip > 0.340:
                        details_parts.append(
                            "BABIP " + str(round(babip, 3)) + " (above avg)"
                        )
                    entry = {
                        "name": name,
                        "signal": signal,
                        "details": "; ".join(details_parts),
                        "xwoba": round(xwoba, 3),
                        "woba": round(woba, 3),
                        "diff": round(sell_diff, 3),
                        "babip": round(babip, 3) if babip is not None else None,
                        "pa": pa,
                        **_regression_fields(reg_result)
                    }
                    result["sell_high_hitters"].append(entry)
                elif babip is not None and babip > 0.370 and sell_diff >= 0.010:
                    # High BABIP alone with modest overperformance
                    entry = {
                        "name": name,
                        "signal": "high BABIP",
                        "details": (
                            "BABIP " + str(round(babip, 3))
                            + " (very high); wOBA " + str(round(woba, 3))
                            + " vs xwOBA " + str(round(xwoba, 3))
                        ),
                        "xwoba": round(xwoba, 3),
                        "woba": round(woba, 3),
                        "diff": round(sell_diff, 3),
                        "babip": round(babip, 3),
                        "pa": pa,
                        **_regression_fields(reg_result)
                    }
                    result["sell_high_hitters"].append(entry)
            except (ValueError, TypeError):
                continue
    except Exception as e:
        print("Warning: hitter regression detection failed: " + str(e))

    # Sort hitters by magnitude of difference
    result["buy_low_hitters"].sort(key=lambda x: -x.get("diff", 0))
    result["sell_high_hitters"].sort(key=lambda x: -x.get("diff", 0))

    # ------------------------------------------------------------------
    # Pitchers: combine FanGraphs FIP/xFIP/ERA/LOB% with Savant xwOBA
    # ------------------------------------------------------------------
    try:
        savant_pit = _fetch_savant_expected("pitcher")
        fg_pit = _fetch_fangraphs_regression_pitching()

        for name_lower, fg_row in (fg_pit or {}).items():
            try:
                era = fg_row.get("era")
                fip = fg_row.get("fip")
                xfip = fg_row.get("xfip")
                babip_raw = fg_row.get("babip")
                lob_pct_raw = fg_row.get("lob_pct")
                siera_raw = fg_row.get("siera")
                hr_fb_raw = fg_row.get("hr_fb_rate")
                ip = fg_row.get("ip")

                if era is None or fip is None:
                    continue
                era = float(era)
                fip = float(fip)
                ip_val = float(ip) if ip is not None else 0
                if ip_val < 20:
                    continue

                xfip_val = float(xfip) if xfip is not None else None
                babip = float(babip_raw) if babip_raw is not None else None
                lob_pct = float(lob_pct_raw) if lob_pct_raw is not None else None
                siera = float(siera_raw) if siera_raw is not None else None
                hr_fb_rate = float(hr_fb_raw) if hr_fb_raw is not None else None

                # Reconstruct display name from FanGraphs lowercase key
                display_name = name_lower.title()

                # Try to find Savant data for extra context
                savant_row = _find_in_savant(display_name, savant_pit)
                savant_xwoba = None
                savant_woba = None
                if savant_row:
                    savant_xwoba_raw = savant_row.get("est_woba")
                    savant_woba_raw = savant_row.get("woba")
                    if savant_xwoba_raw:
                        try:
                            savant_xwoba = float(savant_xwoba_raw)
                        except (ValueError, TypeError):
                            pass
                    if savant_woba_raw:
                        try:
                            savant_woba = float(savant_woba_raw)
                        except (ValueError, TypeError):
                            pass

                # Compute K-BB% and gather extra fields
                k_rate_raw = fg_row.get("k_rate")
                bb_rate_raw = fg_row.get("bb_rate")
                k_bb_pct = None
                if k_rate_raw is not None and bb_rate_raw is not None:
                    try:
                        k_bb_pct = float(k_rate_raw) - float(bb_rate_raw)
                    except (ValueError, TypeError):
                        pass
                k_per_9 = fg_row.get("k_per_9")

                # Build player_stats dict for composite scoring
                pitcher_stats = {
                    "era": era,
                    "fip": fip,
                    "xfip": xfip_val,
                    "babip": babip,
                    "lob_pct": lob_pct,
                    "siera": siera,
                    "hr_fb_rate": hr_fb_rate,
                    "k_bb_pct": k_bb_pct,
                    "k_per_9": k_per_9,
                    "stuff_plus": fg_row.get("stuff_plus"),
                    "pitching_plus": fg_row.get("pitching_plus"),
                    "location_plus": fg_row.get("location_plus"),
                    "ip": fg_row.get("ip"),
                }
                reg_result = compute_pitcher_regression_score(pitcher_stats)

                era_fip_diff = era - fip

                # Buy-low pitcher: FIP << ERA (unlucky) or xFIP << ERA
                if era_fip_diff >= 0.75:
                    details_parts = [
                        "ERA " + str(round(era, 2))
                        + " vs FIP " + str(round(fip, 2))
                        + " (gap " + str(round(era_fip_diff, 2)) + ")"
                    ]
                    signal = "FIP << ERA"
                    if xfip_val is not None and (era - xfip_val) >= 0.75:
                        details_parts.append(
                            "xFIP " + str(round(xfip_val, 2))
                        )
                        signal = "FIP/xFIP << ERA"
                    if babip is not None and babip > 0.330:
                        details_parts.append(
                            "BABIP " + str(round(babip, 3))
                            + " (high, likely unlucky)"
                        )
                        signal = signal + " + high BABIP"
                    if savant_xwoba is not None and savant_woba is not None:
                        if savant_xwoba < savant_woba:
                            details_parts.append(
                                "Savant xwOBA " + str(round(savant_xwoba, 3))
                                + " < wOBA " + str(round(savant_woba, 3))
                            )
                    entry = {
                        "name": display_name,
                        "signal": signal,
                        "details": "; ".join(details_parts),
                        "era": round(era, 2),
                        "fip": round(fip, 2),
                        "xfip": round(xfip_val, 2) if xfip_val is not None else None,
                        "babip": round(babip, 3) if babip is not None else None,
                        "lob_pct": round(lob_pct, 1) if lob_pct is not None else None,
                        "ip": round(ip_val, 1),
                        **_regression_fields(reg_result)
                    }
                    result["buy_low_pitchers"].append(entry)

                # Sell-high pitcher: ERA << FIP (overperforming) or high LOB%
                fip_era_diff = fip - era
                if fip_era_diff >= 0.75:
                    details_parts = [
                        "ERA " + str(round(era, 2))
                        + " vs FIP " + str(round(fip, 2))
                        + " (gap " + str(round(fip_era_diff, 2)) + ")"
                    ]
                    signal = "ERA << FIP"
                    if lob_pct is not None and lob_pct > 80.0:
                        details_parts.append(
                            "LOB% " + str(round(lob_pct, 1))
                            + "% (unsustainably high)"
                        )
                        signal = "ERA << FIP + high LOB%"
                    if babip is not None and babip < 0.260:
                        details_parts.append(
                            "BABIP " + str(round(babip, 3))
                            + " (low, likely lucky)"
                        )
                    entry = {
                        "name": display_name,
                        "signal": signal,
                        "details": "; ".join(details_parts),
                        "era": round(era, 2),
                        "fip": round(fip, 2),
                        "xfip": round(xfip_val, 2) if xfip_val is not None else None,
                        "babip": round(babip, 3) if babip is not None else None,
                        "lob_pct": round(lob_pct, 1) if lob_pct is not None else None,
                        "ip": round(ip_val, 1),
                        **_regression_fields(reg_result)
                    }
                    result["sell_high_pitchers"].append(entry)
                elif lob_pct is not None and lob_pct > 80.0 and fip_era_diff >= 0.40:
                    # High LOB% alone with moderate overperformance
                    details_parts = [
                        "LOB% " + str(round(lob_pct, 1))
                        + "% (unsustainably high)"
                    ]
                    details_parts.append(
                        "ERA " + str(round(era, 2))
                        + " vs FIP " + str(round(fip, 2))
                    )
                    if babip is not None and babip < 0.260:
                        details_parts.append(
                            "BABIP " + str(round(babip, 3))
                            + " (low, likely lucky)"
                        )
                    entry = {
                        "name": display_name,
                        "signal": "high LOB%",
                        "details": "; ".join(details_parts),
                        "era": round(era, 2),
                        "fip": round(fip, 2),
                        "xfip": round(xfip_val, 2) if xfip_val is not None else None,
                        "babip": round(babip, 3) if babip is not None else None,
                        "lob_pct": round(lob_pct, 1),
                        "ip": round(ip_val, 1),
                        **_regression_fields(reg_result)
                    }
                    result["sell_high_pitchers"].append(entry)
            except (ValueError, TypeError):
                continue
    except Exception as e:
        print("Warning: pitcher regression detection failed: " + str(e))

    # Sort pitchers by ERA-FIP gap magnitude
    result["buy_low_pitchers"].sort(
        key=lambda x: -(x.get("era", 0) - x.get("fip", 0))
    )
    result["sell_high_pitchers"].sort(
        key=lambda x: -(x.get("fip", 0) - x.get("era", 0))
    )

    _cache_set(cache_key, result)
    return result


def get_regression_signal(player_name):
    """Get regression signal for a specific player.
    Returns dict with 'signal', 'category', 'details',
    'regression_score', 'direction', and 'confidence' if found, else None.
    """
    if not player_name:
        return None
    try:
        candidates = detect_regression_candidates()
        if not candidates:
            return None
        norm = _normalize_name(player_name)
        for category in ["buy_low_hitters", "sell_high_hitters",
                         "buy_low_pitchers", "sell_high_pitchers"]:
            for entry in candidates.get(category, []):
                entry_norm = _normalize_name(entry.get("name", ""))
                matched = False
                if entry_norm == norm:
                    matched = True
                else:
                    parts = norm.split()
                    if parts and all(p in entry_norm for p in parts):
                        matched = True
                if matched:
                    return {
                        "category": category,
                        "signal": entry.get("signal", ""),
                        "details": entry.get("details", ""),
                        "regression_score": entry.get("regression_score"),
                        "direction": entry.get("direction"),
                        "confidence": entry.get("confidence"),
                    }
        return None
    except Exception as e:
        print("Warning: get_regression_signal failed for "
              + str(player_name) + ": " + str(e))
        return None


# ============================================================
# 5c. Player Splits (MLB Stats API)
# ============================================================

def _fetch_player_splits(mlb_id, stat_group="hitting"):
    """Fetch player splits (vs LHP/RHP, home/away) via MLB Stats API.
    stat_group: 'hitting' or 'pitching'
    Returns dict: {vs_lhp: {avg, obp, slg, ops, pa}, vs_rhp: {...}, home: {...}, away: {...}}
    """
    if not mlb_id:
        return {}
    cache_key = ("player_splits", mlb_id, stat_group)
    cached = _cache_get(cache_key, TTL_SPLITS)
    if cached is not None:
        return cached
    try:
        endpoint = (
            "/people/" + str(mlb_id)
            + "/stats?stats=statSplits&group=" + stat_group
            + "&season=" + str(YEAR)
            + "&sitCodes=vl,vr,h,a"
        )
        data = _mlb_fetch(endpoint)

        # Map sitCode abbreviations to readable keys
        sit_map = {
            "vl": "vs_lhp",
            "vr": "vs_rhp",
            "h": "home",
            "a": "away",
        }

        def _parse_splits(api_data, sit_mapping):
            parsed = {}
            for sg in api_data.get("stats", []):
                for split in sg.get("splits", []):
                    sit_code = split.get("split", {}).get("code", "")
                    mapped_key = sit_mapping.get(sit_code)
                    if not mapped_key:
                        continue
                    stat = split.get("stat", {})
                    entry = {
                        "avg": _safe_float(stat.get("avg")),
                        "obp": _safe_float(stat.get("obp")),
                        "slg": _safe_float(stat.get("slg")),
                        "ops": _safe_float(stat.get("ops")),
                    }
                    # PA: try plateAppearances, fall back to atBats + walks
                    pa = _safe_float(stat.get("plateAppearances"))
                    if pa is None:
                        ab = _safe_float(stat.get("atBats"), 0)
                        bb = _safe_float(stat.get("baseOnBalls"), 0)
                        hbp = _safe_float(stat.get("hitByPitch"), 0)
                        sf = _safe_float(stat.get("sacFlies"), 0)
                        computed = ab + bb + hbp + sf
                        pa = computed if computed > 0 else None
                    entry["pa"] = int(pa) if pa is not None else None
                    parsed[mapped_key] = entry
            return parsed

        result = _parse_splits(data, sit_map)

        # Pre-season fallback: if empty and before May, try last year
        if not result and date.today().month < 5:
            try:
                fallback_endpoint = (
                    "/people/" + str(mlb_id)
                    + "/stats?stats=statSplits&group=" + stat_group
                    + "&season=" + str(YEAR - 1)
                    + "&sitCodes=vl,vr,h,a"
                )
                fb_data = _mlb_fetch(fallback_endpoint)
                result = _parse_splits(fb_data, sit_map)
                if result:
                    result["data_season"] = YEAR - 1
            except Exception:
                pass

        _cache_set(cache_key, result)
        return result
    except Exception as e:
        print("Warning: player splits fetch failed for "
              + str(mlb_id) + ": " + str(e))
        return {}


def _fetch_bvp_stats(batter_mlb_id, pitcher_mlb_id):
    """Fetch batter-vs-pitcher career stats from MLB Stats API.

    Returns dict: {pa, ab, h, hr, bb, k, avg, obp, slg, ops} or {} if no data.
    Cached 24 hours (BvP career stats change slowly).
    """
    if not batter_mlb_id or not pitcher_mlb_id:
        return {}
    cache_key = ("bvp", batter_mlb_id, pitcher_mlb_id)
    cached = _cache_get(cache_key, TTL_SPLITS)
    if cached is not None:
        return cached
    try:
        endpoint = (
            "/people/" + str(batter_mlb_id)
            + "/stats?stats=vsPlayer&opposingPlayerId=" + str(pitcher_mlb_id)
            + "&group=hitting"
        )
        data = _mlb_fetch(endpoint)
        if not data:
            _cache_set(cache_key, {})
            return {}

        for sg in data.get("stats", []):
            splits = sg.get("splits", [])
            if not splits:
                continue
            stat = splits[0].get("stat", {})
            result = {
                "pa": _safe_int(stat.get("plateAppearances")),
                "ab": _safe_int(stat.get("atBats")),
                "h": _safe_int(stat.get("hits")),
                "hr": _safe_int(stat.get("homeRuns")),
                "bb": _safe_int(stat.get("baseOnBalls")),
                "k": _safe_int(stat.get("strikeOuts")),
                "avg": _safe_float(stat.get("avg")),
                "obp": _safe_float(stat.get("obp")),
                "slg": _safe_float(stat.get("slg")),
                "ops": _safe_float(stat.get("ops")),
            }
            _cache_set(cache_key, result)
            return result

        _cache_set(cache_key, {})
        return {}
    except Exception as e:
        print("Warning: BvP fetch failed (" + str(batter_mlb_id)
              + " vs " + str(pitcher_mlb_id) + "): " + str(e))
        return {}


_handedness_cache = {}


def _get_handedness(mlb_id):
    """Get bat/pitch hand for a player. Cached indefinitely (never changes)."""
    if mlb_id in _handedness_cache:
        return _handedness_cache[mlb_id]
    try:
        data = _mlb_fetch("/people/" + str(mlb_id))
        person = data.get("people", [{}])[0]
        result = {
            "bat_side": person.get("batSide", {}).get("code", ""),
            "pitch_hand": person.get("pitchHand", {}).get("code", ""),
        }
        _handedness_cache[mlb_id] = result
        return result
    except Exception:
        _handedness_cache[mlb_id] = {}
        return {}


def get_matchup_score(batter_name, pitcher_name):
    """Score a batter-vs-pitcher matchup using career BvP + platoon splits.

    Returns dict:
        score: float (-1.0 to +1.0, positive = batter advantage)
        bvp: dict of career stats (pa, avg, ops, etc.) or None
        platoon: "advantage" / "disadvantage" / "neutral" / None
        detail: str explaining the matchup
        sample: int PA in BvP history (0 = no history)
    """
    result = {"score": 0.0, "bvp": None, "platoon": None, "detail": "", "sample": 0}

    batter_id = get_mlb_id(batter_name)
    pitcher_id = get_mlb_id(pitcher_name)

    if not batter_id or not pitcher_id:
        result["detail"] = "Could not resolve MLB IDs"
        return result

    # 1. Career BvP stats
    bvp = _fetch_bvp_stats(batter_id, pitcher_id)
    if bvp and bvp.get("pa") and bvp.get("pa") >= 3:
        result["bvp"] = bvp
        result["sample"] = bvp.get("pa", 0)
        ops = bvp.get("ops")
        if ops is not None:
            # League avg OPS ~ .720; score relative to that
            # Scale: .620 OPS = -0.5, .720 = 0.0, .920 = +1.0
            bvp_score = (ops - 0.720) / 0.200
            bvp_score = max(-1.0, min(1.0, bvp_score))
            # Weight by sample size (diminishing returns after 30 PA)
            pa = bvp.get("pa", 0)
            sample_weight = min(1.0, pa / 30.0)
            result["score"] += bvp_score * sample_weight * 0.6  # 60% weight to BvP

    # 2. Platoon advantage (batter handedness vs pitcher handedness)
    try:
        bat_side = _get_handedness(batter_id).get("bat_side", "")
        pitch_hand = _get_handedness(pitcher_id).get("pitch_hand", "")

        if bat_side and pitch_hand:
            # Opposite hand = platoon advantage for batter
            if bat_side != pitch_hand:
                result["platoon"] = "advantage"
                result["score"] += 0.15
            elif bat_side == "S":
                result["platoon"] = "switch"
                result["score"] += 0.05  # Switch hitters have slight edge
            else:
                result["platoon"] = "disadvantage"
                result["score"] -= 0.15
    except Exception:
        pass

    # 3. Build detail string
    parts = []
    if result["bvp"] and result["sample"] >= 3:
        b = result["bvp"]
        parts.append(str(result["sample"]) + " PA: "
                     + str(b.get("avg", "---")) + "/" + str(b.get("obp", "---"))
                     + "/" + str(b.get("slg", "---")))
        if b.get("hr"):
            parts.append(str(b["hr"]) + " HR")
    if result["platoon"]:
        parts.append("platoon " + result["platoon"])
    result["detail"] = ", ".join(parts) if parts else "no matchup history"

    result["score"] = round(max(-1.0, min(1.0, result["score"])), 2)
    return result


def get_lineup_matchup_scores(roster_names, schedule):
    """Score all batters on a roster against today's probable opposing pitchers.

    Args:
        roster_names: list of (player_name, team_name) tuples
        schedule: today's schedule (list of game dicts with probable pitchers)

    Returns dict keyed by batter name: {score, bvp, platoon, detail, opposing_pitcher}
    """
    if not schedule:
        return {}

    # Build reverse alias map once: full_name_normalized -> [alias_normalized, ...]
    _full_to_aliases = {}
    for alias, full in TEAM_ALIASES.items():
        _full_to_aliases.setdefault(normalize_team_name(full), []).append(normalize_team_name(alias))

    # Build team -> opposing pitcher lookup from schedule
    _opp_pitcher_lookup = {}
    for game in schedule:
        away = game.get("away_name", "")
        home = game.get("home_name", "")
        away_pp = game.get("away_probable_pitcher", "")
        home_pp = game.get("home_probable_pitcher", "")
        if home_pp:
            away_norm = normalize_team_name(away)
            _opp_pitcher_lookup[away_norm] = home_pp
            for alias_norm in _full_to_aliases.get(away_norm, []):
                _opp_pitcher_lookup[alias_norm] = home_pp
        if away_pp:
            home_norm = normalize_team_name(home)
            _opp_pitcher_lookup[home_norm] = away_pp
            for alias_norm in _full_to_aliases.get(home_norm, []):
                _opp_pitcher_lookup[alias_norm] = away_pp

    result = {}
    for batter_name, team_name in roster_names:
        if not batter_name or not team_name:
            continue
        norm_team = normalize_team_name(team_name)
        opp_pitcher = _opp_pitcher_lookup.get(norm_team)
        if not opp_pitcher:
            # Try full name from alias
            full = TEAM_ALIASES.get(team_name, team_name)
            opp_pitcher = _opp_pitcher_lookup.get(normalize_team_name(full))
        if not opp_pitcher:
            continue

        matchup = get_matchup_score(batter_name, opp_pitcher)
        matchup["opposing_pitcher"] = opp_pitcher
        result[batter_name] = matchup

    return result


def _safe_int(v, default=None):
    """Safely convert to int."""
    if v is None:
        return default
    try:
        return int(v)
    except (ValueError, TypeError):
        return default


# ============================================================
# 5d. Enhanced Transaction Tracking (Call-Ups)
# ============================================================

def _fetch_callups(days=3):
    """Fetch recent minor-to-major league transactions (call-ups).
    Filters existing transaction data for callup-type moves.
    Returns list of {player_name, team, date, type, description}.
    """
    cache_key = ("callups", days)
    cached = _cache_get(cache_key, TTL_MLB)
    if cached is not None:
        return cached
    try:
        all_transactions = _fetch_mlb_transactions(days)
        callup_keywords = ["Recalled", "Selected", "Purchased", "Contract Selected"]
        callups = []
        for tx in all_transactions:
            tx_type = tx.get("type", "")
            tx_desc = tx.get("description", "")
            is_callup = False
            for keyword in callup_keywords:
                if keyword.lower() in tx_type.lower() or keyword.lower() in tx_desc.lower():
                    is_callup = True
                    break
            if is_callup:
                callups.append({
                    "player_name": tx.get("player_name", ""),
                    "team": tx.get("team", ""),
                    "date": tx.get("date", ""),
                    "type": tx_type,
                    "description": tx_desc,
                })
        _cache_set(cache_key, callups)
        return callups
    except Exception as e:
        print("Warning: callups fetch failed: " + str(e))
        return []


# ============================================================
# 5e. FanGraphs Prospect Board
# ============================================================

def _fetch_prospect_board():
    """Fetch FanGraphs prospect board data.
    Returns list of {name, team, position, overall_rank, eta, risk,
    scouting_grades: {hit, power, speed, arm, field, overall}}.
    """
    cache_key = ("prospect_board",)
    cached = _cache_get(cache_key, TTL_FANGRAPHS)
    if cached is not None:
        return cached
    try:
        url = "https://www.fangraphs.com/api/prospects/board/data?type=0"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
        data = json.loads(raw)

        prospects = []
        if not isinstance(data, list):
            # Sometimes the response wraps in an object
            data = data.get("data", data.get("prospects", []))
        if not isinstance(data, list):
            _cache_set(cache_key, [])
            return []

        for entry in data:
            try:
                prospect = {
                    "name": entry.get("PlayerName", entry.get("playerName", "")),
                    "team": entry.get("Team", entry.get("team", "")),
                    "position": entry.get("Position", entry.get("position", "")),
                    "overall_rank": _safe_float(
                        entry.get("OverallRank", entry.get("overallRank",
                        entry.get("rankOverall", None)))
                    ),
                    "eta": entry.get("ETA", entry.get("eta", "")),
                    "risk": entry.get("Risk", entry.get("risk", "")),
                    "scouting_grades": {
                        "hit": _safe_float(entry.get("Hit", entry.get("hit", None))),
                        "power": _safe_float(entry.get("Game", entry.get("power",
                            entry.get("Power", None)))),
                        "speed": _safe_float(entry.get("Speed", entry.get("speed", None))),
                        "arm": _safe_float(entry.get("Arm", entry.get("arm", None))),
                        "field": _safe_float(entry.get("Field", entry.get("field", None))),
                        "overall": _safe_float(entry.get("FV", entry.get("fv",
                            entry.get("futureValue", None)))),
                    },
                }
                prospects.append(prospect)
            except Exception:
                continue

        _cache_set(cache_key, prospects)
        return prospects
    except Exception as e:
        print("Warning: FanGraphs prospect board fetch failed: " + str(e))
        return []


# ============================================================
# 5f. WAR & League Leaders
# ============================================================

def _fetch_war(player_type="bat"):
    """Fetch WAR data via pybaseball bwar_bat() or bwar_pitch().
    Returns dict keyed by lowercase player name with WAR value.
    """
    cache_key = ("war", player_type)
    cached = _cache_get(cache_key, TTL_WAR)
    if cached is not None:
        return cached
    try:
        if player_type == "bat":
            from pybaseball import bwar_bat
            df_all = bwar_bat()
        else:
            from pybaseball import bwar_pitch
            df_all = bwar_pitch()

        if df_all is None or len(df_all) == 0:
            _cache_set(cache_key, {})
            return {}

        # Filter to current year
        year_col = None
        for col_name in ["year_ID", "yearID", "year", "Year", "season"]:
            if col_name in df_all.columns:
                year_col = col_name
                break

        df = df_all
        if year_col is not None:
            df = df_all[df_all[year_col] == YEAR]
            # Pre-season fallback: re-filter same data, no re-download
            if len(df) == 0 and date.today().month < 5:
                df = df_all[df_all[year_col] == YEAR - 1]

        # Build result dict keyed by lowercase name
        result = {}
        name_col = None
        for col_name in ["name_common", "Name", "name", "player_name"]:
            if col_name in df.columns:
                name_col = col_name
                break

        war_col = None
        for col_name in ["WAR", "war", "bWAR"]:
            if col_name in df.columns:
                war_col = col_name
                break

        if name_col is not None and war_col is not None:
            for _, row in df.iterrows():
                name = row.get(name_col, "")
                war_val = row.get(war_col, None)
                if name and war_val is not None:
                    try:
                        result[str(name).lower()] = float(war_val)
                    except (ValueError, TypeError):
                        continue

        _cache_set(cache_key, result)
        return result
    except Exception as e:
        print("Warning: WAR fetch failed for " + player_type + ": " + str(e))
        return {}


def _fetch_league_leaders(stat_type="hitting", count=10):
    """Fetch league leaders from MLB Stats API.
    stat_type: 'hitting' or 'pitching'
    Returns list of {player, team, stat, value, rank}.
    """
    cache_key = ("league_leaders", stat_type, count)
    cached = _cache_get(cache_key, TTL_MLB)
    if cached is not None:
        return cached

    # Map stat_type to relevant leader categories
    if stat_type == "hitting":
        categories = ["homeRuns", "battingAverage", "runsBattedIn",
                       "stolenBases", "onBasePlusSlugging"]
    else:
        categories = ["earnedRunAverage", "strikeouts", "wins",
                       "walksAndHitsPerInningPitched", "saves"]

    all_leaders = {}
    for category in categories:
        try:
            endpoint = (
                "/stats/leaders?leaderCategories=" + category
                + "&season=" + str(YEAR)
                + "&limit=" + str(count)
            )
            data = _mlb_fetch(endpoint)
            leaders = []
            for leader_group in data.get("leagueLeaders", []):
                for entry in leader_group.get("leaders", []):
                    person = entry.get("person", {})
                    team = entry.get("team", {})
                    leaders.append({
                        "player": person.get("fullName", ""),
                        "team": team.get("name", ""),
                        "stat": category,
                        "value": entry.get("value", ""),
                        "rank": entry.get("rank", 0),
                    })
            all_leaders[category] = leaders
        except Exception as e:
            print("Warning: league leaders fetch failed for "
                  + category + ": " + str(e))
            all_leaders[category] = []

    _cache_set(cache_key, all_leaders)
    return all_leaders


def get_player_war(player_name):
    """Get a player's WAR. Returns float or None."""
    if not player_name:
        return None
    try:
        norm = player_name.strip().lower()
        # Try batting WAR first
        bat_war = _fetch_war("bat")
        if norm in bat_war:
            return bat_war[norm]
        # Try partial match on batting
        for key, val in bat_war.items():
            parts = norm.split()
            if parts and all(p in key for p in parts):
                return val
        # Try pitching WAR
        pitch_war = _fetch_war("pitch")
        if norm in pitch_war:
            return pitch_war[norm]
        # Try partial match on pitching
        for key, val in pitch_war.items():
            parts = norm.split()
            if parts and all(p in key for p in parts):
                return val
        return None
    except Exception as e:
        print("Warning: get_player_war failed for "
              + str(player_name) + ": " + str(e))
        return None


# ============================================================
# 6. Name Matching Utilities
# ============================================================



def _find_in_savant(player_name, savant_data):
    """Find a player in Baseball Savant data by name matching"""
    if not savant_data:
        return None
    norm = _normalize_name(player_name)
    # Try direct match on normalized names
    for key, row in savant_data.items():
        if _is_savant_meta_key(key):
            continue
        if _normalize_name(key) == norm:
            return row
        # Also try the player_name field if it exists
        if _normalize_name(row.get("player_name", "")) == norm:
            return row
        if _normalize_name(row.get("last_name, first_name", "")) == norm:
            return row
    # Fuzzy: check if all parts of the search name appear
    parts = norm.split()
    if parts:
        for key, row in savant_data.items():
            if _is_savant_meta_key(key):
                continue
            row_norm = _normalize_name(key)
            if all(p in row_norm for p in parts):
                return row
    return None


def _find_in_fangraphs(player_name, fg_data):
    """Find a player in FanGraphs data by name matching"""
    if not fg_data:
        return None
    norm = _normalize_name(player_name)
    # Direct match
    result = fg_data.get(norm)
    if result:
        return result
    # Try partial matching
    parts = norm.split()
    if parts:
        for key, row in fg_data.items():
            if all(p in key for p in parts):
                return row
    return None


# ============================================================
# 7. Percentile Rank Calculator
# ============================================================

def _percentile_rank(value, all_values, higher_is_better=True):
    """Calculate percentile rank (0-100) for a value within a distribution"""
    if not all_values or value is None:
        return None
    try:
        val = float(value)
        sorted_vals = sorted([float(v) for v in all_values if v is not None])
        if not sorted_vals:
            return None
        count_below = sum(1 for v in sorted_vals if v < val)
        pct = int(round(count_below / len(sorted_vals) * 100))
        if not higher_is_better:
            pct = 100 - pct
        return max(0, min(100, pct))
    except (ValueError, TypeError):
        return None


def _collect_column_values(savant_data, column):
    """Collect all non-empty values for a column from Savant data"""
    values = []
    for key, row in savant_data.items():
        if _is_savant_meta_key(key):
            continue
        val = row.get(column, "")
        if val != "" and val is not None:
            try:
                values.append(float(val))
            except (ValueError, TypeError):
                pass
    return values


# ============================================================
# 8. Quality Tier Assignment
# ============================================================

def _quality_tier(pct_rank):
    """Assign quality tier based on percentile rank"""
    if pct_rank is None:
        return None
    if pct_rank >= 90:
        return "elite"
    if pct_rank >= 70:
        return "strong"
    if pct_rank >= 40:
        return "average"
    if pct_rank >= 20:
        return "below"
    return "poor"


# ============================================================
# 9. Hot/Cold Determination
# ============================================================

def _hot_cold(game_log_stats):
    """Determine hot/cold status from recent game log stats"""
    if not game_log_stats:
        return "neutral"
    # For batters: look at last 14 days OPS
    ops = game_log_stats.get("ops_14d")
    if ops is not None:
        try:
            ops_val = float(ops)
            if ops_val >= .900:
                return "hot"
            if ops_val >= .780:
                return "warm"
            if ops_val >= .650:
                return "neutral"
            if ops_val >= .500:
                return "cold"
            return "ice"
        except (ValueError, TypeError):
            pass
    # For pitchers: look at last 14 days ERA
    era = game_log_stats.get("era_14d")
    if era is not None:
        try:
            era_val = float(era)
            if era_val <= 2.50:
                return "hot"
            if era_val <= 3.50:
                return "warm"
            if era_val <= 4.50:
                return "neutral"
            if era_val <= 5.50:
                return "cold"
            return "ice"
        except (ValueError, TypeError):
            pass
    return "neutral"


# ============================================================
# 10. Build Functions for player_intel()
# ============================================================

def _safe_float(val, default=None):
    """Safely convert a value to float"""
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _detect_player_type(name, mlb_id):
    """Detect whether a player is a batter or pitcher.
    Checks Savant expected stats for both types.
    """
    # Check batter data first
    batter_data = _fetch_savant_expected("batter")
    if _find_in_savant(name, batter_data):
        return "batter"
    # Check pitcher data
    pitcher_data = _fetch_savant_expected("pitcher")
    if _find_in_savant(name, pitcher_data):
        return "pitcher"
    # Fallback: try MLB API
    if mlb_id:
        try:
            data = _mlb_fetch("/people/" + str(mlb_id))
            people = data.get("people", [])
            if people:
                pos = people[0].get("primaryPosition", {}).get("abbreviation", "")
                if pos in ("P", "SP", "RP"):
                    return "pitcher"
                return "batter"
        except Exception:
            pass
    return "batter"  # default


def _build_batted_ball_profile(name):
    """Build batted ball profile for a pitcher (GB%, FB%, LD%, barrel%, hard hit%).

    Fetches from FanGraphs via pybaseball pitching_stats which includes
    GB%, FB%, LD%, Hard%, and barrel data. Uses _cache_manager for caching.
    """
    cache_key = "batted_ball_profile:" + _normalize_name(name)
    cached = _cache_manager.get(cache_key, ttl=TTL_FANGRAPHS)
    if cached is not None:
        return cached

    try:
        from pybaseball import pitching_stats
        df_cache_key = ("batted_ball_df", YEAR)
        df = _cache_get(df_cache_key, TTL_FANGRAPHS)
        if df is None:
            year = YEAR
            df = pitching_stats(year, qual=25)
            if (df is None or len(df) == 0) and date.today().month < 5:
                year = YEAR - 1
                df = pitching_stats(year, qual=25)
            if df is not None and len(df) > 0:
                _cache_set(df_cache_key, df)
        if df is None or len(df) == 0:
            result = {"note": "No FanGraphs pitching data available"}
            _cache_manager.set(cache_key, result, ttl=TTL_FANGRAPHS)
            return result

        # Find the player row by name
        norm = _normalize_name(name)
        player_row = None
        for _, row in df.iterrows():
            row_name = row.get("Name", "")
            if row_name and _normalize_name(row_name) == norm:
                player_row = row
                break
        # Fuzzy fallback: partial match
        if player_row is None:
            parts = norm.split()
            if parts:
                for _, row in df.iterrows():
                    row_name = row.get("Name", "")
                    if row_name and all(p in _normalize_name(row_name) for p in parts):
                        player_row = row
                        break

        if player_row is None:
            result = {"note": "Player not found in FanGraphs pitching data"}
            _cache_manager.set(cache_key, result, ttl=TTL_FANGRAPHS)
            return result

        gb_pct = _safe_float(player_row.get("GB%"))
        fb_pct = _safe_float(player_row.get("FB%"))
        ld_pct = _safe_float(player_row.get("LD%"))
        hard_hit_pct = _safe_float(player_row.get("Hard%"))
        # Barrel% may be in "Barrel%" column depending on pybaseball version
        barrel_pct = _safe_float(player_row.get("Barrel%"))
        if barrel_pct is None:
            barrel_pct = _safe_float(player_row.get("Barrel%\xa0"))

        # Compute league-wide percentile ranks for context
        all_gb = [_safe_float(r.get("GB%")) for _, r in df.iterrows() if _safe_float(r.get("GB%")) is not None]
        all_fb = [_safe_float(r.get("FB%")) for _, r in df.iterrows() if _safe_float(r.get("FB%")) is not None]
        all_ld = [_safe_float(r.get("LD%")) for _, r in df.iterrows() if _safe_float(r.get("LD%")) is not None]
        all_hard = [_safe_float(r.get("Hard%")) for _, r in df.iterrows() if _safe_float(r.get("Hard%")) is not None]

        # For pitchers: high GB% is good (lower is better=False), low FB% is good,
        # low hard hit% is good, low barrel% is good
        gb_pct_rank = _percentile_rank(gb_pct, all_gb, higher_is_better=True)
        fb_pct_rank = _percentile_rank(fb_pct, all_fb, higher_is_better=False)
        hard_hit_pct_rank = _percentile_rank(hard_hit_pct, all_hard, higher_is_better=False)

        # Classify pitcher profile
        profile_type = "neutral"
        if gb_pct is not None and gb_pct >= 50:
            profile_type = "ground_ball"
        elif fb_pct is not None and fb_pct >= 40:
            profile_type = "fly_ball"

        result = {
            "gb_pct": gb_pct,
            "fb_pct": fb_pct,
            "ld_pct": ld_pct,
            "barrel_pct": barrel_pct,
            "hard_hit_pct": hard_hit_pct,
            "gb_pct_rank": gb_pct_rank,
            "fb_pct_rank": fb_pct_rank,
            "hard_hit_pct_rank": hard_hit_pct_rank,
            "profile_type": profile_type,
            "data_season": year,
        }

        # Stuff+ metrics (if available in the dataset)
        stuff_plus = _safe_float(player_row.get("Stuff+"))
        location_plus = _safe_float(player_row.get("Location+"))
        pitching_plus = _safe_float(player_row.get("Pitching+"))
        if stuff_plus is not None:
            result["stuff_plus"] = stuff_plus
        if location_plus is not None:
            result["location_plus"] = location_plus
        if pitching_plus is not None:
            result["pitching_plus"] = pitching_plus

        _cache_manager.set(cache_key, result, ttl=TTL_FANGRAPHS)
        return result
    except Exception as e:
        print("Warning: _build_batted_ball_profile failed for " + str(name) + ": " + str(e))
        result = {"error": str(e)}
        _cache_manager.set(cache_key, result, ttl=300)
        return result


def _build_statcast(name, mlb_id):
    """Build statcast section of player intel"""
    try:
        player_type = _detect_player_type(name, mlb_id)
        savant_type = player_type

        # Fetch all three Savant datasets
        expected_data = _fetch_savant_expected(savant_type)
        statcast_data = _fetch_savant_statcast(savant_type)
        sprint_data = _fetch_savant_sprint_speed(savant_type) if player_type == "batter" else {}

        expected_row = _find_in_savant(name, expected_data)
        statcast_row = _find_in_savant(name, statcast_data)
        sprint_row = _find_in_savant(name, sprint_data)

        # Determine data season (may be prior year in pre-season)
        data_season = expected_data.get("__data_season", YEAR) if expected_data else YEAR

        result = {"player_type": player_type, "data_season": data_season}

        # Expected stats with percentile ranks
        if expected_row:
            xwoba = _safe_float(expected_row.get("est_woba"))
            woba = _safe_float(expected_row.get("woba"))
            xba = _safe_float(expected_row.get("est_ba"))
            ba = _safe_float(expected_row.get("ba"))
            xslg = _safe_float(expected_row.get("est_slg"))
            slg = _safe_float(expected_row.get("slg"))
            pa = _safe_float(expected_row.get("pa"))

            all_xwoba = _collect_column_values(expected_data, "est_woba")
            all_xba = _collect_column_values(expected_data, "est_ba")
            all_xslg = _collect_column_values(expected_data, "est_slg")

            xwoba_pct = _percentile_rank(xwoba, all_xwoba)
            xba_pct = _percentile_rank(xba, all_xba)
            xslg_pct = _percentile_rank(xslg, all_xslg)

            result["expected"] = {
                "xwoba": xwoba,
                "woba": woba,
                "xwoba_diff": round(xwoba - woba, 3) if xwoba is not None and woba is not None else None,
                "xwoba_pct": xwoba_pct,
                "xwoba_tier": _quality_tier(xwoba_pct),
                "xba": xba,
                "ba": ba,
                "xba_pct": xba_pct,
                "xslg": xslg,
                "slg": slg,
                "xslg_pct": xslg_pct,
                "pa": int(pa) if pa is not None else None,
            }

        # Statcast data (exit velo, barrel rate, etc.)
        if statcast_row:
            avg_ev = _safe_float(statcast_row.get("avg_hit_speed", statcast_row.get("exit_velocity_avg")))
            max_ev = _safe_float(statcast_row.get("max_hit_speed", statcast_row.get("exit_velocity_max")))
            barrel_pct = _safe_float(statcast_row.get("brl_percent", statcast_row.get("barrel_batted_rate")))
            hard_hit_pct = _safe_float(statcast_row.get("hard_hit_percent", statcast_row.get("hard_hit_rate")))
            la = _safe_float(statcast_row.get("avg_launch_angle", statcast_row.get("launch_angle_avg")))

            all_ev = _collect_column_values(statcast_data, "avg_hit_speed") or _collect_column_values(statcast_data, "exit_velocity_avg")
            all_barrel = _collect_column_values(statcast_data, "brl_percent") or _collect_column_values(statcast_data, "barrel_batted_rate")
            all_hard = _collect_column_values(statcast_data, "hard_hit_percent") or _collect_column_values(statcast_data, "hard_hit_rate")

            ev_pct = _percentile_rank(avg_ev, all_ev)
            barrel_pct_rank = _percentile_rank(barrel_pct, all_barrel)
            hard_pct_rank = _percentile_rank(hard_hit_pct, all_hard)

            result["batted_ball"] = {
                "avg_exit_velo": avg_ev,
                "max_exit_velo": max_ev,
                "barrel_pct": barrel_pct,
                "hard_hit_pct": hard_hit_pct,
                "launch_angle": la,
                "ev_pct": ev_pct,
                "ev_tier": _quality_tier(ev_pct),
                "barrel_pct_rank": barrel_pct_rank,
                "barrel_tier": _quality_tier(barrel_pct_rank),
                "hard_hit_pct_rank": hard_pct_rank,
            }

        # Sprint speed (batters only)
        if sprint_row:
            sprint_speed = _safe_float(sprint_row.get("hp_to_1b", sprint_row.get("sprint_speed")))
            all_sprint = (
                _collect_column_values(sprint_data, "hp_to_1b")
                or _collect_column_values(sprint_data, "sprint_speed")
            )
            sprint_pct = _percentile_rank(sprint_speed, all_sprint)
            result["speed"] = {
                "sprint_speed": sprint_speed,
                "sprint_pct": sprint_pct,
                "speed_tier": _quality_tier(sprint_pct),
            }

        # Bat tracking (batters only)
        if player_type == "batter":
            try:
                bt_data = _fetch_savant_bat_tracking()
                bt_row = _find_in_savant(name, bt_data)
                if bt_row:
                    bt_metrics = _extract_bat_tracking_metrics(bt_row)

                    all_bat_speed = (
                        _collect_column_values(bt_data, "avg_bat_speed")
                        or _collect_column_values(bt_data, "bat_speed_avg")
                    )
                    all_fast_swing = (
                        _collect_column_values(bt_data, "hard_swing_rate")
                        or _collect_column_values(bt_data, "fast_swing_rate")
                    )
                    all_squared_up = (
                        _collect_column_values(bt_data, "squared_up_per_swing")
                        or _collect_column_values(bt_data, "squared_up_rate")
                    )

                    result["bat_tracking"] = dict(bt_metrics)
                    result["bat_tracking"]["bat_speed_pct"] = _percentile_rank(bt_metrics.get("bat_speed"), all_bat_speed)
                    result["bat_tracking"]["bat_speed_tier"] = _quality_tier(result["bat_tracking"]["bat_speed_pct"])
                    result["bat_tracking"]["fast_swing_pct"] = _percentile_rank(bt_metrics.get("fast_swing_rate"), all_fast_swing)
                    result["bat_tracking"]["squared_up_pct"] = _percentile_rank(bt_metrics.get("squared_up_rate"), all_squared_up)
            except Exception as e:
                print("Warning: bat tracking failed for " + str(name) + ": " + str(e))

        # Pitch arsenal (pitchers only)
        if player_type == "pitcher":
            try:
                arsenal_data = _fetch_savant_pitch_arsenal("pitcher")
                arsenal_row = _find_in_savant(name, arsenal_data)
                if arsenal_row:
                    result["pitch_arsenal"] = {
                        "pitch_type": arsenal_row.get("pitch_type", ""),
                        "pitch_name": arsenal_row.get("pitch_name", ""),
                        "pitch_usage": _safe_float(arsenal_row.get("pitch_usage")),
                        "velocity": _safe_float(arsenal_row.get("pitch_velocity", arsenal_row.get("velocity"))),
                        "spin_rate": _safe_float(arsenal_row.get("spin_rate")),
                        "whiff_pct": _safe_float(arsenal_row.get("whiff_percent", arsenal_row.get("whiff_pct"))),
                        "put_away_pct": _safe_float(arsenal_row.get("put_away_percent", arsenal_row.get("put_away"))),
                        "run_value": _safe_float(arsenal_row.get("run_value")),
                    }
            except Exception as e:
                print("Warning: pitch arsenal failed for " + str(name) + ": " + str(e))

            # xERA / ERA regression analysis for pitchers
            try:
                fg_pitch = _fetch_fangraphs_regression_pitching()
                fg_row = _find_in_fangraphs(name, fg_pitch)
                if fg_row:
                    era_val = _safe_float(fg_row.get("era"))
                    siera_val = _safe_float(fg_row.get("siera"))
                    fip_val = _safe_float(fg_row.get("fip"))
                    xfip_val = _safe_float(fg_row.get("xfip"))
                    ip_val = _safe_float(fg_row.get("ip"))
                    # Use SIERA as xERA proxy (best ERA predictor available)
                    xera_val = siera_val
                    era_minus_xera = None
                    regression_signal = None
                    if era_val is not None and xera_val is not None:
                        era_minus_xera = round(era_val - xera_val, 2)
                        if era_minus_xera > 0.5:
                            regression_signal = "buy"
                        elif era_minus_xera < -0.5:
                            regression_signal = "sell"
                        else:
                            regression_signal = "hold"
                    result["era_analysis"] = {
                        "era": era_val,
                        "xera": xera_val,
                        "fip": fip_val,
                        "xfip": xfip_val,
                        "era_minus_xera": era_minus_xera,
                        "era_regression_signal": regression_signal,
                        "ip": ip_val,
                        "xera_source": "SIERA",
                    }
            except Exception as e:
                print("Warning: SIERA analysis failed for " + str(name) + ": " + str(e))

            # Stuff+ metrics from FanGraphs regression pitching data
            try:
                if fg_row is None:
                    fg_pitch_data = _fetch_fangraphs_regression_pitching()
                    fg_row = _find_in_fangraphs(name, fg_pitch_data)
                if fg_row:
                    stuff_plus = _safe_float(fg_row.get("stuff_plus"))
                    location_plus = _safe_float(fg_row.get("location_plus"))
                    pitching_plus = _safe_float(fg_row.get("pitching_plus"))
                    if stuff_plus is not None or location_plus is not None or pitching_plus is not None:
                        stuff_gap = None
                        if stuff_plus is not None and location_plus is not None:
                            stuff_gap = round(stuff_plus - location_plus, 1)
                        result["stuff_metrics"] = {
                            "stuff_plus": stuff_plus,
                            "location_plus": location_plus,
                            "pitching_plus": pitching_plus,
                            "stuff_location_gap": stuff_gap,
                        }
            except Exception as e:
                print("Warning: Stuff+ metrics failed for " + str(name) + ": " + str(e))

            # Batted ball profile (GB%, FB%, LD%, barrel%, hard hit%)
            try:
                bb_profile = _build_batted_ball_profile(name)
                if bb_profile and not bb_profile.get("error") and not bb_profile.get("note"):
                    result["batted_ball_profile"] = bb_profile
            except Exception as e:
                print("Warning: batted ball profile failed for " + str(name) + ": " + str(e))

        if not expected_row and not statcast_row and not sprint_row:
            result["note"] = "Player not found in Savant leaderboards (may not meet minimum PA/IP threshold)"

        # Compute composite quality_tier
        # Priority: xwOBA tier (if sufficient PA/IP), then EV tier, then z-score tier
        _MIN_RELIABLE_PA = 50
        _MIN_RELIABLE_IP = 15
        exp = result.get("expected", {})
        bb_res = result.get("batted_ball", {})
        era_a = result.get("era_analysis", {})
        sample_pa = exp.get("pa")
        sample_ip = era_a.get("ip")
        is_reliable = False
        if player_type == "pitcher" and sample_ip is not None:
            is_reliable = float(sample_ip) >= _MIN_RELIABLE_IP
        elif sample_pa is not None:
            is_reliable = float(sample_pa) >= _MIN_RELIABLE_PA

        if is_reliable and exp.get("xwoba_tier"):
            result["quality_tier"] = exp.get("xwoba_tier")
        elif bb_res.get("ev_tier"):
            # EV comes from statcast CSV which may have fallen back to prior year
            result["quality_tier"] = bb_res.get("ev_tier")
        elif exp.get("xwoba_tier"):
            # Small sample but it's all we have from current year
            result["quality_tier"] = exp.get("xwoba_tier")
            result["quality_source"] = "small_sample"

        # If still no quality tier, use projection z-score
        if not result.get("quality_tier"):
            try:
                from valuations import get_player_zscore
                z_info = get_player_zscore(name)
                if z_info:
                    result["quality_tier"] = z_info.get("tier", "Unknown")
                    result["quality_source"] = "projections"
            except Exception:
                pass

        # Save daily snapshot for historical comparison
        _save_statcast_snapshot(name, result)

        return result
    except Exception as e:
        print("Warning: _build_statcast failed for " + str(name) + ": " + str(e))
        return {"error": str(e)}


def _compute_game_log_splits(games, stat_group):
    """Compute rolling splits from game log entries"""
    if not games:
        return {}
    result = {}
    now = datetime.now()

    # Split into 14-day and 30-day windows
    games_14d = []
    games_30d = []
    for g in games:
        game_date_str = g.get("date", "")
        if not game_date_str:
            games_30d.append(g)
            games_14d.append(g)
            continue
        try:
            game_date = datetime.strptime(game_date_str, "%Y-%m-%d")
            days_ago = (now - game_date).days
            if days_ago <= 30:
                games_30d.append(g)
            if days_ago <= 14:
                games_14d.append(g)
        except (ValueError, TypeError):
            games_30d.append(g)

    if stat_group == "hitting":
        for label, subset in [("14d", games_14d), ("30d", games_30d)]:
            if not subset:
                continue
            total_ab = sum(_safe_float(g.get("atBats", 0), 0) for g in subset)
            total_h = sum(_safe_float(g.get("hits", 0), 0) for g in subset)
            total_hr = sum(_safe_float(g.get("homeRuns", 0), 0) for g in subset)
            total_rbi = sum(_safe_float(g.get("rbi", 0), 0) for g in subset)
            total_bb = sum(_safe_float(g.get("baseOnBalls", 0), 0) for g in subset)
            total_k = sum(_safe_float(g.get("strikeOuts", 0), 0) for g in subset)
            total_sb = sum(_safe_float(g.get("stolenBases", 0), 0) for g in subset)

            avg = round(total_h / total_ab, 3) if total_ab > 0 else 0.0
            obp_denom = total_ab + total_bb
            obp = round((total_h + total_bb) / obp_denom, 3) if obp_denom > 0 else 0.0
            # Simple SLG approximation from available stats
            total_2b = sum(_safe_float(g.get("doubles", 0), 0) for g in subset)
            total_3b = sum(_safe_float(g.get("triples", 0), 0) for g in subset)
            total_1b = total_h - total_2b - total_3b - total_hr
            tb = total_1b + (2 * total_2b) + (3 * total_3b) + (4 * total_hr)
            slg = round(tb / total_ab, 3) if total_ab > 0 else 0.0
            ops = round(obp + slg, 3)

            result["avg_" + label] = avg
            result["ops_" + label] = ops
            result["hr_" + label] = int(total_hr)
            result["rbi_" + label] = int(total_rbi)
            result["sb_" + label] = int(total_sb)
            result["k_" + label] = int(total_k)
            result["bb_" + label] = int(total_bb)
            result["games_" + label] = len(subset)
    else:
        # Pitching splits
        for label, subset in [("14d", games_14d), ("30d", games_30d)]:
            if not subset:
                continue
            total_ip = sum(_safe_float(g.get("inningsPitched", 0), 0) for g in subset)
            total_er = sum(_safe_float(g.get("earnedRuns", 0), 0) for g in subset)
            total_k = sum(_safe_float(g.get("strikeOuts", 0), 0) for g in subset)
            total_bb = sum(_safe_float(g.get("baseOnBalls", 0), 0) for g in subset)
            total_h = sum(_safe_float(g.get("hits", 0), 0) for g in subset)
            total_w = sum(_safe_float(g.get("wins", 0), 0) for g in subset)

            era = round(total_er * 9 / total_ip, 2) if total_ip > 0 else 0.0
            whip = round((total_bb + total_h) / total_ip, 2) if total_ip > 0 else 0.0

            result["era_" + label] = era
            result["whip_" + label] = whip
            result["k_" + label] = int(total_k)
            result["bb_" + label] = int(total_bb)
            result["ip_" + label] = round(total_ip, 1)
            result["w_" + label] = int(total_w)
            result["games_" + label] = len(subset)

    return result


def _build_trends(name, mlb_id):
    """Build trends section: recent game log splits + hot/cold status"""
    try:
        player_type = _detect_player_type(name, mlb_id)
        stat_group = "pitching" if player_type == "pitcher" else "hitting"

        # Career year-by-year (MLB level only) — fetch regardless of recent games
        career = _fetch_mlb_career_stats(mlb_id, stat_group=stat_group)

        games = _fetch_mlb_game_log(mlb_id, stat_group=stat_group, days=30)
        if not games:
            return {
                "status": "neutral",
                "note": "No recent game log data available",
                "player_type": player_type,
                "career_stats": career,
            }

        splits = _compute_game_log_splits(games, stat_group)
        status = _hot_cold(splits)

        # Include last 10 raw game log entries (most recent first), trimmed to UI fields
        _UI_HITTING = {"date", "opponent", "atBats", "hits", "runs", "homeRuns", "rbi", "baseOnBalls", "strikeOuts", "stolenBases"}
        _UI_PITCHING = {"date", "opponent", "inningsPitched", "hits", "earnedRuns", "strikeOuts", "baseOnBalls", "wins", "losses", "saves", "holds"}
        _ui_fields = _UI_PITCHING if stat_group == "pitching" else _UI_HITTING
        recent_games = [{k: g[k] for k in _ui_fields if k in g} for g in reversed(games[-10:])]

        result = {
            "status": status,
            "player_type": player_type,
            "splits": splits,
            "games_total": len(games),
            "game_log": recent_games,
            "career_stats": career,
        }

        # ERA regression flagging for pitchers
        if player_type == "pitcher":
            try:
                fg_pitch = _fetch_fangraphs_regression_pitching()
                fg_row = _find_in_fangraphs(name, fg_pitch)
                if fg_row:
                    era_val = _safe_float(fg_row.get("era"))
                    siera_val = _safe_float(fg_row.get("siera"))
                    if era_val is not None and siera_val is not None:
                        era_diff = era_val - siera_val
                        trend_notes = result.get("trend_notes", [])
                        if era_diff > 0.5:
                            trend_notes.append(
                                "ERA regression candidate (buy): ERA "
                                + str(round(era_val, 2))
                                + " vs SIERA " + str(round(siera_val, 2))
                            )
                        elif era_diff < -0.5:
                            trend_notes.append(
                                "ERA regression candidate (sell): ERA "
                                + str(round(era_val, 2))
                                + " vs SIERA " + str(round(siera_val, 2))
                            )
                        if trend_notes:
                            result["trend_notes"] = trend_notes
            except Exception as e:
                print("Warning: ERA regression check failed for " + str(name) + ": " + str(e))

        return result
    except Exception as e:
        print("Warning: _build_trends failed for " + str(name) + ": " + str(e))
        return {"error": str(e)}


def _build_context(name):
    """Build context section: Reddit buzz + headlines"""
    try:
        posts = _search_reddit_player(name)
        mention_count = len(posts)
        if mention_count == 0:
            return {
                "mentions": 0,
                "sentiment": "unknown",
                "headlines": [],
            }

        avg_score = sum(p.get("score", 0) for p in posts) / mention_count
        if avg_score > 5:
            sentiment = "positive"
        elif avg_score < 1:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        headlines = [p.get("title", "") for p in posts[:5]]

        return {
            "mentions": mention_count,
            "sentiment": sentiment,
            "avg_score": round(avg_score, 1),
            "headlines": headlines,
        }
    except Exception as e:
        print("Warning: _build_context failed for " + str(name) + ": " + str(e))
        return {"error": str(e)}


def _build_percentiles(name, mlb_id):
    """Build percentile rankings section from Baseball Savant.
    The famous Savant percentile card data.
    """
    try:
        player_type = _detect_player_type(name, mlb_id)
        pct_data = _fetch_savant_percentile_rankings(player_type)
        if not pct_data:
            return {"note": "Percentile data not available"}

        row = _find_in_savant(name, pct_data)
        if not row:
            return {"note": "Player not found in percentile rankings"}

        data_season = pct_data.get("__data_season", YEAR)

        # Extract available percentile columns
        result = {"data_season": data_season, "player_type": player_type}

        # Common percentile fields from Savant
        pct_fields = {
            "xwoba": ["xwoba_percent", "xwoba"],
            "xba": ["xba_percent", "xba"],
            "exit_velocity": ["exit_velocity_percent", "exit_velocity"],
            "barrel_pct": ["barrel_pct_percent", "barrel_batted_rate"],
            "hard_hit_pct": ["hard_hit_percent", "hard_hit_pct"],
            "k_pct": ["k_percent", "k_pct"],
            "bb_pct": ["bb_percent", "bb_pct"],
            "whiff_pct": ["whiff_percent", "whiff_pct"],
            "chase_rate": ["oz_swing_percent", "chase_rate"],
            "sprint_speed": ["sprint_speed_percent", "sprint_speed"],
        }

        metrics = {}
        for label, candidates in pct_fields.items():
            for col in candidates:
                val = _safe_float(row.get(col))
                if val is not None:
                    metrics[label] = val
                    break

        result["metrics"] = metrics
        return result
    except Exception as e:
        print("Warning: _build_percentiles failed for " + str(name) + ": " + str(e))
        return {"error": str(e)}


def _build_discipline(name):
    """Build plate discipline section from FanGraphs data"""
    try:
        player_type = _detect_player_type(name, None)
        if player_type == "pitcher":
            fg_data = _fetch_fangraphs_pitching()
        else:
            fg_data = _fetch_fangraphs_batting()

        row = _find_in_fangraphs(name, fg_data)
        if not row:
            return {"note": "Player not found in FanGraphs data"}

        return {
            "bb_rate": row.get("bb_rate"),
            "k_rate": row.get("k_rate"),
            "o_swing_pct": row.get("o_swing_pct"),
            "z_contact_pct": row.get("z_contact_pct"),
            "swstr_pct": row.get("swstr_pct"),
        }
    except Exception as e:
        print("Warning: _build_discipline failed for " + str(name) + ": " + str(e))
        return {"error": str(e)}


def _build_splits(name, player_type):
    """Build platoon split analysis (vs LHP/RHP) for player intel.
    Returns dict with vs_LHP, vs_RHP, platoon_advantage, platoon_differential.
    """
    try:
        mlb_id = get_mlb_id(name)
        if not mlb_id:
            return {"note": "Could not resolve MLB ID for splits lookup"}

        stat_group = "pitching" if player_type == "pitcher" else "hitting"
        raw_splits = _fetch_player_splits(mlb_id, stat_group=stat_group)
        if not raw_splits:
            return {"note": "No split data available"}

        vs_lhp = raw_splits.get("vs_lhp")
        vs_rhp = raw_splits.get("vs_rhp")

        if not vs_lhp and not vs_rhp:
            return {"note": "No platoon split data available"}

        result = {}

        # Format vs_LHP and vs_RHP sections
        for key, label in [("vs_lhp", "vs_LHP"), ("vs_rhp", "vs_RHP")]:
            split_data = raw_splits.get(key)
            if split_data:
                result[label] = {
                    "avg": split_data.get("avg"),
                    "obp": split_data.get("obp"),
                    "slg": split_data.get("slg"),
                    "ops": split_data.get("ops"),
                    "sample_pa": split_data.get("pa"),
                }

        # Compute platoon advantage and differential
        lhp_ops = vs_lhp.get("ops") if vs_lhp else None
        rhp_ops = vs_rhp.get("ops") if vs_rhp else None

        if lhp_ops is not None and rhp_ops is not None:
            diff = round(abs(lhp_ops - rhp_ops), 3)
            result["platoon_differential"] = diff
            if diff < 0.030:
                result["platoon_advantage"] = "neutral"
            elif lhp_ops > rhp_ops:
                result["platoon_advantage"] = "LHP"
            else:
                result["platoon_advantage"] = "RHP"

        # Include home/away if available
        home = raw_splits.get("home")
        away = raw_splits.get("away")
        if home:
            result["home"] = {
                "avg": home.get("avg"),
                "obp": home.get("obp"),
                "slg": home.get("slg"),
                "ops": home.get("ops"),
                "sample_pa": home.get("pa"),
            }
        if away:
            result["away"] = {
                "avg": away.get("avg"),
                "obp": away.get("obp"),
                "slg": away.get("slg"),
                "ops": away.get("ops"),
                "sample_pa": away.get("pa"),
            }

        if raw_splits.get("data_season"):
            result["data_season"] = raw_splits.get("data_season")

        return result
    except Exception as e:
        print("Warning: _build_splits failed for " + str(name) + ": " + str(e))
        return {"error": str(e)}


# ============================================================
# 10. Main Functions: player_intel() and batch_intel()
# ============================================================

def player_intel(name, include=None):
    """
    Get comprehensive intelligence packet for a player.

    include: list of sections to fetch. None = all.
    Valid sections: 'statcast', 'trends', 'context', 'discipline', 'percentiles', 'splits', 'arsenal_changes'
    """
    if include is None:
        include = ["statcast", "trends", "context", "discipline", "percentiles", "splits", "arsenal_changes"]

    result = {"name": name}

    mlb_id = get_mlb_id(name)
    result["mlb_id"] = mlb_id

    if "statcast" in include:
        result["statcast"] = _build_statcast(name, mlb_id)

    if "trends" in include:
        result["trends"] = _build_trends(name, mlb_id)

    if "context" in include:
        result["context"] = _build_context(name)

    if "discipline" in include:
        result["discipline"] = _build_discipline(name)

    if "percentiles" in include:
        result["percentiles"] = _build_percentiles(name, mlb_id)

    if "splits" in include:
        player_type = _detect_player_type(name, mlb_id)
        result["splits"] = _build_splits(name, player_type)

    if "arsenal_changes" in include:
        # Only fetch for pitchers
        player_type = result.get("statcast", {}).get("player_type")
        if player_type is None:
            player_type = _detect_player_type(name, mlb_id)
        if player_type == "pitcher":
            result["arsenal_changes"] = _build_arsenal_changes(name)

    return result


def batch_intel(names, include=None):
    """
    Get intel for multiple players efficiently.
    Uses cached bulk leaderboard data -- one fetch covers all ~400 qualifying players.
    """
    if include is None:
        include = ["statcast"]  # Default to just statcast for batch (efficiency)

    result = {}
    for name in names:
        if not name:
            continue
        try:
            result[name] = player_intel(name, include=include)
        except Exception as e:
            print("Warning: intel failed for " + str(name) + ": " + str(e))
            result[name] = {"name": name, "error": str(e)}
    return result


# ============================================================
# 10b. Statcast Leaderboard Query
# ============================================================

# Map user-friendly metric names to (fetch_func, column_candidates, higher_is_better, label)
_LEADERBOARD_METRICS = {
    # Batted ball
    "exit_velocity": ("statcast", ["avg_hit_speed", "exit_velocity_avg"], True, "Exit Velocity (mph)"),
    "max_exit_velocity": ("statcast", ["max_hit_speed", "exit_velocity_max"], True, "Max Exit Velocity (mph)"),
    "barrel_pct": ("statcast", ["brl_percent", "barrel_batted_rate"], True, "Barrel %"),
    "hard_hit_pct": ("statcast", ["hard_hit_percent", "hard_hit_rate"], True, "Hard Hit %"),
    "launch_angle": ("statcast", ["avg_launch_angle", "launch_angle_avg"], False, "Avg Launch Angle"),
    # Expected
    "xwoba": ("expected", ["est_woba", "xwoba"], True, "xwOBA"),
    "xba": ("expected", ["est_ba", "xba"], True, "xBA"),
    "xslg": ("expected", ["est_slg", "xslg"], True, "xSLG"),
    # Speed
    "sprint_speed": ("sprint", ["sprint_speed"], True, "Sprint Speed (ft/s)"),
    # Bat tracking
    "bat_speed": ("bat_tracking", ["bat_speed"], True, "Bat Speed (mph)"),
    "swing_length": ("bat_tracking", ["swing_length"], False, "Swing Length (ft)"),
    "squared_up_rate": ("bat_tracking", ["squared_up_per_swing", "squared_up_rate"], True, "Squared Up %"),
    "blast_pct": ("bat_tracking", ["blast_per_swing", "blast_pct"], True, "Blast %"),
}

_LEADERBOARD_ALIASES = {
    "ev": "exit_velocity", "exit_velo": "exit_velocity", "velo": "exit_velocity",
    "barrel": "barrel_pct", "barrels": "barrel_pct",
    "hard_hit": "hard_hit_pct", "hh": "hard_hit_pct",
    "speed": "sprint_speed", "sprint": "sprint_speed",
    "bat_tracking": "bat_speed",
}

def statcast_leaderboard(metric, player_type="batter", count=20):
    """Query Savant leaderboard data for a specific metric.
    Returns list of {rank, name, team, value} sorted by the metric.
    """
    metric_lower = metric.lower().replace(" ", "_").replace("-", "_").replace("%", "_pct")
    metric_lower = _LEADERBOARD_ALIASES.get(metric_lower, metric_lower)

    spec = _LEADERBOARD_METRICS.get(metric_lower)
    if not spec:
        available = sorted(_LEADERBOARD_METRICS.keys())
        return {"error": "Unknown metric '" + metric + "'. Available: " + ", ".join(available)}

    source, col_candidates, higher_is_better, label = spec

    # Fetch the right data source
    if source == "statcast":
        data = _fetch_savant_statcast(player_type)
    elif source == "expected":
        data = _fetch_savant_expected(player_type)
    elif source == "sprint":
        data = _fetch_savant_sprint_speed(player_type)
    elif source == "bat_tracking":
        data = _fetch_savant_bat_tracking()
    else:
        return {"error": "Unknown source: " + source}

    if not data:
        return {"error": "Could not fetch Savant data for " + label}

    data_season = data.get("__data_season", YEAR)

    # Data is a dict keyed by player name (plus __data_season and id:* keys)
    # Collect all player rows
    rows = []
    for k, v in data.items():
        if k.startswith("__") or k.startswith("id:") or not isinstance(v, dict):
            continue
        rows.append((k, v))

    if not rows:
        return {"error": "No data rows available"}

    # Find the right column from the first row
    sample = rows[0][1]
    col = None
    for c in col_candidates:
        if sample.get(c) is not None:
            col = c
            break
    if not col:
        lower_map = {k.lower(): k for k in sample.keys()}
        for c in col_candidates:
            if c.lower() in lower_map:
                col = lower_map[c.lower()]
                break
    if not col:
        return {"error": "Column not found in data for " + label}

    # Extract and sort
    entries = []
    for name_key, row in rows:
        val = _safe_float(row.get(col))
        if val is None:
            continue
        # Normalize "Last, First" format
        name = name_key
        if "," in str(name):
            parts = str(name).split(",", 1)
            name = parts[1].strip() + " " + parts[0].strip()
        team = (row.get("team_name_abbrev")
                or row.get("team_abbrev")
                or row.get("team")
                or row.get("Team")
                or "")
        entries.append({"name": str(name), "team": str(team), "value": val})

    entries.sort(key=lambda e: e["value"], reverse=higher_is_better)
    entries = entries[:count]
    for i, e in enumerate(entries):
        e["rank"] = i + 1

    # Resolve teams from sprint speed CSV (has team column)
    missing_teams = [e for e in entries if not e.get("team")]
    if missing_teams:
        try:
            sprint_data = data if source == "sprint" else _fetch_savant_sprint_speed(player_type)
            if sprint_data:
                name_team = {}
                for k, v in sprint_data.items():
                    if k.startswith("__") or k.startswith("id:") or not isinstance(v, dict):
                        continue
                    n = k
                    if "," in n:
                        parts = n.split(",", 1)
                        n = parts[1].strip() + " " + parts[0].strip()
                    t = v.get("team", "")
                    if t:
                        name_team[n.lower()] = str(t)
                for e in missing_teams:
                    t = name_team.get(e["name"].lower())
                    if t:
                        e["team"] = t
        except Exception:
            pass

    return {
        "metric": metric_lower,
        "label": label,
        "data_season": data_season,
        "player_type": player_type,
        "higher_is_better": higher_is_better,
        "leaders": entries,
    }


# ============================================================
# 11. Standalone Commands
# ============================================================

def cmd_player_report(args, as_json=False):
    """Deep-dive single player report"""
    if not args:
        if as_json:
            return {"error": "Usage: player <player_name>"}
        print("Usage: intel.py player <player_name>")
        return
    name = " ".join(args)
    intel_data = player_intel(name)
    if as_json:
        return intel_data
    # Pretty print
    print("Player Intelligence Report: " + name)
    print("=" * 50)

    statcast = intel_data.get("statcast", {})
    if statcast and not statcast.get("error"):
        data_season = statcast.get("data_season", "")
        season_label = ""
        if data_season and data_season != YEAR:
            season_label = " [Pre-season: " + str(data_season) + " data]"
        print("")
        print("STATCAST (" + statcast.get("player_type", "unknown") + ")" + season_label)
        print("-" * 30)
        expected = statcast.get("expected", {})
        if expected:
            print("  xwOBA: " + str(expected.get("xwoba", "N/A"))
                  + " (actual: " + str(expected.get("woba", "N/A"))
                  + ", diff: " + str(expected.get("xwoba_diff", "N/A")) + ")")
            print("  xwOBA percentile: " + str(expected.get("xwoba_pct", "N/A"))
                  + " (" + str(expected.get("xwoba_tier", "N/A")) + ")")
            print("  xBA: " + str(expected.get("xba", "N/A"))
                  + " | xSLG: " + str(expected.get("xslg", "N/A")))
        bb = statcast.get("batted_ball", {})
        if bb:
            print("  Exit Velo: " + str(bb.get("avg_exit_velo", "N/A"))
                  + " mph (pct: " + str(bb.get("ev_pct", "N/A"))
                  + ", " + str(bb.get("ev_tier", "N/A")) + ")")
            print("  Barrel%: " + str(bb.get("barrel_pct", "N/A"))
                  + " | Hard Hit%: " + str(bb.get("hard_hit_pct", "N/A")))
        speed = statcast.get("speed", {})
        if speed:
            print("  Sprint Speed: " + str(speed.get("sprint_speed", "N/A"))
                  + " (pct: " + str(speed.get("sprint_pct", "N/A"))
                  + ", " + str(speed.get("speed_tier", "N/A")) + ")")
        arsenal = statcast.get("pitch_arsenal", {})
        if arsenal:
            print("  Pitch Arsenal:")
            print("    Type: " + str(arsenal.get("pitch_name", "N/A"))
                  + " | Usage: " + str(arsenal.get("pitch_usage", "N/A"))
                  + " | Velo: " + str(arsenal.get("velocity", "N/A"))
                  + " | Spin: " + str(arsenal.get("spin_rate", "N/A")))
            print("    Whiff%: " + str(arsenal.get("whiff_pct", "N/A"))
                  + " | Put Away%: " + str(arsenal.get("put_away_pct", "N/A")))
        bb_profile = statcast.get("batted_ball_profile", {})
        if bb_profile and not bb_profile.get("error") and not bb_profile.get("note"):
            profile_season = bb_profile.get("data_season", "")
            profile_label = ""
            if profile_season and profile_season != YEAR:
                profile_label = " [" + str(profile_season) + " data]"
            print("  Batted Ball Profile" + profile_label + " (" + str(bb_profile.get("profile_type", "neutral")) + "):")
            print("    GB%: " + str(bb_profile.get("gb_pct", "N/A"))
                  + " (pct: " + str(bb_profile.get("gb_pct_rank", "N/A")) + ")"
                  + " | FB%: " + str(bb_profile.get("fb_pct", "N/A"))
                  + " (pct: " + str(bb_profile.get("fb_pct_rank", "N/A")) + ")")
            print("    LD%: " + str(bb_profile.get("ld_pct", "N/A"))
                  + " | Hard%: " + str(bb_profile.get("hard_hit_pct", "N/A"))
                  + " (pct: " + str(bb_profile.get("hard_hit_pct_rank", "N/A")) + ")")
            if bb_profile.get("barrel_pct") is not None:
                print("    Barrel%: " + str(bb_profile.get("barrel_pct")))
        if statcast.get("note"):
            print("  Note: " + statcast.get("note", ""))

    trends = intel_data.get("trends", {})
    if trends and not trends.get("error"):
        print("")
        print("TRENDS (status: " + trends.get("status", "unknown") + ")")
        print("-" * 30)
        splits = trends.get("splits", {})
        if splits:
            # Print 14-day and 30-day splits
            for window in ["14d", "30d"]:
                games_key = "games_" + window
                if splits.get(games_key):
                    print("  Last " + window + " (" + str(splits.get(games_key, 0)) + " games):")
                    if splits.get("avg_" + window) is not None:
                        print("    AVG: " + str(splits.get("avg_" + window, "N/A"))
                              + " | OPS: " + str(splits.get("ops_" + window, "N/A"))
                              + " | HR: " + str(splits.get("hr_" + window, "N/A"))
                              + " | RBI: " + str(splits.get("rbi_" + window, "N/A")))
                    if splits.get("era_" + window) is not None:
                        print("    ERA: " + str(splits.get("era_" + window, "N/A"))
                              + " | WHIP: " + str(splits.get("whip_" + window, "N/A"))
                              + " | K: " + str(splits.get("k_" + window, "N/A"))
                              + " | IP: " + str(splits.get("ip_" + window, "N/A")))

    context = intel_data.get("context", {})
    if context and not context.get("error"):
        print("")
        print("REDDIT BUZZ")
        print("-" * 30)
        print("  Mentions: " + str(context.get("mentions", 0))
              + " | Sentiment: " + str(context.get("sentiment", "unknown"))
              + " | Avg Score: " + str(context.get("avg_score", "N/A")))
        for headline in context.get("headlines", []):
            print("  - " + headline)

    discipline = intel_data.get("discipline", {})
    if discipline and not discipline.get("error") and not discipline.get("note"):
        print("")
        print("PLATE DISCIPLINE")
        print("-" * 30)
        print("  BB%: " + str(discipline.get("bb_rate", "N/A"))
              + " | K%: " + str(discipline.get("k_rate", "N/A")))
        print("  O-Swing%: " + str(discipline.get("o_swing_pct", "N/A"))
              + " | Z-Contact%: " + str(discipline.get("z_contact_pct", "N/A")))
        print("  SwStr%: " + str(discipline.get("swstr_pct", "N/A")))
    elif discipline and discipline.get("note"):
        print("")
        print("PLATE DISCIPLINE")
        print("-" * 30)
        print("  " + discipline.get("note", ""))

    percentiles = intel_data.get("percentiles", {})
    if percentiles and not percentiles.get("error") and not percentiles.get("note"):
        pct_season = percentiles.get("data_season", "")
        pct_label = ""
        if pct_season and pct_season != YEAR:
            pct_label = " [" + str(pct_season) + " data]"
        print("")
        print("SAVANT PERCENTILES" + pct_label)
        print("-" * 30)
        metrics = percentiles.get("metrics", {})
        for key, val in metrics.items():
            print("  " + key.ljust(15) + str(val))
    elif percentiles and percentiles.get("note"):
        print("")
        print("SAVANT PERCENTILES")
        print("-" * 30)
        print("  " + percentiles.get("note", ""))

    splits = intel_data.get("splits", {})
    if splits and not splits.get("error") and not splits.get("note"):
        splits_season = splits.get("data_season")
        splits_label = ""
        if splits_season:
            splits_label = " [" + str(splits_season) + " data]"
        print("")
        print("PLATOON SPLITS" + splits_label)
        print("-" * 30)
        for split_key, split_label in [("vs_LHP", "vs LHP"), ("vs_RHP", "vs RHP")]:
            split_data = splits.get(split_key)
            if split_data:
                pa_str = ""
                if split_data.get("sample_pa") is not None:
                    pa_str = " (" + str(split_data.get("sample_pa")) + " PA)"
                print("  " + split_label + pa_str + ":"
                      + " AVG " + str(split_data.get("avg", "N/A"))
                      + " | OBP " + str(split_data.get("obp", "N/A"))
                      + " | SLG " + str(split_data.get("slg", "N/A"))
                      + " | OPS " + str(split_data.get("ops", "N/A")))
        advantage = splits.get("platoon_advantage")
        diff = splits.get("platoon_differential")
        if advantage:
            print("  Platoon advantage: " + str(advantage)
                  + " (OPS diff: " + str(diff) + ")")
        for split_key, split_label in [("home", "Home"), ("away", "Away")]:
            split_data = splits.get(split_key)
            if split_data:
                pa_str = ""
                if split_data.get("sample_pa") is not None:
                    pa_str = " (" + str(split_data.get("sample_pa")) + " PA)"
                print("  " + split_label + pa_str + ":"
                      + " AVG " + str(split_data.get("avg", "N/A"))
                      + " | OBP " + str(split_data.get("obp", "N/A"))
                      + " | SLG " + str(split_data.get("slg", "N/A"))
                      + " | OPS " + str(split_data.get("ops", "N/A")))
    elif splits and splits.get("note"):
        print("")
        print("PLATOON SPLITS")
        print("-" * 30)
        print("  " + splits.get("note", ""))

    arsenal_changes = intel_data.get("arsenal_changes", {})
    if arsenal_changes and not arsenal_changes.get("error"):
        print("")
        print("ARSENAL CHANGES")
        print("-" * 30)
        current = arsenal_changes.get("current", {})
        if current:
            print("  Current arsenal:")
            for pt, info in sorted(current.items()):
                line = "    " + str(info.get("pitch_name", pt))
                if info.get("usage_pct") is not None:
                    line = line + " | " + str(info.get("usage_pct")) + "%"
                if info.get("velocity") is not None:
                    line = line + " | " + str(info.get("velocity")) + " mph"
                if info.get("spin_rate") is not None:
                    line = line + " | " + str(int(info.get("spin_rate"))) + " rpm"
                if info.get("whiff_rate") is not None:
                    line = line + " | " + str(info.get("whiff_rate")) + "% whiff"
                print(line)
        changes = arsenal_changes.get("changes", [])
        hist_date = arsenal_changes.get("historical_date")
        if changes:
            print("  Changes vs " + str(hist_date) + ":")
            for chg in changes:
                label = str(chg.get("pitch_name", chg.get("pitch_type", "")))
                print("    " + label + ": " + str(chg.get("detail", "")))
        elif arsenal_changes.get("note"):
            print("  " + arsenal_changes.get("note", ""))
        elif hist_date:
            print("  No significant changes since " + str(hist_date))


def cmd_breakouts(args, as_json=False):
    """Players where xwOBA >> wOBA (unlucky, due for positive regression)"""
    pos_type = args[0] if args else "B"
    count = 15
    if len(args) > 1:
        try:
            count = int(args[1])
        except (ValueError, TypeError):
            pass
    savant_type = "batter" if pos_type == "B" else "pitcher"
    expected = _fetch_savant_expected(savant_type)
    if not expected:
        if as_json:
            return {"error": "Could not fetch Savant data"}
        print("Could not fetch Savant data")
        return
    # Find players with biggest positive xwOBA - wOBA diff
    candidates = []
    for key, row in expected.items():
        if _is_savant_meta_key(key):
            continue
        try:
            xwoba = float(row.get("est_woba", 0))
            woba = float(row.get("woba", 0))
            diff = xwoba - woba
            if diff > 0.020:
                candidates.append({
                    "name": row.get("player_name", key),
                    "woba": round(woba, 3),
                    "xwoba": round(xwoba, 3),
                    "diff": round(diff, 3),
                    "pa": int(float(row.get("pa", 0))),
                })
        except (ValueError, TypeError):
            pass
    candidates.sort(key=lambda x: -x.get("diff", 0))
    candidates = candidates[:count]
    if as_json:
        return {"pos_type": pos_type, "candidates": candidates}
    # Pretty print
    label = "Batters" if pos_type == "B" else "Pitchers"
    print("Breakout Candidates (" + label + ") - xwOBA >> wOBA")
    print("=" * 60)
    print("  " + "Name".ljust(25) + "wOBA".rjust(7) + "xwOBA".rjust(7) + "Diff".rjust(7) + "PA".rjust(6))
    print("  " + "-" * 52)
    for c in candidates:
        print("  " + str(c.get("name", "")).ljust(25)
              + str(c.get("woba", "")).rjust(7)
              + str(c.get("xwoba", "")).rjust(7)
              + ("+" + str(c.get("diff", ""))).rjust(7)
              + str(c.get("pa", "")).rjust(6))


def cmd_busts(args, as_json=False):
    """Players where wOBA >> xwOBA (lucky, due for negative regression)"""
    pos_type = args[0] if args else "B"
    count = 15
    if len(args) > 1:
        try:
            count = int(args[1])
        except (ValueError, TypeError):
            pass
    savant_type = "batter" if pos_type == "B" else "pitcher"
    expected = _fetch_savant_expected(savant_type)
    if not expected:
        if as_json:
            return {"error": "Could not fetch Savant data"}
        print("Could not fetch Savant data")
        return
    # Find players with biggest negative xwOBA - wOBA diff (wOBA >> xwOBA)
    candidates = []
    for key, row in expected.items():
        if _is_savant_meta_key(key):
            continue
        try:
            xwoba = float(row.get("est_woba", 0))
            woba = float(row.get("woba", 0))
            diff = woba - xwoba
            if diff > 0.020:
                candidates.append({
                    "name": row.get("player_name", key),
                    "woba": round(woba, 3),
                    "xwoba": round(xwoba, 3),
                    "diff": round(diff, 3),
                    "pa": int(float(row.get("pa", 0))),
                })
        except (ValueError, TypeError):
            pass
    candidates.sort(key=lambda x: -x.get("diff", 0))
    candidates = candidates[:count]
    if as_json:
        return {"pos_type": pos_type, "candidates": candidates}
    # Pretty print
    label = "Batters" if pos_type == "B" else "Pitchers"
    print("Regression Risks (" + label + ") - wOBA >> xwOBA")
    print("=" * 60)
    print("  " + "Name".ljust(25) + "wOBA".rjust(7) + "xwOBA".rjust(7) + "Diff".rjust(7) + "PA".rjust(6))
    print("  " + "-" * 52)
    for c in candidates:
        print("  " + str(c.get("name", "")).ljust(25)
              + str(c.get("woba", "")).rjust(7)
              + str(c.get("xwoba", "")).rjust(7)
              + ("-" + str(c.get("diff", ""))).rjust(7)
              + str(c.get("pa", "")).rjust(6))


def cmd_reddit_buzz(args, as_json=False):
    """Hot posts from r/fantasybaseball"""
    posts = _fetch_reddit_hot()
    if not posts:
        if as_json:
            return {"posts": [], "note": "No posts fetched"}
        print("No posts fetched from Reddit")
        return

    # Categorize by flair
    categories = {}
    for post in posts:
        flair = post.get("flair") or "General"
        if flair not in categories:
            categories[flair] = []
        categories[flair].append(post)

    if as_json:
        return {"posts": posts, "categories": categories}

    print("Reddit r/fantasybaseball - Hot Posts")
    print("=" * 60)
    for flair, cat_posts in sorted(categories.items()):
        print("")
        print("[" + flair + "]")
        for post in cat_posts[:5]:
            score_str = str(post.get("score", 0))
            comments_str = str(post.get("num_comments", 0))
            print("  [" + score_str + " pts, " + comments_str + " comments] " + post.get("title", ""))


def cmd_trending(args, as_json=False):
    """Players with rising buzz on Reddit"""
    posts = _fetch_reddit_hot()
    if not posts:
        if as_json:
            return {"trending": [], "note": "No posts fetched"}
        print("No posts fetched from Reddit")
        return

    # Extract player names mentioned in high-engagement posts
    # Look for posts with above-average engagement
    avg_score = sum(p.get("score", 0) for p in posts) / len(posts) if posts else 0
    trending_posts = [p for p in posts if p.get("score", 0) > avg_score]

    # Also look at flairs that indicate player-specific discussion
    player_flairs = ["Hype", "Prospect", "Injury", "Player Discussion", "Breaking News"]
    highlighted = []
    for post in posts:
        flair = post.get("flair", "")
        if flair in player_flairs or post.get("score", 0) > avg_score * 1.5:
            highlighted.append({
                "title": post.get("title", ""),
                "score": post.get("score", 0),
                "num_comments": post.get("num_comments", 0),
                "flair": flair,
            })

    highlighted.sort(key=lambda x: -(x.get("score", 0) + x.get("num_comments", 0)))

    if as_json:
        return {"trending": highlighted[:20], "avg_score": round(avg_score, 1)}

    print("Trending Players / Topics")
    print("=" * 60)
    for item in highlighted[:20]:
        flair_str = " [" + item.get("flair", "") + "]" if item.get("flair") else ""
        print("  " + str(item.get("score", 0)).rjust(4) + " pts  "
              + str(item.get("num_comments", 0)).rjust(3) + " cmts"
              + flair_str + "  " + item.get("title", ""))


def cmd_prospect_watch(args, as_json=False):
    """Top prospects by ETA and recent transactions (call-ups)"""
    transactions = _fetch_mlb_transactions(days=14)
    if not transactions:
        if as_json:
            return {"prospects": [], "note": "No recent transactions found"}
        print("No recent transactions found")
        return

    # Filter for call-ups, option recalls, selections
    callup_keywords = ["recalled", "selected", "contract purchased", "optioned", "promoted"]
    callups = []
    for tx in transactions:
        desc_lower = tx.get("description", "").lower()
        tx_type = tx.get("type", "").lower()
        if any(kw in desc_lower or kw in tx_type for kw in callup_keywords):
            callups.append(tx)

    if as_json:
        return {"prospects": callups}

    print("Recent Call-Ups & Roster Moves")
    print("=" * 60)
    if not callups:
        print("  No recent call-ups found")
        return
    for tx in callups[:20]:
        player = tx.get("player_name", "Unknown")
        team = tx.get("team", "")
        tx_date = tx.get("date", "")
        desc = tx.get("description", "")
        print("  " + tx_date + "  " + player.ljust(25) + team)
        if desc:
            print("    " + desc[:80])


def cmd_transactions(args, as_json=False):
    """Recent fantasy-relevant MLB transactions"""
    days = 7
    player_filter = None
    for arg in (args or []):
        if str(arg).startswith("--player="):
            player_filter = str(arg).split("=", 1)[1]
        else:
            try:
                days = int(arg)
            except (ValueError, TypeError):
                # Treat non-numeric non-flag args as player filter
                if not player_filter:
                    player_filter = str(arg)

    transactions = _fetch_mlb_transactions(days=days)
    if not transactions:
        if as_json:
            return {"transactions": [], "note": "No transactions found"}
        print("No transactions found in last " + str(days) + " days")
        return

    # Filter to MLB-level teams only (exclude DSL/FCL/minor league noise)
    mlb_level = []
    for tx in transactions:
        team = tx.get("team", "")
        # Exact match only — "Boston Red Sox Prospects" is NOT "Boston Red Sox"
        if team in _MLB_TEAMS:
            mlb_level.append(tx)
    # Fallback if filter removed everything (API may use short names)
    if not mlb_level:
        mlb_level = transactions

    # Filter for fantasy-relevant transactions
    # Exclude noise transaction types first (spring training roster shuffles)
    _NOISE_TYPES = {"assigned", "reassigned", "roster move"}
    relevant_keywords = [
        "injured list", "disabled list", "recalled", "optioned",
        "designated for assignment", "released", "traded",
        "contract purchased", "activated", "transferred",
    ]
    # "signed" removed from keywords — it's a substring of "assigned"
    # Instead check for it with a word-boundary guard
    import re
    _signed_re = re.compile(r"\bsigned\b")
    _selected_re = re.compile(r"\bselected\b")
    relevant = []
    for tx in mlb_level:
        tx_type_lower = tx.get("type", "").lower()
        if tx_type_lower in _NOISE_TYPES:
            continue
        desc_lower = tx.get("description", "").lower()
        text = desc_lower + " " + tx_type_lower
        if (any(kw in text for kw in relevant_keywords)
                or _signed_re.search(text)
                or _selected_re.search(text)):
            relevant.append(tx)

    if not relevant:
        relevant = mlb_level  # Show all if keyword filter is too restrictive

    # Filter by player name if specified
    if player_filter:
        pf_lower = player_filter.lower()
        relevant = [tx for tx in relevant
                    if pf_lower in tx.get("player_name", "").lower()
                    or pf_lower in tx.get("description", "").lower()]

    if as_json:
        return {"transactions": relevant, "days": days}

    print("Fantasy-Relevant MLB Transactions (last " + str(days) + " days)")
    print("=" * 60)
    for tx in relevant[:30]:
        player = tx.get("player_name", "")
        team = tx.get("team", "")
        tx_date = tx.get("date", "")
        tx_type = tx.get("type", "")
        desc = tx.get("description", "")
        header = tx_date
        if player:
            header = header + "  " + player
        if team:
            header = header + " (" + team + ")"
        if tx_type:
            header = header + " - " + tx_type
        print("  " + header)
        if desc:
            print("    " + desc[:100])


def cmd_statcast_compare(args, as_json=False):
    """Compare a player's current Statcast profile vs 30/60 days ago"""
    if not args:
        if as_json:
            return {"error": "Usage: statcast-compare <player_name> [days]"}
        print("Usage: intel.py statcast-compare <player_name> [days]")
        return

    # Parse args: last arg might be days number
    days = 30
    name_parts = list(args)
    if len(name_parts) > 1:
        try:
            maybe_days = int(name_parts[-1])
            if maybe_days in (30, 60, 90, 120):
                days = maybe_days
                name_parts = name_parts[:-1]
        except (ValueError, TypeError):
            pass
    name = " ".join(name_parts)
    norm = _normalize_name(name)

    try:
        db = _get_intel_db()

        # Get current values (most recent snapshot)
        current_rows = db.execute(
            "SELECT metric, value, date FROM statcast_snapshots "
            "WHERE player_name = ? ORDER BY date DESC",
            (norm,)
        ).fetchall()

        if not current_rows:
            # No snapshots yet — try to build one now
            mlb_id = get_mlb_id(name)
            statcast = _build_statcast(name, mlb_id)
            if statcast and not statcast.get("error"):
                # Re-query after snapshot was saved
                current_rows = db.execute(
                    "SELECT metric, value, date FROM statcast_snapshots "
                    "WHERE player_name = ? ORDER BY date DESC",
                    (norm,)
                ).fetchall()

        if not current_rows:
            msg = "No Statcast data available for " + name
            if as_json:
                return {"error": msg}
            print(msg)
            return

        # Build current dict (most recent date per metric)
        current = {}
        current_date = None
        for metric, value, snap_date in current_rows:
            if metric not in current:
                current[metric] = value
                if current_date is None:
                    current_date = snap_date

        # Get historical values (closest to N days ago)
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        hist_rows = db.execute(
            "SELECT metric, value, date FROM statcast_snapshots "
            "WHERE player_name = ? AND date <= ? ORDER BY date DESC",
            (norm, cutoff)
        ).fetchall()

        historical = {}
        hist_date = None
        for metric, value, snap_date in hist_rows:
            if metric not in historical:
                historical[metric] = value
                if hist_date is None:
                    hist_date = snap_date

        # Build comparison
        comparisons = []
        all_metrics = sorted(set(list(current.keys()) + list(historical.keys())))
        for metric in all_metrics:
            curr_val = current.get(metric)
            hist_val = historical.get(metric)
            delta = None
            direction = None
            if curr_val is not None and hist_val is not None:
                delta = round(curr_val - hist_val, 3)
                if delta > 0:
                    direction = "up"
                elif delta < 0:
                    direction = "down"
                else:
                    direction = "same"
            comparisons.append({
                "metric": metric,
                "current": round(curr_val, 3) if curr_val is not None else None,
                "historical": round(hist_val, 3) if hist_val is not None else None,
                "delta": delta,
                "direction": direction,
            })

        result = {
            "name": name,
            "days": days,
            "current_date": current_date,
            "historical_date": hist_date,
            "comparisons": comparisons,
        }

        if not historical:
            result["note"] = "No historical data from " + str(days) + " days ago (snapshots start when player is first queried)"

        if as_json:
            return result

        # CLI output
        print("Statcast Comparison: " + name)
        print("Current (" + str(current_date or "today") + ") vs "
              + str(days) + " days ago (" + str(hist_date or "N/A") + ")")
        print("=" * 55)
        print("  " + "Metric".ljust(18) + "Current".rjust(10) + "Historical".rjust(12) + "Delta".rjust(10))
        print("  " + "-" * 50)
        for comp in comparisons:
            curr_str = str(comp.get("current", "N/A"))
            hist_str = str(comp.get("historical", "N/A"))
            delta_str = ""
            if comp.get("delta") is not None:
                arrow = ""
                if comp.get("direction") == "up":
                    arrow = "^"
                elif comp.get("direction") == "down":
                    arrow = "v"
                delta_str = arrow + str(comp.get("delta"))
            print("  " + comp.get("metric", "").ljust(18) + curr_str.rjust(10)
                  + hist_str.rjust(12) + delta_str.rjust(10))

    except Exception as e:
        if as_json:
            return {"error": str(e)}
        print("Error: " + str(e))


def _save_bat_tracking_snapshot(name, bt_metrics):
    """Save bat tracking metrics as a daily snapshot for historical comparison."""
    if not bt_metrics:
        return
    try:
        db = _get_intel_db()
        today_str = date.today().isoformat()
        norm = _normalize_name(name)
        db.execute(
            "INSERT OR REPLACE INTO bat_tracking_snapshots "
            "(player_name, date, bat_speed, swing_length, "
            "fast_swing_rate, squared_up_rate, blast_pct) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (norm, today_str,
             bt_metrics.get("bat_speed"),
             bt_metrics.get("swing_length"),
             bt_metrics.get("fast_swing_rate"),
             bt_metrics.get("squared_up_rate"),
             bt_metrics.get("blast_pct"))
        )
    except Exception as e:
        print("Warning: _save_bat_tracking_snapshot failed for " + str(name) + ": " + str(e))


def cmd_bat_tracking_breakouts(args, as_json=False):
    """Hitters with improving bat speed / swing quality (bat tracking breakout detector)"""
    count = 20
    if args:
        try:
            count = int(args[0])
        except (ValueError, TypeError):
            pass

    # Fetch bat tracking data
    bt_data = _fetch_savant_bat_tracking()
    if not bt_data:
        if as_json:
            return {"error": "Could not fetch bat tracking data"}
        print("Could not fetch bat tracking data")
        return

    # Collect league-wide fast_swing_rate values for top-15% threshold
    all_fast_swing = (
        _collect_column_values(bt_data, "hard_swing_rate")
        or _collect_column_values(bt_data, "fast_swing_rate")
    )
    fast_swing_p85 = None
    if all_fast_swing:
        sorted_fs = sorted(all_fast_swing)
        p85_idx = int(len(sorted_fs) * 0.85)
        if p85_idx < len(sorted_fs):
            fast_swing_p85 = sorted_fs[p85_idx]

    today_str = date.today().isoformat()
    cutoff = (date.today() - timedelta(days=30)).isoformat()
    db = _get_intel_db()

    candidates = []
    for key, row in bt_data.items():
        if _is_savant_meta_key(key):
            continue
        try:
            player_name = row.get("name", row.get("player_name", row.get("last_name, first_name", key)))
            bt_metrics = _extract_bat_tracking_metrics(row)
            bat_speed = bt_metrics.get("bat_speed")
            fast_swing = bt_metrics.get("fast_swing_rate")
            squared_up = bt_metrics.get("squared_up_rate")
            blast_pct = bt_metrics.get("blast_pct")

            # Save snapshot
            _save_bat_tracking_snapshot(player_name, bt_metrics)

            # Query historical snapshot (30+ days ago)
            norm = _normalize_name(player_name)
            try:
                cursor = db.execute(
                    "SELECT date, bat_speed, swing_length, fast_swing_rate, "
                    "squared_up_rate, blast_pct FROM bat_tracking_snapshots "
                    "WHERE player_name = ? AND date <= ? "
                    "ORDER BY date DESC LIMIT 1",
                    (norm, cutoff)
                )
                hist_row = cursor.fetchone()
            except Exception:
                hist_row = None

            # Compute deltas vs historical
            bat_speed_gain = None
            squared_up_gain = None
            blast_pct_gain = None
            hist_date = None
            if hist_row:
                hist_date = hist_row[0]
                hist_bat_speed = hist_row[1]
                hist_squared_up = hist_row[3]
                hist_blast = hist_row[4]
                if bat_speed is not None and hist_bat_speed is not None:
                    bat_speed_gain = round(bat_speed - hist_bat_speed, 1)
                if squared_up is not None and hist_squared_up is not None:
                    squared_up_gain = round(squared_up - hist_squared_up, 1)
                if blast_pct is not None and hist_blast is not None:
                    blast_pct_gain = round(blast_pct - hist_blast, 1)

            # Check breakout signals
            signals = []
            breakout_score = 0.0

            # Signal 1: bat speed gain >= 1.5 mph
            if bat_speed_gain is not None and bat_speed_gain >= 1.5:
                signals.append({"metric": "bat_speed", "detail": "+" + str(bat_speed_gain) + " mph"})
                breakout_score += bat_speed_gain * 2.0

            # Signal 2: fast-swing rate in top 15% of league
            if fast_swing is not None and fast_swing_p85 is not None and fast_swing >= fast_swing_p85:
                fs_display = round(fast_swing * 100, 1) if fast_swing < 1 else round(fast_swing, 1)
                signals.append({"metric": "fast_swing", "detail": str(fs_display) + "% (top 15%)"})
                breakout_score += 3.0

            # Signal 3: squared-up rate gain >= 3%
            if squared_up_gain is not None and squared_up_gain >= 3.0:
                signals.append({"metric": "squared_up", "detail": "+" + str(squared_up_gain) + "%"})
                breakout_score += squared_up_gain * 1.5

            # Signal 4: blast_pct gain >= 2%
            if blast_pct_gain is not None and blast_pct_gain >= 2.0:
                signals.append({"metric": "blast_pct", "detail": "+" + str(blast_pct_gain) + "%"})
                breakout_score += blast_pct_gain * 1.5

            if not signals:
                continue

            # Cross-reference with z-scores for buy-low signal
            z_score = None
            z_tier = None
            try:
                from valuations import get_player_zscore
                z_info = get_player_zscore(player_name)
                if z_info:
                    z_score = z_info.get("z_final")
                    z_tier = z_info.get("tier")
                    # Low z-score + improving bat tracking = strongest signal
                    if z_score is not None and z_score < 0:
                        breakout_score += abs(z_score) * 1.5
            except Exception:
                pass

            candidates.append({
                "name": player_name,
                "bat_speed": bat_speed,
                "swing_length": bt_metrics.get("swing_length"),
                "fast_swing_rate": fast_swing,
                "squared_up_rate": squared_up,
                "blast_pct": blast_pct,
                "bat_speed_gain": bat_speed_gain,
                "squared_up_gain": squared_up_gain,
                "blast_pct_gain": blast_pct_gain,
                "hist_date": hist_date,
                "signals": signals,
                "breakout_score": round(breakout_score, 1),
                "z_score": round(z_score, 2) if z_score is not None else None,
                "z_tier": z_tier,
            })
        except (ValueError, TypeError):
            continue

    # Batch commit all snapshots saved during the loop
    try:
        db.commit()
    except Exception:
        pass

    # Sort by composite breakout score descending
    candidates.sort(key=lambda x: -x.get("breakout_score", 0))
    candidates = candidates[:count]

    if as_json:
        total_scanned = sum(1 for k in bt_data if not _is_savant_meta_key(k))
        return {
            "breakouts": candidates,
            "total_hitters_scanned": total_scanned,
            "count": len(candidates),
            "fast_swing_p85_threshold": round(fast_swing_p85, 1) if fast_swing_p85 is not None else None,
            "snapshot_date": today_str,
        }

    # Pretty print
    print("Bat Tracking Breakout Detector")
    print("=" * 80)
    print("  " + "Name".ljust(22) + "BatSpd".rjust(7) + "SwLen".rjust(6)
          + "Fast%".rjust(6) + "SqUp%".rjust(6) + "Blast%".rjust(7)
          + "Score".rjust(6) + "  Flags")
    print("  " + "-" * 76)
    for c in candidates:
        bat_spd_str = str(c.get("bat_speed", "")) if c.get("bat_speed") is not None else "-"
        sw_len_str = str(c.get("swing_length", "")) if c.get("swing_length") is not None else "-"
        fast_str = str(round(c.get("fast_swing_rate", 0), 1)) if c.get("fast_swing_rate") is not None else "-"
        squp_str = str(round(c.get("squared_up_rate", 0), 1)) if c.get("squared_up_rate") is not None else "-"
        blast_str = str(round(c.get("blast_pct", 0), 1)) if c.get("blast_pct") is not None else "-"
        score_str = str(c.get("breakout_score", 0))
        flag_str = ", ".join(s.get("metric", "") + " " + s.get("detail", "") for s in c.get("signals", []))
        z_note = ""
        if c.get("z_score") is not None:
            z_note = " [z=" + str(c.get("z_score")) + "]"
        print("  " + str(c.get("name", "")).ljust(22) + bat_spd_str.rjust(7)
              + sw_len_str.rjust(6) + fast_str.rjust(6) + squp_str.rjust(6)
              + blast_str.rjust(7) + score_str.rjust(6) + "  " + flag_str + z_note)


# ============================================================
# 11c. League-Wide Pitch Mix Breakout Screener
# ============================================================

def _extract_player_display_name(row):
    """Extract a display-friendly player name from an arsenal CSV row."""
    raw = (
        row.get("last_name, first_name", "")
        or row.get("player_name", "")
        or ""
    )
    if not raw:
        return ""
    # Convert "Last, First" -> "First Last"
    if ", " in raw:
        parts = raw.split(", ", 1)
        return parts[1].strip() + " " + parts[0].strip()
    return raw.strip()


def _group_arsenal_rows_by_player(rows):
    """Group pitch arsenal rows by normalized player name.
    Returns dict of normalized_name -> {"display_name": str, "rows": [row, ...]}
    """
    grouped = {}
    for row in rows:
        raw_name = (
            row.get("last_name, first_name", "")
            or row.get("player_name", "")
            or ""
        )
        if not raw_name:
            continue
        norm = _normalize_name(raw_name)
        if norm not in grouped:
            grouped[norm] = {
                "display_name": _extract_player_display_name(row),
                "rows": [],
            }
        grouped[norm]["rows"].append(row)
    return grouped


def _score_breakout_signal(changes, current_arsenal):
    """Score a pitcher's breakout signal strength from their arsenal changes.

    Scoring:
    - Usage shift: abs(diff) / 10 points per change (e.g. 15% shift = 1.5 pts)
    - Velocity change: abs(diff) points per change (e.g. 2.1 mph = 2.1 pts)
    - New pitch added: 3.0 points flat
    - Dropped pitch: 1.0 point flat
    - Effectiveness bonus: +1.5 if whiff_rate improved on changed pitch
    - Run value bonus: +1.0 if run_value decreased (improved) on changed pitch
    """
    score = 0.0
    for chg in changes:
        change_type = chg.get("change_type", "")
        pt = chg.get("pitch_type", "")

        if change_type == "new_pitch":
            score += 3.0
        elif change_type == "dropped_pitch":
            score += 1.0
        elif change_type == "usage_increase" or change_type == "usage_decrease":
            diff = abs(_safe_float(chg.get("diff"), 0))
            score += diff / 10.0
        elif change_type == "velocity":
            diff = abs(_safe_float(chg.get("diff"), 0))
            score += diff

        # Effectiveness bonus: check whiff_rate improvement on this pitch
        cur_pitch = current_arsenal.get(pt, {})
        whiff_cur = cur_pitch.get("whiff_rate")
        whiff_hist = _safe_float(chg.get("old_whiff"))
        if whiff_cur is not None and whiff_hist is not None:
            if whiff_cur > whiff_hist:
                score += 1.5

        # Run value bonus (lower = better for pitchers)
        run_val = cur_pitch.get("run_value")
        run_val_hist = _safe_float(chg.get("old_run_value"))
        if run_val is not None and run_val_hist is not None:
            if run_val < run_val_hist:
                score += 1.0

    return round(score, 1)


def cmd_pitch_mix_breakouts(args, as_json=False):
    """League-wide pitch mix breakout screener -- find pitchers with significant arsenal changes"""
    try:
        # Parse args: optional count (default 20)
        count = 20
        if args:
            try:
                count = int(args[0])
            except (ValueError, TypeError):
                pass

        # 1. Fetch all arsenal rows
        rows = _fetch_pitch_arsenal_rows()
        if not rows:
            if as_json:
                return {"error": "No pitch arsenal data available"}
            print("No pitch arsenal data available")
            return

        # 2. Group rows by player
        grouped = _group_arsenal_rows_by_player(rows)
        total_pitchers = len(grouped)

        # 3. Get SQLite DB
        db = _get_intel_db()
        today_str = date.today().isoformat()
        cutoff = (date.today() - timedelta(days=30)).isoformat()

        # 4. Scan each pitcher for changes
        breakout_list = []

        for norm_name, player_info in grouped.items():
            try:
                display_name = player_info.get("display_name", norm_name)
                player_rows = player_info.get("rows", [])

                # 4a. Build current arsenal and save snapshots
                current = {}
                for row in player_rows:
                    pitch_type = row.get("pitch_type", "")
                    if not pitch_type:
                        continue
                    usage = _safe_float(row.get("pitch_usage"))
                    velo = _safe_float(row.get("pitch_velocity", row.get("velocity")))
                    spin = _safe_float(row.get("spin_rate"))
                    whiff = _safe_float(row.get("whiff_percent", row.get("whiff_pct")))
                    run_val = _safe_float(row.get("run_value"))

                    current[pitch_type] = {
                        "pitch_name": row.get("pitch_name", pitch_type),
                        "usage_pct": usage,
                        "velocity": velo,
                        "spin_rate": spin,
                        "whiff_rate": whiff,
                        "run_value": run_val,
                    }

                    # Save snapshot
                    try:
                        db.execute(
                            "INSERT OR REPLACE INTO arsenal_snapshots "
                            "(player_name, date, pitch_type, usage_pct, velocity, "
                            "spin_rate, whiff_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (norm_name, today_str, pitch_type,
                             usage, velo, spin, whiff)
                        )
                    except Exception as e:
                        print("Warning: arsenal snapshot save failed: " + str(e))

                # 4b. Query historical snapshots (30+ days ago)
                try:
                    cursor = db.execute(
                        "SELECT date, pitch_type, usage_pct, velocity, spin_rate, "
                        "whiff_rate FROM arsenal_snapshots "
                        "WHERE player_name = ? AND date <= ? "
                        "ORDER BY date DESC",
                        (norm_name, cutoff)
                    )
                    hist_rows = cursor.fetchall()
                except Exception:
                    hist_rows = []

                # 4c. If no history, skip
                if not hist_rows:
                    continue

                # 4d. Build historical arsenal from the most recent old snapshot date
                hist_date = hist_rows[0][0]
                historical = {}
                for h_row in hist_rows:
                    if h_row[0] != hist_date:
                        break
                    h_pitch_type = h_row[1]
                    historical[h_pitch_type] = {
                        "usage_pct": h_row[2],
                        "velocity": h_row[3],
                        "spin_rate": h_row[4],
                        "whiff_rate": h_row[5],
                    }

                # 4e. Compare current vs historical -- stricter thresholds for league scan
                changes = []
                all_pitch_types = set(list(current.keys()) + list(historical.keys()))

                for pt in sorted(all_pitch_types):
                    cur = current.get(pt)
                    hist = historical.get(pt)

                    if cur and not hist:
                        changes.append({
                            "pitch_type": pt,
                            "pitch_name": cur.get("pitch_name", pt),
                            "change_type": "new_pitch",
                            "detail": "New pitch added to arsenal",
                        })
                        continue

                    if hist and not cur:
                        changes.append({
                            "pitch_type": pt,
                            "change_type": "dropped_pitch",
                            "detail": "Pitch dropped from arsenal",
                        })
                        continue

                    # Both exist -- check for significant changes
                    pitch_name = cur.get("pitch_name", pt)

                    # Velocity change >= 1.5 mph (stricter for league scan)
                    cur_velo = cur.get("velocity")
                    hist_velo = hist.get("velocity")
                    if cur_velo is not None and hist_velo is not None:
                        velo_diff = round(cur_velo - hist_velo, 1)
                        if abs(velo_diff) >= 1.5:
                            direction = "gained" if velo_diff > 0 else "lost"
                            changes.append({
                                "pitch_type": pt,
                                "pitch_name": pitch_name,
                                "change_type": "velocity",
                                "detail": (direction + " " + str(abs(velo_diff))
                                           + " mph (" + str(hist_velo) + " -> "
                                           + str(cur_velo) + ")"),
                                "old_value": hist_velo,
                                "new_value": cur_velo,
                                "diff": velo_diff,
                                "old_whiff": hist.get("whiff_rate"),
                                "old_run_value": None,
                            })

                    # Usage shift >= 10% (stricter for league scan)
                    cur_usage = cur.get("usage_pct")
                    hist_usage = hist.get("usage_pct")
                    if cur_usage is not None and hist_usage is not None:
                        usage_diff = round(cur_usage - hist_usage, 1)
                        if abs(usage_diff) >= 10.0:
                            if usage_diff > 0:
                                change_type = "usage_increase"
                                direction = "increased"
                            else:
                                change_type = "usage_decrease"
                                direction = "decreased"
                            changes.append({
                                "pitch_type": pt,
                                "pitch_name": pitch_name,
                                "change_type": change_type,
                                "detail": ("usage " + direction + " "
                                           + str(abs(usage_diff)) + "% ("
                                           + str(hist_usage) + "% -> "
                                           + str(cur_usage) + "%)"),
                                "old_value": hist_usage,
                                "new_value": cur_usage,
                                "diff": usage_diff,
                                "old_whiff": hist.get("whiff_rate"),
                                "old_run_value": None,
                            })

                if not changes:
                    continue

                # 5. Score breakout signal strength
                signal_score = _score_breakout_signal(changes, current)

                # 6. Cross-reference with z-scores
                z_score_val = None
                try:
                    from valuations import get_player_zscore
                    z_info = get_player_zscore(display_name)
                    if z_info:
                        z_score_val = z_info.get("z_final")
                except Exception:
                    pass

                breakout_list.append({
                    "name": display_name,
                    "changes": changes,
                    "signal_score": signal_score,
                    "z_score": z_score_val,
                    "historical_date": hist_date,
                })

            except Exception as e:
                print("Warning: pitch mix scan failed for " + str(norm_name) + ": " + str(e))
                continue

        # Commit all snapshots
        try:
            db.commit()
        except Exception as e:
            print("Warning: snapshot commit failed: " + str(e))

        # 7. Sort by signal score descending, return top N
        breakout_list.sort(key=lambda x: -(x.get("signal_score", 0)))
        top_breakouts = breakout_list[:count]

        result = {
            "breakouts": top_breakouts,
            "total_pitchers_scanned": total_pitchers,
            "pitchers_with_changes": len(breakout_list),
        }

        if as_json:
            return result

        # CLI output: pretty table
        print("Pitch Mix Breakout Screener")
        print("=" * 80)
        print("Scanned " + str(total_pitchers) + " pitchers, "
              + str(len(breakout_list)) + " with significant changes")
        print("")
        print("  " + "Name".ljust(22) + "Score".rjust(6) + "  "
              + "Z".rjust(6) + "  " + "Changes")
        print("  " + "-" * 74)

        for entry in top_breakouts:
            name_str = str(entry.get("name", ""))[:21]
            score_str = str(entry.get("signal_score", 0))
            z_val = entry.get("z_score")
            if z_val is not None:
                z_str = str(round(z_val, 1))
            else:
                z_str = "N/A"

            # Build compact changes summary
            change_parts = []
            for chg in entry.get("changes", []):
                pt = chg.get("pitch_type", "")
                ct = chg.get("change_type", "")
                if ct == "new_pitch":
                    change_parts.append(pt + ":NEW")
                elif ct == "dropped_pitch":
                    change_parts.append(pt + ":DROP")
                elif ct == "velocity":
                    diff = chg.get("diff", 0)
                    sign = "+" if diff > 0 else ""
                    change_parts.append(pt + ":" + sign + str(diff) + "mph")
                elif ct in ("usage_increase", "usage_decrease"):
                    diff = chg.get("diff", 0)
                    sign = "+" if diff > 0 else ""
                    change_parts.append(pt + ":" + sign + str(diff) + "%")
            changes_str = ", ".join(change_parts)

            print("  " + name_str.ljust(22) + score_str.rjust(6) + "  "
                  + z_str.rjust(6) + "  " + changes_str)

        if top_breakouts:
            hist_date_show = top_breakouts[0].get("historical_date", "N/A")
            print("")
            print("  Compared vs snapshots from: " + str(hist_date_show))

    except Exception as e:
        if as_json:
            return {"error": "Pitch mix breakout scan failed: " + str(e)}
        print("Error: Pitch mix breakout scan failed: " + str(e))


# ============================================================
# 12. COMMANDS dict + CLI dispatch
# ============================================================

COMMANDS = {
    "player": cmd_player_report,
    "breakouts": cmd_breakouts,
    "busts": cmd_busts,
    "reddit": cmd_reddit_buzz,
    "trending": cmd_trending,
    "prospects": cmd_prospect_watch,
    "transactions": cmd_transactions,
    "statcast-compare": cmd_statcast_compare,
    "bat-tracking-breakouts": cmd_bat_tracking_breakouts,
    "pitch-mix-breakouts": cmd_pitch_mix_breakouts,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Fantasy Baseball Intelligence Module")
        print("Usage: intel.py <command> [args]")
        print("")
        print("Commands:")
        for name in COMMANDS:
            doc = COMMANDS[name].__doc__ or ""
            print("  " + name.ljust(15) + doc.strip())
        sys.exit(1)
    cmd = sys.argv[1]
    args = sys.argv[2:]
    if cmd in COMMANDS:
        COMMANDS[cmd](args)
    else:
        print("Unknown command: " + cmd)
        sys.exit(1)
