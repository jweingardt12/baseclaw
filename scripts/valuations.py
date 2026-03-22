#!/usr/bin/env python3
"""Fantasy Baseball Z-Score Valuation Engine"""

import sys
import json
import os
import csv
import io
import urllib.request
from datetime import date

import pandas as pd
import numpy as np
from mlb_id_cache import get_mlb_id
from shared import enrich_with_intel

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")

# FanGraphs projections API
FANGRAPHS_PROJ_URL = "https://www.fangraphs.com/api/projections"
PROJ_MAX_AGE = 86400  # 24 hours


def _proj_csv_path(stats_type, proj_type=None):
    """Get path for projection CSV (bat or pit), optionally per-system"""
    if proj_type:
        prefix = "projections_" + proj_type + "_"
    else:
        prefix = "projections_"
    filename = prefix + ("hitters.csv" if stats_type == "bat" else "pitchers.csv")
    return os.path.join(DATA_DIR, filename)


def _proj_csv_is_fresh(path):
    """Check if a projection CSV exists and is less than 24h old"""
    if not os.path.exists(path):
        return False
    try:
        import time as _time
        age = _time.time() - os.path.getmtime(path)
        return age < PROJ_MAX_AGE
    except Exception:
        return True


def fetch_fangraphs_projections(stats_type, proj_type="steamer"):
    """Fetch projections from FanGraphs JSON API.
    stats_type: 'bat' or 'pit'
    proj_type: 'steamer', 'zips', or 'fangraphsdc'
    Returns a pandas DataFrame or None on failure.
    """
    url = (
        FANGRAPHS_PROJ_URL
        + "?type=" + proj_type
        + "&stats=" + stats_type
        + "&pos=all&team=0&players=0"
    )
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "YahooFantasyBot/1.0",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = json.loads(response.read().decode())
        if not raw or not isinstance(raw, list):
            print("Warning: FanGraphs projections returned empty for " + stats_type)
            return None

        # Map FanGraphs JSON field names to CSV-compatible column names
        rows = []
        for entry in raw:
            row = {}
            row["Name"] = entry.get("PlayerName", entry.get("playerName", ""))
            row["Team"] = entry.get("Team", entry.get("team", ""))
            if stats_type == "bat":
                row["PA"] = entry.get("PA", 0)
                row["AB"] = entry.get("AB", 0)
                row["H"] = entry.get("H", 0)
                row["HR"] = entry.get("HR", 0)
                row["R"] = entry.get("R", 0)
                row["RBI"] = entry.get("RBI", 0)
                row["SB"] = entry.get("SB", 0)
                row["CS"] = entry.get("CS", 0)
                row["BB"] = entry.get("BB", 0)
                row["SO"] = entry.get("SO", entry.get("K", 0))
                row["AVG"] = entry.get("AVG", 0)
                row["OBP"] = entry.get("OBP", 0)
                row["SLG"] = entry.get("SLG", 0)
                row["2B"] = entry.get("2B", 0)
                row["3B"] = entry.get("3B", 0)
            else:
                row["IP"] = entry.get("IP", 0)
                row["W"] = entry.get("W", 0)
                row["L"] = entry.get("L", 0)
                row["ERA"] = entry.get("ERA", 0)
                row["WHIP"] = entry.get("WHIP", 0)
                row["K"] = entry.get("SO", entry.get("K", 0))
                row["BB"] = entry.get("BB", 0)
                row["SV"] = entry.get("SV", 0)
                row["HLD"] = entry.get("HLD", 0)
                row["GS"] = entry.get("GS", 0)
                row["G"] = entry.get("G", 0)
                row["ER"] = entry.get("ER", 0)
                row["QS"] = entry.get("QS", 0)
            rows.append(row)

        df = pd.DataFrame(rows)
        return df
    except Exception as e:
        print("Warning: FanGraphs projections fetch failed for " + stats_type + ": " + str(e))
        return None


# Per-category projection blending weights (research-backed ATC-style)
# Weights sum to 1.0 per category across steamer + zips + fangraphsdc
PROJECTION_WEIGHTS = {
    "steamer": {
        "HR": 0.30, "R": 0.35, "RBI": 0.35, "SB": 0.25, "CS": 0.30,
        "AVG": 0.35, "OBP": 0.35, "SLG": 0.35,
        "H": 0.35, "2B": 0.35, "3B": 0.30, "BB": 0.35, "SO": 0.35, "AB": 0.35, "PA": 0.35,
        "W": 0.30, "L": 0.30, "K": 0.35, "ERA": 0.30, "WHIP": 0.30,
        "SV": 0.30, "HLD": 0.30, "QS": 0.30, "IP": 0.35, "GS": 0.35, "G": 0.35, "ER": 0.30,
    },
    "zips": {
        "HR": 0.35, "R": 0.30, "RBI": 0.30, "SB": 0.35, "CS": 0.35,
        "AVG": 0.30, "OBP": 0.30, "SLG": 0.30,
        "H": 0.30, "2B": 0.30, "3B": 0.35, "BB": 0.30, "SO": 0.30, "AB": 0.30, "PA": 0.30,
        "W": 0.35, "L": 0.35, "K": 0.30, "ERA": 0.35, "WHIP": 0.35,
        "SV": 0.35, "HLD": 0.35, "QS": 0.35, "IP": 0.30, "GS": 0.30, "G": 0.30, "ER": 0.35,
    },
    "fangraphsdc": {
        "HR": 0.35, "R": 0.35, "RBI": 0.35, "SB": 0.40, "CS": 0.35,
        "AVG": 0.35, "OBP": 0.35, "SLG": 0.35,
        "H": 0.35, "2B": 0.35, "3B": 0.35, "BB": 0.35, "SO": 0.35, "AB": 0.35, "PA": 0.35,
        "W": 0.35, "L": 0.35, "K": 0.35, "ERA": 0.35, "WHIP": 0.35,
        "SV": 0.35, "HLD": 0.35, "QS": 0.35, "IP": 0.35, "GS": 0.35, "G": 0.35, "ER": 0.35,
    },
}


def fetch_consensus_projections(stats_type):
    """Fetch and blend projections from Steamer, ZiPS, and Depth Charts.
    Weights: Depth Charts 40%, Steamer 30%, ZiPS 30%.
    Returns a blended pandas DataFrame or None on failure.
    """
    systems = [
        ("fangraphsdc", 0.40),
        ("steamer", 0.30),
        ("zips", 0.30),
    ]

    dfs = {}
    for system, weight in systems:
        # Check per-system cache first
        sys_path = _proj_csv_path(stats_type, proj_type=system)
        if _proj_csv_is_fresh(sys_path):
            try:
                df = pd.read_csv(sys_path)
                df.columns = df.columns.str.strip()
                dfs[system] = (df, weight)
                continue
            except Exception:
                pass

        print("Fetching " + system + " projections for " + stats_type + "...")
        df = fetch_fangraphs_projections(stats_type, proj_type=system)
        if df is not None and len(df) > 0:
            # Cache per-system
            os.makedirs(DATA_DIR, exist_ok=True)
            df.to_csv(sys_path, index=False)
            dfs[system] = (df, weight)
        else:
            print("Warning: " + system + " projections unavailable for " + stats_type)

    if not dfs:
        return None

    # If only one system available, use it directly
    if len(dfs) == 1:
        system_name = list(dfs.keys())[0]
        return dfs[system_name][0]

    # Blend: merge on Name, weighted average of numeric columns
    system_names = list(dfs.keys())

    # Build name-indexed lookup for each system
    system_lookups = {}
    for system, (df, weight) in dfs.items():
        lookup = {}
        for _, row in df.iterrows():
            name = str(row.get("Name", "")).strip().lower()
            if name:
                lookup[name] = row
        system_lookups[system] = (lookup, weight)

    # Re-normalize weights to sum to 1.0
    total_weight = sum(w for _, w in system_lookups.values())

    blended_rows = []
    # Iterate over all players from all systems
    all_names = set()
    for system, (lookup, weight) in system_lookups.items():
        all_names.update(lookup.keys())

    for name_lower in all_names:
        # Collect rows from each system
        rows_and_weights = []
        for system, (lookup, weight) in system_lookups.items():
            row = lookup.get(name_lower)
            if row is not None:
                rows_and_weights.append((row, weight / total_weight, system))

        if not rows_and_weights:
            continue

        # Use first available as template
        template = rows_and_weights[0][0].copy()
        blended = {}
        blended["Name"] = template.get("Name", "")
        blended["Team"] = template.get("Team", "")

        # Numeric columns to blend
        if stats_type == "bat":
            numeric_cols = ["PA", "AB", "H", "HR", "R", "RBI", "SB", "CS",
                            "BB", "SO", "AVG", "OBP", "SLG", "2B", "3B"]
        else:
            numeric_cols = ["IP", "W", "L", "ERA", "WHIP", "K", "BB",
                            "SV", "HLD", "GS", "G", "ER", "QS"]

        for col in numeric_cols:
            weighted_sum = 0
            w_sum = 0
            for row, w, sys_name in rows_and_weights:
                val = row.get(col, None)
                if val is not None:
                    try:
                        # Use per-category weight if available, otherwise flat weight
                        cat_weight = PROJECTION_WEIGHTS.get(sys_name, {}).get(col, w)
                        # Re-normalize: per-category weights may not sum to total_weight
                        weighted_sum += float(val) * cat_weight
                        w_sum += cat_weight
                    except (ValueError, TypeError):
                        pass
            if w_sum > 0:
                blended[col] = round(weighted_sum / w_sum, 3)
            else:
                blended[col] = 0

        blended_rows.append(blended)

    if not blended_rows:
        return dfs[system_names[0]][0]

    result = pd.DataFrame(blended_rows)
    return result


def ensure_projections(proj_type="consensus", force=False):
    """Ensure projection CSVs exist. Auto-fetch if missing or stale.
    proj_type: 'consensus' (default), 'steamer', 'zips', or 'fangraphsdc'
    Returns dict describing what happened for each type.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    results = {}

    for stats_type in ["bat", "pit"]:
        path = _proj_csv_path(stats_type)
        label = "hitters" if stats_type == "bat" else "pitchers"

        if not force and _proj_csv_is_fresh(path):
            results[label] = "cached"
            continue

        if proj_type == "consensus":
            print("Fetching consensus projections for " + label + "...")
            df = fetch_consensus_projections(stats_type)
        else:
            print("Fetching " + proj_type + " projections for " + label + "...")
            df = fetch_fangraphs_projections(stats_type, proj_type=proj_type)

        if df is not None and len(df) > 0:
            df.to_csv(path, index=False)
            results[label] = "fetched (" + str(len(df)) + " players)"
            print("Saved " + str(len(df)) + " " + label + " projections to " + path)
        else:
            results[label] = "failed"
            print("Could not fetch " + label + " projections")

    return results


# Default league categories (fallback when API unavailable)
DEFAULT_BATTING_CATS = ["R", "H", "HR", "RBI", "TB", "AVG", "OBP", "XBH", "NSB"]
DEFAULT_BATTING_CATS_NEGATIVE = ["K"]
DEFAULT_PITCHING_CATS = ["IP", "W", "K", "HLD", "ERA", "WHIP", "QS", "NSV"]
DEFAULT_PITCHING_CATS_NEGATIVE = ["L", "ER"]

# Module-level aliases (used by existing code)
BATTING_CATS = DEFAULT_BATTING_CATS
BATTING_CATS_NEGATIVE = DEFAULT_BATTING_CATS_NEGATIVE
PITCHING_CATS = DEFAULT_PITCHING_CATS
PITCHING_CATS_NEGATIVE = DEFAULT_PITCHING_CATS_NEGATIVE

# Ratio stats that need playing-time weighting
RATIO_BATTING = ["AVG", "OBP"]
RATIO_PITCHING = ["ERA", "WHIP"]

# Positional scarcity bonuses
# Catcher premium: conditional on league roster slots (2.0 for 2C, 1.0 for 1C, 1.5 fallback).
POS_BONUS = {"C": 1.5, "SS": 0.5, "2B": 0.3, "3B": 0.3, "RP": 0.5}


def get_catcher_premium(roster_positions=None):
    """Catcher premium based on league roster configuration.
    2C leagues get 2.0 (catchers are scarcer), 1C leagues get 1.0.
    Falls back to 1.5 when league context unavailable."""
    if roster_positions:
        c_count = sum(1 for rp in roster_positions
                      if rp.get("position") == "C")
        if c_count >= 2:
            return 2.0
        if c_count == 1:
            return 1.0
    return 1.5  # fallback when no league context


def set_catcher_premium(roster_positions=None):
    """Update POS_BONUS['C'] based on league context."""
    POS_BONUS["C"] = get_catcher_premium(roster_positions)


# Park factors (2024-2025 Baseball Savant, 1.0 = neutral)
PARK_FACTORS = {
    "COL": 1.15, "CIN": 1.08, "BOS": 1.06, "CHC": 1.04, "ARI": 1.03,
    "TEX": 1.02, "ATL": 1.02, "PHI": 1.01, "LAD": 1.01, "MIN": 1.01,
    "TOR": 1.00, "NYY": 1.00, "BAL": 1.00, "HOU": 1.00, "DET": 0.99,
    "CLE": 0.99, "WSH": 0.99, "STL": 0.98, "LAA": 0.98, "MIL": 0.98,
    "PIT": 0.97, "CHW": 0.97, "KC": 0.97, "NYM": 0.96, "OAK": 0.96,
    "SEA": 0.95, "TB": 0.94, "SD": 0.93, "SF": 0.93, "MIA": 0.92,
    # Alternate abbreviations used by projections/FanGraphs
    "KCR": 0.97, "TBR": 0.94, "SDP": 0.93, "SFG": 0.93,
    "WSN": 0.99, "ATH": 0.96, "CWS": 0.97,
}

# Map full team names to 3-letter abbreviations for park factor lookup
_TEAM_NAME_TO_ABBR = {
    "arizona diamondbacks": "ARI",
    "atlanta braves": "ATL",
    "baltimore orioles": "BAL",
    "boston red sox": "BOS",
    "chicago cubs": "CHC",
    "chicago white sox": "CHW",
    "cincinnati reds": "CIN",
    "cleveland guardians": "CLE",
    "colorado rockies": "COL",
    "detroit tigers": "DET",
    "houston astros": "HOU",
    "kansas city royals": "KC",
    "los angeles angels": "LAA",
    "los angeles dodgers": "LAD",
    "miami marlins": "MIA",
    "milwaukee brewers": "MIL",
    "minnesota twins": "MIN",
    "new york mets": "NYM",
    "new york yankees": "NYY",
    "oakland athletics": "OAK",
    "philadelphia phillies": "PHI",
    "pittsburgh pirates": "PIT",
    "san diego padres": "SD",
    "san francisco giants": "SF",
    "seattle mariners": "SEA",
    "st. louis cardinals": "STL",
    "tampa bay rays": "TB",
    "texas rangers": "TEX",
    "toronto blue jays": "TOR",
    "washington nationals": "WSH",
}

# PA/IP needed for a stat to become more predictive than projections
# Research-backed stabilization points (Russell Carleton / Tom Tango)
STAT_STABILIZATION = {
    # Hitter stats (PA needed)
    "K": 60, "SO": 60, "BB": 120, "HR": 170, "SB": 80, "CS": 80,
    "H": 200, "R": 200, "RBI": 200, "2B": 200, "3B": 200,
    "AVG": 400, "OBP": 350, "SLG": 300,
    # Pitcher stats (batters faced, approx IP * 3)
    "ERA": 600, "WHIP": 350, "W": 500, "L": 500, "QS": 400,
    "SV": 100, "HLD": 100, "ER": 400,
    # Pitcher K stabilizes faster than hitter K
    "K_pitch": 70, "IP": 200,
}
DEFAULT_STABILIZATION = 200

# Generic SGP denominators for 12-team H2H categories league
# How much of stat X = one standings point (historical averages)
GENERIC_SGP_DENOMINATORS_12 = {
    "R": 45, "H": 75, "HR": 15, "RBI": 45, "SB": 10, "CS": 8,
    "AVG": 0.008, "OBP": 0.007, "TB": 55, "XBH": 20, "NSB": 8,
    "K": 90, "W": 5, "QS": 8, "ERA": 0.30, "WHIP": 0.04,
    "IP": 45, "HLD": 10, "NSV": 5, "SV": 8,
    "L": 3, "ER": 30, "BB": 20,
}

# Minimum thresholds (filter out tiny samples)
MIN_PA = 200
MIN_IP = 30

_cached_categories = None

def load_league_categories(lg=None):
    """Load scoring categories from Yahoo API, falling back to defaults"""
    global _cached_categories
    if _cached_categories:
        return _cached_categories
    if lg is None:
        _cached_categories = {
            "batting": list(DEFAULT_BATTING_CATS),
            "batting_negative": list(DEFAULT_BATTING_CATS_NEGATIVE),
            "pitching": list(DEFAULT_PITCHING_CATS),
            "pitching_negative": list(DEFAULT_PITCHING_CATS_NEGATIVE),
        }
        return _cached_categories
    try:
        cats = lg.stat_categories()
        batting = []
        batting_neg = []
        pitching = []
        pitching_neg = []
        for cat in cats:
            name = cat.get("display_name", "")
            pos_type = cat.get("position_type", "")
            is_negative = str(cat.get("is_only_display_stat", "0")) == "1"
            if not name:
                continue
            if pos_type == "B":
                if is_negative:
                    batting_neg.append(name)
                else:
                    batting.append(name)
            elif pos_type == "P":
                if is_negative:
                    pitching_neg.append(name)
                else:
                    pitching.append(name)
        if batting or pitching:
            _cached_categories = {
                "batting": batting,
                "batting_negative": batting_neg,
                "pitching": pitching,
                "pitching_negative": pitching_neg,
            }
        else:
            _cached_categories = {
                "batting": list(DEFAULT_BATTING_CATS),
                "batting_negative": list(DEFAULT_BATTING_CATS_NEGATIVE),
                "pitching": list(DEFAULT_PITCHING_CATS),
                "pitching_negative": list(DEFAULT_PITCHING_CATS_NEGATIVE),
            }
    except Exception:
        _cached_categories = {
            "batting": list(DEFAULT_BATTING_CATS),
            "batting_negative": list(DEFAULT_BATTING_CATS_NEGATIVE),
            "pitching": list(DEFAULT_PITCHING_CATS),
            "pitching_negative": list(DEFAULT_PITCHING_CATS_NEGATIVE),
        }
    return _cached_categories


def load_hitters_csv():
    """Load FanGraphs hitter projections CSV"""
    path = os.path.join(DATA_DIR, "projections_hitters.csv")
    if not os.path.exists(path):
        return None
    df = pd.read_csv(path)
    # Normalize column names (FanGraphs sometimes has spaces)
    df.columns = df.columns.str.strip()
    return df


def load_pitchers_csv():
    """Load FanGraphs pitcher projections CSV"""
    path = os.path.join(DATA_DIR, "projections_pitchers.csv")
    if not os.path.exists(path):
        return None
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    return df


def get_park_factor(team):
    """Look up park factor for a team name or abbreviation. Returns 1.0 if unknown."""
    if not team or pd.isna(team):
        return 1.0
    cleaned = str(team).strip()
    # Try abbreviation lookup first (e.g. "COL", "BOS")
    abbr_result = PARK_FACTORS.get(cleaned.upper())
    if abbr_result is not None:
        return abbr_result
    # Try full team name lookup (e.g. "Colorado Rockies")
    mapped_abbr = _TEAM_NAME_TO_ABBR.get(cleaned.lower())
    if mapped_abbr is not None:
        return PARK_FACTORS.get(mapped_abbr, 1.0)
    return 1.0


def apply_park_factors(df, stats_type):
    """Apply park factor adjustments to a DataFrame of derived stats.
    For hitters: counting stats scaled by park factor, ratios by sqrt(factor).
    For pitchers: ERA/ER scaled by inverse factor (boost pitchers in hitter parks).
    Returns modified DataFrame (in-place).
    """
    if "Team" not in df.columns:
        return df

    pf = df["Team"].apply(get_park_factor)
    pf_sqrt = np.sqrt(pf)

    if stats_type == "bat":
        # Counting stats: divide by park factor to normalize
        for col in ["R", "HR", "RBI", "H", "TB", "XBH"]:
            if col in df.columns:
                df[col] = df[col] / pf
        # Ratio stats: modest adjustment via sqrt
        for col in ["AVG", "OBP"]:
            if col in df.columns:
                df[col] = df[col] / pf_sqrt
        # K and NSB are not park-dependent
    else:
        # Pitchers: ERA/ER benefit from hitter-friendly parks (divide by factor)
        inv_pf = 1.0 / pf
        for col in ["ERA", "ER"]:
            if col in df.columns:
                df[col] = df[col] * inv_pf
        # WHIP gets modest inverse adjustment
        inv_pf_sqrt = 1.0 / pf_sqrt
        if "WHIP" in df.columns:
            df["WHIP"] = df["WHIP"] * inv_pf_sqrt

    # Store park factor on the DataFrame for downstream use
    df["ParkFactor"] = pf

    return df


def derive_hitter_stats(df):
    """Derive league-specific stats from FanGraphs columns"""
    out = pd.DataFrame()
    out["Name"] = df["Name"]
    out["Team"] = df.get("Team", "")
    out["PA"] = df.get("PA", 0)

    # Positional info - FanGraphs may not always have this
    if "Pos" in df.columns:
        out["Pos"] = df["Pos"]
    elif "POS" in df.columns:
        out["Pos"] = df["POS"]
    else:
        out["Pos"] = ""

    out["R"] = df.get("R", 0)
    out["H"] = df.get("H", 0)
    out["HR"] = df.get("HR", 0)
    out["RBI"] = df.get("RBI", 0)
    out["AVG"] = df.get("AVG", 0)
    out["OBP"] = df.get("OBP", 0)

    # K (negative - fewer is better for batters)
    if "SO" in df.columns:
        out["K"] = df["SO"]
    elif "K" in df.columns:
        out["K"] = df["K"]
    else:
        out["K"] = 0

    # TB = H + 2B + 2*3B + 3*HR
    doubles = df.get("2B", 0)
    triples = df.get("3B", 0)
    out["TB"] = df.get("H", 0) + doubles + 2 * triples + 3 * df.get("HR", 0)

    # XBH = 2B + 3B + HR
    out["XBH"] = doubles + triples + df.get("HR", 0)

    # NSB = SB - CS
    out["NSB"] = df.get("SB", 0) - df.get("CS", 0)

    # Apply park factor adjustments before z-score computation
    out = apply_park_factors(out, "bat")

    return out


def derive_pitcher_stats(df):
    """Derive league-specific stats from FanGraphs columns"""
    out = pd.DataFrame()
    out["Name"] = df["Name"]
    out["Team"] = df.get("Team", "")
    out["IP"] = df.get("IP", 0)

    if "Pos" in df.columns:
        out["Pos"] = df["Pos"]
    elif "POS" in df.columns:
        out["Pos"] = df["POS"]
    else:
        # Guess SP vs RP from GS
        gs = df.get("GS", 0)
        g = df.get("G", 1)
        out["Pos"] = np.where(gs > g * 0.5, "SP", "RP")

    out["W"] = df.get("W", 0)
    out["K"] = df.get("K", df.get("SO", 0))
    out["HLD"] = df.get("HLD", 0)
    out["ERA"] = df.get("ERA", 0)
    out["WHIP"] = df.get("WHIP", 0)
    out["QS"] = df.get("QS", 0)
    out["NSV"] = df.get("SV", 0)

    # L (negative)
    out["L"] = df.get("L", 0)

    # ER (negative) - derive from ERA if not present
    if "ER" in df.columns:
        out["ER"] = df["ER"]
    else:
        out["ER"] = (df.get("ERA", 0) * df.get("IP", 0) / 9.0).round(0)

    # Apply park factor adjustments before z-score computation
    out = apply_park_factors(out, "pit")

    return out


def calc_zscore(series, negative=False):
    """Calculate z-scores for a stat series"""
    mean = series.mean()
    std = series.std()
    if std == 0 or pd.isna(std):
        return pd.Series(0, index=series.index)
    z = (series - mean) / std
    if negative:
        z = z * -1
    return z


def calc_ratio_zscore(stat_series, weight_series, negative=False):
    """Z-score for ratio stats using FanGraphs FVARz method.
    1. Compute raw z-score against unweighted pool mean/std
    2. Multiply raw z by player volume (PA or IP)
    3. Re-normalize those volume-weighted values across pool
    """
    mean = stat_series.mean()
    std = stat_series.std()
    if std == 0 or pd.isna(std):
        return pd.Series(0, index=stat_series.index)
    # Step 1: raw z-score
    raw_z = (stat_series - mean) / std
    if negative:
        raw_z = raw_z * -1
    # Step 2: multiply by volume
    weighted_value = raw_z * weight_series
    # Step 3: re-normalize across pool
    wv_mean = weighted_value.mean()
    wv_std = weighted_value.std()
    if wv_std == 0 or pd.isna(wv_std):
        return pd.Series(0, index=stat_series.index)
    final_z = (weighted_value - wv_mean) / wv_std
    return final_z


def compute_hitter_zscores(df):
    """Compute z-scores for all hitter categories"""
    # Filter by minimum PA
    mask = df["PA"] >= MIN_PA
    working = df[mask].copy()
    if len(working) == 0:
        return df.assign(Z_Total=0)

    z_cols = []

    # Counting stats
    for cat in BATTING_CATS:
        if cat in RATIO_BATTING:
            continue
        if cat not in working.columns:
            continue
        col = "Z_" + cat
        neg = cat in BATTING_CATS_NEGATIVE
        working[col] = calc_zscore(working[cat], negative=neg)
        z_cols.append(col)

    # Negative category
    for cat in BATTING_CATS_NEGATIVE:
        if cat not in working.columns:
            continue
        col = "Z_" + cat
        working[col] = calc_zscore(working[cat], negative=True)
        z_cols.append(col)

    # Ratio stats (weighted by PA)
    for cat in RATIO_BATTING:
        if cat not in working.columns:
            continue
        col = "Z_" + cat
        working[col] = calc_ratio_zscore(working[cat], working["PA"])
        z_cols.append(col)

    # Deduplicate z_cols (K appears in both BATTING_CATS_NEGATIVE processing)
    z_cols = list(dict.fromkeys(z_cols))

    # Sum z-scores
    working["Z_Total"] = working[z_cols].sum(axis=1)

    # Positional scarcity
    working["Z_PosAdj"] = working["Pos"].apply(get_pos_bonus)
    working["Z_Final"] = working["Z_Total"] + working["Z_PosAdj"]

    return working


def compute_pitcher_zscores(df):
    """Compute z-scores for all pitcher categories"""
    mask = df["IP"] >= MIN_IP
    working = df[mask].copy()
    if len(working) == 0:
        return df.assign(Z_Total=0)

    z_cols = []

    # Counting stats
    for cat in PITCHING_CATS:
        if cat in RATIO_PITCHING:
            continue
        if cat not in working.columns:
            continue
        col = "Z_" + cat
        working[col] = calc_zscore(working[cat])
        z_cols.append(col)

    # Negative categories
    for cat in PITCHING_CATS_NEGATIVE:
        if cat not in working.columns:
            continue
        col = "Z_" + cat
        working[col] = calc_zscore(working[cat], negative=True)
        z_cols.append(col)

    # Ratio stats (lower is better for ERA/WHIP, weighted by IP)
    for cat in RATIO_PITCHING:
        if cat not in working.columns:
            continue
        col = "Z_" + cat
        working[col] = calc_ratio_zscore(working[cat], working["IP"], negative=True)
        z_cols.append(col)

    z_cols = list(dict.fromkeys(z_cols))
    working["Z_Total"] = working[z_cols].sum(axis=1)

    # Positional scarcity
    working["Z_PosAdj"] = working["Pos"].apply(get_pos_bonus)
    working["Z_Final"] = working["Z_Total"] + working["Z_PosAdj"]

    return working


def compute_projection_disagreements(stats_type="bat", count=20):
    """Compare z-scores across projection systems to find disagreements.
    Returns list of players sorted by disagreement level (highest first).
    """
    systems = ["steamer", "zips", "fangraphsdc"]
    system_zscores = {}

    for system in systems:
        sys_path = _proj_csv_path(stats_type, proj_type=system)
        if not os.path.exists(sys_path):
            continue
        try:
            df = pd.read_csv(sys_path)
            df.columns = df.columns.str.strip()
            if stats_type == "bat":
                derived = derive_hitter_stats(df)
                scored = compute_hitter_zscores(derived)
            else:
                derived = derive_pitcher_stats(df)
                scored = compute_pitcher_zscores(derived)

            if scored is not None and "Z_Final" in scored.columns:
                lookup = {}
                for _, row in scored.iterrows():
                    name = str(row.get("Name", "")).strip()
                    if name:
                        lookup[name.lower()] = round(_safe_float(row.get("Z_Final", 0)), 2)
                system_zscores[system] = lookup
        except Exception as e:
            print("Warning: could not load " + system + " for disagreement check: " + str(e))

    if len(system_zscores) < 2:
        return []

    # Get consensus z-scores for reference
    hitters, pitchers, source = _get_loaded_data()
    consensus_df = hitters if stats_type == "bat" else pitchers
    consensus_lookup = {}
    if consensus_df is not None and "Z_Final" in consensus_df.columns:
        for _, row in consensus_df.iterrows():
            name = str(row.get("Name", "")).strip()
            if name:
                consensus_lookup[name.lower()] = {
                    "z_final": round(_safe_float(row.get("Z_Final", 0)), 2),
                    "team": str(row.get("Team", "")),
                    "pos": str(row.get("Pos", "")),
                    "name_display": name,
                }

    # Find all players in 2+ systems
    all_names = set()
    for lookup in system_zscores.values():
        all_names.update(lookup.keys())

    disagreements = []
    for name_lower in all_names:
        z_values = []
        per_system = {}
        for system in systems:
            z = system_zscores.get(system, {}).get(name_lower)
            if z is not None:
                z_values.append(z)
                per_system[system] = z

        if len(z_values) < 2:
            continue

        std_dev = float(np.std(z_values))
        z_range = max(z_values) - min(z_values)
        consensus_info = consensus_lookup.get(name_lower, {})

        if std_dev < 0.3:
            continue

        entry = {
            "name": consensus_info.get("name_display", name_lower.title()),
            "team": consensus_info.get("team", ""),
            "pos": consensus_info.get("pos", ""),
            "consensus_z": consensus_info.get("z_final", 0),
            "disagreement": round(std_dev, 2),
            "z_range": round(z_range, 2),
        }
        for system in systems:
            entry[system + "_z"] = per_system.get(system)

        # Determine disagreement level
        if std_dev >= 1.5:
            entry["level"] = "extreme"
        elif std_dev >= 1.0:
            entry["level"] = "high"
        elif std_dev >= 0.5:
            entry["level"] = "moderate"
        else:
            entry["level"] = "low"

        disagreements.append(entry)

    disagreements.sort(key=lambda x: x.get("disagreement", 0), reverse=True)
    return disagreements[:count]


def get_pos_bonus(pos_str):
    """Get positional scarcity bonus from position string"""
    if not pos_str or pd.isna(pos_str):
        return 0
    pos_str = str(pos_str)
    best = 0
    for pos, bonus in POS_BONUS.items():
        if pos in pos_str:
            best = max(best, bonus)
    return best


# --- Player Tier System ---

# Rank-based tier cutoffs (per type: hitters and pitchers separately)
# Top 15 per type = Untouchable, top 50 = Core, top 100 = Solid,
# above median = Fringe, below median = Streamable
TIER_RANK_CUTOFFS = {
    "Untouchable": 15,
    "Core": 50,
    "Solid": 100,
}
# Fringe = rank > 100 but z_final >= 0
# Streamable = z_final < 0


# Module-level cache for loaded valuations data
_loaded_cache = {"hitters": None, "pitchers": None, "source": None, "time": 0,
                 "tier_thresholds_B": None, "tier_thresholds_P": None,
                 "rank_lookup_B": None, "rank_lookup_P": None}
_LOAD_CACHE_TTL = 300  # 5 minutes


def _compute_tier_thresholds(df):
    """Compute z-score cutoffs for each tier from a sorted DataFrame.
    Returns dict of {tier: min_z_final} based on rank cutoffs.
    """
    if df is None or "Z_Final" not in df.columns or len(df) == 0:
        return {"Untouchable": 6.0, "Core": 3.0, "Solid": 1.5, "Fringe": 0.0}
    sorted_z = df["Z_Final"].dropna().sort_values(ascending=False).reset_index(drop=True)
    thresholds = {}
    for tier, rank_cutoff in TIER_RANK_CUTOFFS.items():
        idx = min(rank_cutoff - 1, len(sorted_z) - 1)
        thresholds[tier] = float(sorted_z.iloc[idx])
    thresholds["Fringe"] = 0.0
    return thresholds


def _get_tier_thresholds(player_type):
    """Get tier thresholds for a player type ('B' or 'P'), computing if needed."""
    key = "tier_thresholds_" + player_type
    if _loaded_cache.get(key) is not None:
        return _loaded_cache[key]
    # Need to load data first
    _get_loaded_data()
    return _loaded_cache.get(key, {"Untouchable": 6.0, "Core": 3.0, "Solid": 1.5, "Fringe": 0.0})


def _assign_tier(z_final, player_type="B"):
    """Assign management tier based on Z_Final score and player type.
    Uses rank-calibrated thresholds so top ~15 per type = Untouchable, etc.
    """
    if pd.isna(z_final):
        return "Streamable"
    z = float(z_final)
    thresholds = _get_tier_thresholds(player_type)
    if z >= thresholds.get("Untouchable", 6.0):
        return "Untouchable"
    if z >= thresholds.get("Core", 3.0):
        return "Core"
    if z >= thresholds.get("Solid", 1.5):
        return "Solid"
    if z >= thresholds.get("Fringe", 0.0):
        return "Fringe"
    return "Streamable"


def _build_rank_lookup(df):
    """Build a name->rank dict from a DataFrame sorted by Z_Final descending."""
    if df is None or "Z_Final" not in df.columns:
        return {}
    sorted_df = df.sort_values("Z_Final", ascending=False).reset_index(drop=True)
    lookup = {}
    for i, (_, row) in enumerate(sorted_df.iterrows(), 1):
        name_lower = str(row.get("Name", "")).strip().lower()
        if name_lower and name_lower not in lookup:
            lookup[name_lower] = i
    return lookup


def _get_loaded_data():
    """Get cached hitters/pitchers DataFrames, reloading if stale"""
    import time as _time
    now = _time.time()
    if (_loaded_cache["hitters"] is not None
            and now - _loaded_cache["time"] < _LOAD_CACHE_TTL):
        return _loaded_cache["hitters"], _loaded_cache["pitchers"], _loaded_cache["source"]
    h, p, s = load_all()
    _loaded_cache["hitters"] = h
    _loaded_cache["pitchers"] = p
    _loaded_cache["source"] = s
    _loaded_cache["time"] = now
    # Compute tier thresholds and rank lookups from actual data
    _loaded_cache["tier_thresholds_B"] = _compute_tier_thresholds(h)
    _loaded_cache["tier_thresholds_P"] = _compute_tier_thresholds(p)
    _loaded_cache["rank_lookup_B"] = _build_rank_lookup(h)
    _loaded_cache["rank_lookup_P"] = _build_rank_lookup(p)
    return h, p, s


def get_player_zscore(player_name):
    """Look up a player's z-score breakdown and tier.
    Returns dict with z_total, z_final, tier, per_category_zscores, rank, pos, type.
    Returns None if player not found.
    """
    hitters, pitchers, source = _get_loaded_data()
    results = get_player_by_name(player_name, hitters, pitchers)
    if not results:
        return None

    # Use first match
    p = results[0]
    player_type = p.get("_type", "B")
    z_final = _safe_float(p.get("Z_Final", 0))
    z_total = _safe_float(p.get("Z_Total", 0))

    # Per-category z-scores
    per_cat = {}
    for k, v in p.items():
        if k.startswith("Z_") and k not in ("Z_Total", "Z_Final", "Z_PosAdj"):
            cat_name = k.replace("Z_", "")
            per_cat[cat_name] = round(_safe_float(v), 2)

    # Look up rank from pre-computed cache (O(1) instead of O(n log n))
    name_lower = str(p.get("Name", "")).strip().lower()
    rank_key = "rank_lookup_" + player_type
    rank_lookup = _loaded_cache.get(rank_key, {})
    rank = rank_lookup.get(name_lower, 0) if rank_lookup else 0

    return {
        "name": str(p.get("Name", "")),
        "team": str(p.get("Team", "")),
        "pos": str(p.get("Pos", "")),
        "type": player_type,
        "z_total": round(z_total, 2),
        "z_final": round(z_final, 2),
        "z_pos_adj": round(_safe_float(p.get("Z_PosAdj", 0)), 2),
        "tier": _assign_tier(z_final, player_type),
        "per_category_zscores": per_cat,
        "rank": rank,
    }


def get_player_tier(player_name):
    """Convenience: return just the tier string for a player name.
    Returns 'Streamable' if player not found.
    """
    info = get_player_zscore(player_name)
    if info is None:
        return "Streamable"
    return info.get("tier", "Streamable")


def get_zscore_for_players(player_names):
    """Batch lookup z-scores for multiple players.
    Returns dict mapping player_name -> zscore_info (or None).
    """
    result = {}
    for name in player_names:
        result[name] = get_player_zscore(name)
    return result


# --- Category Impact Modeling ---

def project_category_impact(add_players, drop_players, league_standings=None):
    """Project how adding/dropping players changes category contributions.

    add_players: list of player name strings to add
    drop_players: list of player name strings to drop
    league_standings: optional dict of {category: {team_values: [...], my_value: X, my_rank: N}}

    Returns dict with per-category z-score impact and net assessment.
    """
    add_zscores = []
    drop_zscores = []

    for name in add_players:
        info = get_player_zscore(name)
        if info:
            add_zscores.append(info)

    for name in drop_players:
        info = get_player_zscore(name)
        if info:
            drop_zscores.append(info)

    # Calculate per-category net impact
    category_impact = {}

    # Collect all category names from both adds and drops
    all_cats = set()
    for info in add_zscores + drop_zscores:
        for cat in info.get("per_category_zscores", {}).keys():
            all_cats.add(cat)

    for cat in sorted(all_cats):
        add_total = sum(
            info.get("per_category_zscores", {}).get(cat, 0)
            for info in add_zscores
        )
        drop_total = sum(
            info.get("per_category_zscores", {}).get(cat, 0)
            for info in drop_zscores
        )
        delta = round(add_total - drop_total, 2)
        category_impact[cat] = {
            "add_z": round(add_total, 2),
            "drop_z": round(drop_total, 2),
            "delta": delta,
            "direction": "improve" if delta > 0 else ("decline" if delta < 0 else "neutral"),
        }

    # Overall z-score change
    total_add = sum(info.get("z_final", 0) for info in add_zscores)
    total_drop = sum(info.get("z_final", 0) for info in drop_zscores)
    net_z = round(total_add - total_drop, 2)

    # Summary
    improving = [cat for cat, v in category_impact.items() if v.get("delta", 0) > 0.1]
    declining = [cat for cat, v in category_impact.items() if v.get("delta", 0) < -0.1]

    return {
        "add_players": [{
            "name": info.get("name", ""),
            "z_final": info.get("z_final", 0),
            "tier": info.get("tier", "Unknown"),
        } for info in add_zscores],
        "drop_players": [{
            "name": info.get("name", ""),
            "z_final": info.get("z_final", 0),
            "tier": info.get("tier", "Unknown"),
        } for info in drop_zscores],
        "category_impact": category_impact,
        "net_z_change": net_z,
        "improving_categories": improving,
        "declining_categories": declining,
        "assessment": "positive" if net_z > 0.5 else ("negative" if net_z < -0.5 else "neutral"),
    }


# --- Live stats blending ---

def load_live_stats():
    """Load current-season live stats via pybaseball.
    Returns (hitters_df, pitchers_df) or (None, None) if unavailable.
    """
    try:
        from pybaseball import batting_stats, pitching_stats
        current_year = date.today().year
        h_df = batting_stats(current_year, qual=1)
        p_df = pitching_stats(current_year, qual=1)
        if h_df is not None and len(h_df) > 0:
            h_df.columns = h_df.columns.str.strip()
        else:
            h_df = None
        if p_df is not None and len(p_df) > 0:
            p_df.columns = p_df.columns.str.strip()
        else:
            p_df = None
        return h_df, p_df
    except Exception as e:
        print("Warning: live stats fetch failed: " + str(e))
        return None, None


def get_projection_weight(season_start_date=None):
    """Return weight for preseason projections vs actual stats.
    Date-based decay: early season trusts projections, late season trusts actuals.
    """
    if season_start_date is None:
        season_start_date = date(date.today().year, 3, 27)
    today = date.today()
    days_into_season = max(0, (today - season_start_date).days)
    if days_into_season <= 14:
        return 0.95
    elif days_into_season <= 42:
        return 0.80
    elif days_into_season <= 84:
        return 0.55
    elif days_into_season <= 126:
        return 0.35
    else:
        return 0.20


def get_stat_blend_weight(stat_name, sample_size, stat_type="bat", date_weight=None):
    """Return projection weight for a specific stat based on sample size.
    Uses per-metric stabilization points. K-rate stabilizes at 60 PA,
    BABIP/AVG needs 400+ PA. Returns projection_weight (1.0 = all projections).
    Pass date_weight to avoid recomputing get_projection_weight() per call.
    """
    lookup_key = stat_name
    if stat_type == "pit" and stat_name in ("K", "SO"):
        lookup_key = "K_pitch"
    stabilization = STAT_STABILIZATION.get(lookup_key,
                    STAT_STABILIZATION.get(stat_name.upper(), DEFAULT_STABILIZATION))
    reliability = min(sample_size / stabilization, 1.0) if stabilization > 0 else 0
    if date_weight is None:
        date_weight = get_projection_weight()
    stat_proj_weight = max(1.0 - reliability, date_weight * 0.5)
    return stat_proj_weight


def blend_projections_and_actual(proj_df, actual_df, stat_type="bat"):
    """Blend projection data with actual in-season stats.
    Weight: actual_weight = min(games_played / 80, 0.7)
    Counting stats: weighted rate-based blending
    Ratio stats: weighted by PA/IP
    """
    if proj_df is None or actual_df is None or len(actual_df) == 0:
        return proj_df

    # Cache date-based weight once for entire blend pass
    _date_weight = get_projection_weight()

    # Build lookup from actual stats by name
    actual_by_name = {}
    for _, row in actual_df.iterrows():
        name = str(row.get("Name", "")).strip()
        if name:
            actual_by_name[name.lower()] = row

    blended_rows = []
    for _, proj_row in proj_df.iterrows():
        proj_name = str(proj_row.get("Name", "")).strip().lower()
        actual_row = actual_by_name.get(proj_name)

        if actual_row is None:
            blended_rows.append(proj_row)
            continue

        blended = proj_row.copy()

        if stat_type == "bat":
            actual_pa = float(actual_row.get("PA", 0))
            proj_pa = float(proj_row.get("PA", 0))

            if actual_pa > 0 and proj_pa > 0:
                # Counting stats: per-stat blend weights based on stabilization
                counting = ["R", "H", "HR", "RBI", "SB", "CS", "2B", "3B"]
                for stat in counting:
                    stat_proj_w = get_stat_blend_weight(stat, actual_pa, "bat", _date_weight)
                    stat_actual_w = 1.0 - stat_proj_w
                    a_val = float(actual_row.get(stat, actual_row.get("SO" if stat == "K" else stat, 0)))
                    p_val = float(proj_row.get(stat, 0))
                    a_rate = a_val / actual_pa if actual_pa > 0 else 0
                    p_rate = p_val / proj_pa if proj_pa > 0 else 0
                    blended_rate = (a_rate * stat_actual_w) + (p_rate * stat_proj_w)
                    blended[stat] = round(blended_rate * proj_pa)

                # SO/K with per-stat weight
                stat_proj_w = get_stat_blend_weight("K", actual_pa, "bat", _date_weight)
                stat_actual_w = 1.0 - stat_proj_w
                a_so = float(actual_row.get("SO", actual_row.get("K", 0)))
                p_so = float(proj_row.get("SO", proj_row.get("K", 0)))
                a_rate = a_so / actual_pa if actual_pa > 0 else 0
                p_rate = p_so / proj_pa if proj_pa > 0 else 0
                blended_rate = (a_rate * stat_actual_w) + (p_rate * stat_proj_w)
                if "SO" in proj_row.index:
                    blended["SO"] = round(blended_rate * proj_pa)
                if "K" in proj_row.index:
                    blended["K"] = round(blended_rate * proj_pa)

                # Ratio stats: per-stat weights, weighted by PA
                for stat in ["AVG", "OBP", "SLG"]:
                    stat_proj_w = get_stat_blend_weight(stat, actual_pa, "bat", _date_weight)
                    stat_actual_w = 1.0 - stat_proj_w
                    a_val = float(actual_row.get(stat, 0))
                    p_val = float(proj_row.get(stat, 0))
                    total_pa = actual_pa + proj_pa
                    if total_pa > 0:
                        blended[stat] = round(
                            (a_val * actual_pa * stat_actual_w + p_val * proj_pa * stat_proj_w)
                            / (actual_pa * stat_actual_w + proj_pa * stat_proj_w), 3
                        )

                # BB with per-stat weight
                stat_proj_w = get_stat_blend_weight("BB", actual_pa, "bat", _date_weight)
                stat_actual_w = 1.0 - stat_proj_w
                a_bb = float(actual_row.get("BB", 0))
                p_bb = float(proj_row.get("BB", 0))
                a_rate = a_bb / actual_pa if actual_pa > 0 else 0
                p_rate = p_bb / proj_pa if proj_pa > 0 else 0
                blended_rate = (a_rate * stat_actual_w) + (p_rate * stat_proj_w)
                blended["BB"] = round(blended_rate * proj_pa)

        else:
            # Pitching: per-stat blend weights using batters faced (IP * 3)
            actual_ip = float(actual_row.get("IP", 0))
            proj_ip = float(proj_row.get("IP", 0))
            actual_bf = actual_ip * 3  # approximate batters faced

            if actual_ip > 0 and proj_ip > 0:
                # Counting stats per IP with per-stat weights
                counting = ["W", "L", "K", "BB", "SV", "HLD", "ER", "QS"]
                for stat in counting:
                    stat_proj_w = get_stat_blend_weight(stat, actual_bf, "pit", _date_weight)
                    stat_actual_w = 1.0 - stat_proj_w
                    a_val = float(actual_row.get(stat, actual_row.get("SO" if stat == "K" else stat, 0)))
                    p_val = float(proj_row.get(stat, 0))
                    a_rate = a_val / actual_ip if actual_ip > 0 else 0
                    p_rate = p_val / proj_ip if proj_ip > 0 else 0
                    blended_rate = (a_rate * stat_actual_w) + (p_rate * stat_proj_w)
                    blended[stat] = round(blended_rate * proj_ip)

                # Ratio stats: per-stat weights, weighted by IP
                for stat in ["ERA", "WHIP"]:
                    stat_proj_w = get_stat_blend_weight(stat, actual_bf, "pit", _date_weight)
                    stat_actual_w = 1.0 - stat_proj_w
                    a_val = float(actual_row.get(stat, 0))
                    p_val = float(proj_row.get(stat, 0))
                    total_ip = actual_ip + proj_ip
                    if total_ip > 0:
                        blended[stat] = round(
                            (a_val * actual_ip * stat_actual_w + p_val * proj_ip * stat_proj_w)
                            / (actual_ip * stat_actual_w + proj_ip * stat_proj_w), 3
                        )

        blended_rows.append(blended)

    return pd.DataFrame(blended_rows)


# --- Fallback: load from JSON rankings ---

def load_from_json():
    """Load player data from hand-entered JSON rankings as fallback"""
    path = os.path.join(DATA_DIR, "player-rankings-2026.json")
    if not os.path.exists(path):
        return None, None

    with open(path, "r") as f:
        data = json.load(f)

    hitters = []
    for tier_key, tier_list in data.get("hitters_by_tier", {}).items():
        if not isinstance(tier_list, list):
            continue
        for p in tier_list:
            if "name" not in p or "value" not in p:
                continue
            hitters.append({
                "Name": p["name"],
                "Team": p.get("team", ""),
                "Pos": "",
                "Value": p["value"],
                "OBP": p.get("obp", 0),
                "K_pct": p.get("k_pct", 0),
            })

    pitchers = []
    for tier_key, tier_list in data.get("pitchers_by_tier", {}).items():
        if not isinstance(tier_list, list):
            continue
        for p in tier_list:
            if "name" not in p:
                continue
            pos = "RP" if tier_key in ("holds_specialists", "closers") else "SP"
            pitchers.append({
                "Name": p["name"],
                "Team": p.get("team", ""),
                "Pos": pos,
                "Value": p.get("value", 50),
                "ERA": p.get("era", 0),
                "WHIP": p.get("whip", 0),
                "QS": p.get("qs_proj", 0),
                "HLD": p.get("hld_proj", 0),
                "SV": p.get("sv_proj", 0),
            })

    h_df = pd.DataFrame(hitters) if hitters else None
    p_df = pd.DataFrame(pitchers) if pitchers else None

    # For JSON fallback, use the hand-entered "value" as a pseudo z-score
    if h_df is not None and len(h_df) > 0:
        mean_val = h_df["Value"].mean()
        std_val = h_df["Value"].std()
        if std_val > 0:
            h_df["Z_Total"] = (h_df["Value"] - mean_val) / std_val
        else:
            h_df["Z_Total"] = 0
        h_df["Z_PosAdj"] = h_df["Pos"].apply(get_pos_bonus)
        h_df["Z_Final"] = h_df["Z_Total"] + h_df["Z_PosAdj"]

    if p_df is not None and len(p_df) > 0:
        mean_val = p_df["Value"].mean()
        std_val = p_df["Value"].std()
        if std_val > 0:
            p_df["Z_Total"] = (p_df["Value"] - mean_val) / std_val
        else:
            p_df["Z_Total"] = 0
        p_df["Z_PosAdj"] = p_df["Pos"].apply(get_pos_bonus)
        p_df["Z_Final"] = p_df["Z_Total"] + p_df["Z_PosAdj"]

    return h_df, p_df


def load_all():
    """Load and compute valuations from best available data source.
    Priority: manual CSV (if fresh) -> auto-fetched projections -> JSON fallback
    """
    h_csv = load_hitters_csv()
    p_csv = load_pitchers_csv()

    # Auto-fetch projections if CSVs missing
    if h_csv is None or p_csv is None:
        try:
            ensure_projections()
            if h_csv is None:
                h_csv = load_hitters_csv()
            if p_csv is None:
                p_csv = load_pitchers_csv()
        except Exception as e:
            print("Warning: auto-fetch projections failed: " + str(e))

    hitters = None
    pitchers = None
    source = "json"

    # In-season blending: blend projections with live stats (April+)
    if h_csv is not None and date.today().month >= 4:
        try:
            live_h, live_p = load_live_stats()
            if live_h is not None and len(live_h) > 0:
                h_csv = blend_projections_and_actual(h_csv, live_h, stat_type="bat")
                source = "blended"
            if p_csv is not None and live_p is not None and len(live_p) > 0:
                p_csv = blend_projections_and_actual(p_csv, live_p, stat_type="pit")
                source = "blended"
        except Exception as e:
            print("Warning: live stats blending failed: " + str(e))

    if h_csv is not None:
        h_derived = derive_hitter_stats(h_csv)
        hitters = compute_hitter_zscores(h_derived)
        if source != "blended":
            source = "csv"

    if p_csv is not None:
        p_derived = derive_pitcher_stats(p_csv)
        pitchers = compute_pitcher_zscores(p_derived)
        if source != "blended":
            source = "csv"

    # Fallback to JSON for whichever is missing
    if hitters is None or pitchers is None:
        h_json, p_json = load_from_json()
        if hitters is None:
            hitters = h_json
            if pitchers is not None:
                source = "mixed"
        if pitchers is None:
            pitchers = p_json
            if hitters is not None and source == "csv":
                source = "mixed"

    return hitters, pitchers, source


def get_player_by_name(name, hitters, pitchers):
    """Find a player by partial name match (accent-insensitive)"""
    from shared import normalize_player_name
    norm = normalize_player_name(name)
    results = []

    if hitters is not None:
        for _, row in hitters.iterrows():
            if norm in normalize_player_name(str(row.get("Name", ""))):
                r = row.to_dict()
                r["_type"] = "B"
                results.append(r)

    if pitchers is not None:
        for _, row in pitchers.iterrows():
            if norm in normalize_player_name(str(row.get("Name", ""))):
                r = row.to_dict()
                r["_type"] = "P"
                results.append(r)

    return results


def _safe_float(val):
    """Safely convert a value to float, handling NaN"""
    if pd.isna(val):
        return 0
    return float(val)


# --- Position lookup from Yahoo ---

# Cache for Yahoo position data (populated once per process)
_yahoo_pos_cache = {}


def _fill_positions_from_yahoo(players, pos_type="B"):
    """Fill empty 'pos' fields by looking up player positions from Yahoo API.
    Uses league roster/free-agent data and caches results.
    """
    global _yahoo_pos_cache

    # Build list of names that need positions
    names_needed = {}
    for p in players:
        if not p.get("pos"):
            names_needed[p.get("name", "").lower()] = p

    if not names_needed:
        return

    # Check cache first
    for name_lower, player in list(names_needed.items()):
        if name_lower in _yahoo_pos_cache:
            player["pos"] = _yahoo_pos_cache[name_lower]
            del names_needed[name_lower]

    if not names_needed:
        return

    # Try to get positions from Yahoo league data
    try:
        from shared import get_league, get_league_context, TEAM_ID
        sc, gm, lg = get_league()

        def _elig_to_pos(elig):
            """Convert eligible_positions list to a position string, keeping Util as fallback."""
            filtered = [p for p in elig if p not in ("BN", "IL", "IL+", "DL", "DL+", "NA")]
            # Prefer non-Util positions
            non_util = [p for p in filtered if p != "Util"]
            return ",".join(non_util) if non_util else (",".join(filtered) if filtered else "")

        def _match_name(yahoo_name, needed_names):
            """Match a Yahoo player name (may have suffix like '(Batter)') to needed names.
            Returns the matching key from needed_names or None."""
            yn_lower = yahoo_name.lower().strip()
            # Exact match first
            if yn_lower in needed_names:
                return yn_lower
            # Strip parenthetical suffix: "Shohei Ohtani (Batter)" -> "shohei ohtani"
            base = yn_lower.split("(")[0].strip()
            if base and base in needed_names:
                return base
            return None

        # First: check all rostered players across the league
        try:
            all_teams = lg.teams()
            for team_key in all_teams:
                if not names_needed:
                    break
                try:
                    t = lg.to_team(team_key)
                    roster = t.roster()
                    for rp in roster:
                        match_key = _match_name(rp.get("name", ""), names_needed)
                        if match_key:
                            elig = rp.get("eligible_positions", [])
                            pos_str = _elig_to_pos(elig)
                            if pos_str:
                                # Merge positions if player appears twice (e.g. Ohtani batter + pitcher)
                                existing = names_needed[match_key].get("pos", "")
                                if existing:
                                    combined = set(existing.split(",")) | set(pos_str.split(","))
                                    pos_str = ",".join(sorted(combined))
                                names_needed[match_key]["pos"] = pos_str
                                _yahoo_pos_cache[match_key] = pos_str
                except Exception:
                    continue
            # Remove resolved entries
            names_needed = {k: v for k, v in names_needed.items() if not v.get("pos")}
        except Exception:
            pass

        # Second: check free agents for remaining names
        if names_needed:
            try:
                fa = lg.free_agents(pos_type)[:100]
                for fp in fa:
                    match_key = _match_name(fp.get("name", ""), names_needed)
                    if match_key:
                        elig = fp.get("eligible_positions", [])
                        pos_str = _elig_to_pos(elig)
                        if pos_str:
                            names_needed[match_key]["pos"] = pos_str
                            _yahoo_pos_cache[match_key] = pos_str
                            del names_needed[match_key]
            except Exception:
                pass

        # Fallback for pitchers: if pos_type is P and still empty, default to SP/RP
        if pos_type == "P":
            for name_lower, player in names_needed.items():
                player["pos"] = "P"
                _yahoo_pos_cache[name_lower] = "P"

    except Exception as e:
        print("Warning: Yahoo position lookup failed: " + str(e))


# ============================================================
# SGP (Standings Gain Points) Engine
# ============================================================

def compute_sgp_denominators(category_standings=None, num_teams=12):
    """Compute SGP denominators from league category standings.
    SGP denominator = (1st place value - last place value) / (num_teams - 1).
    Falls back to generic defaults if no standings data.

    Args:
        category_standings: dict of {category_name: [values_by_team]} or None
        num_teams: number of teams in the league
    Returns:
        dict of {category_name: denominator}
    """
    if not category_standings:
        return dict(GENERIC_SGP_DENOMINATORS_12)

    denominators = {}
    divisor = max(num_teams - 1, 1)
    for cat, values in category_standings.items():
        if not values or len(values) < 2:
            denominators[cat] = GENERIC_SGP_DENOMINATORS_12.get(cat, 1.0)
            continue
        try:
            float_vals = [float(v) for v in values if v is not None]
            if not float_vals:
                denominators[cat] = GENERIC_SGP_DENOMINATORS_12.get(cat, 1.0)
                continue
            max_val = max(float_vals)
            min_val = min(float_vals)
            denom = (max_val - min_val) / divisor
            if denom <= 0:
                denom = GENERIC_SGP_DENOMINATORS_12.get(cat, 1.0)
            denominators[cat] = round(denom, 4)
        except (ValueError, TypeError):
            denominators[cat] = GENERIC_SGP_DENOMINATORS_12.get(cat, 1.0)
    return denominators


def compute_player_sgp(player_projected_stats, denominators, negative_cats=None):
    """Convert projected stats to SGP (Standings Gain Points).
    For each category: player_stat / denominator = standings points contributed.

    Args:
        player_projected_stats: dict of {category: projected_value}
        denominators: dict of {category: sgp_denominator}
        negative_cats: set of categories where lower is better (ERA, WHIP, etc.)
    Returns:
        dict with per_category_sgp, total_sgp
    """
    if negative_cats is None:
        negative_cats = {"ERA", "WHIP", "ER", "L", "K_negative", "L_negative", "ER_negative"}

    per_cat = {}
    total = 0.0
    for cat, denom in denominators.items():
        stat_val = player_projected_stats.get(cat, 0)
        if stat_val is None or denom is None or denom == 0:
            continue
        try:
            val = float(stat_val)
            d = float(denom)
            sgp = val / d
            if cat in negative_cats:
                sgp = -sgp  # lower is better, so invert
            per_cat[cat] = round(sgp, 2)
            total += sgp
        except (ValueError, TypeError):
            continue
    return {
        "per_category_sgp": per_cat,
        "total_sgp": round(total, 2),
    }


_sgp_cache = {"denominators": None, "time": 0}
_SGP_CACHE_TTL = 3600  # 1 hour

def get_player_sgp(player_name, denominators=None):
    """Get SGP breakdown for a player. Like get_player_zscore() but for SGP.
    Uses cached denominators, falling back to generic pre-season defaults.
    """
    import time as _time
    now = _time.time()
    if denominators is None:
        if (_sgp_cache.get("denominators") is not None
                and now - _sgp_cache.get("time", 0) < _SGP_CACHE_TTL):
            denominators = _sgp_cache["denominators"]
        else:
            denominators = compute_sgp_denominators()
            _sgp_cache["denominators"] = denominators
            _sgp_cache["time"] = now

    # Get player z-info and raw projected stats
    hitters, pitchers, source = _get_loaded_data()
    player_row = get_player_by_name(player_name, hitters, pitchers)
    if player_row is None:
        return None

    z_info = get_player_zscore(player_name)
    if not z_info:
        return None

    # Extract numeric projected stats from the row
    player_stats = {}
    for col in player_row.index:
        try:
            val = float(player_row[col])
            player_stats[col] = val
        except (ValueError, TypeError):
            pass

    # Derive XBH if not present
    if "XBH" not in player_stats:
        xbh = player_stats.get("2B", 0) + player_stats.get("3B", 0) + player_stats.get("HR", 0)
        if xbh > 0:
            player_stats["XBH"] = xbh

    # Derive TB if not present
    if "TB" not in player_stats:
        tb = (player_stats.get("H", 0)
              + player_stats.get("2B", 0)
              + 2 * player_stats.get("3B", 0)
              + 3 * player_stats.get("HR", 0))
        if tb > 0:
            player_stats["TB"] = tb

    # Derive NSB if not present
    if "NSB" not in player_stats:
        nsb = player_stats.get("SB", 0) - player_stats.get("CS", 0)
        player_stats["NSB"] = nsb

    # Derive NSV if not present
    if "NSV" not in player_stats:
        nsv = player_stats.get("SV", 0) + player_stats.get("HLD", 0)
        player_stats["NSV"] = nsv

    result = compute_player_sgp(player_stats, denominators)
    result["name"] = z_info.get("name", player_name)
    result["z_final"] = z_info.get("z_final", 0)
    result["tier"] = z_info.get("tier", "Streamable")
    return result


# --- CLI Commands ---

def cmd_rankings(args, as_json=False):
    """Show top N players by z-score value"""
    pos_type = args[0].upper() if args else "B"
    count = int(args[1]) if len(args) > 1 else 25

    hitters, pitchers, source = load_all()

    if pos_type == "B":
        if hitters is None or len(hitters) == 0:
            if as_json:
                return {"source": source, "pos_type": pos_type, "players": []}
            print("Data source: " + source)
            print("No hitter data available")
            return
        df = hitters.sort_values("Z_Final", ascending=False).head(count)
    else:
        if pitchers is None or len(pitchers) == 0:
            if as_json:
                return {"source": source, "pos_type": pos_type, "players": []}
            print("Data source: " + source)
            print("No pitcher data available")
            return
        df = pitchers.sort_values("Z_Final", ascending=False).head(count)

    if as_json:
        players = []
        for i, (_, row) in enumerate(df.iterrows(), 1):
            z = _safe_float(row.get("Z_Final", 0))
            entry = {
                "rank": i,
                "name": str(row.get("Name", "?")),
                "team": str(row.get("Team", "")),
                "pos": str(row.get("Pos", "")),
                "z_score": round(z, 2),
                "mlb_id": get_mlb_id(str(row.get("Name", ""))),
            }
            pf = row.get("ParkFactor")
            if pf is not None and not pd.isna(pf):
                entry["park_factor"] = round(float(pf), 2)
            players.append(entry)

        # Fill empty positions from Yahoo player data when available
        needs_pos = [p for p in players if not p.get("pos")]
        if needs_pos:
            try:
                _fill_positions_from_yahoo(needs_pos, pos_type)
            except Exception as e:
                print("Warning: could not fill positions from Yahoo: " + str(e))

        enrich_with_intel(players)
        return {"source": source, "pos_type": pos_type, "players": players}

    print("Data source: " + source)

    if pos_type == "B":
        print("\nTop " + str(count) + " Hitters by Z-Score:")
        print("-" * 65)
        print("  #  " + "Name".ljust(25) + "Team".ljust(6) + "Pos".ljust(8) + "Z-Score")
        print("-" * 65)
        for i, (_, row) in enumerate(df.iterrows(), 1):
            name = str(row.get("Name", "?"))
            team = str(row.get("Team", ""))
            pos = str(row.get("Pos", ""))
            z = row.get("Z_Final", 0)
            print("  " + str(i).rjust(2) + ". " + name.ljust(25) + team.ljust(6) + pos.ljust(8) + "{:.2f}".format(z))
    else:
        print("\nTop " + str(count) + " Pitchers by Z-Score:")
        print("-" * 65)
        print("  #  " + "Name".ljust(25) + "Team".ljust(6) + "Pos".ljust(8) + "Z-Score")
        print("-" * 65)
        for i, (_, row) in enumerate(df.iterrows(), 1):
            name = str(row.get("Name", "?"))
            team = str(row.get("Team", ""))
            pos = str(row.get("Pos", ""))
            z = row.get("Z_Final", 0)
            print("  " + str(i).rjust(2) + ". " + name.ljust(25) + team.ljust(6) + pos.ljust(8) + "{:.2f}".format(z))


def cmd_compare(args, as_json=False):
    """Compare two players side by side"""
    if len(args) < 2:
        if as_json:
            return {"error": "Need two player names"}
        print("Usage: valuations.py compare <name1> <name2>")
        print("  Use quotes for multi-word names: compare \"Juan Soto\" \"Aaron Judge\"")
        return

    hitters, pitchers, source = load_all()

    p1 = get_player_by_name(args[0], hitters, pitchers)
    p2 = get_player_by_name(args[1], hitters, pitchers)

    if not p1:
        if as_json:
            return {"error": "Player not found: " + args[0]}
        print("Player not found: " + args[0])
        return
    if not p2:
        if as_json:
            return {"error": "Player not found: " + args[1]}
        print("Player not found: " + args[1])
        return

    a = p1[0]
    b = p2[0]

    if as_json:
        z_keys = sorted([k for k in set(list(a.keys()) + list(b.keys())) if k.startswith("Z_")])
        z_scores = {}
        for key in z_keys:
            label = key.replace("Z_", "")
            z_scores[label] = {
                "player1": round(_safe_float(a.get(key, 0)), 2),
                "player2": round(_safe_float(b.get(key, 0)), 2),
            }
        p1_info = {
            "name": str(a.get("Name", "?")),
            "type": str(a.get("_type", "?")),
            "team": str(a.get("Team", "")),
            "pos": str(a.get("Pos", "")),
        }
        p2_info = {
            "name": str(b.get("Name", "?")),
            "type": str(b.get("_type", "?")),
            "team": str(b.get("Team", "")),
            "pos": str(b.get("Pos", "")),
        }
        enrich_with_intel([p1_info, p2_info])
        return {
            "player1": p1_info,
            "player2": p2_info,
            "z_scores": z_scores,
        }

    print("\n" + "=" * 55)
    print("PLAYER COMPARISON")
    print("=" * 55)
    print("  " + "".ljust(18) + str(a.get("Name", "?")).ljust(20) + str(b.get("Name", "?")))
    print("-" * 55)
    print("  " + "Type".ljust(18) + str(a.get("_type", "?")).ljust(20) + str(b.get("_type", "?")))
    print("  " + "Team".ljust(18) + str(a.get("Team", "")).ljust(20) + str(b.get("Team", "")))
    print("  " + "Position".ljust(18) + str(a.get("Pos", "")).ljust(20) + str(b.get("Pos", "")))

    # Show z-score columns
    z_keys = sorted([k for k in set(list(a.keys()) + list(b.keys())) if k.startswith("Z_")])
    for key in z_keys:
        label = key.replace("Z_", "")
        val_a = a.get(key, 0)
        val_b = b.get(key, 0)
        if pd.isna(val_a):
            val_a = 0
        if pd.isna(val_b):
            val_b = 0
        line = "  " + label.ljust(18) + "{:.2f}".format(val_a).ljust(20) + "{:.2f}".format(val_b)
        print(line)

    print("=" * 55)


def cmd_value(args, as_json=False):
    """Show a player's z-score breakdown"""
    if not args:
        if as_json:
            return {"players": []}
        print("Usage: valuations.py value <player_name>")
        return

    name = " ".join(args)
    hitters, pitchers, source = load_all()
    results = get_player_by_name(name, hitters, pitchers)

    if not results:
        if as_json:
            return {"players": []}
        print("Player not found: " + name)
        return

    if as_json:
        players = []
        for p in results:
            skip = {"Name", "Team", "Pos", "_type", "ParkFactor"}
            raw_stats = {}
            z_scores = {}
            for k in p.keys():
                if k in skip:
                    continue
                val = p[k]
                if pd.isna(val):
                    val = 0
                if k.startswith("Z_"):
                    label = k.replace("Z_", "")
                    z_scores[label] = round(float(val), 2) if isinstance(val, (int, float)) else val
                else:
                    raw_stats[k] = round(float(val), 3) if isinstance(val, float) else val
            entry = {
                "name": str(p.get("Name", "?")),
                "type": str(p.get("_type", "?")),
                "team": str(p.get("Team", "")),
                "pos": str(p.get("Pos", "")),
                "raw_stats": raw_stats,
                "z_scores": z_scores,
            }
            pf = p.get("ParkFactor")
            if pf is not None and not pd.isna(pf):
                entry["park_factor"] = round(float(pf), 2)
            players.append(entry)
        enrich_with_intel(players)
        return {"players": players}

    for p in results:
        print("\n" + "=" * 45)
        print(str(p.get("Name", "?")) + " (" + str(p.get("_type", "?")) + ")")
        print("Team: " + str(p.get("Team", "")) + "  Pos: " + str(p.get("Pos", "")))
        print("=" * 45)

        # Show raw stats
        skip = {"Name", "Team", "Pos", "_type"}
        z_keys = []
        raw_keys = []
        for k in p.keys():
            if k in skip:
                continue
            if k.startswith("Z_"):
                z_keys.append(k)
            else:
                raw_keys.append(k)

        if raw_keys:
            print("\nRaw Stats:")
            for k in raw_keys:
                val = p[k]
                if pd.isna(val):
                    val = 0
                if isinstance(val, float):
                    print("  " + k.ljust(12) + "{:.3f}".format(val))
                else:
                    print("  " + k.ljust(12) + str(val))

        if z_keys:
            print("\nZ-Scores:")
            z_keys_sorted = sorted(z_keys)
            for k in z_keys_sorted:
                val = p[k]
                if pd.isna(val):
                    val = 0
                label = k.replace("Z_", "")
                print("  " + label.ljust(12) + "{:.2f}".format(val))

        print("-" * 45)


def cmd_import_csv(args):
    """Import FanGraphs CSV projections into the data directory"""
    if not args:
        print("Usage: valuations.py import-csv <filepath>")
        print("  The file will be auto-detected as hitters or pitchers")
        print("  based on column names (PA = hitters, IP = pitchers)")
        return

    filepath = args[0]
    if not os.path.exists(filepath):
        print("File not found: " + filepath)
        return

    # Read and detect type
    df = pd.read_csv(filepath)
    df.columns = df.columns.str.strip()

    if "PA" in df.columns and "AB" in df.columns:
        dest = os.path.join(DATA_DIR, "projections_hitters.csv")
        label = "hitters"
    elif "IP" in df.columns and ("ERA" in df.columns or "W" in df.columns):
        dest = os.path.join(DATA_DIR, "projections_pitchers.csv")
        label = "pitchers"
    else:
        print("Could not detect file type. Expected FanGraphs hitter or pitcher projections.")
        print("Columns found: " + ", ".join(df.columns[:15].tolist()))
        return

    # Ensure data dir exists
    os.makedirs(DATA_DIR, exist_ok=True)
    df.to_csv(dest, index=False)
    print("Imported " + str(len(df)) + " " + label + " to " + dest)


def cmd_generate(args):
    """Generate rankings from imported projections"""
    hitters, pitchers, source = load_all()

    if source == "json":
        print("WARNING: No CSV projections found, using JSON fallback data.")
        print("Import FanGraphs projections with: valuations.py import-csv <file>")

    print("Source: " + source)

    results = {"hitters": [], "pitchers": []}

    if hitters is not None and len(hitters) > 0:
        h_sorted = hitters.sort_values("Z_Final", ascending=False)
        print("Generated rankings for " + str(len(h_sorted)) + " hitters")
        for _, row in h_sorted.iterrows():
            results["hitters"].append({
                "name": str(row.get("Name", "")),
                "team": str(row.get("Team", "")),
                "pos": str(row.get("Pos", "")),
                "z_total": round(float(row.get("Z_Total", 0)), 2),
                "z_pos_adj": round(float(row.get("Z_PosAdj", 0)), 2),
                "z_final": round(float(row.get("Z_Final", 0)), 2),
            })

    if pitchers is not None and len(pitchers) > 0:
        p_sorted = pitchers.sort_values("Z_Final", ascending=False)
        print("Generated rankings for " + str(len(p_sorted)) + " pitchers")
        for _, row in p_sorted.iterrows():
            results["pitchers"].append({
                "name": str(row.get("Name", "")),
                "team": str(row.get("Team", "")),
                "pos": str(row.get("Pos", "")),
                "z_total": round(float(row.get("Z_Total", 0)), 2),
                "z_pos_adj": round(float(row.get("Z_PosAdj", 0)), 2),
                "z_final": round(float(row.get("Z_Final", 0)), 2),
            })

    # Save generated rankings
    out_path = os.path.join(DATA_DIR, "generated_rankings.json")
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print("Saved to " + out_path)


def _save_draft_day_rankings(hitters, pitchers):
    """Save current rankings as draft-day baseline"""
    draft_path = os.path.join(DATA_DIR, "draft_day_rankings.json")
    data = {"hitters": [], "pitchers": [], "saved_date": str(date.today())}
    if hitters is not None:
        for _, row in hitters.iterrows():
            data["hitters"].append({
                "name": str(row.get("Name", "")),
                "z_final": round(_safe_float(row.get("Z_Final", 0)), 2),
                "team": str(row.get("Team", "")),
                "pos": str(row.get("Pos", "")),
            })
    if pitchers is not None:
        for _, row in pitchers.iterrows():
            data["pitchers"].append({
                "name": str(row.get("Name", "")),
                "z_final": round(_safe_float(row.get("Z_Final", 0)), 2),
                "team": str(row.get("Team", "")),
                "pos": str(row.get("Pos", "")),
            })
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(draft_path, "w") as f:
        json.dump(data, f)


def compute_zscore_shifts(count=25):
    """Compare current z-scores to draft-day baseline. Returns biggest movers."""
    hitters, pitchers, source = _get_loaded_data()
    draft_path = os.path.join(DATA_DIR, "draft_day_rankings.json")

    if not os.path.exists(draft_path):
        _save_draft_day_rankings(hitters, pitchers)
        return {"shifts": [], "note": "Draft-day baseline saved. Run again after stats accumulate."}

    with open(draft_path) as f:
        draft_data = json.load(f)

    shifts = []
    for player_type, current_df, draft_key in [("B", hitters, "hitters"), ("P", pitchers, "pitchers")]:
        if current_df is None:
            continue
        draft_lookup = {}
        for p in draft_data.get(draft_key, []):
            draft_lookup[str(p.get("name", "")).strip().lower()] = p

        for _, row in current_df.iterrows():
            name = str(row.get("Name", "")).strip()
            draft_info = draft_lookup.get(name.lower())
            if not draft_info:
                continue
            draft_z = draft_info.get("z_final", 0)
            current_z = round(_safe_float(row.get("Z_Final", 0)), 2)
            delta = round(current_z - draft_z, 2)
            if abs(delta) >= 0.75:
                shifts.append({
                    "name": name,
                    "type": player_type,
                    "team": str(row.get("Team", "")),
                    "pos": str(row.get("Pos", "")),
                    "draft_z": draft_z,
                    "current_z": current_z,
                    "delta": delta,
                    "direction": "rising" if delta > 0 else "falling",
                })

    shifts.sort(key=lambda x: abs(x.get("delta", 0)), reverse=True)
    return {"shifts": shifts[:count], "baseline_date": draft_data.get("saved_date", "unknown")}


def cmd_zscore_shifts(args, as_json=False):
    """Show biggest z-score movers since draft day"""
    count = int(args[0]) if args else 25
    try:
        result = compute_zscore_shifts(count=count)
    except Exception as e:
        if as_json:
            return {"error": str(e)}
        print("Error computing z-score shifts: " + str(e))
        return

    if as_json:
        return result

    note = result.get("note")
    if note:
        print(note)
        return

    shifts = result.get("shifts", [])
    baseline = result.get("baseline_date", "unknown")
    print("Z-Score Shifts (baseline: " + baseline + ")")
    print("-" * 75)
    print("  #  " + "Name".ljust(25) + "Pos".ljust(8) + "Draft Z".rjust(8) + "  Now Z".rjust(8) + "  Delta".rjust(8) + "  Dir")
    print("-" * 75)
    for i, s in enumerate(shifts, 1):
        arrow = "^" if s.get("direction") == "rising" else "v"
        print(
            "  " + str(i).rjust(2) + ". "
            + str(s.get("name", "")).ljust(25)
            + str(s.get("pos", "")).ljust(8)
            + "{:.2f}".format(s.get("draft_z", 0)).rjust(8)
            + "{:.2f}".format(s.get("current_z", 0)).rjust(8)
            + "{:+.2f}".format(s.get("delta", 0)).rjust(8)
            + "  " + arrow
        )


COMMANDS = {
    "rankings": cmd_rankings,
    "compare": cmd_compare,
    "value": cmd_value,
    "import-csv": cmd_import_csv,
    "generate": cmd_generate,
    "zscore-shifts": cmd_zscore_shifts,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Fantasy Baseball Z-Score Valuation Engine")
        print("Usage: valuations.py <command> [args]")
        print("\nCommands:")
        print("  rankings [B|P] [count]      - Top players by z-score")
        print("  compare <name1> <name2>     - Compare two players")
        print("  value <name>                - Player z-score breakdown")
        print("  import-csv <filepath>       - Import FanGraphs CSV projections")
        print("  generate                    - Generate rankings from projections")
        print("  zscore-shifts [count]       - Biggest z-score movers since draft day")
        print("\nData: looks for projections_hitters.csv / projections_pitchers.csv in " + DATA_DIR)
        print("Fallback: uses player-rankings-2026.json for basic valuations")
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd in COMMANDS:
        COMMANDS[cmd](args)
    else:
        print("Unknown command: " + cmd)
