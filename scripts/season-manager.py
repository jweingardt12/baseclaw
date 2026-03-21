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
    get_league_settings,
    LEAGUE_ID, TEAM_ID, GAME_KEY, DATA_DIR,
    MLB_API, mlb_fetch, TEAM_ALIASES, normalize_team_name,
    get_trend_lookup, enrich_with_intel, enrich_with_trends,
    batch_player_news,
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


def get_schedule_for_range(start_date, end_date):
    """Get MLB schedule for a date range with probable pitchers"""
    if statsapi:
        try:
            return statsapi.schedule(start_date=start_date, end_date=end_date, hydrate="probablePitcher")
        except Exception as e:
            print("  Warning: statsapi range schedule failed: " + str(e))
    # Fallback
    try:
        data = mlb_fetch("/schedule?sportId=1&startDate=" + start_date + "&endDate=" + end_date + "&hydrate=probablePitcher")
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
    """Check if player is on injured list slot"""
    pos = get_player_position(player)
    return pos in ("IL", "IL+", "DL", "DL+")


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


def cmd_lineup_optimize(args, as_json=False):
    """Cross-reference roster with MLB schedule to find off-day players"""
    apply_changes = "--apply" in args

    if not as_json:
        print("Lineup Optimizer")
        print("=" * 50)

    sc, gm, lg, team = get_league_context()

    try:
        roster = team.roster()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching roster: " + str(e)}
        print("Error fetching roster: " + str(e))
        return

    if not roster:
        if as_json:
            return {"games_today": 0, "active_off_day": [], "bench_playing": [], "il_players": [], "suggested_swaps": [], "applied": False}
        print("Roster is empty (predraft or preseason)")
        return

    if not as_json:
        print("Fetching today's MLB schedule...")
    schedule = get_todays_schedule()
    if not schedule:
        if as_json:
            return {"games_today": 0, "active_off_day": [], "bench_playing": [], "il_players": [], "suggested_swaps": [], "applied": False}
        print("No games scheduled today (off day or could not fetch schedule)")
        return

    if not as_json:
        print("Games today: " + str(len(schedule)))
        print("")

    # Z-score tier-based lineup optimization
    from valuations import get_player_zscore

    active_off_day = []   # Players in lineup whose team is OFF
    bench_playing = []    # Bench players whose team IS playing
    il_players = []       # Players on IL
    active_playing = []   # Active players who are playing (good)
    bench_off_day = []    # Bench players on off day (fine)

    # Enrich roster with z-score tiers
    for p in roster:
        name = p.get("name", "Unknown")
        z_info = get_player_zscore(name)
        if z_info:
            p["_tier"] = z_info.get("tier", "Streamable")
            p["_z_final"] = z_info.get("z_final", 0)
        else:
            p["_tier"] = "Streamable"
            p["_z_final"] = 0

    for p in roster:
        name = p.get("name", "Unknown")
        team_name = get_player_team(p)
        status = p.get("status", "")
        pos = get_player_position(p)
        playing = team_plays_today(team_name, schedule)

        if is_il(p):
            il_players.append(p)
        elif is_bench(p):
            if playing:
                bench_playing.append(p)
            else:
                bench_off_day.append(p)
        else:
            # Active slot
            if playing:
                active_playing.append(p)
            else:
                active_off_day.append(p)

    # Build swap suggestions - tier-aware
    # Untouchable/Core players should NOT be benched just for off days
    # Only suggest swapping Solid/Fringe/Streamable tier active off-day players
    swaps = []
    if active_off_day and bench_playing:
        # Sort bench players by z-score (best first) for better swap quality
        bench_avail = sorted(bench_playing, key=lambda x: x.get("_z_final", 0), reverse=True)
        for off_player in active_off_day:
            off_pos = get_player_position(off_player)
            off_tier = off_player.get("_tier", "Streamable")
            # Find a bench player eligible for that position
            match = None
            for bp in bench_avail:
                bp_elig = bp.get("eligible_positions", [])
                if off_pos in bp_elig or "Util" == off_pos:
                    match = bp
                    break
            if match:
                bench_avail.remove(match)
                swaps.append((off_player, match))

    if as_json:
        swap_list = []
        for off_p, bench_p in swaps:
            swap_list.append({
                "bench_player": off_p.get("name", "Unknown"),
                "bench_player_tier": off_p.get("_tier", "Unknown"),
                "start_player": bench_p.get("name", "Unknown"),
                "start_player_tier": bench_p.get("_tier", "Unknown"),
                "position": get_player_position(off_p),
            })

        def _player_info_with_tier(p):
            info = _player_info(p)
            info["tier"] = p.get("_tier", "Unknown")
            info["z_score"] = round(p.get("_z_final", 0), 2)
            return info

        active_off_day_info = [_player_info_with_tier(p) for p in active_off_day]
        bench_playing_info = [_player_info_with_tier(p) for p in bench_playing]
        il_players_info = [_player_info_with_tier(p) for p in il_players]
        all_players = active_off_day_info + bench_playing_info + il_players_info
        enrich_with_intel(all_players)
        return {
            "games_today": len(schedule),
            "active_off_day": active_off_day_info,
            "bench_playing": bench_playing_info,
            "il_players": il_players_info,
            "suggested_swaps": swap_list,
            "applied": apply_changes,
        }

    # Report
    if active_off_day:
        print("PROBLEM: Active players on OFF DAY:")
        for p in active_off_day:
            name = p.get("name", "Unknown")
            pos = get_player_position(p)
            team_name = get_player_team(p)
            print("  " + pos.ljust(4) + " " + name.ljust(25) + " (" + team_name + ") - NO GAME")
    else:
        print("All active players have games today.")

    print("")

    if bench_playing:
        print("OPPORTUNITY: Bench players WITH games today:")
        for p in bench_playing:
            name = p.get("name", "Unknown")
            elig = ",".join(p.get("eligible_positions", []))
            team_name = get_player_team(p)
            print("  BN   " + name.ljust(25) + " (" + team_name + ") - eligible: " + elig)
    else:
        print("No bench players with games today.")

    print("")

    if il_players:
        print("IL Players:")
        for p in il_players:
            name = p.get("name", "Unknown")
            status = p.get("status", "")
            pos = get_player_position(p)
            print("  " + pos.ljust(4) + " " + name.ljust(25) + " [" + status + "]")
        print("")

    # Suggest swaps
    if swaps:
        print("Suggested Swaps:")
        for off_player, match in swaps:
            off_name = off_player.get("name", "Unknown")
            off_pos = get_player_position(off_player)
            match_name = match.get("name", "Unknown")
            print("  Bench " + off_name + " (" + off_pos + "), Start " + match_name)
        print("")

    if not swaps:
        print("No swaps needed - lineup looks good!")
        return

    if apply_changes:
        print("Applying roster changes...")
        try:
            # Build the new roster positions
            changes = []
            for off_player, bench_player in swaps:
                off_pos = get_player_position(off_player)
                off_key = off_player.get("player_id", "")
                bench_key = bench_player.get("player_id", "")
                # Swap: move bench player to active slot, move off-day player to bench
                changes.append({
                    "player_id": bench_key,
                    "selected_position": off_pos,
                })
                changes.append({
                    "player_id": off_key,
                    "selected_position": "BN",
                })
            # Apply via roster changes
            today_str = date.today().isoformat()
            for change in changes:
                pid = change.get("player_id", "")
                new_pos = change.get("selected_position", "")
                try:
                    team.change_positions(date.today(), [{"player_id": pid, "selected_position": new_pos}])
                except Exception as e:
                    print("  Error moving player " + str(pid) + " to " + new_pos + ": " + str(e))
            print("Roster changes applied!")
        except Exception as e:
            print("Error applying changes: " + str(e))
    else:
        print("Use --apply to execute these changes")


def _category_check_preseason(lg, as_json=False):
    """Pre-season fallback: rank teams by projected z-score per category."""
    from valuations import get_player_zscore, DEFAULT_BATTING_CATS, DEFAULT_BATTING_CATS_NEGATIVE, DEFAULT_PITCHING_CATS, DEFAULT_PITCHING_CATS_NEGATIVE

    try:
        all_cats = DEFAULT_BATTING_CATS + DEFAULT_BATTING_CATS_NEGATIVE + DEFAULT_PITCHING_CATS + DEFAULT_PITCHING_CATS_NEGATIVE
        team_cat_zscores = {}  # team_key -> {cat: total_z}

        teams = lg.teams()
        for team_key, team_data in teams.items():
            try:
                tm = lg.to_team(team_key)
                roster = tm.roster()
            except Exception:
                continue
            cat_totals = {}
            for p in roster:
                name = p.get("name", "")
                z_info = get_player_zscore(name)
                if not z_info:
                    continue
                per_cat = z_info.get("per_category_zscores", {})
                for cat in all_cats:
                    if cat in per_cat:
                        cat_totals[cat] = cat_totals.get(cat, 0) + per_cat[cat]
            team_cat_zscores[team_key] = cat_totals

        if not team_cat_zscores:
            if as_json:
                return {"week": 0, "categories": [], "strongest": [], "weakest": [], "source": "projected"}
            print("No roster data available for pre-season projections")
            return

        # Find my team
        my_key = None
        for tk in team_cat_zscores:
            if TEAM_ID in str(tk):
                my_key = tk
                break

        if not my_key:
            if as_json:
                return {"week": 0, "categories": [], "strongest": [], "weakest": [], "source": "projected"}
            print("Could not find your team in league data")
            return

        my_cats_z = team_cat_zscores[my_key]
        num_teams = len(team_cat_zscores)
        cat_ranks = {}
        lower_is_better_cats = {"ERA", "WHIP", "K"}  # K is negative for batters

        for cat in all_cats:
            my_val = my_cats_z.get(cat, 0)
            values = sorted(
                [team_cat_zscores[tk].get(cat, 0) for tk in team_cat_zscores],
                reverse=True,
            )
            rank = 1
            for v in values:
                if my_val >= v:
                    break
                rank += 1
            cat_ranks[cat] = {"value": round(my_val, 2), "rank": rank, "total": num_teams}

        sorted_cats = sorted(cat_ranks.items(), key=lambda x: x[1]["rank"])
        strong = [c for c, i in sorted_cats if i["rank"] <= 3]
        weak = [c for c, i in sorted_cats if i["rank"] >= (i["total"] - 2) and i["total"] > 3]

        if as_json:
            categories = []
            for cat, info in sorted_cats:
                strength = ""
                if info["rank"] <= 3:
                    strength = "strong"
                elif info["rank"] >= info["total"] - 2 and info["total"] > 3:
                    strength = "weak"
                categories.append({
                    "name": cat,
                    "value": info["value"],
                    "rank": info["rank"],
                    "total": info["total"],
                    "strength": strength,
                })
            return {
                "week": 0,
                "categories": categories,
                "strongest": strong,
                "weakest": weak,
                "source": "projected",
            }

        print("PRE-SEASON PROJECTED CATEGORY RANKS (z-score based)")
        print("=" * 50)
        for cat, info in sorted_cats:
            marker = ""
            if info["rank"] <= 3:
                marker = " <-- STRONG"
            elif info["rank"] >= info["total"] - 2 and info["total"] > 3:
                marker = " <-- WEAK"
            print("  " + cat.ljust(12) + " z=" + str(info["value"]).ljust(8)
                  + " rank " + str(info["rank"]) + "/" + str(info["total"]) + marker)
        print("")
        if strong:
            print("Projected strengths: " + ", ".join(strong))
        if weak:
            print("Projected weaknesses: " + ", ".join(weak))
    except Exception as e:
        if as_json:
            return {"week": 0, "categories": [], "strongest": [], "weakest": [], "error": str(e)}
        print("Error building pre-season projections: " + str(e))


def cmd_category_check(args, as_json=False):
    """Show where you rank in each stat category vs the league"""
    if not as_json:
        print("Category Check")
        print("=" * 50)

    sc, gm, lg = get_league()

    try:
        scoreboard = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching scoreboard: " + str(e)}
        print("Error fetching scoreboard: " + str(e))
        return

    if not scoreboard:
        return _category_check_preseason(lg, as_json)

    # Try to extract category data from scoreboard
    my_cats = {}
    all_teams_cats = {}

    try:
        if isinstance(scoreboard, list):
            for matchup in scoreboard:
                teams = []
                if isinstance(matchup, dict):
                    teams = matchup.get("teams", [])
                for t in teams:
                    team_key = t.get("team_key", "")
                    stats = t.get("stats", {})
                    if not stats and isinstance(t, dict):
                        for k, v in t.items():
                            if isinstance(v, dict) and "value" in v:
                                stats[k] = v.get("value", 0)
                    if team_key:
                        all_teams_cats[team_key] = stats
                    if TEAM_ID in str(team_key):
                        my_cats = stats
        elif isinstance(scoreboard, dict):
            for key, val in scoreboard.items():
                if isinstance(val, dict):
                    all_teams_cats[key] = val
    except Exception as e:
        if not as_json:
            print("Error parsing scoreboard: " + str(e))

    if not my_cats:
        # Pre-season fallback: use projected z-scores from roster
        return _category_check_preseason(lg, as_json)

    # Calculate ranks
    cat_ranks = {}
    for cat, my_val in my_cats.items():
        try:
            my_num = float(my_val)
        except (ValueError, TypeError):
            continue
        values = []
        for team_key, stats in all_teams_cats.items():
            try:
                values.append(float(stats.get(cat, 0)))
            except (ValueError, TypeError):
                pass
        lower_is_better = cat.upper() in ("ERA", "WHIP", "BB", "L")
        if lower_is_better:
            values.sort()
        else:
            values.sort(reverse=True)
        rank = 1
        for v in values:
            if lower_is_better:
                if my_num <= v:
                    break
            else:
                if my_num >= v:
                    break
            rank += 1
        cat_ranks[cat] = {"value": my_val, "rank": rank, "total": len(values)}

    if not cat_ranks:
        if as_json:
            return {"week": 0, "categories": [], "strongest": [], "weakest": []}
        print("No category rankings could be calculated")
        return

    sorted_cats = sorted(cat_ranks.items(), key=lambda x: x[1]["rank"])
    num_teams = max(c["total"] for c in cat_ranks.values()) if cat_ranks else 0
    week = lg.current_week()

    strong = [c for c, i in sorted_cats if i["rank"] <= 3]
    weak = [c for c, i in sorted_cats if i["rank"] >= (i["total"] - 2) and i["total"] > 3]

    if as_json:
        categories = []
        for cat, info in sorted_cats:
            strength = ""
            if info["rank"] <= 3:
                strength = "strong"
            elif info["rank"] >= info["total"] - 2 and info["total"] > 3:
                strength = "weak"
            categories.append({
                "name": cat,
                "value": info["value"],
                "rank": info["rank"],
                "total": info["total"],
                "strength": strength,
            })
        return {
            "week": week,
            "categories": categories,
            "strongest": strong,
            "weakest": weak,
        }

    print("Your Category Rankings (week " + str(week) + "):")
    print("")
    print("  " + "Category".ljust(12) + "Value".rjust(10) + "  Rank")
    print("  " + "-" * 35)

    for cat, info in sorted_cats:
        rank = info["rank"]
        val = info["value"]
        total = info["total"]
        marker = ""
        if rank <= 3:
            marker = " << STRONG"
        elif rank >= total - 2 and total > 3:
            marker = " << WEAK"
        line = "  " + cat.ljust(12) + str(val).rjust(10) + "  " + str(rank) + "/" + str(total) + marker
        print(line)

    # Store in DB
    try:
        db = get_db()
        for cat, info in cat_ranks.items():
            try:
                db.execute(
                    "INSERT OR REPLACE INTO category_history (week, category, value, rank) VALUES (?, ?, ?, ?)",
                    (week, cat, float(info["value"]), info["rank"])
                )
            except (ValueError, TypeError):
                pass
        db.commit()
        db.close()
    except Exception as e:
        print("  Warning: could not save category history: " + str(e))

    print("")

    if strong:
        print("Strongest: " + ", ".join(strong))
    if weak:
        print("Weakest:   " + ", ".join(weak))


def cmd_injury_report(args, as_json=False):
    """Check roster for injured/IL-eligible players"""
    if not as_json:
        print("Injury Report")
        print("=" * 50)

    sc, gm, lg, team = get_league_context()

    try:
        roster = team.roster()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching roster: " + str(e)}
        print("Error fetching roster: " + str(e))
        return

    if not roster:
        if as_json:
            return {"injured_active": [], "healthy_il": [], "injured_bench": [], "il_proper": []}
        print("Roster is empty")
        return

    # Get MLB injuries
    mlb_injuries = {}
    try:
        data = mlb_fetch("/injuries")
        for inj in data.get("injuries", []):
            player_name = inj.get("player", {}).get("fullName", "")
            if player_name:
                mlb_injuries[player_name.lower()] = {
                    "description": inj.get("description", "Unknown"),
                    "date": inj.get("date", ""),
                    "status": inj.get("status", ""),
                }
    except Exception as e:
        if not as_json:
            print("  Warning: could not fetch MLB injuries: " + str(e))

    injured_active = []   # Injured but in active roster slot (bad)
    healthy_il = []       # On IL slot but no injury status (inefficient)
    il_proper = []        # Injured and on IL (correct)
    injured_bench = []    # Injured on bench (could go to IL)

    for p in roster:
        name = p.get("name", "Unknown")
        status = p.get("status", "")
        pos = get_player_position(p)
        has_yahoo_injury = status and status not in ("", "Healthy")
        mlb_inj = mlb_injuries.get(name.lower())

        if is_il(p):
            if has_yahoo_injury or mlb_inj:
                il_proper.append(p)
            else:
                healthy_il.append(p)
        elif is_bench(p):
            if has_yahoo_injury or mlb_inj:
                injured_bench.append(p)
        else:
            # Active slot
            if has_yahoo_injury or mlb_inj:
                injured_active.append(p)

    if as_json:
        def injury_info(p):
            info = _player_info(p)
            mlb_inj = mlb_injuries.get(p.get("name", "").lower())
            if mlb_inj:
                info["injury_description"] = mlb_inj.get("description", "")
            return info

        injured_active_info = [injury_info(p) for p in injured_active]
        healthy_il_info = [injury_info(p) for p in healthy_il]
        injured_bench_info = [injury_info(p) for p in injured_bench]
        il_proper_info = [injury_info(p) for p in il_proper]
        all_players = injured_active_info + healthy_il_info + injured_bench_info + il_proper_info
        enrich_with_intel(all_players)
        return {
            "injured_active": injured_active_info,
            "healthy_il": healthy_il_info,
            "injured_bench": injured_bench_info,
            "il_proper": il_proper_info,
        }

    # Report
    if injured_active:
        print("")
        print("PROBLEM: Injured players in ACTIVE lineup:")
        for p in injured_active:
            name = p.get("name", "Unknown")
            status = p.get("status", "")
            pos = get_player_position(p)
            mlb_inj = mlb_injuries.get(name.lower())
            desc = ""
            if mlb_inj:
                desc = " - " + mlb_inj.get("description", "")
            print("  " + pos.ljust(4) + " " + name.ljust(25) + " [" + status + "]" + desc)
        print("  -> Suggest: Move to IL or bench, replace with healthy player")
    else:
        print("No injured players in active lineup.")

    if healthy_il:
        print("")
        print("INEFFICIENCY: Players on IL with no injury status:")
        for p in healthy_il:
            name = p.get("name", "Unknown")
            pos = get_player_position(p)
            print("  " + pos.ljust(4) + " " + name.ljust(25) + " - may be activatable")
        print("  -> Suggest: Activate and move to lineup/bench")

    if injured_bench:
        print("")
        print("NOTE: Injured players on bench (could free a bench spot via IL):")
        for p in injured_bench:
            name = p.get("name", "Unknown")
            status = p.get("status", "")
            mlb_inj = mlb_injuries.get(name.lower())
            desc = ""
            if mlb_inj:
                desc = " - " + mlb_inj.get("description", "")
            print("  BN   " + name.ljust(25) + " [" + status + "]" + desc)
        print("  -> Suggest: Move to IL to open a bench/roster spot")

    if il_proper:
        print("")
        print("Correctly placed on IL:")
        for p in il_proper:
            name = p.get("name", "Unknown")
            status = p.get("status", "")
            pos = get_player_position(p)
            print("  " + pos.ljust(4) + " " + name.ljust(25) + " [" + status + "]")

    if not injured_active and not healthy_il and not injured_bench:
        print("Roster looks healthy and correctly configured!")


def cmd_waiver_analyze(args, as_json=False):
    """Score free agents using z-score projections and category need"""
    pos_type = args[0] if args else "B"
    count = int(args[1]) if len(args) > 1 else 15

    if not as_json:
        print("Waiver Wire Analysis (" + ("Batters" if pos_type == "B" else "Pitchers") + ")")
        print("=" * 50)

    sc, gm, lg = get_league()

    # First, get our weak categories from the scoreboard
    try:
        scoreboard = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching scoreboard: " + str(e)}
        print("Error fetching scoreboard: " + str(e))
        return

    # Try to identify weak categories
    my_cats = {}
    all_teams_cats = {}

    try:
        if isinstance(scoreboard, list):
            for matchup in scoreboard:
                if not isinstance(matchup, dict):
                    continue
                teams = matchup.get("teams", [])
                for t in teams:
                    team_key = t.get("team_key", "")
                    stats = t.get("stats", {})
                    if team_key:
                        all_teams_cats[team_key] = stats
                    if TEAM_ID in str(team_key):
                        my_cats = stats
    except Exception:
        pass

    # Calculate weak categories
    weak_cats = []
    if my_cats and all_teams_cats:
        for cat, my_val in my_cats.items():
            try:
                my_num = float(my_val)
            except (ValueError, TypeError):
                continue
            values = []
            for team_key, stats in all_teams_cats.items():
                try:
                    values.append(float(stats.get(cat, 0)))
                except (ValueError, TypeError):
                    pass
            lower_is_better = cat.upper() in ("ERA", "WHIP", "BB", "L")
            if lower_is_better:
                values.sort()
            else:
                values.sort(reverse=True)
            rank = 1
            for v in values:
                if lower_is_better:
                    if my_num <= v:
                        break
                else:
                    if my_num >= v:
                        break
                rank += 1
            weak_cats.append((cat, rank, len(values)))

        weak_cats.sort(key=lambda x: -x[1])  # Worst rank first
        weak_cats = weak_cats[:3]

    if not as_json:
        if weak_cats:
            print("Your weakest categories:")
            for cat, rank, total in weak_cats:
                print("  " + cat.ljust(12) + " rank " + str(rank) + "/" + str(total))
            print("")
        else:
            print("Could not determine weak categories (using general analysis)")
            print("")

    # Fetch free agents
    try:
        fa = lg.free_agents(pos_type)[:count * 2]
    except Exception as e:
        if as_json:
            return {"error": "Error fetching free agents: " + str(e)}
        print("Error fetching free agents: " + str(e))
        return

    if not fa:
        if as_json:
            return {"pos_type": pos_type, "weak_categories": [], "recommendations": []}
        print("No free agents found")
        return

    # Z-score based scoring with regression awareness
    from valuations import get_player_zscore, POS_BONUS

    # Try to load regression signals
    try:
        from intel import get_regression_signal
        _has_regression = True
    except Exception:
        _has_regression = False

    weak_cat_names = [c[0] for c in weak_cats] if weak_cats else []

    # Get drop candidates from roster (respect regression buy-low protection)
    drop_candidates = []
    try:
        team = lg.to_team(TEAM_ID)
        roster = team.roster()
        for p in roster:
            if is_il(p):
                continue
            name = p.get("name", "Unknown")
            z_val, tier, _ = _player_z_summary(name)
            if tier in ("Fringe", "Streamable"):
                # Check regression signal - don't recommend dropping buy-low candidates
                reg_signal = None
                if _has_regression:
                    try:
                        reg_signal = get_regression_signal(name)
                    except Exception:
                        pass
                if reg_signal and reg_signal.get("category", "").startswith("buy"):
                    continue  # Protect buy-low candidates from being dropped
                drop_candidates.append({
                    "name": name,
                    "player_id": str(p.get("player_id", "")),
                    "tier": tier,
                    "z_score": round(z_val, 2),
                })
    except Exception:
        pass

    scored = []
    for p in fa:
        name = p.get("name", "Unknown")
        pid = p.get("player_id", "?")
        pct = p.get("percent_owned", 0)
        positions = ",".join(p.get("eligible_positions", ["?"]))
        status = p.get("status", "")

        # Z-score based scoring
        z_info = get_player_zscore(name)
        if z_info:
            z_final = z_info.get("z_final", 0)
            tier = z_info.get("tier", "Streamable")
            per_cat = z_info.get("per_category_zscores", {})

            # Base score from z-score (scaled to be comparable range)
            score = z_final * 10.0

            # Category need bonus: boost if player is strong in our weak categories
            for cat_name in weak_cat_names:
                cat_z = per_cat.get(cat_name, 0)
                if cat_z > 0:
                    score += cat_z * 5.0  # Significant bonus for helping weak cats

            # Positional scarcity bonus
            for pos_str in p.get("eligible_positions", []):
                bonus = POS_BONUS.get(pos_str, 0)
                if bonus > 0:
                    score += bonus * 3.0
        else:
            # Fallback: use ownership as rough proxy
            score = float(pct) if pct else 0
            tier = "Unknown"
            z_final = 0

        # Regression signal: boost buy-low, penalize sell-high
        reg_signal = None
        if _has_regression:
            try:
                reg_signal = get_regression_signal(name)
            except Exception:
                pass
        if reg_signal:
            cat = reg_signal.get("category", "")
            if cat.startswith("buy"):
                score += 10.0  # Buy-low candidates are undervalued
            elif cat.startswith("sell"):
                score -= 5.0   # Sell-high candidates may regress

        # Penalty for injured players
        if status and status not in ("", "Healthy"):
            score *= 0.5

        scored.append({
            "name": name,
            "pid": pid,
            "pct": pct,
            "positions": positions,
            "status": status,
            "score": score,
            "z_score": round(z_final, 2),
            "tier": tier,
            "regression": reg_signal.get("signal", "") if reg_signal else None,
        })

    # Sort by score
    scored.sort(key=lambda x: -x["score"])

    # Record ownership snapshots for trend tracking
    try:
        db = get_db()
        for p in scored:
            pid = str(p.get("pid", ""))
            pct_val = float(p.get("pct", 0)) if p.get("pct") is not None else 0
            if pid:
                db.execute(
                    "INSERT OR REPLACE INTO ownership_history (player_id, date, pct_owned) VALUES (?, date('now'), ?)",
                    (pid, pct_val)
                )
        db.commit()
        db.close()
    except Exception:
        pass

    if as_json:
        enrich_with_intel(scored, count, boost_scores=True)
        enrich_with_trends(scored, count)
        scored.sort(key=lambda x: -x.get("score", 0))
        weak_list = []
        for cat, rank, total in weak_cats:
            weak_list.append({"name": cat, "rank": rank, "total": total})
        recs = []
        for p in scored[:count]:
            recs.append({
                "name": p["name"],
                "pid": p["pid"],
                "pct": p["pct"],
                "positions": p["positions"],
                "status": p["status"],
                "score": round(p["score"], 1),
                "z_score": p.get("z_score", 0),
                "tier": p.get("tier", "Unknown"),
                "regression": p.get("regression"),
                "intel": p.get("intel"),
                "trend": p.get("trend"),
                "mlb_id": get_mlb_id(p.get("name", "")),
            })
        return {
            "pos_type": pos_type,
            "weak_categories": weak_list,
            "recommendations": recs,
            "drop_candidates": drop_candidates[:5],
        }

    print("Top " + str(count) + " Waiver Recommendations (Z-Score Based):")
    print("")
    print("  " + "Player".ljust(25) + "Pos".ljust(10) + "Z".rjust(6) + "  Tier".ljust(14) + "  Score  Status")
    print("  " + "-" * 75)

    for p in scored[:count]:
        status_str = ""
        if p["status"]:
            status_str = " [" + p["status"] + "]"
        line = ("  " + p["name"].ljust(25) + p["positions"].ljust(10)
                + str(p.get("z_score", 0)).rjust(6) + "  " + p.get("tier", "?").ljust(12)
                + "  " + str(round(p["score"], 1)).rjust(5)
                + status_str + "  (id:" + str(p["pid"]) + ")")
        print(line)

    if drop_candidates:
        print("")
        print("Drop Candidates (Fringe/Streamable tier on roster):")
        for dc in drop_candidates[:5]:
            print("  " + dc["name"].ljust(25) + " Z=" + str(dc["z_score"]) + " [" + dc["tier"] + "]")

    if weak_cat_names:
        print("")
        print("Focus: Target players strong in " + ", ".join(weak_cat_names))


def cmd_streaming(args, as_json=False):
    """Recommend streaming pitchers for a given week"""
    if not as_json:
        print("Streaming Pitcher Recommendations")
        print("=" * 50)

    sc, gm, lg = get_league()

    # Determine the week
    target_week = int(args[0]) if args else lg.current_week()
    if not as_json:
        print("Analyzing week " + str(target_week) + "...")

    # Get the week date range
    try:
        settings = lg.settings()
        start_date_str = settings.get("start_date", "")
        if start_date_str:
            season_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            # Each week is 7 days (approximate)
            week_start = season_start + timedelta(days=(target_week - 1) * 7)
            week_end = week_start + timedelta(days=6)
        else:
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
    except Exception:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

    if not as_json:
        print("Week dates: " + week_start.isoformat() + " to " + week_end.isoformat())
        print("")

    # Get schedule for the week
    schedule = get_schedule_for_range(week_start.isoformat(), week_end.isoformat())
    if not schedule:
        if as_json:
            return {"week": target_week, "team_games": [], "recommendations": []}
        print("No schedule data available for this week")
        return

    # Count games per team this week
    team_games = {}
    for game in schedule:
        away = game.get("away_name", "")
        home = game.get("home_name", "")
        if away:
            team_games[away] = team_games.get(away, 0) + 1
        if home:
            team_games[home] = team_games.get(home, 0) + 1

    if not as_json:
        # Show teams with most games (two-start pitcher candidates)
        print("Teams with most games this week:")
        sorted_teams = sorted(team_games.items(), key=lambda x: -x[1])
        for team_name, games in sorted_teams[:10]:
            marker = " ** TWO-START LIKELY" if games >= 7 else ""
            print("  " + team_name.ljust(28) + str(games) + " games" + marker)
        print("")

    # Get free agent pitchers
    try:
        fa_pitchers = lg.free_agents("P")[:40]
    except Exception as e:
        if as_json:
            return {"error": "Error fetching free agent pitchers: " + str(e)}
        print("Error fetching free agent pitchers: " + str(e))
        return

    if not fa_pitchers:
        if as_json:
            return {"week": target_week, "team_games": [], "recommendations": []}
        print("No free agent pitchers found")
        return

    # Score pitchers using z-scores + matchup quality
    from valuations import get_player_zscore

    scored = []
    for p in fa_pitchers:
        name = p.get("name", "Unknown")
        pid = p.get("player_id", "?")
        pct = p.get("percent_owned", 0)
        positions = ",".join(p.get("eligible_positions", ["?"]))
        team_name = get_player_team(p)
        status = p.get("status", "")

        # Skip injured pitchers
        if status and status not in ("", "Healthy"):
            continue

        # Only want starting pitchers
        elig = p.get("eligible_positions", [])
        if "SP" not in elig:
            continue

        # Count team games this week
        games = 0
        for tn, gc in team_games.items():
            if normalize_team_name(team_name) in normalize_team_name(tn):
                games = gc
                break
            full = TEAM_ALIASES.get(team_name, team_name)
            if normalize_team_name(full) in normalize_team_name(tn):
                games = gc
                break

        # Z-score based quality scoring
        z_info = get_player_zscore(name)
        if z_info:
            z_final = z_info.get("z_final", 0)
            tier = z_info.get("tier", "Streamable")
            per_cat = z_info.get("per_category_zscores", {})

            # Base quality from z-score
            score = z_final * 3.0

            # Statcast quality: K z-score, ERA z-score, WHIP z-score
            k_z = per_cat.get("K", 0)
            era_z = per_cat.get("ERA", 0)
            whip_z = per_cat.get("WHIP", 0)
            statcast_bonus = (k_z + era_z + whip_z) / 3.0
            score += statcast_bonus * 2.0
        else:
            # Fallback
            z_final = 0
            tier = "Unknown"
            score = float(pct) / 10.0 if pct else 0

        # Two-start bonus
        if games >= 7:
            score += 20.0
        elif games >= 6:
            score += 10.0

        scored.append({
            "name": name,
            "pid": pid,
            "pct": pct,
            "team": team_name,
            "games": games,
            "positions": positions,
            "score": score,
            "z_score": round(z_final, 2),
            "tier": tier,
        })

    scored.sort(key=lambda x: -x["score"])

    if as_json:
        enrich_with_intel(scored, 15, boost_scores=True)
        enrich_with_trends(scored, 15)
        scored.sort(key=lambda x: -x.get("score", 0))
        tg_list = []
        sorted_teams = sorted(team_games.items(), key=lambda x: -x[1])
        for tn, gc in sorted_teams[:10]:
            tg_list.append({"team": tn, "games": gc})
        recs = []
        for p in scored[:15]:
            recs.append({
                "name": p["name"],
                "player_id": p["pid"],
                "pid": p["pid"],
                "pct": p["pct"],
                "team": p["team"],
                "games": p["games"],
                "score": round(p["score"], 1),
                "z_score": p.get("z_score", 0),
                "tier": p.get("tier", "Unknown"),
                "intel": p.get("intel"),
                "trend": p.get("trend"),
                "mlb_id": get_mlb_id(p.get("name", "")),
            })
        return {
            "week": target_week,
            "team_games": tg_list,
            "recommendations": recs,
        }

    print("Top Streaming Pitcher Recommendations (Z-Score Based):")
    print("")
    print("  " + "Pitcher".ljust(25) + "Team".ljust(12) + "Z".rjust(6) + " Tier".ljust(13) + "Games".rjust(5) + "  Score")
    print("  " + "-" * 75)

    for p in scored[:15]:
        two_start = " *2S*" if p["games"] >= 7 else ""
        line = ("  " + p["name"].ljust(25) + p["team"].ljust(12)
                + str(p.get("z_score", 0)).rjust(6) + " " + p.get("tier", "?").ljust(12)
                + str(p["games"]).rjust(5)
                + "  " + str(round(p["score"], 1)).rjust(5)
                + two_start + "  (id:" + str(p["pid"]) + ")")
        print(line)

    print("")
    print("*2S* = Likely two-start pitcher (7+ team games this week)")


def cmd_trade_eval(args, as_json=False):
    """Evaluate a potential trade using z-score valuations and tier system"""
    if len(args) < 2:
        if as_json:
            return {"error": "Usage: trade-eval <give_ids> <get_ids>"}
        print("Usage: trade-eval <give_ids> <get_ids>")
        print("  IDs are comma-separated player IDs")
        print("  Example: trade-eval 12345,12346 12347,12348")
        return

    give_ids = args[0].split(",")
    get_ids = args[1].split(",")

    if not as_json:
        print("Trade Evaluation (Z-Score Based)")
        print("=" * 50)

    sc, gm, lg, team = get_league_context()

    # Fetch roster to find players we're giving
    try:
        roster = team.roster()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching roster: " + str(e)}
        print("Error fetching roster: " + str(e))
        return

    # Look up players by ID
    give_players = []
    get_players = []

    for pid in give_ids:
        pid = pid.strip()
        for p in roster:
            if str(p.get("player_id", "")) == pid:
                give_players.append(p)
                break

    # For get players, search all league rosters to resolve name + positions
    for pid in get_ids:
        pid = pid.strip()
        player_key = GAME_KEY + ".p." + pid
        found_player = None
        try:
            all_teams = lg.teams()
            for team_key in all_teams:
                try:
                    t = lg.to_team(team_key)
                    for p in t.roster():
                        if str(p.get("player_id", "")) == pid:
                            found_player = p
                            break
                except Exception:
                    continue
                if found_player:
                    break
        except Exception:
            pass
        if found_player:
            get_players.append(found_player)
        else:
            get_players.append({
                "player_id": pid,
                "player_key": player_key,
                "name": "Player " + pid,
            })

    # Z-score valuation for all players
    from valuations import get_player_zscore, POS_BONUS

    def _eval_player(p):
        """Get z-score info for a player, with fallback"""
        name = p.get("name", "Unknown")
        info = get_player_zscore(name)
        if info:
            info["z_source"] = "projections"
            return info
        # Fallback: estimate from percent_owned (legacy)
        pct = float(p.get("percent_owned", 0)) if p.get("percent_owned") else 0
        # Map 0-100% owned to roughly -1 to 6 z-score range
        z_est = (pct / 100.0) * 7.0 - 1.0
        return {
            "name": name,
            "z_final": round(z_est, 2),
            "z_total": round(z_est, 2),
            "tier": "Fringe" if z_est >= 0 else "Streamable",
            "per_category_zscores": {},
            "rank": 0,
            "pos": ",".join(p.get("eligible_positions", [])),
            "type": "B",
            "z_source": "estimated (ownership%)",
        }

    give_evals = [_eval_player(p) for p in give_players]
    get_evals = [_eval_player(p) for p in get_players]

    give_value = sum(e.get("z_final", 0) for e in give_evals)
    get_value = sum(e.get("z_final", 0) for e in get_evals)
    diff = get_value - give_value

    # Warnings
    warnings = []
    for e in give_evals:
        tier = e.get("tier", "Streamable")
        if tier == "Untouchable":
            warnings.append("WARNING: Trading away Untouchable-tier " + e.get("name", "") + " (Z=" + str(e.get("z_final", 0)) + ")")
        elif tier == "Core":
            warnings.append("CAUTION: Trading away Core-tier " + e.get("name", "") + " (Z=" + str(e.get("z_final", 0)) + ")")

    # Grade the trade based on z-score differential
    if diff > 3.0:
        grade = "Strong Accept"
    elif diff > 1.0:
        grade = "Accept"
    elif diff > -1.0:
        grade = "Fair Trade"
    elif diff > -3.0:
        grade = "Decline"
    else:
        grade = "Strong Decline"

    # Position impact
    give_positions = set()
    get_positions = set()
    for p in give_players:
        for pos in p.get("eligible_positions", []):
            give_positions.add(pos)
    for p in get_players:
        for pos in p.get("eligible_positions", []):
            get_positions.add(pos)
    losing = give_positions - get_positions
    gaining = get_positions - give_positions

    # Positional scarcity impact
    pos_warnings = []
    for pos in losing:
        bonus = POS_BONUS.get(pos, 0)
        if bonus > 0:
            pos_warnings.append("Losing scarce position: " + pos + " (scarcity bonus +" + str(bonus) + ")")

    if as_json:
        give_list = []
        for i, p in enumerate(give_players):
            e = give_evals[i] if i < len(give_evals) else {}
            give_list.append({
                "name": p.get("name", "Unknown"),
                "player_id": str(p.get("player_id", "")),
                "positions": p.get("eligible_positions", []),
                "z_score": e.get("z_final", 0),
                "z_source": e.get("z_source", "projections"),
                "tier": e.get("tier", "Streamable"),
                "per_category_zscores": e.get("per_category_zscores", {}),
                "mlb_id": get_mlb_id(p.get("name", "")),
            })
        get_list = []
        for i, p in enumerate(get_players):
            e = get_evals[i] if i < len(get_evals) else {}
            get_list.append({
                "name": p.get("name", "Unknown"),
                "player_id": str(p.get("player_id", "")),
                "positions": p.get("eligible_positions", []),
                "z_score": e.get("z_final", 0),
                "z_source": e.get("z_source", "projections"),
                "tier": e.get("tier", "Streamable"),
                "per_category_zscores": e.get("per_category_zscores", {}),
                "mlb_id": get_mlb_id(p.get("name", "")),
            })
        enrich_with_intel(give_list + get_list)
        return {
            "give_players": give_list,
            "get_players": get_list,
            "give_value": round(give_value, 2),
            "get_value": round(get_value, 2),
            "net_value": round(diff, 2),
            "grade": grade,
            "warnings": warnings + pos_warnings,
            "position_impact": {
                "losing": list(losing),
                "gaining": list(gaining),
            },
        }

    print("GIVING:")
    for i, p in enumerate(give_players):
        e = give_evals[i] if i < len(give_evals) else {}
        name = p.get("name", "Unknown")
        positions = ",".join(p.get("eligible_positions", ["?"]))
        z = e.get("z_final", 0)
        tier = e.get("tier", "?")
        print("  " + name.ljust(25) + " " + positions.ljust(12) + " Z=" + str(round(z, 2)).ljust(8) + " [" + tier + "]")

    print("")
    print("GETTING:")
    for i, p in enumerate(get_players):
        e = get_evals[i] if i < len(get_evals) else {}
        name = p.get("name", "Unknown")
        positions = ",".join(p.get("eligible_positions", ["?"]))
        z = e.get("z_final", 0)
        tier = e.get("tier", "?")
        print("  " + name.ljust(25) + " " + positions.ljust(12) + " Z=" + str(round(z, 2)).ljust(8) + " [" + tier + "]")

    print("")
    print("Total Z-Score Given:    " + str(round(give_value, 2)))
    print("Total Z-Score Received: " + str(round(get_value, 2)))
    print("Net Z-Score:            " + str(round(diff, 2)))

    print("")
    print("Trade Grade: " + grade)

    if warnings or pos_warnings:
        print("")
        for w in warnings + pos_warnings:
            print("  " + w)

    print("")
    print("Position Impact:")
    if losing:
        print("  Losing coverage at: " + ", ".join(losing))
    if gaining:
        print("  Gaining coverage at: " + ", ".join(gaining))
    if not losing and not gaining:
        print("  Position coverage unchanged")


def cmd_daily_update(args, as_json=False):
    """Run all daily checks in sequence"""
    if as_json:
        result = {}
        try:
            result["lineup"] = cmd_lineup_optimize([], as_json=True)
        except Exception as e:
            result["lineup"] = {"error": str(e)}
        try:
            result["injuries"] = cmd_injury_report([], as_json=True)
        except Exception as e:
            result["injuries"] = {"error": str(e)}
        try:
            sc, gm, lg = get_league()
            result["edit_date"] = str(lg.edit_date())
        except Exception:
            result["edit_date"] = None
        return result

    print("=" * 50)
    print("DAILY UPDATE - " + date.today().isoformat())
    print("=" * 50)
    print("")

    actions = []

    # 1. Lineup optimize (report only)
    print("[1/2] Checking lineup...")
    print("-" * 40)
    try:
        cmd_lineup_optimize([])  # No --apply
    except Exception as e:
        print("  Error in lineup check: " + str(e))
    print("")

    # 2. Injury report
    print("[2/2] Checking injuries...")
    print("-" * 40)
    try:
        cmd_injury_report([])
    except Exception as e:
        print("  Error in injury check: " + str(e))
    print("")

    print("=" * 50)
    print("Daily update complete. Review above for recommended actions.")
    print("Use individual commands to take action:")
    print("  lineup-optimize --apply    Apply lineup changes")
    print("  waiver-analyze B           Check waiver wire (batters)")
    print("  waiver-analyze P           Check waiver wire (pitchers)")
    print("  streaming                  Get streaming pitcher picks")


def cmd_category_simulate(args, as_json=False):
    """Simulate category impact of adding/dropping a player"""
    if not args:
        if as_json:
            return {"error": "Usage: category-simulate <add_name> [drop_name]"}
        print("Usage: category-simulate <add_name> [drop_name]")
        return

    add_name = args[0]
    drop_name = args[1] if len(args) > 1 else ""

    if not as_json:
        print("Category Simulator")
        print("=" * 50)
        print("Simulating: Add " + add_name)
        if drop_name:
            print("            Drop " + drop_name)
        print("")

    sc, gm, lg, team = get_league_context()

    # 1. Get current category ranks (reuse category-check logic)
    try:
        scoreboard = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching scoreboard: " + str(e)}
        print("Error fetching scoreboard: " + str(e))
        return

    my_cats = {}
    all_teams_cats = {}

    try:
        if isinstance(scoreboard, list):
            for matchup in scoreboard:
                if not isinstance(matchup, dict):
                    continue
                teams_list = matchup.get("teams", [])
                for t in teams_list:
                    team_key = t.get("team_key", "")
                    stats = t.get("stats", {})
                    if not stats and isinstance(t, dict):
                        for k, v in t.items():
                            if isinstance(v, dict) and "value" in v:
                                stats[k] = v.get("value", 0)
                    if team_key:
                        all_teams_cats[team_key] = stats
                    if TEAM_ID in str(team_key):
                        my_cats = stats
        elif isinstance(scoreboard, dict):
            for key, val in scoreboard.items():
                if isinstance(val, dict):
                    all_teams_cats[key] = val
    except Exception as e:
        if not as_json:
            print("Error parsing scoreboard: " + str(e))

    # Calculate current ranks
    cat_ranks = {}
    num_teams = 0
    for cat, my_val in my_cats.items():
        try:
            my_num = float(my_val)
        except (ValueError, TypeError):
            continue
        values = []
        for tk, stats in all_teams_cats.items():
            try:
                values.append(float(stats.get(cat, 0)))
            except (ValueError, TypeError):
                pass
        lower_is_better = cat.upper() in ("ERA", "WHIP", "BB", "L")
        if lower_is_better:
            values.sort()
        else:
            values.sort(reverse=True)
        rank = 1
        for v in values:
            if lower_is_better:
                if my_num <= v:
                    break
            else:
                if my_num >= v:
                    break
            rank += 1
        cat_ranks[cat] = {"rank": rank, "total": len(values)}
        if len(values) > num_teams:
            num_teams = len(values)

    # Preseason fallback: if no category ranks (all stats 0), use z-score projections
    if not cat_ranks:
        try:
            from valuations import project_category_impact
            impact = project_category_impact([add_name], [drop_name] if drop_name else [])
            if as_json:
                return {
                    "add_player": {"name": add_name},
                    "drop_player": {"name": drop_name} if drop_name else None,
                    "current_ranks": [],
                    "simulated_ranks": [],
                    "summary": "Preseason: using projection z-scores instead of live stats.",
                    "z_score_impact": impact,
                    "source": "projections",
                }
            # CLI output
            print("(Preseason mode: using projection z-scores)")
            print("")
            cat_impact = impact.get("category_impact", {})
            if cat_impact:
                print("  " + "Category".ljust(12) + "Add Z".rjust(8) + "Drop Z".rjust(8) + " Delta".rjust(8) + "  Direction")
                print("  " + "-" * 50)
                for cat, info in sorted(cat_impact.items()):
                    print("  " + cat.ljust(12)
                          + str(info.get("add_z", 0)).rjust(8)
                          + str(info.get("drop_z", 0)).rjust(8)
                          + str(info.get("delta", 0)).rjust(8)
                          + "  " + info.get("direction", "neutral"))
            print("")
            print("Net Z change: " + str(impact.get("net_z_change", 0)))
            print("Assessment: " + str(impact.get("assessment", "neutral")))
            return
        except Exception as e:
            if as_json:
                return {"error": "Preseason fallback failed: " + str(e)}
            print("Error in preseason fallback: " + str(e))
            return

    # 2. Search for the player being added
    add_player_info = None
    try:
        # Search free agents for the player
        for pos_type in ["B", "P"]:
            try:
                fa = lg.free_agents(pos_type)
                for p in fa:
                    if add_name.lower() in p.get("name", "").lower():
                        add_player_info = p
                        break
            except Exception:
                pass
            if add_player_info:
                break
    except Exception as e:
        if not as_json:
            print("Warning: could not search free agents: " + str(e))

    if not add_player_info:
        # Build a minimal player info from the name
        add_player_info = {"name": add_name, "eligible_positions": [], "percent_owned": 0}

    add_positions = add_player_info.get("eligible_positions", [])
    add_pct = add_player_info.get("percent_owned", 0)
    add_team = get_player_team(add_player_info)
    add_mlb_id = get_mlb_id(add_player_info.get("name", ""))

    # Determine if batter or pitcher
    pitcher_positions = {"SP", "RP", "P"}
    is_pitcher = bool(set(add_positions) & pitcher_positions)
    is_batter = not is_pitcher or bool(set(add_positions) - pitcher_positions - {"BN", "UTIL", "IL", "IL+", "DL", "DL+"})

    # Batting categories that a batter impacts
    from valuations import DEFAULT_BATTING_CATS, DEFAULT_BATTING_CATS_NEGATIVE, DEFAULT_PITCHING_CATS, DEFAULT_PITCHING_CATS_NEGATIVE
    bat_cats = set(DEFAULT_BATTING_CATS + DEFAULT_BATTING_CATS_NEGATIVE)
    # Pitching categories that a pitcher impacts
    pitch_cats = set(DEFAULT_PITCHING_CATS + DEFAULT_PITCHING_CATS_NEGATIVE)

    affected_cats = set()
    if is_batter:
        affected_cats |= bat_cats
    if is_pitcher:
        affected_cats |= pitch_cats

    # 3. Look up drop player if specified
    drop_player_info = None
    if drop_name:
        try:
            roster = team.roster()
            for p in roster:
                if drop_name.lower() in p.get("name", "").lower():
                    drop_player_info = p
                    break
        except Exception as e:
            if not as_json:
                print("Warning: could not search roster: " + str(e))

    # 4. Simulate rank changes
    # Use ownership % as a proxy for player quality
    # Higher ownership = better player = more likely to improve ranks
    # Scale: 90%+ owned = strong impact, 50-90% = moderate, <50% = marginal
    pct_val = float(add_pct) if add_pct else 0
    if pct_val >= 90:
        impact_factor = 2
    elif pct_val >= 70:
        impact_factor = 1
    elif pct_val >= 40:
        impact_factor = 0
    else:
        impact_factor = -1

    current_ranks = []
    simulated_ranks = []
    improvements = []
    regressions = []

    for cat, info in cat_ranks.items():
        rank = info.get("rank", 0)
        total = info.get("total", 0)
        current_ranks.append({"name": cat, "rank": rank, "total": total})

        change = 0
        if cat.upper() in affected_cats:
            # Estimate change based on ownership % and current rank
            # If we're weak in a category and adding a good player, bigger improvement
            if rank > total * 0.6:
                # Weak category - more room to improve
                change = max(0, impact_factor + 1)
            elif rank > total * 0.4:
                # Mid category - moderate improvement possible
                change = max(0, impact_factor)
            else:
                # Already strong - minimal improvement, could even regress rate stats
                if cat.upper() in ("AVG", "OBP", "ERA", "WHIP"):
                    # Rate stats can regress even with a good add
                    change = -1 if impact_factor < 2 else 0
                else:
                    change = 0

        simulated_ranks.append({
            "name": cat,
            "rank": max(1, rank - change),
            "total": total,
            "change": change,
        })

        if change > 0:
            improvements.append(cat + " (+" + str(change) + ")")
        elif change < 0:
            regressions.append(cat + " (" + str(change) + ")")

    # 5. Build summary
    summary_parts = []
    if improvements:
        summary_parts.append("Adding " + add_player_info.get("name", add_name) + " projects to improve " + ", ".join(improvements))
    if regressions:
        if summary_parts:
            summary_parts.append("but may hurt " + ", ".join(regressions))
        else:
            summary_parts.append("Adding " + add_player_info.get("name", add_name) + " may hurt " + ", ".join(regressions))

    net_change = sum(s.get("change", 0) for s in simulated_ranks)
    if net_change > 0:
        summary_parts.append("Net: +" + str(net_change) + " rank improvement across categories.")
    elif net_change < 0:
        summary_parts.append("Net: " + str(net_change) + " rank regression across categories.")
    else:
        if not summary_parts:
            summary_parts.append("Adding " + add_player_info.get("name", add_name) + " is projected to have minimal category impact.")
        else:
            summary_parts.append("Net: neutral impact.")

    summary = " ".join(summary_parts)

    # Build result
    add_result = {
        "name": add_player_info.get("name", add_name),
        "team": add_team or "",
        "positions": ",".join(add_positions) if add_positions else "Unknown",
        "mlb_id": add_mlb_id,
    }

    drop_result = None
    if drop_player_info:
        drop_positions = drop_player_info.get("eligible_positions", [])
        drop_result = {
            "name": drop_player_info.get("name", drop_name),
            "team": get_player_team(drop_player_info) or "",
            "positions": ",".join(drop_positions) if drop_positions else "Unknown",
        }

    enrich_with_intel([add_result])

    result = {
        "add_player": add_result,
        "drop_player": drop_result,
        "current_ranks": current_ranks,
        "simulated_ranks": simulated_ranks,
        "summary": summary,
    }

    if as_json:
        return result

    # Print results
    print("Player to Add: " + add_result.get("name", "") + " (" + add_result.get("team", "") + ") - " + add_result.get("positions", ""))
    if drop_result:
        print("Player to Drop: " + drop_result.get("name", "") + " (" + drop_result.get("team", "") + ") - " + drop_result.get("positions", ""))
    print("")

    print("  " + "Category".ljust(12) + "Current".rjust(8) + "  Simulated".rjust(10) + "  Change")
    print("  " + "-" * 42)

    for i, cr in enumerate(current_ranks):
        sr = simulated_ranks[i]
        cat = cr.get("name", "")
        cur = str(cr.get("rank", 0)) + "/" + str(cr.get("total", 0))
        sim = str(sr.get("rank", 0)) + "/" + str(sr.get("total", 0))
        ch = sr.get("change", 0)
        ch_str = ""
        if ch > 0:
            ch_str = " +" + str(ch) + " UP"
        elif ch < 0:
            ch_str = " " + str(ch) + " DOWN"
        print("  " + cat.ljust(12) + cur.rjust(8) + "  " + sim.rjust(10) + ch_str)

    print("")
    print(summary)


def cmd_scout_opponent(args, as_json=False):
    """Scout the current week's opponent - analyze their strengths and weaknesses"""
    if not as_json:
        print("Opponent Scout Report")
        print("=" * 50)

    sc, gm, lg = get_league()

    # Get stat categories for category names
    try:
        stat_cats = lg.stat_categories()
        stat_id_to_name = {}
        for cat in stat_cats:
            sid = str(cat.get("stat_id", ""))
            display = cat.get("display_name", cat.get("name", "Stat " + sid))
            stat_id_to_name[sid] = display
    except Exception as e:
        stat_cats = []
        stat_id_to_name = {}
        if not as_json:
            print("  Warning: could not fetch stat categories: " + str(e))

    # Get raw matchup data (same approach as yahoo-fantasy.py's matchup detail)
    try:
        raw = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching matchup data: " + str(e)}
        print("Error fetching matchup data: " + str(e))
        return

    if not raw:
        if as_json:
            return {"error": "No matchup data available"}
        print("No matchup data available")
        return

    try:
        league_data = raw.get("fantasy_content", {}).get("league", [])
        if len(league_data) < 2:
            if as_json:
                return {"error": "No matchup data in response"}
            print("No matchup data in response")
            return

        sb_data = league_data[1].get("scoreboard", {})
        week = sb_data.get("week", "?")
        matchup_block = sb_data.get("0", {}).get("matchups", {})
        count = int(matchup_block.get("count", 0))

        for i in range(count):
            matchup = matchup_block.get(str(i), {}).get("matchup", {})
            teams_data = matchup.get("0", {}).get("teams", {})
            team1_data = teams_data.get("0", {})
            team2_data = teams_data.get("1", {})

            # Extract team names from nested Yahoo structure
            def _get_name(tdata):
                if isinstance(tdata, dict):
                    team_info = tdata.get("team", [])
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                            if isinstance(item, dict) and "name" in item:
                                return item.get("name", "?")
                return "?"

            def _get_key(tdata):
                if isinstance(tdata, dict):
                    team_info = tdata.get("team", [])
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                            if isinstance(item, dict) and "team_key" in item:
                                return item.get("team_key", "")
                return ""

            name1 = _get_name(team1_data)
            name2 = _get_name(team2_data)
            key1 = _get_key(team1_data)
            key2 = _get_key(team2_data)

            if TEAM_ID not in key1 and TEAM_ID not in key2:
                continue

            # Found our matchup
            if TEAM_ID in key1:
                my_data = team1_data
                opp_data = team2_data
                opp_name = name2
            else:
                my_data = team2_data
                opp_data = team1_data
                opp_name = name1

            my_key = _get_key(my_data)

            # Extract stats
            def _get_stats(tdata):
                stats = {}
                team_info = tdata.get("team", [])
                if isinstance(team_info, list):
                    for block in team_info:
                        if isinstance(block, dict) and "team_stats" in block:
                            raw_stats = block.get("team_stats", {}).get("stats", [])
                            for s in raw_stats:
                                stat = s.get("stat", {})
                                sid = str(stat.get("stat_id", ""))
                                val = stat.get("value", "0")
                                stats[sid] = val
                return stats

            my_stats = _get_stats(my_data)
            opp_stats = _get_stats(opp_data)

            # Extract stat winners
            stat_winners = matchup.get("stat_winners", [])
            cat_results = {}
            for sw in stat_winners:
                w = sw.get("stat_winner", {})
                sid = str(w.get("stat_id", ""))
                if w.get("is_tied"):
                    cat_results[sid] = "tie"
                else:
                    winner_key = w.get("winner_team_key", "")
                    if winner_key == my_key:
                        cat_results[sid] = "win"
                    else:
                        cat_results[sid] = "loss"

            # Build categories with margin analysis
            categories = []
            wins = 0
            losses = 0
            ties = 0

            # Determine which categories have lower-is-better sort order
            lower_is_better_sids = set()
            for cat in stat_cats:
                sid = str(cat.get("stat_id", ""))
                sort_order = cat.get("sort_order", "1")
                if str(sort_order) == "0":
                    lower_is_better_sids.add(sid)

            for sid in sorted(cat_results.keys(), key=lambda x: int(x) if x.isdigit() else 0):
                cat_name = stat_id_to_name.get(sid, "Stat " + sid)
                my_val = my_stats.get(sid, "-")
                opp_val = opp_stats.get(sid, "-")
                result = cat_results.get(sid, "tie")

                if result == "win":
                    wins += 1
                elif result == "loss":
                    losses += 1
                else:
                    ties += 1

                # Determine margin
                margin = "comfortable"
                try:
                    my_num = float(my_val)
                    opp_num = float(opp_val)
                    diff = abs(my_num - opp_num)
                    avg = (abs(my_num) + abs(opp_num)) / 2.0
                    if avg > 0:
                        pct_diff = diff / avg
                        if pct_diff < 0.10:
                            margin = "close"
                        elif pct_diff > 0.30:
                            margin = "dominant"
                    else:
                        margin = "close"
                except (ValueError, TypeError):
                    margin = "close"

                categories.append({
                    "name": cat_name,
                    "my_value": str(my_val),
                    "opp_value": str(opp_val),
                    "result": result,
                    "margin": margin,
                })

            # Get league-wide scoreboard data for opponent strengths/weaknesses
            opp_strengths = []
            opp_weaknesses = []

            try:
                scoreboard = lg.matchups()
                all_teams_cats = {}
                if isinstance(scoreboard, list):
                    for m in scoreboard:
                        if isinstance(m, dict):
                            for t in m.get("teams", []):
                                tk = t.get("team_key", "")
                                st = t.get("stats", {})
                                if tk:
                                    all_teams_cats[tk] = st

                opp_key = _get_key(opp_data)
                opp_league_stats = all_teams_cats.get(opp_key, {})

                if opp_league_stats and all_teams_cats:
                    opp_cat_ranks = {}
                    for cat_stat, opp_val in opp_league_stats.items():
                        try:
                            opp_num = float(opp_val)
                        except (ValueError, TypeError):
                            continue
                        values = []
                        for tk, st in all_teams_cats.items():
                            try:
                                values.append(float(st.get(cat_stat, 0)))
                            except (ValueError, TypeError):
                                pass
                        is_lower = cat_stat.upper() in ("ERA", "WHIP", "BB", "L")
                        if is_lower:
                            values.sort()
                        else:
                            values.sort(reverse=True)
                        rank = 1
                        for v in values:
                            if is_lower:
                                if opp_num <= v:
                                    break
                            else:
                                if opp_num >= v:
                                    break
                            rank += 1
                        opp_cat_ranks[cat_stat] = rank

                    total_teams = len(all_teams_cats)
                    for cat_stat, rank in opp_cat_ranks.items():
                        if rank <= 3:
                            opp_strengths.append(cat_stat)
                        elif total_teams > 3 and rank >= (total_teams - 2):
                            opp_weaknesses.append(cat_stat)
            except Exception as e:
                if not as_json:
                    print("  Warning: could not analyze league-wide ranks: " + str(e))

            # Generate strategy suggestions
            strategy = []

            # Find close losses to target
            close_losses = [c for c in categories if c.get("result") == "loss" and c.get("margin") == "close"]
            if close_losses:
                names = [c.get("name", "?") for c in close_losses]
                strategy.append("Target close categories: " + ", ".join(names) + " are all within reach")

            # Protect close wins
            close_wins = [c for c in categories if c.get("result") == "win" and c.get("margin") == "close"]
            if close_wins:
                names = [c.get("name", "?") for c in close_wins]
                strategy.append("Protect your leads: " + ", ".join(names) + " are close - don't get complacent")

            # Opponent dominant categories - suggest conceding
            dominant_losses = [c for c in categories if c.get("result") == "loss" and c.get("margin") == "dominant"]
            if dominant_losses:
                names = [c.get("name", "?") for c in dominant_losses]
                strategy.append("Opponent is dominant in " + ", ".join(names) + " - consider conceding and focusing elsewhere")

            # Leverage strengths where opponent is weak
            if opp_weaknesses:
                strategy.append("Opponent is weak in " + ", ".join(opp_weaknesses) + " - leverage your advantage there")

            # Opponent strengths warning
            if opp_strengths:
                strategy.append("Opponent is strong league-wide in " + ", ".join(opp_strengths) + " - hard to overcome, focus on other categories")

            if not strategy:
                strategy.append("Matchup is evenly contested - stay the course and avoid unnecessary roster moves")

            result_data = {
                "week": week,
                "opponent": opp_name,
                "score": {"wins": wins, "losses": losses, "ties": ties},
                "categories": categories,
                "opp_strengths": opp_strengths,
                "opp_weaknesses": opp_weaknesses,
                "strategy": strategy,
            }

            if as_json:
                return result_data

            print("Week " + str(week) + " Scout Report vs " + opp_name)
            print("Score: " + str(wins) + "-" + str(losses) + "-" + str(ties))
            print("")
            for cat in categories:
                marker = "W" if cat.get("result") == "win" else ("L" if cat.get("result") == "loss" else "T")
                m = " *" if cat.get("margin") == "close" else ""
                print("  [" + marker + "] " + cat.get("name", "?").ljust(12) + str(cat.get("my_value", "")).rjust(8) + " vs " + str(cat.get("opp_value", "")).rjust(8) + m)
            print("")
            if opp_strengths:
                print("Opponent Strengths: " + ", ".join(opp_strengths))
            if opp_weaknesses:
                print("Opponent Weaknesses: " + ", ".join(opp_weaknesses))
            print("")
            print("Strategy:")
            for idx, s in enumerate(strategy):
                print("  " + str(idx + 1) + ". " + s)
            return

        # No matchup found
        if as_json:
            return {"error": "Could not find your matchup"}
        print("Could not find your matchup")
    except Exception as e:
        if as_json:
            return {"error": "Error parsing matchup data: " + str(e)}
        print("Error parsing matchup data: " + str(e))


def _match_team_games(team_name, team_games):
    """Match a Yahoo team name to schedule team games count"""
    if not team_name or not team_games:
        return 0
    norm = normalize_team_name(team_name)
    full = TEAM_ALIASES.get(team_name, team_name)
    norm_full = normalize_team_name(full)
    for tn, gc in team_games.items():
        if norm in normalize_team_name(tn) or norm_full in normalize_team_name(tn):
            return gc
    return 0


def _count_roster_games(roster, team_games):
    """Count remaining games for a fantasy roster given MLB team game counts"""
    batter_games = 0
    pitcher_games = 0
    for p in roster:
        if is_il(p):
            continue
        team_name = get_player_team(p)
        games = _match_team_games(team_name, team_games)
        elig = p.get("eligible_positions", [])
        if set(elig) & {"SP", "RP", "P"}:
            pitcher_games += games
        else:
            batter_games += games
    return {"batter_games": batter_games, "pitcher_games": pitcher_games}


def cmd_matchup_strategy(args, as_json=False):
    """Analyze your matchup and build a category-by-category game plan to maximize wins"""
    if not as_json:
        print("Matchup Strategy")
        print("=" * 50)

    sc, gm, lg = get_league()

    # ── 1. Matchup + category comparison (reuse scout-opponent parsing) ──
    try:
        stat_cats = lg.stat_categories()
        stat_id_to_name = {}
        for cat in stat_cats:
            sid = str(cat.get("stat_id", ""))
            display = cat.get("display_name", cat.get("name", "Stat " + sid))
            stat_id_to_name[sid] = display
    except Exception as e:
        stat_cats = []
        stat_id_to_name = {}
        if not as_json:
            print("  Warning: could not fetch stat categories: " + str(e))

    # Determine lower-is-better stat IDs
    lower_is_better_sids = set()
    for cat in stat_cats:
        sid = str(cat.get("stat_id", ""))
        sort_order = cat.get("sort_order", "1")
        if str(sort_order) == "0":
            lower_is_better_sids.add(sid)

    # Rate stat names (margin matters more than volume for these)
    RATE_STATS = {"AVG", "OBP", "ERA", "WHIP"}

    try:
        raw = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching matchup data: " + str(e)}
        print("Error fetching matchup data: " + str(e))
        return

    if not raw:
        if as_json:
            return {"error": "No matchup data available"}
        print("No matchup data available")
        return

    try:
        league_data = raw.get("fantasy_content", {}).get("league", [])
        if len(league_data) < 2:
            if as_json:
                return {"error": "No matchup data in response"}
            print("No matchup data in response")
            return

        sb_data = league_data[1].get("scoreboard", {})
        week = sb_data.get("week", "?")
        matchup_block = sb_data.get("0", {}).get("matchups", {})
        count = int(matchup_block.get("count", 0))

        opp_name = None
        opp_data = None
        my_data = None
        categories = []
        wins = 0
        losses = 0
        ties = 0

        for i in range(count):
            matchup = matchup_block.get(str(i), {}).get("matchup", {})
            teams_data = matchup.get("0", {}).get("teams", {})
            team1_data = teams_data.get("0", {})
            team2_data = teams_data.get("1", {})

            def _get_name(tdata):
                if isinstance(tdata, dict):
                    team_info = tdata.get("team", [])
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                            if isinstance(item, dict) and "name" in item:
                                return item.get("name", "?")
                return "?"

            def _get_key(tdata):
                if isinstance(tdata, dict):
                    team_info = tdata.get("team", [])
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                            if isinstance(item, dict) and "team_key" in item:
                                return item.get("team_key", "")
                return ""

            name1 = _get_name(team1_data)
            name2 = _get_name(team2_data)
            key1 = _get_key(team1_data)
            key2 = _get_key(team2_data)

            if TEAM_ID not in key1 and TEAM_ID not in key2:
                continue

            # Found our matchup
            if TEAM_ID in key1:
                my_data = team1_data
                opp_data = team2_data
                opp_name = name2
            else:
                my_data = team2_data
                opp_data = team1_data
                opp_name = name1

            my_key = _get_key(my_data)
            opp_key = _get_key(opp_data)

            def _get_stats(tdata):
                stats = {}
                team_info = tdata.get("team", [])
                if isinstance(team_info, list):
                    for block in team_info:
                        if isinstance(block, dict) and "team_stats" in block:
                            raw_stats = block.get("team_stats", {}).get("stats", [])
                            for s in raw_stats:
                                stat = s.get("stat", {})
                                sid = str(stat.get("stat_id", ""))
                                val = stat.get("value", "0")
                                stats[sid] = val
                return stats

            my_stats = _get_stats(my_data)
            opp_stats = _get_stats(opp_data)

            # Extract stat winners
            stat_winners = matchup.get("stat_winners", [])
            cat_results = {}
            for sw in stat_winners:
                w = sw.get("stat_winner", {})
                sid = str(w.get("stat_id", ""))
                if w.get("is_tied"):
                    cat_results[sid] = "tie"
                else:
                    winner_key = w.get("winner_team_key", "")
                    if winner_key == my_key:
                        cat_results[sid] = "win"
                    else:
                        cat_results[sid] = "loss"

            # Build categories with margin
            for sid in sorted(cat_results.keys(), key=lambda x: int(x) if x.isdigit() else 0):
                cat_name = stat_id_to_name.get(sid, "Stat " + sid)
                my_val = my_stats.get(sid, "-")
                opp_val = opp_stats.get(sid, "-")
                result = cat_results.get(sid, "tie")

                if result == "win":
                    wins += 1
                elif result == "loss":
                    losses += 1
                else:
                    ties += 1

                margin = "comfortable"
                try:
                    my_num = float(my_val)
                    opp_num = float(opp_val)
                    diff = abs(my_num - opp_num)
                    avg = (abs(my_num) + abs(opp_num)) / 2.0
                    if avg > 0:
                        pct_diff = diff / avg
                        if pct_diff < 0.10:
                            margin = "close"
                        elif pct_diff > 0.30:
                            margin = "dominant"
                    else:
                        margin = "close"
                except (ValueError, TypeError):
                    margin = "close"

                categories.append({
                    "name": cat_name,
                    "my_value": str(my_val),
                    "opp_value": str(opp_val),
                    "result": result,
                    "margin": margin,
                })

            break  # Found our matchup, stop

        if not opp_name:
            if as_json:
                return {"error": "Could not find your matchup"}
            print("Could not find your matchup")
            return

        # ── 2. Schedule analysis — remaining games this week ──
        try:
            settings = lg.settings()
            start_date_str = settings.get("start_date", "")
            current_week = lg.current_week()
            target_week = int(week) if str(week).isdigit() else current_week
            if start_date_str:
                season_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                week_start = season_start + timedelta(days=(target_week - 1) * 7)
                week_end = week_start + timedelta(days=6)
            else:
                today = date.today()
                week_start = today - timedelta(days=today.weekday())
                week_end = week_start + timedelta(days=6)
        except Exception:
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)

        today = date.today()
        remaining_start = max(today, week_start)
        remaining_end = week_end

        schedule_data = {
            "my_batter_games": 0, "my_pitcher_games": 0,
            "opp_batter_games": 0, "opp_pitcher_games": 0,
            "advantage": "neutral",
        }

        team_games = {}
        if remaining_start <= remaining_end:
            schedule = get_schedule_for_range(remaining_start.isoformat(), remaining_end.isoformat())
            for game in schedule:
                away = game.get("away_name", "")
                home = game.get("home_name", "")
                if away:
                    team_games[away] = team_games.get(away, 0) + 1
                if home:
                    team_games[home] = team_games.get(home, 0) + 1

            # Count games for each roster
            try:
                my_team = lg.to_team(TEAM_ID)
                my_roster = my_team.roster()
                my_games = _count_roster_games(my_roster, team_games)
                schedule_data["my_batter_games"] = my_games.get("batter_games", 0)
                schedule_data["my_pitcher_games"] = my_games.get("pitcher_games", 0)
            except Exception as e:
                if not as_json:
                    print("  Warning: could not count my roster games: " + str(e))

            try:
                opp_team = lg.to_team(opp_key)
                opp_roster = opp_team.roster()
                opp_games = _count_roster_games(opp_roster, team_games)
                schedule_data["opp_batter_games"] = opp_games.get("batter_games", 0)
                schedule_data["opp_pitcher_games"] = opp_games.get("pitcher_games", 0)
            except Exception as e:
                if not as_json:
                    print("  Warning: could not count opponent roster games: " + str(e))

            my_total = schedule_data.get("my_batter_games", 0) + schedule_data.get("my_pitcher_games", 0)
            opp_total = schedule_data.get("opp_batter_games", 0) + schedule_data.get("opp_pitcher_games", 0)
            if my_total > opp_total + 5:
                schedule_data["advantage"] = "you"
            elif opp_total > my_total + 5:
                schedule_data["advantage"] = "opponent"

        # ── 3. Opponent transactions ──
        opp_transactions = []
        for tx_type in ["add", "drop"]:
            try:
                raw_tx = lg.transactions(tx_type, 15)
                if not raw_tx:
                    continue
                for tx in raw_tx:
                    if not isinstance(tx, dict):
                        continue
                    tx_team = tx.get("team", "")
                    tx_team_key = tx.get("team_key", "")
                    if opp_key and (opp_key in str(tx_team_key) or opp_name in str(tx_team)):
                        opp_transactions.append({
                            "type": tx_type,
                            "player": tx.get("player", tx.get("name", "Unknown")),
                            "date": tx.get("date", tx.get("timestamp", "")),
                        })
            except Exception:
                pass

        # ── 4. Strategy classification ──
        strategy_map = {"target": [], "protect": [], "concede": [], "lock": []}
        bat_edge = schedule_data.get("my_batter_games", 0) - schedule_data.get("opp_batter_games", 0)
        pitch_edge = schedule_data.get("my_pitcher_games", 0) - schedule_data.get("opp_pitcher_games", 0)

        # Determine batting vs pitching categories by stat_id position type
        pitching_cat_names = set()
        for cat in stat_cats:
            if cat.get("position_type", "") == "P":
                display = cat.get("display_name", cat.get("name", ""))
                if display:
                    pitching_cat_names.add(display)

        for c in categories:
            name = c.get("name", "")
            result = c.get("result", "tie")
            margin = c.get("margin", "comfortable")
            is_pitching = name in pitching_cat_names
            is_rate = name.upper() in RATE_STATS
            edge = pitch_edge if is_pitching else bat_edge

            classification = "lock"
            reason = ""

            if result == "loss":
                if margin == "close":
                    if not is_rate and edge > 3:
                        classification = "target"
                        reason = "Close and you have +" + str(edge) + " " + ("pitcher" if is_pitching else "batter") + " games"
                    else:
                        classification = "target"
                        reason = "Close — winnable with " + ("quality starts" if is_pitching else "waiver moves")
                elif margin == "comfortable":
                    if not is_rate and edge > 8:
                        classification = "target"
                        reason = "Comfortable gap but large schedule edge (+" + str(edge) + " games)"
                    else:
                        classification = "concede"
                        reason = "Comfortable opponent lead — focus elsewhere"
                else:  # dominant
                    classification = "concede"
                    reason = "Opponent is dominant — not worth chasing"
            elif result == "win":
                if margin == "close":
                    if not is_rate and edge < -3:
                        classification = "protect"
                        reason = "Close lead but opponent has more games remaining"
                    else:
                        classification = "protect"
                        reason = "Close — stay alert and don't sacrifice this lead"
                elif margin == "comfortable":
                    classification = "lock"
                    reason = "Comfortable lead — maintain"
                else:  # dominant
                    classification = "lock"
                    reason = "Dominant lead — locked in"
            else:  # tie
                if not is_rate and edge > 2:
                    classification = "target"
                    reason = "Tied with schedule advantage (+" + str(edge) + " games)"
                elif not is_rate and edge < -2:
                    classification = "protect"
                    reason = "Tied but opponent has more games"
                else:
                    classification = "target"
                    reason = "Tied — winnable with the right moves"

            c["classification"] = classification
            c["reason"] = reason
            strategy_map[classification].append(name)

        # ── 5. Waiver recommendations for target categories ──
        def _score_free_agents(pos_type, target_cat_names):
            """Score free agents for target categories, return top 5"""
            results = []
            try:
                fa = lg.free_agents(pos_type)[:25]
            except Exception:
                return results
            for p in fa:
                status = p.get("status", "")
                if status and status not in ("", "Healthy"):
                    continue
                pname = p.get("name", "Unknown")
                team_name = get_player_team(p)
                games = _match_team_games(team_name, team_games)
                results.append({
                    "name": pname,
                    "pid": p.get("player_id", "?"),
                    "pct": p.get("percent_owned", 0),
                    "categories": target_cat_names,
                    "team": team_name,
                    "games": games,
                    "mlb_id": get_mlb_id(pname),
                })
            results.sort(key=lambda x: -(float(x.get("pct", 0)) + (10 if x.get("games", 0) >= 5 else 0)))
            return results[:5]

        waiver_targets = []
        target_cats = strategy_map.get("target", [])
        target_batting = [c for c in target_cats if c not in pitching_cat_names]
        target_pitching = [c for c in target_cats if c in pitching_cat_names]

        try:
            if target_batting:
                waiver_targets.extend(_score_free_agents("B", target_batting))
            if target_pitching:
                waiver_targets.extend(_score_free_agents("P", target_pitching))
        except Exception as e:
            if not as_json:
                print("  Warning: could not fetch waiver targets: " + str(e))

        # ── 6. Summary ──
        score_str = str(wins) + "-" + str(losses) + "-" + str(ties)
        if wins > losses:
            status_str = "Winning " + score_str
        elif losses > wins:
            status_str = "Losing " + score_str
        else:
            status_str = "Tied " + score_str

        parts = [status_str]
        adv = schedule_data.get("advantage", "neutral")
        if adv == "you":
            bat_diff = schedule_data.get("my_batter_games", 0) - schedule_data.get("opp_batter_games", 0)
            parts.append("with a schedule edge (+" + str(bat_diff) + " batter games)")
        elif adv == "opponent":
            bat_diff = schedule_data.get("opp_batter_games", 0) - schedule_data.get("my_batter_games", 0)
            parts.append("but opponent has schedule edge (+" + str(bat_diff) + " batter games)")

        if strategy_map.get("target"):
            parts.append("Target " + ", ".join(strategy_map.get("target", [])[:3]) + " — all within reach")
        if strategy_map.get("protect"):
            parts.append("Protect " + ", ".join(strategy_map.get("protect", [])[:3]))
        if strategy_map.get("concede"):
            parts.append("Concede " + ", ".join(strategy_map.get("concede", [])[:2]) + " where opponent is dominant")

        summary = ". ".join(parts) + "."

        result_data = {
            "week": week,
            "opponent": opp_name,
            "score": {"wins": wins, "losses": losses, "ties": ties},
            "schedule": schedule_data,
            "categories": categories,
            "opp_transactions": opp_transactions,
            "strategy": strategy_map,
            "waiver_targets": waiver_targets,
            "summary": summary,
        }

        if as_json:
            return result_data

        # CLI output
        print("Week " + str(week) + " Strategy vs " + opp_name)
        print("Score: " + score_str)
        print("")
        print("Schedule Remaining:")
        print("  You:  " + str(schedule_data.get("my_batter_games", 0)) + " batter / " + str(schedule_data.get("my_pitcher_games", 0)) + " pitcher games")
        print("  Opp:  " + str(schedule_data.get("opp_batter_games", 0)) + " batter / " + str(schedule_data.get("opp_pitcher_games", 0)) + " pitcher games")
        print("")
        for c in categories:
            marker = "W" if c.get("result") == "win" else ("L" if c.get("result") == "loss" else "T")
            cls = c.get("classification", "?").upper()[:4]
            print("  [" + marker + "] " + c.get("name", "?").ljust(12) + str(c.get("my_value", "")).rjust(8) + " vs " + str(c.get("opp_value", "")).rjust(8) + "  " + cls.ljust(6) + c.get("reason", ""))
        print("")
        if opp_transactions:
            print("Opponent Recent Moves:")
            for tx in opp_transactions:
                print("  " + tx.get("type", "?").ljust(6) + " " + tx.get("player", "?"))
            print("")
        if waiver_targets:
            print("Waiver Targets:")
            for wt in waiver_targets:
                print("  " + wt.get("name", "?").ljust(25) + wt.get("team", "?").ljust(12) + str(wt.get("games", 0)) + " games  " + str(wt.get("pct", 0)) + "% owned")
        print("")
        print("Summary: " + summary)

    except Exception as e:
        if as_json:
            return {"error": "Error building matchup strategy: " + str(e)}
        print("Error building matchup strategy: " + str(e))


def cmd_set_lineup(args, as_json=False):
    """Move specific player(s) to specific position(s)"""
    # Args format: player_id:position pairs (e.g. "12345:SS 67890:BN")
    if not args:
        if as_json:
            return {"success": False, "message": "Usage: set-lineup PLAYER_ID:POSITION [PLAYER_ID:POSITION ...]"}
        print("Usage: set-lineup PLAYER_ID:POSITION [PLAYER_ID:POSITION ...]")
        print("  Example: set-lineup 12345:SS 67890:BN")
        return
    moves = []
    for arg in args:
        parts = arg.split(":")
        if len(parts) != 2:
            msg = "Invalid move format: " + arg + " (expected PLAYER_ID:POSITION)"
            if as_json:
                return {"success": False, "message": msg}
            print(msg)
            return
        moves.append({"player_id": parts[0], "selected_position": parts[1]})
    method = _write_method()

    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            results = []
            for move in moves:
                pid = move.get("player_id", "")
                new_pos = move.get("selected_position", "")
                try:
                    team.change_positions(date.today(), [{"player_id": pid, "selected_position": new_pos}])
                    results.append({"player_id": pid, "position": new_pos, "success": True})
                except Exception as e:
                    results.append({"player_id": pid, "position": new_pos, "success": False, "error": str(e)})
            all_success = all(r.get("success") for r in results)
            # Check if any failures are scope errors
            scope_errors = [r for r in results if not r.get("success") and _is_scope_error(r.get("error", ""))]
            if not scope_errors or method == "api":
                if as_json:
                    return {"success": all_success, "moves": results, "message": "Applied " + str(len(results)) + " lineup change(s)"}
                for r in results:
                    if r.get("success"):
                        print("Moved player " + r.get("player_id", "") + " to " + r.get("position", ""))
                    else:
                        print("Error moving player " + r.get("player_id", "") + ": " + r.get("error", ""))
                return
            # Fall through to browser for scope errors
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                if as_json:
                    return {"success": False, "moves": [], "message": "Error: " + str(e)}
                print("Error setting lineup: " + str(e))
                return

    try:
        from yahoo_browser import set_lineup
        result = set_lineup(moves)
        if as_json:
            return result
        if result.get("success"):
            print(result.get("message", "Lineup changes applied via browser"))
        else:
            print(result.get("message", "Browser set-lineup failed"))
    except Exception as e:
        if as_json:
            return {"success": False, "moves": [], "message": "Browser fallback error: " + str(e)}
        print("Browser fallback error: " + str(e))


def cmd_pending_trades(args, as_json=False):
    """View all pending trade proposals"""
    sc, gm, lg, team = get_league_context()
    try:
        trades = team.proposed_trades()
        if not trades:
            if as_json:
                return {"trades": []}
            print("No pending trade proposals")
            return

        # Build team name lookup from league teams
        team_names = {}
        try:
            all_teams = lg.teams()
            for tk, tinfo in all_teams.items():
                team_names[tk] = tinfo.get("name", tk) if isinstance(tinfo, dict) else tk
        except Exception:
            pass

        my_team_key = team.team_key

        trade_list = []
        for t in trades:
            trader_key = t.get("trader_team_key", "")
            tradee_key = t.get("tradee_team_key", "")
            # Determine direction: did I propose or receive this trade?
            i_proposed = (trader_key == my_team_key)
            trade_list.append({
                "transaction_key": t.get("transaction_key", ""),
                "status": t.get("status", ""),
                "trader_team_key": trader_key,
                "trader_team_name": t.get("trader_team_name", "") or team_names.get(trader_key, trader_key),
                "tradee_team_key": tradee_key,
                "tradee_team_name": t.get("tradee_team_name", "") or team_names.get(tradee_key, tradee_key),
                "trader_players": t.get("trader_players", []),
                "tradee_players": t.get("tradee_players", []),
                "trade_note": t.get("trade_note", ""),
                "direction": "sent" if i_proposed else "received",
                "can_respond": not i_proposed,
            })
        if as_json:
            return {"trades": trade_list}
        print("Pending Trade Proposals:")
        for t in trade_list:
            print("  Key: " + t.get("transaction_key", "?"))
            print("  Status: " + t.get("status", "?"))
            print("  From: " + t.get("trader_team_name", t.get("trader_team_key", "?")))
            print("  To: " + t.get("tradee_team_name", t.get("tradee_team_key", "?")))
            trader_names = [p.get("name", "?") for p in t.get("trader_players", [])]
            tradee_names = [p.get("name", "?") for p in t.get("tradee_players", [])]
            print("  Trader gives: " + ", ".join(trader_names))
            print("  Tradee gives: " + ", ".join(tradee_names))
            if t.get("trade_note"):
                print("  Note: " + t.get("trade_note", ""))
            print("")
    except Exception as e:
        if as_json:
            return {"error": "Error fetching pending trades: " + str(e)}
        print("Error fetching pending trades: " + str(e))


def cmd_propose_trade(args, as_json=False):
    """Propose a trade to another team
    Args: their_team_key your_player_ids their_player_ids [note]
    Player IDs are comma-separated"""
    if len(args) < 3:
        msg = "Usage: propose-trade THEIR_TEAM_KEY YOUR_IDS THEIR_IDS [NOTE]"
        if as_json:
            return {"success": False, "message": msg}
        print(msg)
        return
    tradee_team_key = args[0]
    your_ids = [pid.strip() for pid in args[1].split(",")]
    their_ids = [pid.strip() for pid in args[2].split(",")]
    trade_note = " ".join(args[3:]) if len(args) > 3 else ""
    your_player_keys = [GAME_KEY + ".p." + pid for pid in your_ids]
    their_player_keys = [GAME_KEY + ".p." + pid for pid in their_ids]
    method = _write_method()

    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            my_team_key = team.team_key
            players = []
            for pk in your_player_keys:
                players.append({
                    "player_key": pk,
                    "source_team_key": my_team_key,
                    "destination_team_key": tradee_team_key,
                })
            for pk in their_player_keys:
                players.append({
                    "player_key": pk,
                    "source_team_key": tradee_team_key,
                    "destination_team_key": my_team_key,
                })
            team.propose_trade(tradee_team_key, players, trade_note)
            msg = "Trade proposed to " + tradee_team_key
            if as_json:
                return {
                    "success": True,
                    "tradee_team_key": tradee_team_key,
                    "your_player_keys": your_player_keys,
                    "their_player_keys": their_player_keys,
                    "message": msg,
                }
            print(msg)
            return
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                msg = "Error proposing trade: " + str(e)
                if as_json:
                    return {"success": False, "message": msg}
                print(msg)
                return

    try:
        from yahoo_browser import propose_trade_http, propose_trade
        result = propose_trade_http(tradee_team_key, your_ids, their_ids, trade_note)
        if not result.get("success"):
            print("HTTP trade failed: " + result.get("message", "?") + ", falling back to browser")
            result = propose_trade(tradee_team_key, your_ids, their_ids, trade_note)
        if as_json:
            result["your_player_keys"] = your_player_keys
            result["their_player_keys"] = their_player_keys
            return result
        if result.get("success"):
            print(result.get("message", "Trade proposed via browser"))
        else:
            print(result.get("message", "Browser propose trade failed"))
    except Exception as e:
        msg = "Browser fallback error: " + str(e)
        if as_json:
            return {"success": False, "message": msg}
        print(msg)


def cmd_accept_trade(args, as_json=False):
    """Accept a pending trade by transaction key"""
    if not args:
        msg = "Usage: accept-trade TRANSACTION_KEY [NOTE]"
        if as_json:
            return {"success": False, "message": msg}
        print(msg)
        return
    transaction_key = args[0]
    trade_note = " ".join(args[1:]) if len(args) > 1 else ""
    method = _write_method()

    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            team.accept_trade(transaction_key, trade_note=trade_note)
            msg = "Trade accepted: " + transaction_key
            if as_json:
                return {"success": True, "transaction_key": transaction_key, "message": msg}
            print(msg)
            return
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                msg = "Error accepting trade: " + str(e)
                if as_json:
                    return {"success": False, "transaction_key": transaction_key, "message": msg}
                print(msg)
                return

    try:
        from yahoo_browser import accept_trade
        result = accept_trade(transaction_key, trade_note)
        if as_json:
            return result
        if result.get("success"):
            print(result.get("message", "Trade accepted via browser"))
        else:
            print(result.get("message", "Browser accept trade failed"))
    except Exception as e:
        msg = "Browser fallback error: " + str(e)
        if as_json:
            return {"success": False, "transaction_key": transaction_key, "message": msg}
        print(msg)


def cmd_reject_trade(args, as_json=False):
    """Reject a pending trade by transaction key"""
    if not args:
        msg = "Usage: reject-trade TRANSACTION_KEY [NOTE]"
        if as_json:
            return {"success": False, "message": msg}
        print(msg)
        return
    transaction_key = args[0]
    trade_note = " ".join(args[1:]) if len(args) > 1 else ""
    method = _write_method()

    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            team.reject_trade(transaction_key, trade_note=trade_note)
            msg = "Trade rejected: " + transaction_key
            if as_json:
                return {"success": True, "transaction_key": transaction_key, "message": msg}
            print(msg)
            return
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                msg = "Error rejecting trade: " + str(e)
                if as_json:
                    return {"success": False, "transaction_key": transaction_key, "message": msg}
                print(msg)
                return

    try:
        from yahoo_browser import reject_trade
        result = reject_trade(transaction_key, trade_note)
        if as_json:
            return result
        if result.get("success"):
            print(result.get("message", "Trade rejected via browser"))
        else:
            print(result.get("message", "Browser reject trade failed"))
    except Exception as e:
        msg = "Browser fallback error: " + str(e)
        if as_json:
            return {"success": False, "transaction_key": transaction_key, "message": msg}
        print(msg)


def cmd_whats_new(args, as_json=False):
    """Single digest: injuries, pending trades, opponent moves, trending pickups, prospect call-ups"""
    sc, gm, lg, team = get_league_context()

    db = get_db()
    now = datetime.now().isoformat()

    # Track last check time
    db.execute("""CREATE TABLE IF NOT EXISTS digest_state
                  (key TEXT PRIMARY KEY, value TEXT)""")
    db.commit()
    row = db.execute("SELECT value FROM digest_state WHERE key='last_check'").fetchone()
    last_check = row[0] if row else ""

    result = {
        "last_check": last_check,
        "check_time": now,
        "injuries": [],
        "pending_trades": [],
        "league_activity": [],
        "trending": [],
        "prospects": [],
    }

    # 1. Injury updates
    try:
        injury_data = cmd_injury_report([], as_json=True)
        injured = []
        for p in injury_data.get("injured_active", []):
            injured.append({
                "name": p.get("name", ""),
                "player_id": str(p.get("player_id", "")),
                "status": p.get("status", ""),
                "position": p.get("position", ""),
                "section": "active_injured",
            })
        for p in injury_data.get("healthy_il", []):
            injured.append({
                "name": p.get("name", ""),
                "player_id": str(p.get("player_id", "")),
                "status": "healthy_on_IL",
                "position": p.get("position", ""),
                "section": "healthy_il",
            })
        result["injuries"] = injured
    except Exception as e:
        print("Warning: injury check failed: " + str(e))

    # 2. Pending trades
    try:
        trade_data = cmd_pending_trades([], as_json=True)
        result["pending_trades"] = trade_data.get("trades", [])
    except Exception as e:
        print("Warning: pending trades check failed: " + str(e))

    # 3. Recent league activity (filter out our own transactions)
    try:
        yf_mod = importlib.import_module("yahoo-fantasy")
        tx_data = yf_mod.cmd_transactions([], as_json=True)
        transactions = tx_data.get("transactions", [])
        my_team_name = team.team_data.get("name", "") if hasattr(team, "team_data") else ""
        activity = []
        for tx in transactions[:15]:
            tx_team = tx.get("team", "")
            if tx_team and tx_team != my_team_name:
                activity.append({
                    "type": tx.get("type", "?"),
                    "player": tx.get("player", "?"),
                    "team": tx_team,
                })
        result["league_activity"] = activity
    except Exception as e:
        print("Warning: league activity check failed: " + str(e))

    # 4. Trending players (high ownership delta)
    try:
        trend_lookup = get_trend_lookup()
        trending = []
        for name, info in sorted(trend_lookup.items(), key=lambda x: x[1].get("rank", 99)):
            if info.get("direction") == "added" and info.get("rank", 99) <= 10:
                trending.append({
                    "name": name,
                    "direction": "added",
                    "delta": info.get("delta", ""),
                    "percent_owned": info.get("percent_owned", 0),
                })
        result["trending"] = trending[:10]
    except Exception as e:
        print("Warning: trending check failed: " + str(e))

    # 5. Prospect call-ups
    try:
        intel_mod = importlib.import_module("intel")
        prospect_data = intel_mod.cmd_prospect_watch([], as_json=True)
        prospects = []
        for tx in prospect_data.get("transactions", [])[:5]:
            prospects.append({
                "player": tx.get("player", "?"),
                "type": tx.get("type", "?"),
                "team": tx.get("team", ""),
                "description": tx.get("description", ""),
            })
        result["prospects"] = prospects
    except Exception as e:
        print("Warning: prospect check failed: " + str(e))

    # Update last check time
    try:
        db.execute("INSERT OR REPLACE INTO digest_state (key, value) VALUES ('last_check', ?)", (now,))
        db.commit()
    except Exception:
        pass

    if as_json:
        return result

    print("What's New Digest - " + now[:10])
    print("=" * 50)
    if last_check:
        print("Last checked: " + last_check[:19])
    print("")

    if result.get("injuries"):
        print("INJURIES (" + str(len(result.get("injuries", []))) + "):")
        for p in result.get("injuries", []):
            print("  " + p.get("name", "?").ljust(25) + " [" + p.get("status", "?") + "]")
        print("")

    if result.get("pending_trades"):
        print("PENDING TRADES (" + str(len(result.get("pending_trades", []))) + "):")
        for t in result.get("pending_trades", []):
            trader = t.get("trader_team_name", t.get("trader_team_key", "?"))
            print("  From: " + trader + " - " + t.get("status", "?"))
        print("")

    if result.get("league_activity"):
        print("LEAGUE ACTIVITY (" + str(len(result.get("league_activity", []))) + "):")
        for a in result.get("league_activity", []):
            print("  " + a.get("type", "?").ljust(6) + " " + a.get("player", "?").ljust(25) + " -> " + a.get("team", "?"))
        print("")

    if result.get("trending"):
        print("TRENDING PICKUPS:")
        for t in result.get("trending", []):
            print("  " + t.get("name", "?").ljust(25) + " " + str(t.get("percent_owned", 0)) + "% (" + t.get("delta", "") + ")")
        print("")

    if result.get("prospects"):
        print("PROSPECT CALL-UPS:")
        for p in result.get("prospects", []):
            print("  " + p.get("player", "?").ljust(25) + " " + p.get("type", "?") + " " + p.get("team", ""))
        print("")


def _find_player_owner(lg, target_name):
    """Find which team owns a player by searching all rosters.
    Returns (team_key, team_name, player_dict) or (None, None, None).
    """
    target_lower = target_name.strip().lower()
    all_teams = lg.teams()
    for team_key, team_data in all_teams.items():
        team_name = team_data.get("name", "Unknown")
        try:
            t = lg.to_team(team_key)
            roster = t.roster()
        except Exception:
            continue
        for p in roster:
            name = p.get("name", "")
            if name.lower() == target_lower:
                return team_key, team_name, p
            # Partial match: last name
            if target_lower in name.lower():
                return team_key, team_name, p
    return None, None, None


def _team_cat_strengths_from_zscores(lg, team_key):
    """Derive per-category strengths from projected z-scores (preseason fallback).
    Returns (cat_ranks_dict, weak_cats_list, strong_cats_list).
    """
    from valuations import DEFAULT_BATTING_CATS, DEFAULT_PITCHING_CATS

    # Aggregate per-category z-scores across the team roster
    try:
        target_team = lg.to_team(team_key)
        roster = target_team.roster()
    except Exception:
        return {}, [], []

    all_cats = list(DEFAULT_BATTING_CATS) + list(DEFAULT_PITCHING_CATS)
    cat_totals = {c: 0.0 for c in all_cats}
    cat_counts = {c: 0 for c in all_cats}

    for p in roster:
        name = p.get("name", "Unknown")
        positions = p.get("eligible_positions", [])
        is_pitcher = is_pitcher_position(positions)
        _, _, per_cat = _player_z_summary(name)
        if not per_cat:
            continue
        relevant_cats = (list(DEFAULT_PITCHING_CATS)
                         if is_pitcher else list(DEFAULT_BATTING_CATS))
        for cat in relevant_cats:
            z = per_cat.get(cat, 0)
            if z != 0:
                cat_totals[cat] = cat_totals.get(cat, 0) + z
                cat_counts[cat] = cat_counts.get(cat, 0) + 1

    # Build cat_ranks with average z per category
    cat_ranks = {}
    for cat in all_cats:
        count = cat_counts.get(cat, 0)
        if count > 0:
            avg_z = cat_totals.get(cat, 0) / count
            cat_ranks[cat] = {"value": round(avg_z, 2), "rank": 0, "total": 0,
                              "z_avg": round(avg_z, 2)}

    if not cat_ranks:
        return {}, [], []

    # Sort by z_avg to find strong (highest) and weak (lowest)
    sorted_cats = sorted(cat_ranks.items(),
                         key=lambda x: x[1].get("z_avg", 0), reverse=True)
    strong = [c for c, _ in sorted_cats[:3]]
    weak = [c for c, _ in sorted_cats[-3:]]

    return cat_ranks, weak, strong


def _get_team_category_ranks(lg, target_team_key):
    """Get per-team category values from the current scoreboard.
    Returns dict of {cat_name: {value, rank, total}} for the target team,
    plus a list of weak categories (bottom 3) and strong categories (top 3).
    """
    try:
        scoreboard = lg.matchups()
    except Exception:
        return _team_cat_strengths_from_zscores(lg, target_team_key)

    if not scoreboard:
        return _team_cat_strengths_from_zscores(lg, target_team_key)

    all_teams_cats = {}
    target_cats = {}

    try:
        if isinstance(scoreboard, list):
            for matchup in scoreboard:
                teams = []
                if isinstance(matchup, dict):
                    teams = matchup.get("teams", [])
                for t in teams:
                    tk = t.get("team_key", "")
                    stats = t.get("stats", {})
                    if not stats and isinstance(t, dict):
                        for k, v in t.items():
                            if isinstance(v, dict) and "value" in v:
                                stats[k] = v.get("value", 0)
                    if tk:
                        all_teams_cats[tk] = stats
                    if target_team_key in str(tk):
                        target_cats = stats
        elif isinstance(scoreboard, dict):
            for key, val in scoreboard.items():
                if isinstance(val, dict):
                    all_teams_cats[key] = val
    except Exception:
        pass

    if not target_cats:
        return _team_cat_strengths_from_zscores(lg, target_team_key)

    # Calculate ranks per category
    cat_ranks = {}
    for cat, my_val in target_cats.items():
        try:
            my_num = float(my_val)
        except (ValueError, TypeError):
            continue
        values = []
        for tk, stats in all_teams_cats.items():
            try:
                values.append(float(stats.get(cat, 0)))
            except (ValueError, TypeError):
                pass
        lower_is_better = cat.upper() in ("ERA", "WHIP", "BB", "L")
        if lower_is_better:
            values.sort()
        else:
            values.sort(reverse=True)
        rank = 1
        for v in values:
            if lower_is_better:
                if my_num <= v:
                    break
            else:
                if my_num >= v:
                    break
            rank += 1
        total = len(values)
        cat_ranks[cat] = {"value": my_val, "rank": rank, "total": total}

    if not cat_ranks:
        return _team_cat_strengths_from_zscores(lg, target_team_key)

    sorted_cats = sorted(cat_ranks.items(), key=lambda x: x[1].get("rank", 0))
    strong = [c for c, i in sorted_cats if i.get("rank", 99) <= 3]
    weak = [c for c, i in sorted_cats
            if i.get("rank", 0) >= (i.get("total", 0) - 2) and i.get("total", 0) > 3]
    # If scoreboard exists but yields no weak/strong (e.g. all zeroes at week 0),
    # fall back to z-score projections
    if not weak and not strong:
        return _team_cat_strengths_from_zscores(lg, target_team_key)
    return cat_ranks, weak, strong


def cmd_trade_finder(args, as_json=False):
    """Find optimal trade packages to acquire a target player.
    Analyzes both teams' needs and z-score values to build fair proposals.
    Usage: trade-finder <target_player_name>
    If no target given, scans league for complementary trade partners.
    """
    from valuations import get_player_zscore, DEFAULT_BATTING_CATS, DEFAULT_PITCHING_CATS

    target_name = " ".join(args).strip() if args else ""

    sc, gm, lg, team = get_league_context()

    try:
        # --- If no target, fall back to league-wide scan ---
        if not target_name:
            return _trade_finder_league_scan(lg, team, as_json)

        # --- Target-player mode ---
        if not as_json:
            print("Trade Package Builder")
            print("=" * 50)
            print("Target: " + target_name)
            print("")

        # 1. Find who owns the target player
        target_team_key, target_team_name, target_player = _find_player_owner(lg, target_name)
        if not target_team_key:
            msg = "Could not find " + target_name + " on any roster. They may be a free agent."
            if as_json:
                return {"error": msg}
            print(msg)
            return

        # Check if we own the target
        if TEAM_ID in str(target_team_key):
            msg = target_name + " is already on your roster."
            if as_json:
                return {"error": msg}
            print(msg)
            return

        if not as_json:
            print("Owned by: " + target_team_name)

        # 2. Get z-score info for the target player
        target_z, target_tier, target_per_cat = _player_z_summary(target_player.get("name", target_name))
        target_positions = target_player.get("eligible_positions", [])
        target_is_pitcher = is_pitcher_position(target_positions)

        # 3. Analyze what categories the target team is weakest in
        batting_cats = list(DEFAULT_BATTING_CATS)
        pitching_cats = list(DEFAULT_PITCHING_CATS)
        _, their_weak_cats, their_strong_cats = _get_team_category_ranks(lg, target_team_key)

        # 4. Get our roster with z-scores
        my_roster = team.roster()
        my_players = []
        for p in my_roster:
            name = p.get("name", "Unknown")
            positions = p.get("eligible_positions", [])
            is_pitcher = is_pitcher_position(positions)
            z_val, tier, per_cat = _player_z_summary(name)
            my_players.append({
                "name": name,
                "player_id": str(p.get("player_id", "")),
                "positions": positions,
                "z_score": round(z_val, 2),
                "tier": tier,
                "per_category_zscores": per_cat,
                "is_pitcher": is_pitcher,
                "mlb_id": get_mlb_id(name),
            })

        # 5. Identify which of our players help fill their weaknesses
        #    and build trade proposals ranked by fairness
        tradeable = [p for p in my_players if p.get("tier") not in ("Untouchable",)]

        # Score each tradeable player on how well they address the other team's needs
        def _need_score(player):
            """How much does this player help the target team's weak categories?"""
            score = 0.0
            pcat = player.get("per_category_zscores", {})
            for cat in their_weak_cats:
                cat_z = pcat.get(cat, 0)
                if cat_z > 0:
                    score += cat_z
            return score

        def _fairness_score(offer_z, target_z_val):
            """0..1 fairness where 1.0 = perfectly balanced z-scores"""
            diff = abs(offer_z - target_z_val)
            if diff < 0.1:
                return 1.0
            if diff > 6.0:
                return 0.0
            return round(max(0.0, 1.0 - (diff / 6.0)), 2)

        # Build 1-for-1 proposals
        proposals = []
        for p in tradeable:
            offer_z = p.get("z_score", 0)
            fairness = _fairness_score(offer_z, target_z)
            # Skip wildly unfair (either direction)
            if fairness < 0.15:
                continue
            need = _need_score(p)
            # Composite: weight fairness heavily, add need bonus
            composite = fairness * 0.6 + min(need / 5.0, 0.4)

            # Determine which of their weak cats this player addresses
            addressed = []
            pcat = p.get("per_category_zscores", {})
            for cat in their_weak_cats:
                if pcat.get(cat, 0) > 0.3:
                    addressed.append(cat)

            # Determine what categories we gain from the target
            our_gain_cats = []
            for cat, z in target_per_cat.items():
                if z > 0.3:
                    our_gain_cats.append(cat)

            your_z_change = round(target_z - offer_z, 2)
            their_z_change = round(offer_z - target_z, 2)

            summary = ("Offer " + p.get("name", "?") + " (Z=" + str(offer_z)
                        + ") for " + target_player.get("name", target_name)
                        + " (Z=" + str(round(target_z, 2)) + ")")
            if addressed:
                summary += " -- they gain " + ", ".join(addressed[:3]) + " help"
            if our_gain_cats:
                summary += ", you gain " + ", ".join(our_gain_cats[:3])

            proposals.append({
                "offer": [p.get("name", "?")],
                "offer_details": [p],
                "receive": [target_player.get("name", target_name)],
                "receive_details": [{
                    "name": target_player.get("name", target_name),
                    "player_id": str(target_player.get("player_id", "")),
                    "positions": target_positions,
                    "z_score": round(target_z, 2),
                    "tier": target_tier,
                    "per_category_zscores": target_per_cat,
                    "mlb_id": get_mlb_id(target_player.get("name", target_name)),
                }],
                "your_z_change": your_z_change,
                "their_z_change": their_z_change,
                "fairness_score": fairness,
                "addresses_needs": addressed,
                "composite_score": round(composite, 3),
                "summary": summary,
            })

        # Also try 2-for-1 packages if target is high value
        if target_z >= 3.0:
            lower_tier = [p for p in tradeable
                          if p.get("z_score", 0) < target_z * 0.8]
            lower_tier.sort(key=lambda x: x.get("z_score", 0), reverse=True)
            tried_pairs = set()
            for i in range(min(len(lower_tier), 5)):
                for j in range(i + 1, min(len(lower_tier), 6)):
                    p1 = lower_tier[i]
                    p2 = lower_tier[j]
                    pair_key = p1.get("name", "") + "|" + p2.get("name", "")
                    if pair_key in tried_pairs:
                        continue
                    tried_pairs.add(pair_key)
                    combo_z = p1.get("z_score", 0) + p2.get("z_score", 0)
                    fairness = _fairness_score(combo_z, target_z)
                    if fairness < 0.25:
                        continue
                    need = _need_score(p1) + _need_score(p2)
                    composite = fairness * 0.6 + min(need / 5.0, 0.4)

                    addressed = []
                    for cat in their_weak_cats:
                        p1z = p1.get("per_category_zscores", {}).get(cat, 0)
                        p2z = p2.get("per_category_zscores", {}).get(cat, 0)
                        if p1z > 0.3 or p2z > 0.3:
                            addressed.append(cat)

                    your_z_change = round(target_z - combo_z, 2)
                    their_z_change = round(combo_z - target_z, 2)

                    summary = ("Offer " + p1.get("name", "?") + " + "
                                + p2.get("name", "?")
                                + " (combined Z=" + str(round(combo_z, 2))
                                + ") for " + target_player.get("name", target_name)
                                + " (Z=" + str(round(target_z, 2)) + ")")
                    if addressed:
                        summary += " -- they gain " + ", ".join(addressed[:3]) + " help"

                    proposals.append({
                        "offer": [p1.get("name", "?"), p2.get("name", "?")],
                        "offer_details": [p1, p2],
                        "receive": [target_player.get("name", target_name)],
                        "receive_details": [{
                            "name": target_player.get("name", target_name),
                            "player_id": str(target_player.get("player_id", "")),
                            "positions": target_positions,
                            "z_score": round(target_z, 2),
                            "tier": target_tier,
                            "per_category_zscores": target_per_cat,
                            "mlb_id": get_mlb_id(
                                target_player.get("name", target_name)),
                        }],
                        "your_z_change": your_z_change,
                        "their_z_change": their_z_change,
                        "fairness_score": fairness,
                        "addresses_needs": addressed,
                        "composite_score": round(composite, 3),
                        "summary": summary,
                    })

        # Sort by composite score and take top 3
        proposals.sort(key=lambda x: x.get("composite_score", 0), reverse=True)
        proposals = proposals[:3]

        # Enrich player details with intel
        all_details = []
        for prop in proposals:
            all_details.extend(prop.get("offer_details", []))
            all_details.extend(prop.get("receive_details", []))
        enrich_with_intel(all_details)

        result = {
            "target_player": target_player.get("name", target_name),
            "target_team": target_team_name,
            "target_team_needs": their_weak_cats,
            "target_z_score": round(target_z, 2),
            "target_tier": target_tier,
            "proposals": proposals,
        }

        if as_json:
            return result

        # CLI output
        print("Target: " + target_player.get("name", target_name)
              + " (Z=" + str(round(target_z, 2)) + ", " + target_tier + ")")
        print("Owner: " + target_team_name)
        print("Their weak categories: " + ", ".join(their_weak_cats))
        print("")
        if not proposals:
            print("No viable trade packages found."
                  " The z-score gap may be too large.")
            return
        for i, prop in enumerate(proposals):
            print("Proposal " + str(i + 1) + " (fairness: "
                  + str(prop.get("fairness_score", 0)) + "):")
            print("  " + prop.get("summary", ""))
            print("  Your net Z: " + str(prop.get("your_z_change", 0))
                  + " | Their net Z: "
                  + str(prop.get("their_z_change", 0)))
            if prop.get("addresses_needs"):
                print("  Addresses their needs: "
                      + ", ".join(prop.get("addresses_needs", [])))
            print("")

    except Exception as e:
        if as_json:
            return {"error": "Error running trade finder: " + str(e)}
        print("Error running trade finder: " + str(e))


def _assess_player_context(player, roster_position, percent_owned=None, percent_started=None, news=None):
    """Build qualitative context for a player beyond raw z-scores.
    Returns a dict with adjustment factor (0.5-1.3) and flags explaining why.

    Factors considered:
    - Injury status (IL, DTD, etc.) and severity
    - Roster position (bench/IL/NA = lower value, starting = higher)
    - Ownership/start % gaps (high owned but low started = benched/platoon)
    - Position scarcity
    - Recent news sentiment (injury reports, role changes, breakout buzz)
    """
    flags = []
    adjustment = 1.0
    status = player.get("status", "")
    positions = player.get("positions") or player.get("eligible_positions", [])
    pos_slot = roster_position or ""

    # --- Injury adjustment ---
    if status in ("IL", "IL+", "DL", "DL+"):
        flags.append("injured_IL")
        adjustment *= 0.6
    elif status == "DTD":
        flags.append("day_to_day")
        adjustment *= 0.85
    elif status in ("IL-LT",):
        flags.append("injured_long_term")
        adjustment *= 0.4

    # --- Roster position adjustment ---
    if pos_slot in ("BN", "Bench"):
        flags.append("benched")
        adjustment *= 0.85
    elif pos_slot in ("NA",):
        flags.append("minor_leagues")
        adjustment *= 0.5
    elif pos_slot in ("IL", "IL+", "DL", "DL+"):
        if "injured_IL" not in flags:
            flags.append("IL_slot")
            adjustment *= 0.65

    # --- Ownership/start gap ---
    if percent_owned is not None and percent_started is not None:
        if percent_owned > 50 and percent_started < percent_owned * 0.4:
            flags.append("low_start_rate")
            adjustment *= 0.8
        elif percent_started is not None and percent_started > 80:
            flags.append("high_start_rate")
            adjustment *= 1.05

    # --- Position scarcity bonus ---
    scarce_positions = ("C", "SS", "2B")
    active_positions = [p for p in positions if p not in ("BN", "Bench", "IL", "IL+", "DL", "DL+", "Util", "NA", "P")]
    if any(p in scarce_positions for p in active_positions):
        flags.append("scarce_position")
        adjustment *= 1.1

    # --- News sentiment adjustment ---
    if news and not news.get("error"):
        news_flags = news.get("flags", [])
        sentiment = news.get("sentiment", "neutral")
        headlines = news.get("headlines", [])

        # Add news flags for transparency
        flags.extend(news_flags)
        if headlines:
            flags.append("news:" + str(len(headlines)) + "_articles")

        # Adjust based on news sentiment
        neg_news = [f for f in news_flags if f.startswith("news_negative:")]
        pos_news = [f for f in news_flags if f.startswith("news_positive:")]

        # Specific high-impact news adjustments
        for nf in neg_news:
            kw = nf.split(":", 1)[-1]
            if kw in ("surgery", "torn", "shut down"):
                adjustment *= 0.5
            elif kw in ("injury", "injured", "il stint", "out for", "strain", "sprain", "fracture"):
                adjustment *= 0.7
            elif kw in ("demotion", "demoted", "sent down", "optioned"):
                adjustment *= 0.6
            elif kw in ("benched", "platoon", "lost job", "loses role"):
                adjustment *= 0.75
            elif kw in ("struggling", "slump", "bust", "avoid"):
                adjustment *= 0.85

        for nf in pos_news:
            kw = nf.split(":", 1)[-1]
            if kw in ("named closer", "closing"):
                adjustment *= 1.2
            elif kw in ("breakout", "career year", "dominant", "elite"):
                adjustment *= 1.15
            elif kw in ("promoted", "called up", "everyday"):
                adjustment *= 1.1
            elif kw in ("return", "returning", "comeback", "activated"):
                adjustment *= 1.1
            elif kw in ("velocity up", "stuff plus"):
                adjustment *= 1.1

    # Clamp
    adjustment = max(0.3, min(1.4, round(adjustment, 2)))

    return {
        "adjustment": adjustment,
        "effective_z": round(player.get("z_score", 0) * adjustment, 2),
        "flags": flags,
    }


def _build_player_entry(p, name, positions, z_val, tier, per_cat, roster_pos=None, news=None):
    """Build a player dict with qualitative context baked in."""
    entry = {
        "name": name,
        "player_id": str(p.get("player_id", "")),
        "positions": positions,
        "z_score": round(z_val, 2),
        "tier": tier,
        "per_category_zscores": per_cat,
        "status": p.get("status", ""),
        "is_pitcher": is_pitcher_position(positions),
        "roster_position": roster_pos or p.get("position", ""),
    }
    ctx = _assess_player_context(
        entry, roster_pos or p.get("position", ""),
        p.get("percent_owned"), p.get("percent_started"),
        news=news)
    entry["context"] = ctx
    entry["effective_z"] = ctx.get("effective_z", entry["z_score"])
    return entry


def _trade_finder_league_scan(lg, team, as_json=False):
    """League-wide trade partner scan with mutual benefit analysis.
    Analyzes BOTH sides' category weaknesses, positional needs, and surplus
    to find trades where both teams improve."""
    from valuations import get_player_zscore, DEFAULT_BATTING_CATS, DEFAULT_PITCHING_CATS

    batting_cats = list(DEFAULT_BATTING_CATS)
    pitching_cats = list(DEFAULT_PITCHING_CATS)

    # --- Phase 1: Build MY team profile ---
    my_team_key = team.team_key
    _, my_weak, my_strong = _team_cat_strengths_from_zscores(lg, my_team_key)

    my_roster = team.roster()

    # Fetch news for our roster players (used in qualitative assessment)
    my_names = [p.get("name", "") for p in my_roster]
    my_news = batch_player_news(my_names, max_results=3)

    my_players = []
    for p in my_roster:
        name = p.get("name", "Unknown")
        positions = p.get("eligible_positions", [])
        z_val, tier, per_cat = _player_z_summary(name)
        my_players.append(_build_player_entry(
            p, name, positions, z_val, tier, per_cat,
            news=my_news.get(name)))

    my_tradeable = [p for p in my_players
                    if p.get("tier") not in ("Untouchable",)
                    and p.get("status", "") not in ("IL", "IL+", "DL", "DL+")]

    # --- Phase 2: Analyze each opponent ---
    all_teams = lg.teams()
    partners = []
    _roster_cache = {}  # Cache rosters to avoid duplicate fetches
    _cat_profile_cache = {}  # Cache category profiles
    MAX_GOOD_PARTNERS = 3  # Early return threshold

    for other_key, other_data in all_teams.items():
        if TEAM_ID in str(other_key):
            continue
        other_name = other_data.get("name", "Unknown")

        # Use cached roster if available
        if other_key in _roster_cache:
            other_roster = _roster_cache[other_key]
        else:
            try:
                other_team = lg.to_team(other_key)
                other_roster = other_team.roster()
                _roster_cache[other_key] = other_roster
            except Exception:
                continue

        # Get their category profile (cached)
        if other_key in _cat_profile_cache:
            _, their_weak, their_strong = _cat_profile_cache[other_key]
        else:
            _, their_weak, their_strong = _team_cat_strengths_from_zscores(lg, other_key)
            _cat_profile_cache[other_key] = (_, their_weak, their_strong)

        # Build their roster with z-scores and qualitative context
        their_names = [p.get("name", "") for p in other_roster]
        their_news = batch_player_news(their_names, max_results=3)

        their_players = []
        their_hitters = []
        their_pitchers = []
        for p in other_roster:
            name = p.get("name", "Unknown")
            positions = p.get("eligible_positions", [])
            z_val, tier, per_cat = _player_z_summary(name)
            entry = _build_player_entry(
                p, name, positions, z_val, tier, per_cat,
                news=their_news.get(name))
            their_players.append(entry)
            if entry.get("is_pitcher"):
                their_pitchers.append(entry)
            else:
                their_hitters.append(entry)

        their_tradeable = [p for p in their_players
                           if p.get("tier") not in ("Untouchable",)
                           and p.get("status", "") not in ("IL", "IL+", "DL", "DL+")]

        # --- Phase 3: Score mutual complementarity ---
        # Category fit: my weak cats that are their strong, and vice versa
        i_need_they_have = [c for c in my_weak if c in their_strong]
        they_need_i_have = [c for c in their_weak if c in my_strong]

        if not i_need_they_have and not they_need_i_have:
            continue  # No mutual fit

        # Reward balanced mutual benefit
        my_benefit = len(i_need_they_have)
        their_benefit = len(they_need_i_have)
        mutual_score = min(my_benefit, their_benefit) * 2.0 + max(my_benefit, their_benefit) * 0.5

        # Type complementarity: do they need pitching and I have surplus? vice versa?
        my_pitcher_count = len([p for p in my_players if p.get("is_pitcher")])
        my_hitter_count = len([p for p in my_players if not p.get("is_pitcher")])
        their_pitcher_count = len(their_pitchers)
        their_hitter_count = len(their_hitters)

        # Bonus if we trade from opposite surplus types
        type_bonus = 0
        my_pit_heavy = my_pitcher_count > my_hitter_count
        their_pit_heavy = their_pitcher_count > their_hitter_count
        if my_pit_heavy != their_pit_heavy:
            type_bonus = 1.0

        total_score = round(mutual_score + type_bonus, 1)
        complementary = list(set(i_need_they_have + they_need_i_have))

        their_hitters.sort(key=lambda x: x.get("z_score", 0), reverse=True)
        their_pitchers.sort(key=lambda x: x.get("z_score", 0), reverse=True)

        partners.append({
            "team_key": other_key,
            "team_name": other_name,
            "score": total_score,
            "complementary_categories": complementary,
            "their_hitters": their_hitters[:5],
            "their_pitchers": their_pitchers[:5],
            "their_weak": their_weak,
            "their_strong": their_strong,
            "their_tradeable": their_tradeable,
            "i_need_they_have": i_need_they_have,
            "they_need_i_have": they_need_i_have,
        })

        # Early return: stop scanning once we have enough strong partners
        good_partners = [p for p in partners if p.get("score", 0) >= 3.0]
        if len(good_partners) >= MAX_GOOD_PARTNERS:
            break

    partners.sort(key=lambda p: p.get("score", 0), reverse=True)
    partners = partners[:5]

    # --- Phase 4: Build mutually beneficial packages ---
    def _cat_gain(player, weak_cats):
        """How much does this player help in the given weak categories?"""
        total = 0.0
        pcat = player.get("per_category_zscores", {})
        helped = []
        for cat in weak_cats:
            z = pcat.get(cat, 0)
            if z > 0.3:
                total += z
                helped.append(cat)
        return total, helped

    suggestions = []
    for partner in partners:
        their_tradeable = partner.get("their_tradeable", [])
        their_weak = partner.get("their_weak", [])
        i_need_they_have = partner.get("i_need_they_have", [])
        they_need_i_have = partner.get("they_need_i_have", [])

        scored_packages = []

        # Try 1-for-1 packages using effective_z (qualitative-adjusted)
        for my_p in my_tradeable:
            my_eff = my_p.get("effective_z", my_p.get("z_score", 0))
            their_gain, their_helped = _cat_gain(my_p, their_weak)

            for their_p in their_tradeable:
                their_eff = their_p.get("effective_z", their_p.get("z_score", 0))

                # Effective z-score fairness
                eff_diff = abs(their_eff - my_eff)
                if eff_diff > 10.0:
                    continue

                my_gain, my_helped = _cat_gain(their_p, my_weak)

                # Both sides must gain something
                if their_gain < 0.5 and my_gain < 0.5:
                    continue

                # Mutual benefit score
                mutual = min(my_gain, their_gain) * 2.0 + max(my_gain, their_gain) * 0.3

                # Fairness on effective z (not raw) — injured/benched players trade at discount
                fairness = max(0, 1.0 - eff_diff / 12.0)
                score = mutual * fairness

                # Build rationale with qualitative context
                rationale_parts = []
                if my_helped:
                    rationale_parts.append("You gain " + ", ".join(my_helped[:3]) + " help")
                if their_helped:
                    rationale_parts.append("They gain " + ", ".join(their_helped[:3]) + " help")
                if my_p.get("is_pitcher") and not their_p.get("is_pitcher"):
                    rationale_parts.append("SP->bat swap from your pitching surplus")
                elif not my_p.get("is_pitcher") and their_p.get("is_pitcher"):
                    rationale_parts.append("bat->SP swap filling your pitching need")

                # Surface qualitative flags
                their_flags = their_p.get("context", {}).get("flags", [])
                my_flags = my_p.get("context", {}).get("flags", [])
                if "injured_IL" in their_flags or "injured_long_term" in their_flags:
                    rationale_parts.append("NOTE: " + their_p.get("name", "?") + " is injured (buy-low opportunity)")
                if "benched" in their_flags:
                    rationale_parts.append("NOTE: " + their_p.get("name", "?") + " is on their bench")
                if "minor_leagues" in their_flags:
                    rationale_parts.append("NOTE: " + their_p.get("name", "?") + " is in minors")

                why_accept = ""
                if their_helped:
                    why_accept = "They accept: fills their weak " + ", ".join(their_helped[:3])
                    if their_eff > my_eff + 2:
                        why_accept += " — they overpay on z-score but gain category value"
                    elif "benched" in my_flags:
                        why_accept += " — your bench player fills their need"
                    else:
                        why_accept += " — fair effective value"
                rationale = ". ".join(rationale_parts)
                if why_accept:
                    rationale += ". " + why_accept

                scored_packages.append({
                    "give": [my_p],
                    "get": [their_p],
                    "z_diff": round(their_p.get("z_score", 0) - my_p.get("z_score", 0), 2),
                    "rationale": rationale,
                    "mutual_score": round(score, 2),
                    "my_gain": round(my_gain, 2),
                    "their_gain": round(their_gain, 2),
                })

        # Try 2-for-1 packages using effective_z
        if len(my_tradeable) >= 2:
            my_sorted = sorted(my_tradeable, key=lambda x: x.get("effective_z", 0))
            for i in range(min(len(my_sorted), 4)):
                for j in range(i + 1, min(len(my_sorted), 5)):
                    p1 = my_sorted[i]
                    p2 = my_sorted[j]
                    combo_eff = p1.get("effective_z", 0) + p2.get("effective_z", 0)
                    combo_their_gain = _cat_gain(p1, their_weak)[0] + _cat_gain(p2, their_weak)[0]
                    _, p1_helped = _cat_gain(p1, their_weak)
                    _, p2_helped = _cat_gain(p2, their_weak)
                    combo_helped = list(set(p1_helped + p2_helped))

                    if combo_their_gain < 1.0:
                        continue

                    for their_p in their_tradeable:
                        their_eff = their_p.get("effective_z", their_p.get("z_score", 0))
                        if their_eff < 10.0:
                            continue
                        eff_diff = abs(their_eff - combo_eff)
                        if eff_diff > 12.0:
                            continue

                        my_gain, my_helped = _cat_gain(their_p, my_weak)
                        if my_gain < 0.5:
                            continue

                        mutual = min(my_gain, combo_their_gain) * 2.0 + max(my_gain, combo_their_gain) * 0.3
                        fairness = max(0, 1.0 - eff_diff / 14.0)
                        score = mutual * fairness

                        rationale = "2-for-1: consolidate roster talent"
                        if my_helped:
                            rationale += ". You gain " + ", ".join(my_helped[:3])
                        their_flags = their_p.get("context", {}).get("flags", [])
                        if "injured_IL" in their_flags:
                            rationale += " (buy-low: " + their_p.get("name", "?") + " is injured)"
                        if combo_helped:
                            rationale += ". They accept: gain " + ", ".join(combo_helped[:3]) + " help + roster flexibility"

                        scored_packages.append({
                            "give": [p1, p2],
                            "get": [their_p],
                            "z_diff": round(their_p.get("z_score", 0) - (p1.get("z_score", 0) + p2.get("z_score", 0)), 2),
                            "rationale": rationale,
                            "mutual_score": round(score, 2),
                            "my_gain": round(my_gain, 2),
                            "their_gain": round(combo_their_gain, 2),
                        })

        # Sort by mutual score, take top 3
        scored_packages.sort(key=lambda x: x.get("mutual_score", 0), reverse=True)

        # De-dup: don't show multiple packages with same give player
        seen_gives = set()
        final_packages = []
        for pkg in scored_packages:
            give_key = "|".join(sorted([p.get("name", "") for p in pkg.get("give", [])]))
            if give_key in seen_gives:
                continue
            seen_gives.add(give_key)
            final_packages.append(pkg)
            if len(final_packages) >= 3:
                break

        # Clean up internal fields before returning
        clean_partner = {
            "team_key": partner.get("team_key"),
            "team_name": partner.get("team_name"),
            "score": partner.get("score"),
            "complementary_categories": partner.get("complementary_categories"),
            "their_hitters": partner.get("their_hitters"),
            "their_pitchers": partner.get("their_pitchers"),
            "packages": final_packages,
        }
        suggestions.append(clean_partner)

    if as_json:
        return {
            "weak_categories": my_weak,
            "strong_categories": my_strong,
            "partners": suggestions,
        }

    print("Trade Finder (Mutual Benefit Analysis)")
    print("=" * 50)
    print("Your weak categories: " + ", ".join(my_weak))
    print("Your strong categories: " + ", ".join(my_strong))
    print("")
    if not suggestions:
        print("No complementary trade partners found")
        return
    for partner in suggestions:
        print("Trade Partner: " + partner.get("team_name", "?")
              + " (mutual fit: " + str(partner.get("score", 0)) + ")")
        print("  Complementary in: "
              + ", ".join(partner.get("complementary_categories", [])))
        for pkg in partner.get("packages", []):
            give_names = ", ".join(
                [p.get("name", "?") + " (z:" + str(p.get("z_score", 0)) + ")"
                 for p in pkg.get("give", [])])
            get_names = ", ".join(
                [p.get("name", "?") + " (z:" + str(p.get("z_score", 0)) + ")"
                 for p in pkg.get("get", [])])
            print("  Give: " + give_names + " <-> Get: " + get_names)
            print("    " + pkg.get("rationale", ""))
            print("    Mutual score: " + str(pkg.get("mutual_score", 0))
                  + " (you gain: " + str(pkg.get("my_gain", 0))
                  + ", they gain: " + str(pkg.get("their_gain", 0)) + ")")
        print("")


def _extract_team_meta(team_data):
    """Extract team_logo URL and manager image from lg.teams() entry"""
    logos = team_data.get("team_logos", [])
    logo_url = ""
    if logos:
        logo_url = logos[0].get("team_logo", {}).get("url", "")
    mgr_image = ""
    managers = team_data.get("managers", [])
    if managers:
        m = managers[0].get("manager", managers[0])
        mgr_image = m.get("image_url", "")
    return logo_url, mgr_image


def cmd_power_rankings(args, as_json=False):
    """Rank all teams by estimated roster strength"""
    sc, gm, lg = get_league()
    try:
        all_teams = lg.teams()
        rankings = []
        for team_key, team_data in all_teams.items():
            team_name = team_data.get("name", "Unknown")
            logo_url, mgr_image = _extract_team_meta(team_data)
            try:
                t = lg.to_team(team_key)
                roster = t.roster()
            except Exception:
                continue
            hitting_count = 0
            pitching_count = 0
            total_owned_pct = 0
            for p in roster:
                positions = p.get("eligible_positions", [])
                is_pitcher = is_pitcher_position(positions)
                pct = p.get("percent_owned", 0)
                if isinstance(pct, (int, float)):
                    total_owned_pct += float(pct)
                if is_pitcher:
                    pitching_count += 1
                else:
                    hitting_count += 1
            # Use aggregate ownership % as a proxy for team strength
            roster_size = len(roster) if roster else 1
            avg_owned = total_owned_pct / roster_size if roster_size > 0 else 0
            rankings.append({
                "team_key": team_key,
                "name": team_name,
                "hitting_count": hitting_count,
                "pitching_count": pitching_count,
                "roster_size": roster_size,
                "avg_owned_pct": round(avg_owned, 1),
                "total_score": round(total_owned_pct, 1),
                "is_my_team": TEAM_ID in str(team_key),
                "team_logo": logo_url,
                "manager_image": mgr_image,
            })
        rankings.sort(key=lambda r: r.get("total_score", 0), reverse=True)
        for i, r in enumerate(rankings):
            r["rank"] = i + 1
        if as_json:
            return {"rankings": rankings}
        print("Power Rankings:")
        print("  " + "#".rjust(3) + "  " + "Team".ljust(30) + "Avg Own%".rjust(9) + "  H/P".rjust(6))
        print("  " + "-" * 52)
        for r in rankings:
            marker = " <-- YOU" if r.get("is_my_team") else ""
            print("  " + str(r.get("rank", "?")).rjust(3) + "  " + r.get("name", "?").ljust(30)
                  + str(r.get("avg_owned_pct", 0)).rjust(8) + "%"
                  + "  " + str(r.get("hitting_count", 0)) + "/" + str(r.get("pitching_count", 0))
                  + marker)
    except Exception as e:
        if as_json:
            return {"error": "Error building power rankings: " + str(e)}
        print("Error building power rankings: " + str(e))


def cmd_week_planner(args, as_json=False):
    """Show games-per-day grid for your roster this week"""
    sc, gm, lg, team = get_league_context()
    try:
        # Get week date range
        current_week = lg.current_week()
        week_num = int(args[0]) if args else current_week
        try:
            week_range = lg.week_date_range(week_num)
            start_date = str(week_range[0])
            end_date = str(week_range[1])
        except Exception:
            # Fallback: current week Mon-Sun
            today = date.today()
            start_of_week = today - timedelta(days=today.weekday())
            end_of_week = start_of_week + timedelta(days=6)
            start_date = start_of_week.isoformat()
            end_date = end_of_week.isoformat()

        # Get schedule for the week
        schedule = get_schedule_for_range(start_date, end_date)

        # Build team -> dates with games mapping
        team_game_dates = {}
        for game in schedule:
            game_date = game.get("game_date", "")
            for side in ["away_name", "home_name"]:
                team_name = game.get(side, "")
                if team_name:
                    norm = normalize_team_name(team_name)
                    if norm not in team_game_dates:
                        team_game_dates[norm] = set()
                    team_game_dates[norm].add(game_date)

        # Get roster and match players to their MLB teams
        roster = team.roster()
        # Build date list for the week
        s = datetime.strptime(start_date, "%Y-%m-%d").date()
        e = datetime.strptime(end_date, "%Y-%m-%d").date()
        dates = []
        d = s
        while d <= e:
            dates.append(d.isoformat())
            d += timedelta(days=1)

        player_schedule = []
        daily_totals = {dt: 0 for dt in dates}
        for p in roster:
            name = p.get("name", "Unknown")
            positions = p.get("eligible_positions", [])
            pos = get_player_position(p)
            player_team = get_player_team(p)
            player_team_norm = normalize_team_name(player_team)
            # Also resolve alias to full name for matching
            player_team_full = normalize_team_name(TEAM_ALIASES.get(player_team, player_team))
            games_by_date = {}
            total_games = 0
            for dt in dates:
                has_game = False
                for norm_team, game_dates in team_game_dates.items():
                    if dt in game_dates and (player_team_norm in norm_team or player_team_full in norm_team
                                             or norm_team in player_team_norm or norm_team in player_team_full):
                        has_game = True
                        break
                games_by_date[dt] = has_game
                if has_game:
                    total_games += 1
                    if pos not in ["BN", "IL", "IL+", "NA"]:
                        daily_totals[dt] = daily_totals.get(dt, 0) + 1

            player_schedule.append({
                "name": name,
                "position": pos,
                "positions": positions,
                "mlb_team": player_team,
                "total_games": total_games,
                "games_by_date": games_by_date,
            })

        if as_json:
            return {
                "week": week_num,
                "start_date": start_date,
                "end_date": end_date,
                "dates": dates,
                "players": player_schedule,
                "daily_totals": daily_totals,
            }

        print("Week " + str(week_num) + " Planner (" + start_date + " to " + end_date + ")")
        print("=" * 50)
        # Simplified CLI output
        date_headers = [dt[-5:] for dt in dates]  # MM-DD
        print("  " + "Player".ljust(20) + "Pos".ljust(5) + "  ".join(date_headers))
        print("  " + "-" * (25 + len(dates) * 7))
        for ps in player_schedule:
            day_marks = []
            for dt in dates:
                if ps.get("games_by_date", {}).get(dt):
                    day_marks.append("  *  ")
                else:
                    day_marks.append("  -  ")
            print("  " + ps.get("name", "?")[:20].ljust(20) + ps.get("position", "?").ljust(5) + "".join(day_marks))

    except Exception as e:
        if as_json:
            return {"error": "Error building week planner: " + str(e)}
        print("Error building week planner: " + str(e))


def cmd_season_pace(args, as_json=False):
    """Project season pace, playoff odds, and magic number"""
    sc, gm, lg = get_league()
    try:
        standings = lg.standings()
        settings = lg.settings()
        current_week = lg.current_week()
        try:
            end_week = int(lg.end_week())
        except Exception:
            end_week = settings.get("end_week", 22)
            if not end_week:
                end_week = 22
            end_week = int(end_week)
        playoff_teams = int(settings.get("num_playoff_teams", 6))

        # Fetch teams for logo/avatar data
        team_meta = {}
        try:
            all_teams = lg.teams()
            for tk, td in all_teams.items():
                tname = td.get("name", "")
                logo_url, mgr_image = _extract_team_meta(td)
                team_meta[tname] = {"team_logo": logo_url, "manager_image": mgr_image}
        except Exception:
            pass

        team_paces = []
        for i, t in enumerate(standings, 1):
            name = t.get("name", "Unknown")
            wins = int(t.get("outcome_totals", {}).get("wins", 0))
            losses = int(t.get("outcome_totals", {}).get("losses", 0))
            ties = int(t.get("outcome_totals", {}).get("ties", 0))
            weeks_played = wins + losses + ties
            if weeks_played == 0:
                weeks_played = max(1, current_week - 1)
            remaining_weeks = end_week - current_week + 1
            if remaining_weeks < 0:
                remaining_weeks = 0
            total_weeks = end_week
            win_pct = float(wins) / weeks_played if weeks_played > 0 else 0
            projected_wins = round(win_pct * total_weeks, 1)
            projected_losses = round((1 - win_pct) * total_weeks, 1)
            is_my_team = TEAM_ID in str(t.get("team_key", ""))
            meta = team_meta.get(name, {})

            team_paces.append({
                "rank": i,
                "name": name,
                "wins": wins,
                "losses": losses,
                "ties": ties,
                "weeks_played": weeks_played,
                "remaining_weeks": remaining_weeks,
                "win_pct": round(win_pct, 3),
                "projected_wins": projected_wins,
                "projected_losses": projected_losses,
                "is_my_team": is_my_team,
                "team_logo": meta.get("team_logo", ""),
                "manager_image": meta.get("manager_image", ""),
            })

        # Calculate magic number for playoff spot
        # Magic number = wins needed - current wins
        # wins_needed = projected wins of team in last playoff spot + 1
        if len(team_paces) >= playoff_teams:
            cutoff_team = team_paces[playoff_teams - 1]
            cutoff_projected = cutoff_team.get("projected_wins", 0)
        else:
            cutoff_projected = 0

        for t in team_paces:
            if t.get("projected_wins", 0) > cutoff_projected:
                t["playoff_status"] = "in"
            elif t.get("projected_wins", 0) == cutoff_projected:
                t["playoff_status"] = "bubble"
            else:
                t["playoff_status"] = "out"
            magic = max(0, round(cutoff_projected - t.get("wins", 0) + 1, 1))
            t["magic_number"] = magic

        if as_json:
            return {
                "current_week": current_week,
                "end_week": end_week,
                "playoff_teams": playoff_teams,
                "teams": team_paces,
            }

        print("Season Pace & Projections (Week " + str(current_week) + "/" + str(end_week) + ")")
        print("Playoff spots: " + str(playoff_teams))
        print("=" * 60)
        print("  " + "#".rjust(3) + "  " + "Team".ljust(28) + "Record".rjust(8) + "  Pace".rjust(6) + "  Magic#".rjust(8) + "  Status")
        print("  " + "-" * 70)
        for t in team_paces:
            record = str(t.get("wins", 0)) + "-" + str(t.get("losses", 0))
            if t.get("ties", 0):
                record += "-" + str(t.get("ties", 0))
            pace = str(t.get("projected_wins", 0))
            magic = str(t.get("magic_number", "?"))
            status = t.get("playoff_status", "?")
            marker = " <-- YOU" if t.get("is_my_team") else ""
            print("  " + str(t.get("rank", "?")).rjust(3) + "  " + t.get("name", "?").ljust(28)
                  + record.rjust(8) + "  " + pace.rjust(5) + "  " + magic.rjust(7) + "  " + status + marker)

    except Exception as e:
        if as_json:
            return {"error": "Error calculating season pace: " + str(e)}
        print("Error calculating season pace: " + str(e))


def cmd_closer_monitor(args, as_json=False):
    """Monitor closer situations across MLB - saves leaders, committees, at-risk closers"""
    sc, gm, lg = get_league()
    try:
        # Get saves leaders from free agents (high-ownership RPs)
        fa_pitchers = lg.free_agents("P")[:50]
        rp_closers = []
        for p in fa_pitchers:
            positions = p.get("eligible_positions", [])
            if "RP" in positions:
                pct = p.get("percent_owned", 0)
                if isinstance(pct, (int, float)) and float(pct) > 20:
                    rp_closers.append({
                        "name": p.get("name", "Unknown"),
                        "player_id": str(p.get("player_id", "")),
                        "positions": positions,
                        "percent_owned": float(pct),
                        "status": p.get("status", ""),
                        "mlb_id": get_mlb_id(p.get("name", "")),
                        "ownership": "free_agent",
                    })

        # Get our roster RPs for context
        team = lg.to_team(TEAM_ID)
        roster = team.roster()
        my_closers = []
        for p in roster:
            positions = p.get("eligible_positions", [])
            if "RP" in positions:
                my_closers.append({
                    "name": p.get("name", "Unknown"),
                    "player_id": str(p.get("player_id", "")),
                    "positions": positions,
                    "status": p.get("status", ""),
                    "mlb_id": get_mlb_id(p.get("name", "")),
                    "ownership": "my_team",
                })

        # Sort available closers by ownership %
        rp_closers.sort(key=lambda x: x.get("percent_owned", 0), reverse=True)

        # Try to get saves leaders from MLB Stats API
        saves_leaders = []
        try:
            if statsapi:
                leaders_data = statsapi.league_leaders("saves", limit=30)
                if isinstance(leaders_data, str):
                    # Parse the text output
                    for line in leaders_data.strip().split("\n")[1:]:
                        parts = line.strip().split()
                        if len(parts) >= 3:
                            saves_leaders.append({
                                "name": " ".join(parts[1:-1]),
                                "saves": parts[-1],
                            })
        except Exception:
            pass

        if as_json:
            return {
                "my_closers": my_closers,
                "available_closers": rp_closers[:15],
                "saves_leaders": saves_leaders[:15],
            }

        print("Closer Monitor")
        print("=" * 50)
        if my_closers:
            print("Your Closers/RPs:")
            for p in my_closers:
                status = " [" + p.get("status", "") + "]" if p.get("status") else ""
                print("  " + p.get("name", "?").ljust(25) + " (rostered)" + status)
            print("")
        print("Available Closers (by ownership %):")
        for p in rp_closers[:15]:
            status = " [" + p.get("status", "") + "]" if p.get("status") else ""
            print("  " + p.get("name", "?").ljust(25) + " " + str(p.get("percent_owned", 0)) + "% owned" + status
                  + "  (id:" + p.get("player_id", "?") + ")")
        if saves_leaders:
            print("")
            print("MLB Saves Leaders:")
            for i, p in enumerate(saves_leaders[:10], 1):
                print("  " + str(i).rjust(2) + ". " + p.get("name", "?").ljust(25) + " " + str(p.get("saves", 0)) + " saves")

    except Exception as e:
        if as_json:
            return {"error": "Error building closer monitor: " + str(e)}
        print("Error building closer monitor: " + str(e))


def cmd_pitcher_matchup(args, as_json=False):
    """Show pitcher matchup quality for rostered SPs based on opponent team batting stats"""
    sc, gm, lg, team = get_league_context()
    try:
        # Get week date range
        current_week = lg.current_week()
        week_num = int(args[0]) if args else current_week
        try:
            week_range = lg.week_date_range(week_num)
            start_date = str(week_range[0])
            end_date = str(week_range[1])
        except Exception:
            today = date.today()
            start_of_week = today - timedelta(days=today.weekday())
            end_of_week = start_of_week + timedelta(days=6)
            start_date = start_of_week.isoformat()
            end_date = end_of_week.isoformat()

        # Get roster SPs
        roster = team.roster()
        pitchers = []
        for p in roster:
            positions = p.get("eligible_positions", [])
            if "SP" in positions:
                pitchers.append(p)

        if not pitchers:
            result = {
                "week": week_num,
                "start_date": start_date,
                "end_date": end_date,
                "pitchers": [],
            }
            if as_json:
                return result
            print("No starting pitchers on roster")
            return

        # Get schedule for the week to find probable pitchers
        schedule = get_schedule_for_range(start_date, end_date)

        # Try to get probable pitchers via statsapi hydrate
        probable_map = {}  # pitcher_name_norm -> [game_info, ...]
        try:
            if statsapi:
                prob_sched = statsapi.schedule(start_date=start_date, end_date=end_date, hydrate="probablePitcher")
                for game in prob_sched:
                    game_date = game.get("game_date", "")
                    for side in ["away_probable_pitcher", "home_probable_pitcher"]:
                        pitcher_name = game.get(side, "")
                        if pitcher_name:
                            norm = pitcher_name.strip().lower()
                            if norm not in probable_map:
                                probable_map[norm] = []
                            opp_side = "home_name" if "away" in side else "away_name"
                            ha = "away" if "away" in side else "home"
                            probable_map[norm].append({
                                "date": game_date,
                                "opponent": game.get(opp_side, ""),
                                "home_away": ha,
                            })
        except Exception as e:
            print("  Warning: probable pitcher fetch failed: " + str(e))

        # Build team batting stats lookup (opponent quality)
        team_batting = {}
        try:
            from pybaseball import team_batting as pb_team_batting
            season = date.today().year
            tb = pb_team_batting(season)
            if tb is not None and len(tb) > 0:
                for _, row in tb.iterrows():
                    team_name = str(row.get("Team", ""))
                    k_val = row.get("SO%") or row.get("K%") or 0
                    team_batting[normalize_team_name(team_name)] = {
                        "avg": float(row.get("AVG") or 0),
                        "obp": float(row.get("OBP") or 0),
                        "k_pct": float(k_val) / 100 if k_val else 0,
                        "woba": float(row.get("wOBA") or 0),
                    }
        except Exception as e:
            print("  Warning: pybaseball team batting failed: " + str(e))

        # Match each SP to their upcoming starts
        pitcher_matchups = []
        for p in pitchers:
            name = p.get("name", "Unknown")
            player_id = str(p.get("player_id", ""))
            player_team = get_player_team(p)
            name_norm = name.strip().lower()

            # Find starts from probable pitcher data
            starts = probable_map.get(name_norm, [])

            if not starts:
                # Fallback: find games for their team this week
                team_norm = normalize_team_name(player_team)
                team_full = normalize_team_name(TEAM_ALIASES.get(player_team, player_team))
                for game in schedule:
                    away = normalize_team_name(game.get("away_name", ""))
                    home = normalize_team_name(game.get("home_name", ""))
                    if team_norm in away or team_full in away:
                        starts.append({
                            "date": game.get("game_date", ""),
                            "opponent": game.get("home_name", ""),
                            "home_away": "away",
                        })
                    elif team_norm in home or team_full in home:
                        starts.append({
                            "date": game.get("game_date", ""),
                            "opponent": game.get("away_name", ""),
                            "home_away": "home",
                        })
                # If fallback, only show first 2 at most
                starts = starts[:2]

            is_two_start = len(starts) >= 2

            for s in starts:
                opp_name = s.get("opponent", "Unknown")
                opp_norm = normalize_team_name(opp_name)

                # Find team batting stats
                opp_stats = None
                for tk, tv in team_batting.items():
                    if opp_norm in tk or tk in opp_norm:
                        opp_stats = tv
                        break

                opp_avg = opp_stats.get("avg", 0) if opp_stats else 0
                opp_obp = opp_stats.get("obp", 0) if opp_stats else 0
                opp_k_pct = opp_stats.get("k_pct", 0) if opp_stats else 0
                opp_woba = opp_stats.get("woba", 0) if opp_stats else 0

                # Grade the matchup (lower opponent batting = better for pitcher)
                grade = "C"
                if opp_stats:
                    score = 0
                    # Lower AVG is good for pitcher
                    if opp_avg < .235:
                        score += 2
                    elif opp_avg < .250:
                        score += 1
                    elif opp_avg > .270:
                        score -= 1
                    # Lower OBP is good
                    if opp_obp < .310:
                        score += 2
                    elif opp_obp < .325:
                        score += 1
                    elif opp_obp > .345:
                        score -= 1
                    # Higher K% is good for pitcher
                    if opp_k_pct > .25:
                        score += 2
                    elif opp_k_pct > .22:
                        score += 1
                    elif opp_k_pct < .18:
                        score -= 1
                    # Lower wOBA is good
                    if opp_woba < .300:
                        score += 2
                    elif opp_woba < .315:
                        score += 1
                    elif opp_woba > .340:
                        score -= 1

                    if score >= 5:
                        grade = "A"
                    elif score >= 3:
                        grade = "B"
                    elif score >= 1:
                        grade = "C"
                    elif score >= -1:
                        grade = "D"
                    else:
                        grade = "F"

                pitcher_matchups.append({
                    "name": name,
                    "player_id": player_id,
                    "mlb_team": player_team,
                    "next_start_date": s.get("date", ""),
                    "opponent": opp_name,
                    "home_away": s.get("home_away", ""),
                    "opp_avg": round(opp_avg, 3),
                    "opp_obp": round(opp_obp, 3),
                    "opp_k_pct": round(opp_k_pct, 3),
                    "opp_woba": round(opp_woba, 3),
                    "matchup_grade": grade,
                    "two_start": is_two_start,
                })

        if as_json:
            return {
                "week": week_num,
                "start_date": start_date,
                "end_date": end_date,
                "pitchers": pitcher_matchups,
            }

        print("Pitcher Matchups - Week " + str(week_num) + " (" + start_date + " to " + end_date + ")")
        print("=" * 60)
        print("  " + "Pitcher".ljust(22) + "Start".ljust(12) + "Opponent".ljust(15) + "H/A".ljust(6) + "Grade")
        print("  " + "-" * 55)
        for pm in pitcher_matchups:
            ha = "vs" if pm.get("home_away") == "home" else "@"
            ts = " [2S]" if pm.get("two_start") else ""
            print("  " + pm.get("name", "?")[:22].ljust(22) + pm.get("next_start_date", "")[:10].ljust(12)
                  + (ha + " " + pm.get("opponent", "?"))[:15].ljust(15) + pm.get("home_away", "").ljust(6)
                  + pm.get("matchup_grade", "?") + ts)

    except Exception as e:
        if as_json:
            return {"error": "Error building pitcher matchups: " + str(e)}
        print("Error building pitcher matchups: " + str(e))


def cmd_roster_stats(args, as_json=False):
    """Show stats for every player on a roster for a given period"""
    period = "season"
    week = None
    team_key = None

    for arg in args:
        if arg.startswith("--period="):
            period = arg.split("=", 1)[1]
        elif arg.startswith("--week="):
            week = arg.split("=", 1)[1]
        elif arg.startswith("--team="):
            team_key = arg.split("=", 1)[1]

    if period == "week" and week:
        req_type = "week"
    else:
        req_type = period

    sc, gm, lg, team = get_league_context()
    if team_key:
        team = lg.to_team(team_key)

    try:
        # Get roster (for specific week if requested)
        if week:
            roster = team.roster(week=int(week))
        else:
            roster = team.roster()

        if not roster:
            if as_json:
                return {"players": [], "period": period}
            print("Roster is empty")
            return

        # Collect player IDs
        player_ids = []
        player_map = {}
        for p in roster:
            pid = p.get("player_id", "")
            if pid:
                player_ids.append(pid)
                player_map[str(pid)] = p

        if not player_ids:
            if as_json:
                return {"players": [], "period": period}
            print("No player IDs found on roster")
            return

        # Fetch stats in batch
        kwargs = {"req_type": req_type}
        if req_type == "week" and week:
            kwargs["week"] = int(week)

        stats = lg.player_stats(player_ids, **kwargs)

        results = []
        if stats:
            for ps in (stats if isinstance(stats, list) else [stats]):
                pid = str(ps.get("player_id", ""))
                roster_entry = player_map.get(pid, {})
                pos = get_player_position(roster_entry)
                pname = roster_entry.get("name", ps.get("name", "Unknown"))
                results.append({
                    "name": pname,
                    "player_id": pid,
                    "position": pos,
                    "eligible_positions": roster_entry.get("eligible_positions", []),
                    "stats": ps,
                    "mlb_id": get_mlb_id(pname),
                })

        if as_json:
            return {
                "players": results,
                "period": period,
                "week": week,
            }

        print("Roster Stats (" + period + "):")
        for r in results:
            print("  " + r.get("position", "?").ljust(4) + " " + r.get("name", "?").ljust(25))
            st = r.get("stats", {})
            if isinstance(st, dict):
                stat_parts = []
                for k, v in st.items():
                    if k not in ("player_id", "name"):
                        stat_parts.append(str(k) + ":" + str(v))
                if stat_parts:
                    print("       " + "  ".join(stat_parts))

    except Exception as e:
        if as_json:
            return {"error": "Error fetching roster stats: " + str(e)}
        print("Error fetching roster stats: " + str(e))


def cmd_faab_recommend(args, as_json=False):
    """Recommend FAAB bid amount for a player
    Args: player_name
    """
    if not args:
        if as_json:
            return {"error": "Usage: faab-recommend <player_name>"}
        print("Usage: faab-recommend <player_name>")
        return

    player_name = " ".join(args)
    sc, gm, lg = get_league()

    # Get FAAB balance
    faab_remaining = 100  # default
    try:
        team = lg.to_team(TEAM_ID)
        details = team.details() if hasattr(team, "details") else None
        if details:
            d = details[0] if isinstance(details, list) and len(details) > 0 else (details if isinstance(details, dict) else {})
            fb = d.get("faab_balance", None)
            if fb is not None:
                faab_remaining = int(fb)
    except Exception as e:
        print("Warning: could not fetch FAAB balance: " + str(e))

    # Get player z-score and value
    from valuations import get_player_zscore, project_category_impact
    player_info = get_player_zscore(player_name)
    if not player_info:
        if as_json:
            return {"error": "Player not found: " + player_name}
        print("Player not found: " + player_name)
        return

    z_final = player_info.get("z_final", 0)
    tier = player_info.get("tier", "Streamable")

    # Calculate recommended bid based on z-score and remaining budget
    # Higher z-score = higher bid, scaled by remaining budget
    if z_final >= 4.0:  # Untouchable
        bid_pct = 0.25
    elif z_final >= 2.0:  # Core
        bid_pct = 0.15
    elif z_final >= 1.0:  # Solid
        bid_pct = 0.08
    elif z_final >= 0.0:  # Fringe
        bid_pct = 0.04
    else:  # Streamable
        bid_pct = 0.01

    recommended_bid = max(1, int(faab_remaining * bid_pct))
    bid_low = max(1, int(recommended_bid * 0.7))
    bid_high = min(faab_remaining, int(recommended_bid * 1.4))

    # Get category impact
    impact = project_category_impact([player_name], [])
    improving = impact.get("improving_categories", [])

    # Build reasoning
    reasons = []
    reasons.append("Player value: " + tier + " tier (z=" + str(round(z_final, 2)) + ")")
    reasons.append("FAAB remaining: $" + str(faab_remaining))
    if improving:
        reasons.append("Improves: " + ", ".join(improving[:4]))

    result = {
        "player": {
            "name": player_info.get("name", player_name),
            "z_final": z_final,
            "tier": tier,
            "pos": player_info.get("pos", ""),
            "team": player_info.get("team", ""),
        },
        "recommended_bid": recommended_bid,
        "bid_range": {"low": bid_low, "high": bid_high},
        "faab_remaining": faab_remaining,
        "faab_after": faab_remaining - recommended_bid,
        "pct_of_budget": round(recommended_bid / max(faab_remaining, 1) * 100, 1),
        "reasoning": reasons,
        "category_impact": impact.get("category_impact", {}),
        "improving_categories": improving,
    }

    if as_json:
        return result

    # CLI output
    print("FAAB Recommendation: " + player_info.get("name", player_name))
    print("=" * 50)
    print("  Recommended Bid: $" + str(recommended_bid) + " (range: $" + str(bid_low) + "-$" + str(bid_high) + ")")
    print("  FAAB Remaining: $" + str(faab_remaining) + " -> $" + str(faab_remaining - recommended_bid))
    print("  Budget %: " + str(round(recommended_bid / max(faab_remaining, 1) * 100, 1)) + "%")
    for r in reasons:
        print("  " + r)


def cmd_ownership_trends(args, as_json=False):
    """Show ownership % trend for a player over time from season.db
    Args: player_name
    """
    if not args:
        if as_json:
            return {"error": "Usage: ownership-trends <player_name>"}
        print("Usage: ownership-trends <player_name>")
        return

    player_name = " ".join(args)

    # Try to find player_id via roster or search
    player_id = None
    resolved_name = player_name
    try:
        sc, gm, lg = get_league()
        team = lg.to_team(TEAM_ID)
        roster = team.roster()
        for p in roster:
            if player_name.lower() in p.get("name", "").lower():
                player_id = str(p.get("player_id", ""))
                resolved_name = p.get("name", player_name)
                break
        if not player_id:
            for pos_type in ["B", "P"]:
                try:
                    fa = lg.free_agents(pos_type)
                    for p in fa:
                        if player_name.lower() in p.get("name", "").lower():
                            player_id = str(p.get("player_id", ""))
                            resolved_name = p.get("name", player_name)
                            break
                except Exception:
                    pass
                if player_id:
                    break
    except Exception as e:
        if not as_json:
            print("Warning: could not search for player: " + str(e))

    if not player_id:
        if as_json:
            return {"error": "Player not found: " + player_name}
        print("Player not found: " + player_name)
        return

    # Query ownership_history from season.db
    try:
        db = get_db()
        rows = db.execute(
            "SELECT date, pct_owned FROM ownership_history WHERE player_id = ? ORDER BY date",
            (player_id,)
        ).fetchall()
        db.close()
    except Exception as e:
        if as_json:
            return {"error": "Database error: " + str(e)}
        print("Database error: " + str(e))
        return

    trend = [{"date": r[0], "pct_owned": r[1]} for r in rows]

    if not trend:
        result = {
            "player_name": resolved_name,
            "player_id": player_id,
            "trend": [],
            "current_pct": None,
            "direction": "unknown",
            "delta_7d": 0,
            "delta_30d": 0,
            "message": "No ownership history recorded yet. Data is collected during the season.",
        }
        if as_json:
            return result
        print("No ownership history for " + resolved_name + " (player_id=" + player_id + ")")
        print("Data is collected during the season.")
        return

    current_pct = trend[-1].get("pct_owned", 0)

    # Calculate deltas
    delta_7d = 0
    delta_30d = 0
    today = date.today()
    for entry in trend:
        try:
            d = datetime.strptime(entry.get("date", ""), "%Y-%m-%d").date()
            diff = (today - d).days
            if 6 <= diff <= 8:
                delta_7d = round(current_pct - entry.get("pct_owned", 0), 1)
            if 29 <= diff <= 31:
                delta_30d = round(current_pct - entry.get("pct_owned", 0), 1)
        except (ValueError, TypeError):
            pass

    direction = "stable"
    if delta_7d > 2:
        direction = "rising"
    elif delta_7d < -2:
        direction = "falling"

    result = {
        "player_name": resolved_name,
        "player_id": player_id,
        "trend": trend,
        "current_pct": current_pct,
        "direction": direction,
        "delta_7d": delta_7d,
        "delta_30d": delta_30d,
    }

    if as_json:
        return result

    print("Ownership Trends: " + resolved_name + " (id:" + player_id + ")")
    print("=" * 50)
    print("  Current: " + str(current_pct) + "%  Direction: " + direction)
    print("  7-day change: " + str(delta_7d) + "%  30-day change: " + str(delta_30d) + "%")
    print("")
    for entry in trend[-14:]:
        print("  " + entry.get("date", "?") + "  " + str(entry.get("pct_owned", 0)) + "%")


def cmd_category_trends(args, as_json=False):
    """Show category rank trends over time from season.db"""

    try:
        db = get_db()
        rows = db.execute(
            "SELECT week, category, value, rank FROM category_history ORDER BY week, category"
        ).fetchall()
        db.close()
    except Exception as e:
        if as_json:
            return {"error": "Database error: " + str(e)}
        print("Database error: " + str(e))
        return

    if not rows:
        result = {
            "categories": [],
            "message": "No category history recorded yet. Run category-check during the season to build history.",
        }
        if as_json:
            return result
        print("No category history recorded yet.")
        print("Run category-check during the season to build history.")
        return

    # Group by category
    cat_data = {}
    for week, category, value, rank in rows:
        if category not in cat_data:
            cat_data[category] = []
        cat_data[category].append({"week": week, "value": value, "rank": rank})

    categories = []
    for cat_name, history in sorted(cat_data.items()):
        ranks = [h.get("rank", 0) for h in history]
        current_rank = ranks[-1] if ranks else 0
        best_rank = min(ranks) if ranks else 0
        worst_rank = max(ranks) if ranks else 0

        # Determine trend from last 3 data points
        trend_label = "stable"
        if len(ranks) >= 3:
            recent = ranks[-3:]
            if recent[-1] < recent[0]:
                trend_label = "improving"
            elif recent[-1] > recent[0]:
                trend_label = "declining"

        categories.append({
            "name": cat_name,
            "history": history,
            "current_rank": current_rank,
            "best_rank": best_rank,
            "worst_rank": worst_rank,
            "trend": trend_label,
        })

    result = {"categories": categories}

    if as_json:
        return result

    print("Category Rank Trends")
    print("=" * 50)
    for cat in categories:
        trend_marker = ""
        if cat.get("trend") == "improving":
            trend_marker = " [IMPROVING]"
        elif cat.get("trend") == "declining":
            trend_marker = " [DECLINING]"
        print("  " + cat.get("name", "?").ljust(12) + "Current: " + str(cat.get("current_rank", "?"))
              + "  Best: " + str(cat.get("best_rank", "?")) + "  Worst: " + str(cat.get("worst_rank", "?"))
              + trend_marker)


def cmd_punt_advisor(args, as_json=False):
    """Analyze standings to recommend which categories to target or punt"""
    if not as_json:
        print("Category Punting Advisor")
        print("=" * 50)

    sc, gm, lg = get_league()

    # ── 1. Get stat categories for names and sort orders ──
    try:
        stat_cats = lg.stat_categories()
        stat_id_to_name = {}
        lower_is_better_sids = set()
        for cat in stat_cats:
            sid = str(cat.get("stat_id", ""))
            display = cat.get("display_name", cat.get("name", "Stat " + sid))
            stat_id_to_name[sid] = display
            sort_order = cat.get("sort_order", "1")
            if str(sort_order) == "0":
                lower_is_better_sids.add(sid)
    except Exception as e:
        if as_json:
            return {"error": "Error fetching stat categories: " + str(e)}
        print("Error fetching stat categories: " + str(e))
        return

    # ── 2. Get raw matchup data for all teams' stats ──
    try:
        raw = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching matchup data: " + str(e)}
        print("Error fetching matchup data: " + str(e))
        return

    if not raw:
        if as_json:
            return {"error": "No matchup data available (season may not have started)"}
        print("No matchup data available (season may not have started)")
        return

    # ── 3. Parse all teams' per-category stats ──
    all_teams = {}  # team_key -> {sid: value_str, ...}
    my_team_key = None
    my_team_name = ""
    num_teams = 0

    try:
        league_data = raw.get("fantasy_content", {}).get("league", [])
        if len(league_data) < 2:
            # Fall back to simpler list format (like category-check)
            if isinstance(raw, list):
                for matchup in raw:
                    if not isinstance(matchup, dict):
                        continue
                    for t in matchup.get("teams", []):
                        tk = t.get("team_key", "")
                        stats = t.get("stats", {})
                        if not stats:
                            for k, v in t.items():
                                if isinstance(v, dict) and "value" in v:
                                    stats[k] = v.get("value", 0)
                        if tk:
                            all_teams[tk] = stats
                        if TEAM_ID in str(tk):
                            my_team_key = tk
            if not all_teams:
                if as_json:
                    return {"error": "Could not parse matchup data"}
                print("Could not parse matchup data")
                return
        else:
            sb_data = league_data[1].get("scoreboard", {})
            matchup_block = sb_data.get("0", {}).get("matchups", {})
            count = int(matchup_block.get("count", 0))

            for i in range(count):
                matchup = matchup_block.get(str(i), {}).get("matchup", {})
                teams_data = matchup.get("0", {}).get("teams", {})

                for slot in ["0", "1"]:
                    tdata = teams_data.get(slot, {})
                    if not tdata:
                        continue
                    team_info = tdata.get("team", [])
                    tk = ""
                    tname = ""
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in (team_info[0] if isinstance(team_info[0], list) else team_info):
                            if isinstance(item, dict):
                                if "team_key" in item:
                                    tk = item.get("team_key", "")
                                if "name" in item:
                                    tname = item.get("name", "")

                    stats = {}
                    if isinstance(team_info, list):
                        for block in team_info:
                            if isinstance(block, dict) and "team_stats" in block:
                                raw_stats = block.get("team_stats", {}).get("stats", [])
                                for s in raw_stats:
                                    stat = s.get("stat", {})
                                    sid = str(stat.get("stat_id", ""))
                                    val = stat.get("value", "0")
                                    stats[sid] = val

                    if tk and stats:
                        all_teams[tk] = stats
                        if TEAM_ID in str(tk):
                            my_team_key = tk
                            my_team_name = tname

    except Exception as e:
        if as_json:
            return {"error": "Error parsing matchup data: " + str(e)}
        print("Error parsing matchup data: " + str(e))
        return

    if not my_team_key or my_team_key not in all_teams:
        # Preseason fallback: use projection z-scores from roster
        return _punt_advisor_from_projections(lg, as_json)

    num_teams = len(all_teams)
    my_stats = all_teams.get(my_team_key, {})

    # If we didn't get team name from raw data, try standings
    if not my_team_name:
        try:
            standings = lg.standings()
            for t in standings:
                if TEAM_ID in str(t.get("team_key", "")):
                    my_team_name = t.get("name", "My Team")
                    break
        except Exception:
            my_team_name = "My Team"

    # ── 4. Compute per-category ranks and gaps ──
    CORRELATIONS = _CATEGORY_CORRELATIONS

    categories = []
    for sid, cat_name in stat_id_to_name.items():
        my_val_str = my_stats.get(sid, None)
        if my_val_str is None:
            continue
        try:
            my_val = float(my_val_str)
        except (ValueError, TypeError):
            continue

        lower_better = sid in lower_is_better_sids

        # Collect all team values for this category
        team_values = []
        for tk, tstats in all_teams.items():
            try:
                team_values.append((tk, float(tstats.get(sid, 0))))
            except (ValueError, TypeError):
                pass

        if not team_values:
            continue

        # Sort to compute ranks
        if lower_better:
            team_values.sort(key=lambda x: x[1])
        else:
            team_values.sort(key=lambda x: x[1], reverse=True)

        # Find my rank
        my_rank = 1
        for idx, (tk, val) in enumerate(team_values):
            if tk == my_team_key:
                my_rank = idx + 1
                break

        # Compute gap to rank above and below
        gap_to_next = ""
        gap_from_above = ""
        sorted_vals = [v for _, v in team_values]

        if my_rank > 1:
            above_val = sorted_vals[my_rank - 2]
            diff = abs(my_val - above_val)
            above_rank = my_rank - 1
            if lower_better:
                gap_from_above = "-" + str(round(diff, 3)) + " vs " + _ordinal(above_rank)
            else:
                gap_from_above = "-" + str(round(diff, 3)) + " vs " + _ordinal(above_rank)

        if my_rank < len(sorted_vals):
            below_val = sorted_vals[my_rank]
            diff = abs(my_val - below_val)
            below_rank = my_rank + 1
            gap_to_next = "+" + str(round(diff, 3)) + " vs " + _ordinal(below_rank)

        # Compute cost to compete: how much improvement to gain 2+ ranks
        cost_to_compete = "low"
        if my_rank > 1:
            target_val = sorted_vals[max(0, my_rank - 3)]  # try to gain 2 ranks
            improvement_needed = abs(my_val - target_val)
            avg_val = sum(sorted_vals) / len(sorted_vals) if sorted_vals else 1
            if avg_val > 0:
                pct_improvement = improvement_needed / abs(avg_val) if avg_val != 0 else 0
            else:
                pct_improvement = 0
            if pct_improvement > 0.20:
                cost_to_compete = "high"
            elif pct_improvement > 0.08:
                cost_to_compete = "medium"
            else:
                cost_to_compete = "low"

        categories.append({
            "name": cat_name,
            "stat_id": sid,
            "rank": my_rank,
            "value": str(my_val_str),
            "total": num_teams,
            "gap_to_next": gap_to_next,
            "gap_from_above": gap_from_above,
            "cost_to_compete": cost_to_compete,
            "lower_is_better": lower_better,
        })

    if not categories:
        # Preseason fallback: all stats are empty/zero, use projections
        return _punt_advisor_from_projections(lg, as_json)

    # Sort by rank (best first)
    categories.sort(key=lambda c: c.get("rank", 99))

    # ── 5. Classify each category ──
    top_cutoff = max(3, num_teams // 3)
    bottom_cutoff = num_teams - top_cutoff + 1

    punt_candidates = []
    target_categories = []

    for cat in categories:
        rank = cat.get("rank", 99)
        cost = cat.get("cost_to_compete", "low")
        name = cat.get("name", "")

        if rank <= 3:
            cat["recommendation"] = "strength"
            cat["reasoning"] = "Top 3 — natural strength, protect this advantage"
            target_categories.append(name)
        elif rank <= top_cutoff:
            cat["recommendation"] = "target"
            cat["reasoning"] = "Close to top — invest to gain ranks"
            target_categories.append(name)
        elif rank >= bottom_cutoff and cost == "high":
            cat["recommendation"] = "punt"
            cat["reasoning"] = "Bottom tier with high cost to compete — punt candidate"
            punt_candidates.append(name)
        elif rank >= bottom_cutoff and cost == "medium":
            cat["recommendation"] = "consider_punting"
            cat["reasoning"] = "Bottom tier but moderate cost — could improve with targeted adds"
        elif rank >= bottom_cutoff:
            cat["recommendation"] = "target"
            cat["reasoning"] = "Bottom tier but low cost to improve — worth targeting"
            target_categories.append(name)
        else:
            cat["recommendation"] = "hold"
            cat["reasoning"] = "Mid-pack — maintain current level"

    # ── 6. Check correlation warnings ──
    correlation_warnings = []
    for punt_name in punt_candidates:
        correlated = CORRELATIONS.get(punt_name, [])
        for corr_name in correlated:
            # Check if the correlated category is a target
            if corr_name in target_categories:
                correlation_warnings.append(
                    "Punting " + punt_name + " may hurt " + corr_name + " (which you're targeting)"
                )

    # ── 7. Build strategy summary ──
    # Identify roster archetype
    batting_cats = {"R", "H", "HR", "RBI", "TB", "AVG", "OBP", "XBH", "NSB", "K"}
    pitching_cats = {"IP", "W", "ERA", "WHIP", "K", "HLD", "QS", "NSV", "ER", "L"}

    strong_batting = [c for c in categories if c.get("recommendation") in ("strength", "target") and c.get("name", "") in batting_cats]
    strong_pitching = [c for c in categories if c.get("recommendation") in ("strength", "target") and c.get("name", "") in pitching_cats]

    archetype = "balanced"
    if len(strong_batting) > len(strong_pitching) + 2:
        archetype = "power hitting"
    elif len(strong_pitching) > len(strong_batting) + 2:
        archetype = "pitching dominant"

    strength_names = [c.get("name", "") for c in categories if c.get("recommendation") == "strength"]
    target_names = [c.get("name", "") for c in categories if c.get("recommendation") == "target"]

    summary_parts = ["Your roster is built for " + archetype + "."]
    if punt_candidates:
        summary_parts.append("Consider punting " + ", ".join(punt_candidates) + " to double down on " + ", ".join(strength_names[:4]) + ".")
    if target_names:
        summary_parts.append("Target " + ", ".join(target_names[:4]) + " where small improvements yield rank gains.")
    if correlation_warnings:
        summary_parts.append("Watch correlations: " + "; ".join(correlation_warnings[:2]) + ".")

    strategy_summary = " ".join(summary_parts)

    # ── 8. Find overall standings rank ──
    overall_rank = "?"
    try:
        standings = lg.standings()
        for idx, t in enumerate(standings, 1):
            if TEAM_ID in str(t.get("team_key", "")):
                overall_rank = idx
                break
    except Exception:
        pass

    result = {
        "team_name": my_team_name,
        "current_rank": overall_rank,
        "num_teams": num_teams,
        "categories": categories,
        "punt_candidates": punt_candidates,
        "target_categories": target_categories,
        "correlation_warnings": correlation_warnings,
        "strategy_summary": strategy_summary,
    }

    if as_json:
        return result

    # CLI output
    print("Team: " + my_team_name + " (Rank: " + str(overall_rank) + "/" + str(num_teams) + ")")
    print("")
    print("  " + "Category".ljust(12) + "Rank".rjust(6) + "  Value".rjust(10) + "  " + "Recommendation")
    print("  " + "-" * 55)
    for cat in categories:
        rec = cat.get("recommendation", "hold").upper()
        rank_str = str(cat.get("rank", "?")) + "/" + str(cat.get("total", "?"))
        print("  " + cat.get("name", "?").ljust(12) + rank_str.rjust(6)
              + "  " + str(cat.get("value", "")).rjust(10) + "  " + rec)

    if punt_candidates:
        print("")
        print("Punt Candidates: " + ", ".join(punt_candidates))
    if target_categories:
        print("Target Categories: " + ", ".join(target_categories))
    if correlation_warnings:
        print("")
        print("Correlation Warnings:")
        for w in correlation_warnings:
            print("  - " + w)
    print("")
    print("Strategy: " + strategy_summary)


def _punt_advisor_from_projections(lg, as_json=False):
    """Preseason punt advisor fallback using roster z-score projections."""
    from valuations import get_player_zscore

    try:
        team = lg.to_team(TEAM_ID)
        roster = team.roster()
    except Exception as e:
        if as_json:
            return {"error": "Could not fetch roster: " + str(e)}
        print("Could not fetch roster: " + str(e))
        return

    # Sum per-category z-scores across the roster
    cat_totals = {}
    resolved = 0
    for p in roster:
        name = p.get("name", "")
        if not name:
            continue
        info = get_player_zscore(name)
        if not info:
            continue
        resolved += 1
        for cat, z in info.get("per_category_zscores", {}).items():
            cat_totals[cat] = cat_totals.get(cat, 0) + z

    if not cat_totals:
        if as_json:
            return {"error": "Could not compute z-scores for roster"}
        print("Could not compute z-scores for roster")
        return

    # Sort categories by z-score total
    sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)

    # Classify: top third = strength, bottom third = punt candidate
    n = len(sorted_cats)
    top_cutoff = max(1, n // 3)
    bottom_cutoff = n - top_cutoff

    CORRELATIONS = _CATEGORY_CORRELATIONS

    categories = []
    punt_candidates = []
    target_categories = []

    for idx, (cat, z_total) in enumerate(sorted_cats):
        z_rounded = round(z_total, 2)
        if idx < top_cutoff:
            rec = "strength"
            reasoning = "Top z-score total — natural strength"
            target_categories.append(cat)
        elif idx >= bottom_cutoff:
            rec = "punt"
            reasoning = "Lowest z-score total — punt candidate"
            punt_candidates.append(cat)
        else:
            rec = "hold"
            reasoning = "Mid-range z-score total"

        categories.append({
            "name": cat,
            "z_total": z_rounded,
            "recommendation": rec,
            "reasoning": reasoning,
        })

    # Correlation warnings
    correlation_warnings = []
    for punt_name in punt_candidates:
        for corr_name in CORRELATIONS.get(punt_name, []):
            if corr_name in target_categories:
                correlation_warnings.append(
                    "Punting " + punt_name + " may hurt " + corr_name + " (which you're targeting)"
                )

    # Strategy summary
    summary_parts = ["Preseason projection-based analysis."]
    if punt_candidates:
        summary_parts.append("Consider punting " + ", ".join(punt_candidates) + " to double down on " + ", ".join(target_categories[:4]) + ".")
    if correlation_warnings:
        summary_parts.append("Watch: " + "; ".join(correlation_warnings[:2]) + ".")
    strategy_summary = " ".join(summary_parts)

    result = {
        "team_name": "My Team",
        "num_teams": "?",
        "categories": categories,
        "punt_candidates": punt_candidates,
        "target_categories": target_categories,
        "correlation_warnings": correlation_warnings,
        "strategy_summary": strategy_summary,
        "source": "projections",
        "players_resolved": resolved,
    }

    if as_json:
        return result

    # CLI output
    print("(Preseason mode: using projection z-scores)")
    print("")
    print("  " + "Category".ljust(12) + "Z-Total".rjust(8) + "  Recommendation")
    print("  " + "-" * 40)
    for cat in categories:
        print("  " + cat.get("name", "?").ljust(12)
              + str(cat.get("z_total", 0)).rjust(8)
              + "  " + cat.get("recommendation", "hold").upper())

    if punt_candidates:
        print("")
        print("Punt Candidates: " + ", ".join(punt_candidates))
    if target_categories:
        print("Target Categories: " + ", ".join(target_categories))
    if correlation_warnings:
        print("")
        print("Correlation Warnings:")
        for w in correlation_warnings:
            print("  - " + w)
    print("")
    print("Strategy: " + strategy_summary)


def _ordinal(n):
    """Return ordinal string for a number (1st, 2nd, 3rd, etc.)"""
    n = int(n)
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return str(n) + suffix


def cmd_il_stash_advisor(args, as_json=False):
    """Analyze IL players on roster + injured free agents for stash/drop decisions"""
    if not as_json:
        print("IL Stash Advisor")
        print("=" * 50)

    sc, gm, lg, team = get_league_context()

    # Get roster
    try:
        roster = team.roster()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching roster: " + str(e)}
        print("Error fetching roster: " + str(e))
        return

    if not roster:
        if as_json:
            return {"il_slots": {"used": 0, "total": 0}, "your_il_players": [], "fa_il_stash_candidates": [], "summary": "Roster is empty."}
        print("Roster is empty")
        return

    # Count IL slots from league settings
    positions = get_roster_positions(lg)
    il_slot_names = ("IL", "IL+", "DL", "DL+")
    total_il_slots = 0
    for pos_name in positions:
        if pos_name in il_slot_names:
            total_il_slots += 1

    # Find players on IL slots
    il_players = []
    for p in roster:
        if is_il(p):
            il_players.append(p)
    used_il_slots = len(il_players)

    # Get MLB injuries for context
    mlb_injuries = {}
    try:
        data = mlb_fetch("/injuries")
        for inj in data.get("injuries", []):
            player_name = inj.get("player", {}).get("fullName", "")
            if player_name:
                mlb_injuries[player_name.lower()] = {
                    "description": inj.get("description", "Unknown"),
                    "date": inj.get("date", ""),
                    "status": inj.get("status", ""),
                }
    except Exception as e:
        if not as_json:
            print("  Warning: could not fetch MLB injuries: " + str(e))

    # Get z-score info
    from valuations import get_player_zscore, POS_BONUS

    # Assess our roster needs by position
    roster_positions = {}
    for p in roster:
        if not is_il(p):
            for ep in p.get("eligible_positions", []):
                if ep not in ("BN", "Bench", "IL", "IL+", "DL", "DL+", "Util"):
                    roster_positions[ep] = roster_positions.get(ep, 0) + 1

    # Build info for each IL player
    your_il_players = []
    for p in il_players:
        name = p.get("name", "Unknown")
        pos = get_player_position(p)
        status = p.get("status", "")
        eligible = p.get("eligible_positions", [])
        primary_pos = ""
        for ep in eligible:
            if ep not in ("BN", "Bench", "IL", "IL+", "DL", "DL+", "Util"):
                primary_pos = ep
                break

        z_val, tier, _ = _player_z_summary(name)

        mlb_inj = mlb_injuries.get(name.lower())
        injury_desc = ""
        if mlb_inj:
            injury_desc = mlb_inj.get("description", "")

        # Determine recommendation
        recommendation = "monitor"
        reasoning = ""

        if tier in ("Untouchable", "Core"):
            recommendation = "stash"
            reasoning = tier + " tier player (z=" + str(round(z_val, 2)) + ")"
            if injury_desc:
                reasoning = reasoning + ", " + injury_desc
            else:
                reasoning = reasoning + ", high upside when healthy"
        elif tier == "Solid":
            # Check positional scarcity
            pos_scarce = primary_pos in ("C", "SS", "2B") if primary_pos else False
            if pos_scarce:
                recommendation = "stash"
                reasoning = "Solid tier at scarce position " + primary_pos + " (z=" + str(round(z_val, 2)) + ")"
            else:
                recommendation = "monitor"
                reasoning = "Solid tier (z=" + str(round(z_val, 2)) + "), monitor for return timeline"
        elif tier == "Fringe":
            if used_il_slots >= total_il_slots:
                recommendation = "drop"
                reasoning = "Fringe tier (z=" + str(round(z_val, 2)) + "), IL slots full — free the spot"
            else:
                recommendation = "monitor"
                reasoning = "Fringe tier (z=" + str(round(z_val, 2)) + "), IL slot available so low cost to hold"
        else:
            recommendation = "drop"
            reasoning = "Low value (z=" + str(round(z_val, 2)) + "), not worth an IL slot"

        player_info = {
            "name": name,
            "player_id": str(p.get("player_id", "")),
            "position": primary_pos or pos,
            "status": status,
            "z_score": round(z_val, 2),
            "tier": tier,
            "recommendation": recommendation,
            "reasoning": reasoning,
            "mlb_id": get_mlb_id(name),
        }
        if injury_desc:
            player_info["injury_description"] = injury_desc
        your_il_players.append(player_info)

    # Find injured free agents worth stashing
    fa_il_candidates = []
    open_slots = total_il_slots - used_il_slots
    if open_slots > 0:
        # Check both batters and pitchers
        for pos_type in ["B", "P"]:
            try:
                fa = lg.free_agents(pos_type)[:30]
                for p in fa:
                    fa_status = p.get("status", "")
                    if not fa_status or fa_status in ("", "Healthy"):
                        continue  # Skip healthy free agents
                    if fa_status not in ("IL", "IL+", "DL", "DL+", "DTD", "IL-LT"):
                        continue

                    fa_name = p.get("name", "Unknown")
                    fa_eligible = p.get("eligible_positions", [])
                    fa_primary = ""
                    for ep in fa_eligible:
                        if ep not in ("BN", "Bench", "IL", "IL+", "DL", "DL+", "Util"):
                            fa_primary = ep
                            break

                    z_info = get_player_zscore(fa_name)
                    if not z_info:
                        continue
                    fa_z = z_info.get("z_final", 0)
                    fa_tier = z_info.get("tier", "Streamable")

                    # Only suggest players with real value
                    if fa_tier in ("Streamable",):
                        continue

                    fa_mlb_inj = mlb_injuries.get(fa_name.lower())
                    fa_inj_desc = ""
                    if fa_mlb_inj:
                        fa_inj_desc = fa_mlb_inj.get("description", "")

                    # Check position scarcity
                    pos_scarce = fa_primary in ("C", "SS", "2B") if fa_primary else False

                    fa_rec = "monitor"
                    fa_reasoning = ""

                    if fa_tier in ("Untouchable", "Core"):
                        fa_rec = "stash"
                        fa_reasoning = fa_tier + " tier FA (z=" + str(round(fa_z, 2)) + ")"
                        if fa_inj_desc:
                            fa_reasoning = fa_reasoning + ", " + fa_inj_desc
                        else:
                            fa_reasoning = fa_reasoning + ", high return value when healthy"
                    elif fa_tier == "Solid":
                        if pos_scarce:
                            fa_rec = "stash"
                            fa_reasoning = "Solid tier at scarce " + fa_primary + " (z=" + str(round(fa_z, 2)) + "), available as FA"
                        else:
                            fa_rec = "monitor"
                            fa_reasoning = "Solid tier (z=" + str(round(fa_z, 2)) + "), track return timeline"
                    elif fa_tier == "Fringe":
                        fa_rec = "monitor"
                        fa_reasoning = "Fringe tier (z=" + str(round(fa_z, 2)) + "), only stash if IL slot open and position needed"

                    candidate = {
                        "name": fa_name,
                        "player_id": str(p.get("player_id", "")),
                        "position": fa_primary or ",".join(fa_eligible),
                        "status": fa_status,
                        "z_score": round(fa_z, 2),
                        "tier": fa_tier,
                        "percent_owned": p.get("percent_owned", 0),
                        "recommendation": fa_rec,
                        "reasoning": fa_reasoning,
                        "mlb_id": get_mlb_id(fa_name),
                    }
                    if fa_inj_desc:
                        candidate["injury_description"] = fa_inj_desc
                    fa_il_candidates.append(candidate)
            except Exception as e:
                if not as_json:
                    print("  Warning: could not fetch " + pos_type + " free agents: " + str(e))

    # Sort FA candidates by z-score descending
    fa_il_candidates.sort(key=lambda x: -x.get("z_score", 0))
    fa_il_candidates = fa_il_candidates[:10]

    # Build summary
    stash_yours = [p for p in your_il_players if p.get("recommendation") == "stash"]
    drop_yours = [p for p in your_il_players if p.get("recommendation") == "drop"]
    stash_fa = [p for p in fa_il_candidates if p.get("recommendation") == "stash"]

    summary_parts = []
    summary_parts.append("You have " + str(used_il_slots) + "/" + str(total_il_slots) + " IL slots used.")
    if open_slots > 0:
        summary_parts.append(str(open_slots) + " open IL slot" + ("s" if open_slots != 1 else "") + ".")
    if drop_yours:
        summary_parts.append("Consider dropping " + ", ".join([p.get("name", "") for p in drop_yours]) + " to free IL space.")
    if stash_fa:
        summary_parts.append("Stash candidate" + ("s" if len(stash_fa) != 1 else "") + ": " + ", ".join([p.get("name", "") for p in stash_fa[:3]]) + ".")
    if not drop_yours and not stash_fa and stash_yours:
        summary_parts.append("Your IL stashes look solid. Hold current players.")
    summary = " ".join(summary_parts)

    result = {
        "il_slots": {"used": used_il_slots, "total": total_il_slots},
        "your_il_players": your_il_players,
        "fa_il_stash_candidates": fa_il_candidates,
        "summary": summary,
    }

    if as_json:
        enrich_with_intel(your_il_players + fa_il_candidates)
        return result

    # CLI output
    print("")
    print("IL Slots: " + str(used_il_slots) + "/" + str(total_il_slots) + " used")
    if open_slots > 0:
        print("  " + str(open_slots) + " open slot" + ("s" if open_slots != 1 else ""))
    print("")

    if your_il_players:
        print("Your IL Players:")
        print("  " + "Player".ljust(25) + "Pos".ljust(6) + "Z".rjust(6) + "  " + "Tier".ljust(12) + "  Action")
        print("  " + "-" * 65)
        for p in your_il_players:
            rec_str = p.get("recommendation", "").upper()
            print("  " + p.get("name", "").ljust(25) + p.get("position", "").ljust(6)
                  + str(p.get("z_score", 0)).rjust(6) + "  " + p.get("tier", "").ljust(12)
                  + "  " + rec_str)
            print("      " + p.get("reasoning", ""))
    else:
        print("No players currently on IL.")

    if fa_il_candidates:
        print("")
        print("FA IL Stash Candidates:")
        print("  " + "Player".ljust(25) + "Pos".ljust(6) + "Z".rjust(6) + "  " + "Tier".ljust(12) + "  Action")
        print("  " + "-" * 65)
        for p in fa_il_candidates:
            rec_str = p.get("recommendation", "").upper()
            print("  " + p.get("name", "").ljust(25) + p.get("position", "").ljust(6)
                  + str(p.get("z_score", 0)).rjust(6) + "  " + p.get("tier", "").ljust(12)
                  + "  " + rec_str)
            print("      " + p.get("reasoning", ""))
    elif open_slots > 0:
        print("")
        print("No high-value injured free agents found to stash.")

    print("")
    print("Summary: " + summary)


def cmd_optimal_moves(args, as_json=False):
    """Find the best sequence of add/drop moves to maximize roster z-score value"""
    count = int(args[0]) if args else 5
    count = min(max(count, 1), 10)

    if not as_json:
        print("Optimal Add/Drop Chain Optimizer")
        print("=" * 50)

    sc, gm, lg = get_league()

    # 1. Get current roster with z-scores
    try:
        team = lg.to_team(TEAM_ID)
        roster = team.roster()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching roster: " + str(e)}
        print("Error fetching roster: " + str(e))
        return

    from valuations import get_player_zscore

    # Build roster z-score info
    roster_players = []
    roster_z_total = 0.0
    for p in roster:
        name = p.get("name", "Unknown")
        pid = str(p.get("player_id", ""))
        z_info = get_player_zscore(name) or {}
        z_val = z_info.get("z_final", 0)
        tier = z_info.get("tier", "Streamable")
        per_cat = z_info.get("per_category_zscores", {})
        eligible = p.get("eligible_positions", [])
        pos = get_player_position(p)
        is_on_il = is_il(p)
        roster_z_total += z_val
        roster_players.append({
            "name": name,
            "player_id": pid,
            "z_score": round(z_val, 2),
            "tier": tier,
            "per_category_zscores": per_cat,
            "eligible_positions": eligible,
            "position": pos,
            "is_il": is_on_il,
            "pos_type": z_info.get("type", "B"),
        })

    roster_z_total = round(roster_z_total, 2)

    # 2. Get free agents for both batters and pitchers
    fa_batters = []
    fa_pitchers = []
    try:
        fa_batters = lg.free_agents("B")[:40]
    except Exception as e:
        if not as_json:
            print("Warning: could not fetch FA batters: " + str(e))
    try:
        fa_pitchers = lg.free_agents("P")[:40]
    except Exception as e:
        if not as_json:
            print("Warning: could not fetch FA pitchers: " + str(e))

    # Build FA z-score info
    fa_pool = []
    for fa_list, pt in [(fa_batters, "B"), (fa_pitchers, "P")]:
        for p in fa_list:
            name = p.get("name", "Unknown")
            pid = str(p.get("player_id", ""))
            pct = p.get("percent_owned", 0)
            status = p.get("status", "")
            eligible = p.get("eligible_positions", [])
            # Skip injured FA
            if status and status not in ("", "Healthy"):
                continue
            z_info = get_player_zscore(name)
            if not z_info:
                continue
            z_val = z_info.get("z_final", 0)
            tier = z_info.get("tier", "Streamable")
            per_cat = z_info.get("per_category_zscores", {})
            fa_pool.append({
                "name": name,
                "player_id": pid,
                "z_score": round(z_val, 2),
                "tier": tier,
                "per_category_zscores": per_cat,
                "eligible_positions": eligible,
                "percent_owned": pct,
                "pos_type": pt,
            })

    # 3. Determine position compatibility for each roster player vs each FA
    # A FA can replace a roster player if they share at least one eligible position
    def positions_compatible(roster_eligible, fa_eligible):
        """Check if FA can fill the same roster slot as the dropped player"""
        roster_set = set(roster_eligible)
        fa_set = set(fa_eligible)
        # Remove non-playing positions
        non_playing = {"BN", "IL", "IL+", "DL", "DL+", "Bench", "NA"}
        roster_set = roster_set - non_playing
        fa_set = fa_set - non_playing
        # Util is compatible with any batter
        if "Util" in roster_set or "Util" in fa_set:
            # Both need to be batters (have some batting position)
            batting_pos = {"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "Util"}
            if (roster_set & batting_pos) and (fa_set & batting_pos):
                return True
        # P is compatible with SP/RP and vice versa
        pitching_pos = {"SP", "RP", "P"}
        if (roster_set & pitching_pos) and (fa_set & pitching_pos):
            return True
        # Direct overlap
        return bool(roster_set & fa_set)

    # 4. Calculate all possible single moves
    # Only consider dropping Fringe/Streamable players (not Untouchable, Core, Solid)
    # Also skip IL players
    droppable_tiers = {"Fringe", "Streamable"}
    all_moves = []

    for rp in roster_players:
        if rp.get("is_il"):
            continue
        if rp.get("tier") not in droppable_tiers:
            continue
        r_eligible = rp.get("eligible_positions", [])
        r_z = rp.get("z_score", 0)

        for fa in fa_pool:
            fa_eligible = fa.get("eligible_positions", [])
            if not positions_compatible(r_eligible, fa_eligible):
                continue
            fa_z = fa.get("z_score", 0)
            improvement = round(fa_z - r_z, 2)
            if improvement < 0.2:
                continue

            # Determine which categories improve or decline
            r_cats = rp.get("per_category_zscores", {})
            fa_cats = fa.get("per_category_zscores", {})
            cats_gained = []
            cats_lost = []
            all_cat_names = set(list(r_cats.keys()) + list(fa_cats.keys()))
            for cat in sorted(all_cat_names):
                delta = fa_cats.get(cat, 0) - r_cats.get(cat, 0)
                if delta > 0.3:
                    cats_gained.append(cat)
                elif delta < -0.3:
                    cats_lost.append(cat)

            all_moves.append({
                "drop": {
                    "name": rp.get("name"),
                    "player_id": rp.get("player_id"),
                    "pos": ",".join([p for p in r_eligible if p not in ("BN", "IL", "IL+", "DL", "DL+", "Bench", "NA")]),
                    "z_score": r_z,
                    "tier": rp.get("tier"),
                },
                "add": {
                    "name": fa.get("name"),
                    "player_id": fa.get("player_id"),
                    "pos": ",".join([p for p in fa_eligible if p not in ("BN", "IL", "IL+", "DL", "DL+", "Bench", "NA")]),
                    "z_score": fa_z,
                    "tier": fa.get("tier"),
                    "percent_owned": str(fa.get("percent_owned", 0)) + "%",
                },
                "z_improvement": improvement,
                "categories_gained": cats_gained,
                "categories_lost": cats_lost,
            })

    # 5. Sort by z-score improvement
    all_moves.sort(key=lambda m: -m.get("z_improvement", 0))

    # 6. Build optimal chain: greedy, sequential non-conflicting moves
    # Once a player is dropped, they are gone. Once a FA is added, they are taken.
    chain = []
    dropped_pids = set()
    added_pids = set()

    for move in all_moves:
        drop_pid = move.get("drop", {}).get("player_id", "")
        add_pid = move.get("add", {}).get("player_id", "")
        if drop_pid in dropped_pids or add_pid in added_pids:
            continue
        chain.append(move)
        dropped_pids.add(drop_pid)
        added_pids.add(add_pid)
        if len(chain) >= count:
            break

    # 7. Calculate totals
    total_improvement = round(sum(m.get("z_improvement", 0) for m in chain), 2)
    projected_z_after = round(roster_z_total + total_improvement, 2)

    # Add rank to each move
    for idx, move in enumerate(chain):
        move["rank"] = idx + 1

    # Build summary
    if chain:
        top = chain[0]
        summary = (str(len(chain)) + " move" + ("s" if len(chain) != 1 else "")
                   + " available. Top move: Drop " + top.get("drop", {}).get("name", "?")
                   + " for " + top.get("add", {}).get("name", "?")
                   + " (+" + str(top.get("z_improvement", 0)) + " z). "
                   + "Total roster improvement: +" + str(total_improvement) + " z-score.")
    else:
        summary = "No beneficial add/drop moves found above the +0.2 z-score threshold."

    result = {
        "roster_z_total": roster_z_total,
        "projected_z_after": projected_z_after,
        "net_improvement": total_improvement,
        "moves": chain,
        "summary": summary,
    }

    if as_json:
        return result

    # CLI output
    print("Current Roster Z-Score Total: " + str(roster_z_total))
    print("")
    if chain:
        print("Recommended Moves (by z-score improvement):")
        print("  " + "#".rjust(3) + "  " + "Drop".ljust(22) + "Z".rjust(6)
              + "  ->  " + "Add".ljust(22) + "Z".rjust(6) + "  " + "Gain".rjust(6))
        print("  " + "-" * 75)
        for move in chain:
            d = move.get("drop", {})
            a = move.get("add", {})
            print("  " + str(move.get("rank", "")).rjust(3)
                  + "  " + d.get("name", "?").ljust(22) + str(d.get("z_score", 0)).rjust(6)
                  + "  ->  " + a.get("name", "?").ljust(22) + str(a.get("z_score", 0)).rjust(6)
                  + "  +" + str(move.get("z_improvement", 0)).rjust(5))
            gained = move.get("categories_gained", [])
            lost = move.get("categories_lost", [])
            if gained or lost:
                detail = "      "
                if gained:
                    detail += "Gains: " + ", ".join(gained)
                if lost:
                    if gained:
                        detail += "  |  "
                    detail += "Loses: " + ", ".join(lost)
                print(detail)
        print("")
        print("Projected Z-Score After: " + str(projected_z_after)
              + " (+" + str(total_improvement) + ")")
    else:
        print("No beneficial moves found above the +0.2 z-score threshold.")
    print("")
    print("Summary: " + summary)


def cmd_playoff_planner(args, as_json=False):
    """Calculate path to playoffs with category gaps, recommended actions, and probability"""
    if not as_json:
        print("Playoff Path Planner")
        print("=" * 50)

    sc, gm, lg = get_league()

    # ── 1. Get standings and settings ──
    try:
        standings = lg.standings()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching standings: " + str(e)}
        print("Error fetching standings: " + str(e))
        return

    try:
        settings = lg.settings()
    except Exception:
        settings = {}

    playoff_cutoff = int(settings.get("num_playoff_teams", 6))
    num_teams = len(standings)

    # Find my team in standings
    my_rank = None
    my_team_name = ""
    my_wins = 0
    my_losses = 0
    my_ties = 0
    cutoff_wins = 0
    cutoff_losses = 0

    for i, t in enumerate(standings, 1):
        tk = t.get("team_key", "")
        wins = int(t.get("outcome_totals", {}).get("wins", 0))
        losses = int(t.get("outcome_totals", {}).get("losses", 0))
        ties = int(t.get("outcome_totals", {}).get("ties", 0))
        if TEAM_ID in str(tk):
            my_rank = i
            my_team_name = t.get("name", "My Team")
            my_wins = wins
            my_losses = losses
            my_ties = ties
        if i == playoff_cutoff:
            cutoff_wins = wins
            cutoff_losses = losses

    if my_rank is None:
        if as_json:
            return {"error": "Could not find your team in standings"}
        print("Could not find your team in standings")
        return

    # Games back from playoff cutoff
    games_back = max(0, cutoff_wins - my_wins)

    # ── 2. Get punt advisor data (category ranks and strategy) ──
    punt_data = cmd_punt_advisor([], as_json=True)
    if punt_data.get("error"):
        if as_json:
            return {"error": "Error getting category data: " + punt_data.get("error", "")}
        print("Error getting category data: " + punt_data.get("error", ""))
        return

    categories = punt_data.get("categories", [])
    punt_candidates = punt_data.get("punt_candidates", [])
    target_categories = punt_data.get("target_categories", [])

    # ── 3. Calculate category gaps to playoff threshold ──
    # In H2H categories, the playoff threshold is roughly the rank where you'd
    # be competitive -- we target the middle of the pack (top half) for each cat
    category_gaps = []
    high_priority_cats = []
    medium_priority_cats = []

    for cat in categories:
        cat_name = cat.get("name", "")
        rank = cat.get("rank", 99)
        value = cat.get("value", "0")
        total = cat.get("total", num_teams)
        cost = cat.get("cost_to_compete", "low")
        recommendation = cat.get("recommendation", "hold")
        lower_better = cat.get("lower_is_better", False)
        gap_from_above = cat.get("gap_from_above", "")

        # Target rank: top half of the league for contention
        target_rank = max(1, total // 2)

        if rank <= target_rank:
            # Already at or above target -- no gap
            continue

        places_to_gain = rank - target_rank

        # Determine priority
        priority = "low"
        if recommendation in ("target",) and cost in ("low", "medium"):
            priority = "high"
            high_priority_cats.append(cat_name)
        elif recommendation in ("consider_punting",) or cost == "medium":
            priority = "medium"
            medium_priority_cats.append(cat_name)
        elif recommendation == "punt":
            priority = "low"  # punt candidates stay low
        else:
            priority = "medium"
            medium_priority_cats.append(cat_name)

        # Build gap description
        gap_desc = "Gain " + str(places_to_gain) + " places"
        if gap_from_above:
            gap_desc = gap_desc + " (" + gap_from_above + ")"

        category_gaps.append({
            "category": cat_name,
            "current_rank": rank,
            "target_rank": target_rank,
            "places_to_gain": places_to_gain,
            "gap": gap_desc,
            "priority": priority,
            "cost_to_compete": cost,
        })

    # Sort by priority then places to gain
    priority_order = {"high": 0, "medium": 1, "low": 2}
    category_gaps.sort(key=lambda g: (priority_order.get(g.get("priority", "low"), 2), g.get("places_to_gain", 0)))

    # ── 4. Build recommended actions ──
    recommended_actions = []

    # 4a. Waiver recommendations for high-priority categories
    batting_cats_set = {"R", "H", "HR", "RBI", "TB", "AVG", "OBP", "XBH", "NSB", "K"}
    pitching_cats_set = {"IP", "W", "ERA", "WHIP", "K", "HLD", "QS", "NSV", "ER", "L"}

    weak_batting = [g.get("category", "") for g in category_gaps
                    if g.get("priority") in ("high", "medium")
                    and g.get("category", "") in batting_cats_set]
    weak_pitching = [g.get("category", "") for g in category_gaps
                     if g.get("priority") in ("high", "medium")
                     and g.get("category", "") in pitching_cats_set]

    # Get waiver recommendations for weak sides
    from valuations import get_player_zscore, POS_BONUS

    waiver_adds = []
    try:
        if weak_batting:
            batter_fa = lg.free_agents("B")[:20]
            for p in batter_fa:
                name = p.get("name", "Unknown")
                z_info = get_player_zscore(name)
                if not z_info:
                    continue
                z_val = z_info.get("z_final", 0)
                per_cat = z_info.get("per_category_zscores", {})
                tier = z_info.get("tier", "Streamable")
                # Check if this player helps our weak batting cats
                helps = []
                help_score = 0.0
                for wcat in weak_batting:
                    cat_z = per_cat.get(wcat, 0)
                    if cat_z > 0.3:
                        helps.append(wcat)
                        help_score += cat_z
                if helps and z_val > 0:
                    waiver_adds.append({
                        "name": name,
                        "z_score": round(z_val, 2),
                        "tier": tier,
                        "helps_categories": helps,
                        "help_score": round(help_score, 2),
                        "pct_owned": p.get("percent_owned", 0),
                        "positions": ",".join(p.get("eligible_positions", [])),
                    })
    except Exception:
        pass

    try:
        if weak_pitching:
            pitcher_fa = lg.free_agents("P")[:20]
            for p in pitcher_fa:
                name = p.get("name", "Unknown")
                z_info = get_player_zscore(name)
                if not z_info:
                    continue
                z_val = z_info.get("z_final", 0)
                per_cat = z_info.get("per_category_zscores", {})
                tier = z_info.get("tier", "Streamable")
                helps = []
                help_score = 0.0
                for wcat in weak_pitching:
                    cat_z = per_cat.get(wcat, 0)
                    if cat_z > 0.3:
                        helps.append(wcat)
                        help_score += cat_z
                if helps and z_val > 0:
                    waiver_adds.append({
                        "name": name,
                        "z_score": round(z_val, 2),
                        "tier": tier,
                        "helps_categories": helps,
                        "help_score": round(help_score, 2),
                        "pct_owned": p.get("percent_owned", 0),
                        "positions": ",".join(p.get("eligible_positions", [])),
                    })
    except Exception:
        pass

    # Sort waiver adds by help_score
    waiver_adds.sort(key=lambda w: w.get("help_score", 0), reverse=True)
    waiver_adds = waiver_adds[:5]

    for w in waiver_adds:
        cats_str = ", ".join(w.get("helps_categories", []))
        recommended_actions.append({
            "action_type": "waiver",
            "description": "Add " + w.get("name", "?") + " (" + w.get("positions", "?") + ", Z=" + str(w.get("z_score", 0)) + ", " + str(w.get("pct_owned", 0)) + "% owned)",
            "impact": "Helps " + cats_str,
            "priority": "high" if w.get("help_score", 0) > 1.0 else "medium",
        })

    # 4b. Trade recommendations -- use trade finder league scan internally
    try:
        team = lg.to_team(TEAM_ID)
        trade_data = _trade_finder_league_scan(lg, team, as_json=True)
        if trade_data and not trade_data.get("error"):
            partners = trade_data.get("partners", [])
            for partner in partners[:2]:
                packages = partner.get("packages", [])
                comp_cats = partner.get("complementary_categories", [])
                for pkg in packages[:1]:
                    give_names = [g.get("name", "?") for g in pkg.get("give", [])]
                    get_names = [g.get("name", "?") for g in pkg.get("get", [])]
                    recommended_actions.append({
                        "action_type": "trade",
                        "description": "Trade " + ", ".join(give_names) + " to " + partner.get("team_name", "?") + " for " + ", ".join(get_names),
                        "impact": "Improves " + ", ".join(comp_cats[:3]),
                        "priority": "high" if len(comp_cats) >= 2 else "medium",
                    })
    except Exception:
        pass

    # 4c. Drop candidates -- low-value players hurting target categories
    drop_candidates = []
    try:
        try:
            team
        except NameError:
            team = lg.to_team(TEAM_ID)
        roster = team.roster()
        target_set = set(high_priority_cats + medium_priority_cats)

        for p in roster:
            if is_il(p):
                continue
            name = p.get("name", "Unknown")
            z_info = get_player_zscore(name)
            if not z_info:
                continue
            z_val = z_info.get("z_final", 0)
            tier = z_info.get("tier", "Streamable")
            per_cat = z_info.get("per_category_zscores", {})

            if tier not in ("Fringe", "Streamable"):
                continue

            # Check if this player hurts any target categories
            hurting = []
            for tcat in target_set:
                cat_z = per_cat.get(tcat, 0)
                if cat_z < -0.3:
                    hurting.append(tcat)

            if hurting or z_val < -0.5:
                drop_candidates.append({
                    "name": name,
                    "z_score": round(z_val, 2),
                    "tier": tier,
                    "hurting_categories": hurting,
                })
    except Exception:
        pass

    drop_candidates.sort(key=lambda d: d.get("z_score", 0))
    drop_candidates = drop_candidates[:3]

    for d in drop_candidates:
        hurt_str = ", ".join(d.get("hurting_categories", []))
        desc = "Drop " + d.get("name", "?") + " (Z=" + str(d.get("z_score", 0)) + ", " + d.get("tier", "?") + ")"
        if hurt_str:
            desc = desc + " -- hurting " + hurt_str
        recommended_actions.append({
            "action_type": "drop",
            "description": desc,
            "priority": "medium" if d.get("z_score", 0) < -0.5 else "low",
        })

    # 4d. Category target actions for high-priority gaps
    for gap in category_gaps:
        if gap.get("priority") != "high":
            continue
        cat_name = gap.get("category", "")
        places = gap.get("places_to_gain", 0)
        current = gap.get("current_rank", "?")
        target = gap.get("target_rank", "?")
        recommended_actions.append({
            "action_type": "category_target",
            "description": "Gain " + str(places) + " places in " + cat_name + " (currently " + _ordinal(current) + ", need " + _ordinal(target) + ")",
            "impact": "Projected +" + str(places) + " " + cat_name + " ranks",
            "priority": "high",
        })

    # Sort actions: high first, then medium, then low
    recommended_actions.sort(key=lambda a: priority_order.get(a.get("priority", "low"), 2))

    # ── 5. Calculate playoff probability ──
    # Simple model based on:
    # - distance from cutoff (games back)
    # - how many categories are in the top half
    # - current rank vs cutoff
    cats_above_target = 0
    total_cats = len(punt_data.get("categories", []))
    for cat in punt_data.get("categories", []):
        rank = cat.get("rank", 99)
        total = cat.get("total", num_teams)
        if rank <= max(1, total // 2):
            cats_above_target += 1

    cat_pct = (float(cats_above_target) / total_cats * 100) if total_cats > 0 else 50

    # Base probability from rank position
    if my_rank <= playoff_cutoff:
        base_prob = 70 + (playoff_cutoff - my_rank) * 5
    else:
        spots_out = my_rank - playoff_cutoff
        base_prob = max(5, 50 - spots_out * 12)

    # Adjust by category strength
    cat_adjustment = (cat_pct - 50) * 0.3

    # Adjust by games back
    gb_adjustment = -games_back * 3

    playoff_probability = max(5, min(95, int(base_prob + cat_adjustment + gb_adjustment)))

    # ── 6. Build summary ──
    summary_parts = []
    if my_rank <= playoff_cutoff:
        summary_parts.append("You're " + _ordinal(my_rank) + " -- currently in a playoff spot.")
        if games_back == 0:
            summary_parts.append("Hold your position by maintaining strengths.")
    else:
        spots_out = my_rank - playoff_cutoff
        summary_parts.append("You're " + _ordinal(my_rank) + ", need to climb " + str(spots_out) + " spot" + ("s" if spots_out != 1 else "") + ".")

    if games_back > 0:
        summary_parts.append(str(games_back) + " category-win" + ("s" if games_back != 1 else "") + " back from the " + _ordinal(playoff_cutoff) + " spot.")

    if high_priority_cats:
        summary_parts.append("Focus on improving " + ", ".join(high_priority_cats[:3]) + " where small gains yield rank jumps.")

    if punt_candidates:
        summary_parts.append("Consider punting " + ", ".join(punt_candidates[:2]) + " to double down on strengths.")

    summary = " ".join(summary_parts)

    result = {
        "current_rank": my_rank,
        "playoff_cutoff": playoff_cutoff,
        "games_back": games_back,
        "team_name": my_team_name,
        "record": str(my_wins) + "-" + str(my_losses) + ("-" + str(my_ties) if my_ties else ""),
        "num_teams": num_teams,
        "category_gaps": category_gaps,
        "recommended_actions": recommended_actions,
        "target_categories": target_categories,
        "punt_categories": punt_candidates,
        "playoff_probability": playoff_probability,
        "summary": summary,
    }

    if as_json:
        return result

    # CLI output
    print("Team: " + my_team_name + " (" + result.get("record", "") + ")")
    print("Current Rank: " + _ordinal(my_rank) + " / " + str(num_teams))
    print("Playoff Cutoff: Top " + str(playoff_cutoff))
    print("Games Back: " + str(games_back))
    print("Playoff Probability: " + str(playoff_probability) + "%")
    print("")

    if category_gaps:
        print("Category Gaps to Close:")
        print("  " + "Category".ljust(12) + "Rank".rjust(6) + "  Target".rjust(8) + "  Priority".rjust(10) + "  Cost")
        print("  " + "-" * 50)
        for g in category_gaps:
            print("  " + g.get("category", "?").ljust(12)
                  + (_ordinal(g.get("current_rank", "?"))).rjust(6)
                  + ("  " + _ordinal(g.get("target_rank", "?"))).rjust(8)
                  + ("  " + g.get("priority", "?")).rjust(10)
                  + "  " + g.get("cost_to_compete", "?"))
    print("")

    if recommended_actions:
        print("Recommended Actions:")
        for a in recommended_actions:
            prio = a.get("priority", "?").upper()
            atype = a.get("action_type", "?").upper()
            print("  [" + prio + "] " + atype + ": " + a.get("description", ""))
            if a.get("impact"):
                print("         Impact: " + a.get("impact", ""))
    print("")

    if target_categories:
        print("Target Categories: " + ", ".join(target_categories))
    if punt_candidates:
        print("Punt Categories: " + ", ".join(punt_candidates))
    print("")
    print("Summary: " + summary)


def cmd_trash_talk(args, as_json=False):
    """Generate trash talk lines based on your current matchup context"""
    import random
    intensity = "competitive"
    if args:
        if args[0] in ("friendly", "competitive", "savage"):
            intensity = args[0]

    if not as_json:
        print("Trash Talk Generator (" + intensity + ")")
        print("=" * 50)

    sc, gm, lg = get_league()

    # ── 1. Get matchup data ──
    try:
        stat_cats = lg.stat_categories()
        stat_id_to_name = {}
        for cat in stat_cats:
            sid = str(cat.get("stat_id", ""))
            display = cat.get("display_name", cat.get("name", "Stat " + sid))
            stat_id_to_name[sid] = display
    except Exception as e:
        stat_cats = []
        stat_id_to_name = {}
        if not as_json:
            print("  Warning: could not fetch stat categories: " + str(e))

    try:
        raw = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching matchup data: " + str(e)}
        print("Error fetching matchup data: " + str(e))
        return

    if not raw:
        if as_json:
            return {"error": "No matchup data available"}
        print("No matchup data available")
        return

    opp_name = None
    wins = 0
    losses = 0
    ties = 0
    winning_cats = []
    losing_cats = []
    my_best_stat = None
    my_best_stat_val = None
    opp_worst_stat = None
    opp_worst_stat_val = None
    week = "?"

    try:
        league_data = raw.get("fantasy_content", {}).get("league", [])
        if len(league_data) < 2:
            if as_json:
                return {"error": "No matchup data in response"}
            print("No matchup data in response")
            return

        sb_data = league_data[1].get("scoreboard", {})
        week = sb_data.get("week", "?")
        matchup_block = sb_data.get("0", {}).get("matchups", {})
        count = int(matchup_block.get("count", 0))

        for i in range(count):
            matchup = matchup_block.get(str(i), {}).get("matchup", {})
            teams_data = matchup.get("0", {}).get("teams", {})
            team1_data = teams_data.get("0", {})
            team2_data = teams_data.get("1", {})

            def _get_name(tdata):
                if isinstance(tdata, dict):
                    team_info = tdata.get("team", [])
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                            if isinstance(item, dict) and "name" in item:
                                return item.get("name", "?")
                return "?"

            def _get_key(tdata):
                if isinstance(tdata, dict):
                    team_info = tdata.get("team", [])
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                            if isinstance(item, dict) and "team_key" in item:
                                return item.get("team_key", "")
                return ""

            name1 = _get_name(team1_data)
            name2 = _get_name(team2_data)
            key1 = _get_key(team1_data)
            key2 = _get_key(team2_data)

            if TEAM_ID not in key1 and TEAM_ID not in key2:
                continue

            # Found our matchup
            if TEAM_ID in key1:
                my_data = team1_data
                opp_data = team2_data
                opp_name = name2
            else:
                my_data = team2_data
                opp_data = team1_data
                opp_name = name1

            my_key = _get_key(my_data)

            def _get_stats(tdata):
                stats = {}
                team_info = tdata.get("team", [])
                if isinstance(team_info, list):
                    for block in team_info:
                        if isinstance(block, dict) and "team_stats" in block:
                            raw_stats = block.get("team_stats", {}).get("stats", [])
                            for s in raw_stats:
                                stat = s.get("stat", {})
                                sid = str(stat.get("stat_id", ""))
                                val = stat.get("value", "0")
                                stats[sid] = val
                return stats

            my_stats = _get_stats(my_data)
            opp_stats = _get_stats(opp_data)

            # Extract stat winners
            stat_winners = matchup.get("stat_winners", [])
            cat_results = {}
            for sw in stat_winners:
                w = sw.get("stat_winner", {})
                sid = str(w.get("stat_id", ""))
                if w.get("is_tied"):
                    cat_results[sid] = "tie"
                else:
                    winner_key = w.get("winner_team_key", "")
                    if winner_key == my_key:
                        cat_results[sid] = "win"
                    else:
                        cat_results[sid] = "loss"

            # Build category tallies
            best_margin = 0
            worst_margin = 0
            for sid in cat_results:
                cat_name = stat_id_to_name.get(sid, "Stat " + sid)
                result = cat_results.get(sid, "tie")
                if result == "win":
                    wins += 1
                    winning_cats.append(cat_name)
                    try:
                        my_num = float(my_stats.get(sid, "0"))
                        opp_num = float(opp_stats.get(sid, "0"))
                        margin = abs(my_num - opp_num)
                        if margin > best_margin:
                            best_margin = margin
                            my_best_stat = cat_name
                            my_best_stat_val = str(my_stats.get(sid, "0"))
                    except (ValueError, TypeError):
                        pass
                elif result == "loss":
                    losses += 1
                    losing_cats.append(cat_name)
                    try:
                        my_num = float(my_stats.get(sid, "0"))
                        opp_num = float(opp_stats.get(sid, "0"))
                        margin = abs(my_num - opp_num)
                        if margin > worst_margin:
                            worst_margin = margin
                            opp_worst_stat = cat_name
                            opp_worst_stat_val = str(opp_stats.get(sid, "0"))
                    except (ValueError, TypeError):
                        pass
                else:
                    ties += 1

            break  # Found our matchup

    except Exception as e:
        if as_json:
            return {"error": "Error parsing matchup: " + str(e)}
        print("Error parsing matchup: " + str(e))
        return

    if not opp_name:
        if as_json:
            return {"error": "Could not find your matchup this week"}
        print("Could not find your matchup this week")
        return

    # ── 2. Get standings for rank context ──
    my_rank = "?"
    opp_rank = "?"
    try:
        standings = lg.standings()
        for idx, t in enumerate(standings, 1):
            tk = str(t.get("team_key", ""))
            tname = t.get("name", "")
            if TEAM_ID in tk:
                my_rank = idx
            if tname == opp_name:
                opp_rank = idx
    except Exception:
        pass

    # ── 3. Build score string ──
    score = str(wins) + "-" + str(losses)
    if ties > 0:
        score = score + "-" + str(ties)

    # ── 4. Generate trash talk lines from templates ──
    context = {
        "your_rank": my_rank,
        "their_rank": opp_rank,
        "score": score,
        "week": week,
        "winning_cats": winning_cats,
        "losing_cats": losing_cats,
        "best_stat": my_best_stat,
        "best_stat_val": my_best_stat_val,
    }

    friendly_templates = [
        "Hey " + opp_name + ", nice team... for a rebuilding year.",
        "I'm sure " + opp_name + " looked great on draft day. What happened?",
        "Don't worry, " + opp_name + ". There's always next week. And the week after that. And...",
        opp_name + ", your roster is like a participation trophy -- everyone gets one.",
        "I'd wish " + opp_name + " good luck, but even luck can't fix that lineup.",
        "Hey " + opp_name + ", if fantasy baseball had a mercy rule, this would be it.",
        "My bench players send their regards, " + opp_name + ".",
    ]

    competitive_templates = [
        opp_name + " is to fantasy baseball what the Rockies are to run prevention.",
        "Losing " + str(losses) + " categories and somehow still talking, " + opp_name + "?",
        "Week " + str(week) + " score is " + score + " and it's not getting better for " + opp_name + ".",
        "I've seen better rosters in 8-team leagues, " + opp_name + ".",
        "The only thing " + opp_name + " is winning is the race to last place.",
        opp_name + " drafted like they were reading the list upside down.",
        "Your weekly moves can't save you from my lineup, " + opp_name + ".",
    ]

    savage_templates = [
        "Your team's ERA looks like a phone number, " + opp_name + ".",
        "The only thing " + opp_name + "'s roster and a dumpster fire have in common is the fire department can't help either one.",
        "I'd trade you advice, " + opp_name + ", but you'd probably drop it.",
        opp_name + "'s team is proof that autodraft needs a warning label.",
        "Even your bye-week players are outperforming your starters, " + opp_name + ".",
        "If " + opp_name + "'s roster was a stock, the SEC would investigate for fraud.",
        opp_name + "'s team photo should be on a milk carton -- because those wins are missing.",
    ]

    # Add contextual lines based on rank differences
    if isinstance(my_rank, int) and isinstance(opp_rank, int):
        rank_diff = opp_rank - my_rank
        if rank_diff > 0:
            competitive_templates.append(
                "I'm ranked " + str(my_rank) + " and you're ranked " + str(opp_rank) + ". Do the math, " + opp_name + "."
            )
            savage_templates.append(
                str(rank_diff) + " spots separate us in the standings, " + opp_name + ". That's not a gap, it's an abyss."
            )
            friendly_templates.append(
                "Ranked " + str(opp_rank) + "? At least you're consistent, " + opp_name + "."
            )

    # Add lines based on winning categories
    if wins > losses:
        competitive_templates.append(
            "Up " + score + " this week. Your move, " + opp_name + ". Actually, don't bother."
        )
        savage_templates.append(
            score + ". That's not a matchup, " + opp_name + ". That's a public service announcement."
        )

    if my_best_stat and my_best_stat_val:
        competitive_templates.append(
            "My " + my_best_stat + " at " + my_best_stat_val + " is doing things your whole roster can't, " + opp_name + "."
        )
        savage_templates.append(
            "My " + my_best_stat + " alone is carrying harder than " + opp_name + "'s entire draft class."
        )

    if len(winning_cats) >= 3:
        sample_cats = ", ".join(random.sample(winning_cats, min(3, len(winning_cats))))
        competitive_templates.append(
            "Dominating " + sample_cats + " and it's not even close, " + opp_name + "."
        )

    # Select templates based on intensity
    if intensity == "friendly":
        pool = friendly_templates
    elif intensity == "savage":
        pool = savage_templates
    else:
        pool = competitive_templates

    num_lines = min(random.randint(3, 5), len(pool))
    lines = random.sample(pool, num_lines)

    # Pick the featured line (longest one tends to be the most impactful)
    featured = max(lines, key=len)

    result = {
        "opponent": opp_name,
        "intensity": intensity,
        "week": week,
        "context": {
            "your_rank": my_rank,
            "their_rank": opp_rank,
            "score": score,
        },
        "lines": lines,
        "featured_line": featured,
    }

    if as_json:
        return result

    print("")
    print("vs. " + opp_name + " (Week " + str(week) + ")")
    print("Score: " + score)
    print("Your Rank: " + str(my_rank) + " | Their Rank: " + str(opp_rank))
    print("")
    print("--- Trash Talk (" + intensity + ") ---")
    print("")
    for line in lines:
        print("  > " + line)
    print("")
    print("Featured: " + featured)


def cmd_rival_history(args, as_json=False):
    """Show head-to-head record against each league opponent with detailed matchup history.
    Supports cross-season history when config/league-history.json exists."""
    if not as_json:
        print("Rival History")
        print("=" * 50)

    sc, gm, lg = get_league()

    opponent_filter = ""
    if args:
        opponent_filter = " ".join(args).strip().lower()

    # Get stat categories for names
    try:
        stat_cats = lg.stat_categories()
        stat_id_to_name = {}
        for cat in stat_cats:
            sid = str(cat.get("stat_id", ""))
            display = cat.get("display_name", cat.get("name", "Stat " + sid))
            stat_id_to_name[sid] = display
    except Exception:
        stat_cats = []
        stat_id_to_name = {}

    # Get our team name and manager GUID for cross-season matching
    my_team_name = ""
    my_manager_guid = ""
    try:
        teams = lg.teams()
        for tk, td in teams.items():
            if TEAM_ID in str(tk):
                my_team_name = td.get("name", "")
                managers = td.get("managers", [])
                if isinstance(managers, list):
                    for mgr in managers:
                        m = mgr.get("manager", mgr) if isinstance(mgr, dict) else {}
                        guid = m.get("guid", "")
                        if guid:
                            my_manager_guid = guid
                            break
                break
    except Exception:
        pass

    # Helpers to extract data from Yahoo nested matchup structure
    def _extract_name(tdata):
        if isinstance(tdata, dict):
            team_info = tdata.get("team", [])
            if isinstance(team_info, list) and len(team_info) > 0:
                items = team_info[0] if isinstance(team_info[0], list) else team_info
                for item in items:
                    if isinstance(item, dict) and "name" in item:
                        return item.get("name", "?")
        return "?"

    def _extract_key(tdata):
        if isinstance(tdata, dict):
            team_info = tdata.get("team", [])
            if isinstance(team_info, list) and len(team_info) > 0:
                items = team_info[0] if isinstance(team_info[0], list) else team_info
                for item in items:
                    if isinstance(item, dict) and "team_key" in item:
                        return item.get("team_key", "")
        return ""

    def _extract_stats(tdata):
        stats = {}
        team_info = tdata.get("team", [])
        if isinstance(team_info, list):
            for block in team_info:
                if isinstance(block, dict) and "team_stats" in block:
                    raw_stats = block.get("team_stats", {}).get("stats", [])
                    for s in raw_stats:
                        stat = s.get("stat", {})
                        sid = str(stat.get("stat_id", ""))
                        val = stat.get("value", "0")
                        stats[sid] = val
        return stats

    def _scan_league_matchups(league_obj, team_id_str, max_weeks, year_label=None):
        """Scan a league's matchups and return list of matchup results"""
        results = []
        for week_num in range(1, max_weeks + 1):
            try:
                raw = league_obj.matchups(week=week_num)
            except Exception:
                continue

            if not raw:
                continue

            try:
                league_data = raw.get("fantasy_content", {}).get("league", [])
                if len(league_data) < 2:
                    continue
                sb_data = league_data[1].get("scoreboard", {})
                matchup_block = sb_data.get("0", {}).get("matchups", {})
                count = int(matchup_block.get("count", 0))

                for i in range(count):
                    matchup = matchup_block.get(str(i), {}).get("matchup", {})
                    teams_data = matchup.get("0", {}).get("teams", {})
                    team1_data = teams_data.get("0", {})
                    team2_data = teams_data.get("1", {})

                    key1 = _extract_key(team1_data)
                    key2 = _extract_key(team2_data)

                    if team_id_str not in key1 and team_id_str not in key2:
                        continue

                    if team_id_str in key1:
                        my_data = team1_data
                        opp_data = team2_data
                    else:
                        my_data = team2_data
                        opp_data = team1_data

                    opp_name = _extract_name(opp_data)
                    my_key = _extract_key(my_data)
                    my_stats = _extract_stats(my_data)
                    opp_stats = _extract_stats(opp_data)

                    stat_winners = matchup.get("stat_winners", [])
                    wins = 0
                    losses = 0
                    ties = 0
                    cat_detail = []

                    for sw in stat_winners:
                        w = sw.get("stat_winner", {})
                        sid = str(w.get("stat_id", ""))
                        cat_name = stat_id_to_name.get(sid, "Stat " + sid)
                        if w.get("is_tied"):
                            ties += 1
                            cat_detail.append({"category": cat_name, "result": "tie", "my_value": str(my_stats.get(sid, "-")), "opp_value": str(opp_stats.get(sid, "-"))})
                        else:
                            winner_key = w.get("winner_team_key", "")
                            if winner_key == my_key:
                                wins += 1
                                cat_detail.append({"category": cat_name, "result": "win", "my_value": str(my_stats.get(sid, "-")), "opp_value": str(opp_stats.get(sid, "-"))})
                            else:
                                losses += 1
                                cat_detail.append({"category": cat_name, "result": "loss", "my_value": str(my_stats.get(sid, "-")), "opp_value": str(opp_stats.get(sid, "-"))})

                    results.append({
                        "week": week_num,
                        "year": year_label,
                        "opp_name": opp_name,
                        "wins": wins,
                        "losses": losses,
                        "ties": ties,
                        "cat_detail": cat_detail,
                    })
                    break
            except Exception:
                continue
        return results

    # Collect all matchup results — current season first
    all_matchups = []

    # Current season
    try:
        current_week = lg.current_week()
    except Exception:
        current_week = 1

    last_completed = current_week - 1
    current_year = str(datetime.now().year)

    if last_completed >= 1:
        all_matchups.extend(_scan_league_matchups(lg, TEAM_ID, last_completed, current_year))

    # Cross-season history from league-history.json (cap at 5 most recent seasons)
    max_hist_seasons = 5
    seasons_scanned = [current_year]
    try:
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config", "league-history.json")
        with open(config_path, "r") as f:
            league_keys = json.load(f)

        hist_count = 0
        for year_str, league_key in sorted(league_keys.items(), reverse=True):
            if year_str == current_year:
                continue  # Already scanned
            if hist_count >= max_hist_seasons:
                break
            try:
                hist_sc = get_connection()
                hist_gm = yfa.Game(hist_sc, "mlb")
                hist_lg = hist_gm.to_league(league_key)

                # Find our team key in historical league
                hist_team_id = ""
                try:
                    hist_teams = hist_lg.teams()
                    # Match by manager GUID (most reliable across seasons)
                    if my_manager_guid:
                        for tk, td in hist_teams.items():
                            managers = td.get("managers", [])
                            if isinstance(managers, list):
                                for mgr in managers:
                                    m = mgr.get("manager", mgr) if isinstance(mgr, dict) else {}
                                    if m.get("guid", "") == my_manager_guid:
                                        hist_team_id = str(tk)
                                        break
                            if hist_team_id:
                                break
                    # Fallback: match by team name
                    if not hist_team_id and my_team_name:
                        for tk, td in hist_teams.items():
                            if td.get("name", "") == my_team_name:
                                hist_team_id = str(tk)
                                break
                except Exception:
                    continue

                if not hist_team_id:
                    continue

                # Try to get end week, default to 22 (typical regular season length)
                try:
                    end_week = hist_lg.end_week()
                except Exception:
                    end_week = 22

                hist_matchups = _scan_league_matchups(hist_lg, hist_team_id, end_week, year_str)
                all_matchups.extend(hist_matchups)
                seasons_scanned.append(year_str)
                hist_count += 1
            except Exception:
                continue
    except Exception:
        pass  # No league-history.json or read error — current season only

    if not all_matchups:
        if as_json:
            return {"your_team": my_team_name, "rivals": [], "error": "No matchup data found"}
        print("No matchup data found")
        return

    # Aggregate by opponent
    rival_data = {}  # opp_name -> {wins, losses, ties, matchups: [...]}
    for m in all_matchups:
        opp = m.get("opp_name", "?")
        if opp not in rival_data:
            rival_data[opp] = {"wins": 0, "losses": 0, "ties": 0, "matchups": [], "seasons": {}}
        # Determine matchup-level result
        if m.get("wins", 0) > m.get("losses", 0):
            rival_data[opp]["wins"] += 1
            result = "win"
        elif m.get("losses", 0) > m.get("wins", 0):
            rival_data[opp]["losses"] += 1
            result = "loss"
        else:
            rival_data[opp]["ties"] += 1
            result = "tie"

        # Track per-season records
        yr = str(m.get("year", current_year))
        if yr not in rival_data[opp]["seasons"]:
            rival_data[opp]["seasons"][yr] = {"wins": 0, "losses": 0, "ties": 0}
        if result == "win":
            rival_data[opp]["seasons"][yr]["wins"] += 1
        elif result == "loss":
            rival_data[opp]["seasons"][yr]["losses"] += 1
        else:
            rival_data[opp]["seasons"][yr]["ties"] += 1

        score_str = str(m.get("wins", 0)) + "-" + str(m.get("losses", 0)) + "-" + str(m.get("ties", 0))
        rival_data[opp]["matchups"].append({
            "week": m.get("week"),
            "year": yr,
            "score": score_str,
            "result": result,
            "cat_detail": m.get("cat_detail", []),
        })

    # ── Detail mode: filter to one opponent ──
    if opponent_filter:
        matched_opp = None
        for opp in rival_data:
            if opponent_filter in opp.lower():
                matched_opp = opp
                break

        if not matched_opp:
            if as_json:
                return {"error": "No opponent found matching: " + opponent_filter}
            print("No opponent found matching: " + opponent_filter)
            return

        rd = rival_data[matched_opp]
        record_str = str(rd.get("wins", 0)) + "-" + str(rd.get("losses", 0)) + "-" + str(rd.get("ties", 0))

        # Build matchup list
        matchup_list = []
        biggest_win = None
        closest_match = None
        biggest_margin = -1
        smallest_margin = 999

        for mu in rd.get("matchups", []):
            score_parts = mu.get("score", "0-0-0").split("-")
            w = int(score_parts[0]) if len(score_parts) > 0 else 0
            l = int(score_parts[1]) if len(score_parts) > 1 else 0
            t = int(score_parts[2]) if len(score_parts) > 2 else 0
            margin = abs(w - l)

            # Find MVP category (biggest differential win)
            mvp_cat = ""
            best_diff = 0
            for cd in mu.get("cat_detail", []):
                if cd.get("result") == "win":
                    try:
                        my_v = float(cd.get("my_value", "0"))
                        opp_v = float(cd.get("opp_value", "0"))
                        diff = abs(my_v - opp_v)
                        if diff > best_diff:
                            best_diff = diff
                            mvp_cat = cd.get("category", "")
                    except (ValueError, TypeError):
                        pass

            note = ""
            if margin <= 1:
                note = "Closest matchup"
            elif margin >= 5:
                note = "Dominant " + mu.get("result", "")

            matchup_entry = {
                "week": mu.get("week"),
                "score": mu.get("score"),
                "result": mu.get("result"),
                "mvp_category": mvp_cat,
                "note": note,
            }
            matchup_list.append(matchup_entry)

            if mu.get("result") == "win" and margin > biggest_margin:
                biggest_margin = margin
                biggest_win = matchup_entry
            if margin < smallest_margin:
                smallest_margin = margin
                closest_match = matchup_entry

        # Category edge analysis
        you_dominate = {}
        they_dominate = {}
        for mu in rd.get("matchups", []):
            for cd in mu.get("cat_detail", []):
                cat = cd.get("category", "")
                if not cat:
                    continue
                if cd.get("result") == "win":
                    you_dominate[cat] = you_dominate.get(cat, 0) + 1
                elif cd.get("result") == "loss":
                    they_dominate[cat] = they_dominate.get(cat, 0) + 1

        total_matchups = len(rd.get("matchups", []))
        threshold = max(1, total_matchups * 0.6)

        your_cats = [c for c, n in sorted(you_dominate.items(), key=lambda x: -x[1]) if n >= threshold]
        their_cats = [c for c, n in sorted(they_dominate.items(), key=lambda x: -x[1]) if n >= threshold]

        # Build narrative
        narrative_parts = []
        if rd.get("wins", 0) > rd.get("losses", 0):
            narrative_parts.append("You own " + matched_opp + " with a " + record_str + " record.")
        elif rd.get("losses", 0) > rd.get("wins", 0):
            narrative_parts.append(matched_opp + " has your number at " + record_str + ".")
        else:
            narrative_parts.append("Dead even rivalry at " + record_str + ".")

        if your_cats:
            narrative_parts.append("You dominate in " + ", ".join(your_cats[:3]) + ".")
        if their_cats:
            narrative_parts.append("They beat you in " + ", ".join(their_cats[:3]) + ".")

        narrative = " ".join(narrative_parts)

        detail_result = {
            "your_team": my_team_name,
            "opponent": matched_opp,
            "all_time_record": record_str,
            "wins": rd.get("wins", 0),
            "losses": rd.get("losses", 0),
            "ties": rd.get("ties", 0),
            "matchups": matchup_list,
            "category_edge": {
                "you_dominate": your_cats,
                "they_dominate": their_cats,
            },
            "biggest_win": biggest_win,
            "closest_match": closest_match,
            "narrative": narrative,
        }

        if as_json:
            return detail_result

        print("Rival History: " + my_team_name + " vs " + matched_opp)
        print("All-Time Record: " + record_str)
        print("")
        print("Matchups:")
        for mu in matchup_list:
            r_marker = mu.get("result", "?")[0].upper()
            line = "  Week " + str(mu.get("week", "?")).rjust(2) + "  [" + r_marker + "] " + mu.get("score", "")
            if mu.get("mvp_category"):
                line += "  MVP: " + mu.get("mvp_category", "")
            if mu.get("note"):
                line += "  (" + mu.get("note", "") + ")"
            print(line)
        print("")
        if your_cats:
            print("You dominate: " + ", ".join(your_cats))
        if their_cats:
            print("They dominate: " + ", ".join(their_cats))
        print("")
        print(narrative)
        return

    # ── Overview mode: all rivals ──
    rivals = []
    for opp, rd in sorted(rival_data.items(), key=lambda x: -(x[1].get("wins", 0) - x[1].get("losses", 0))):
        w = rd.get("wins", 0)
        l = rd.get("losses", 0)
        t = rd.get("ties", 0)
        record_str = str(w) + "-" + str(l) + "-" + str(t)

        # Dominance label
        total = w + l + t
        if total == 0:
            dominance = "unknown"
        elif w >= total * 0.75:
            dominance = "dominant"
        elif w > l:
            dominance = "strong"
        elif w == l:
            dominance = "even"
        elif l >= total * 0.75:
            dominance = "dominated"
        else:
            dominance = "weak"

        # Last meeting
        last_mu = rd.get("matchups", [])[-1] if rd.get("matchups") else None
        last_result = ""
        last_week = 0
        if last_mu:
            r = last_mu.get("result", "?")
            last_result = r[0].upper() + " " + last_mu.get("score", "")
            last_week = last_mu.get("week", 0)

        # Per-season breakdown
        season_list = []
        for yr in sorted(rd.get("seasons", {}).keys(), reverse=True):
            s = rd["seasons"][yr]
            season_list.append({
                "year": yr,
                "wins": s.get("wins", 0),
                "losses": s.get("losses", 0),
                "ties": s.get("ties", 0),
            })

        rivals.append({
            "opponent": opp,
            "record": record_str,
            "wins": w,
            "losses": l,
            "ties": t,
            "last_result": last_result,
            "last_week": last_week,
            "dominance": dominance,
            "seasons": season_list,
        })

    result = {
        "your_team": my_team_name,
        "rivals": rivals,
        "seasons_scanned": sorted(seasons_scanned, reverse=True),
    }

    if as_json:
        return result

    print("Head-to-Head Rival History: " + my_team_name)
    print("")
    print("  " + "Opponent".ljust(28) + "Record".ljust(10) + "Last".ljust(16) + "Status")
    print("  " + "-" * 60)
    for r in rivals:
        last_str = r.get("last_result", "")
        if r.get("last_week"):
            last_str += " (wk " + str(r.get("last_week")) + ")"
        print("  " + r.get("opponent", "?").ljust(28) + r.get("record", "").ljust(10)
              + last_str.ljust(16) + r.get("dominance", ""))


def cmd_achievements(args, as_json=False):
    """Track and display achievement milestones for the season"""
    sc, gm, lg, team = get_league_context()

    achievements = []

    # ---------- Standings & Record Data ----------
    standings = []
    my_standing = {}
    my_team_name = ""
    try:
        standings = lg.standings()
        for i, t in enumerate(standings, 1):
            tk = t.get("team_key", "")
            if TEAM_ID in str(tk):
                my_standing = t
                my_standing["rank"] = i
                my_team_name = t.get("name", "Unknown")
                break
    except Exception as e:
        print("Warning: could not fetch standings: " + str(e))

    wins = int(my_standing.get("outcome_totals", {}).get("wins", 0))
    losses = int(my_standing.get("outcome_totals", {}).get("losses", 0))
    ties = int(my_standing.get("outcome_totals", {}).get("ties", 0))
    my_rank = my_standing.get("rank", 0)
    num_teams = len(standings) if standings else 12

    # ---------- Matchup History (scan past weeks) ----------
    current_week = 1
    try:
        current_week = lg.current_week()
    except Exception:
        pass

    weekly_results = []
    best_week_cats_won = 0
    best_week_cats_won_week = 0
    biggest_blowout_margin = 0
    biggest_blowout_week = 0
    closest_win_margin = 999
    closest_win_week = 0

    yf_mod = importlib.import_module("yahoo-fantasy")
    for wk in range(1, current_week):
        try:
            detail = yf_mod.cmd_matchup_detail([str(wk)], as_json=True)
            if not detail or detail.get("error"):
                continue
            score = detail.get("score", {})
            w = int(score.get("wins", 0))
            l = int(score.get("losses", 0))
            t_val = int(score.get("ties", 0))
            week_won = w > l

            weekly_results.append({
                "week": wk,
                "won": week_won,
                "lost": w < l,
                "tied": w == l,
                "cats_won": w,
                "cats_lost": l,
                "cats_tied": t_val,
            })

            if w > best_week_cats_won:
                best_week_cats_won = w
                best_week_cats_won_week = wk

            margin = w - l
            if margin > biggest_blowout_margin:
                biggest_blowout_margin = margin
                biggest_blowout_week = wk

            if week_won and margin < closest_win_margin:
                closest_win_margin = margin
                closest_win_week = wk

        except Exception:
            continue

    # ---------- Win Streak Calculations ----------
    current_streak = 0
    longest_streak = 0
    streak = 0
    for wr in weekly_results:
        if wr.get("won"):
            streak += 1
            if streak > longest_streak:
                longest_streak = streak
        else:
            streak = 0
    for wr in reversed(weekly_results):
        if wr.get("won"):
            current_streak += 1
        else:
            break

    # ---------- Transaction Count ----------
    my_moves = 0
    my_trades = 0
    try:
        team_details = team.details() if hasattr(team, "details") else None
        if team_details:
            if isinstance(team_details, list) and len(team_details) > 0:
                d = team_details[0] if isinstance(team_details[0], dict) else {}
            elif isinstance(team_details, dict):
                d = team_details
            else:
                d = {}
            my_moves = int(d.get("number_of_moves", 0) or 0)
            my_trades = int(d.get("number_of_trades", 0) or 0)
    except Exception:
        pass

    # ---------- Category History from DB ----------
    best_era = None
    best_era_week = 0
    most_hr_week_val = 0
    most_hr_week = 0
    try:
        db = get_db()
        rows = db.execute("SELECT week, category, value, rank FROM category_history ORDER BY week").fetchall()
        for row in rows:
            wk = row[0]
            cat = row[1]
            val = row[2]

            if cat.upper() == "ERA" and val is not None:
                try:
                    era_val = float(val)
                    if best_era is None or era_val < best_era:
                        best_era = era_val
                        best_era_week = wk
                except (ValueError, TypeError):
                    pass

            if cat.upper() in ("HR",) and val is not None:
                try:
                    hr_val = int(float(val))
                    if hr_val > most_hr_week_val:
                        most_hr_week_val = hr_val
                        most_hr_week = wk
                except (ValueError, TypeError):
                    pass

        db.close()
    except Exception:
        pass

    # ---------- Build Achievement List ----------

    # 1. Hot Streak
    achievements.append({
        "name": "Hot Streak",
        "description": "Win 3+ consecutive matchups",
        "earned": longest_streak >= 3,
        "value": str(longest_streak) + " wins" if longest_streak >= 3 else str(longest_streak) + " best streak",
        "icon": "fire",
    })

    # 2. Ironman Streak
    achievements.append({
        "name": "Ironman Streak",
        "description": "Win 5+ consecutive matchups",
        "earned": longest_streak >= 5,
        "value": str(longest_streak) + " wins" if longest_streak >= 5 else str(longest_streak) + " best streak",
        "icon": "muscle",
    })

    # 3. Category Dominator
    achievements.append({
        "name": "Category Dominator",
        "description": "Win 15+ categories in a single week",
        "earned": best_week_cats_won >= 15,
        "value": str(best_week_cats_won) + " cats (week " + str(best_week_cats_won_week) + ")" if best_week_cats_won > 0 else None,
        "icon": "crown",
    })

    # 4. Blowout King
    achievements.append({
        "name": "Blowout King",
        "description": "Win a matchup by 10+ category margin",
        "earned": biggest_blowout_margin >= 10,
        "value": "+" + str(biggest_blowout_margin) + " (week " + str(biggest_blowout_week) + ")" if biggest_blowout_margin > 0 else None,
        "icon": "explosion",
    })

    # 5. Squeaker
    has_squeaker = closest_win_margin == 1 and closest_win_week > 0
    achievements.append({
        "name": "Squeaker",
        "description": "Win a matchup by exactly 1 category",
        "earned": has_squeaker,
        "value": "Week " + str(closest_win_week) if has_squeaker else None,
        "icon": "sweat",
    })

    # 6. ERA Ace
    achievements.append({
        "name": "ERA Ace",
        "description": "Post a weekly ERA under 2.00",
        "earned": best_era is not None and best_era < 2.0,
        "value": str(round(best_era, 2)) + " ERA (week " + str(best_era_week) + ")" if best_era is not None and best_era < 2.0 else None,
        "icon": "star",
    })

    # 7. HR Derby
    achievements.append({
        "name": "HR Derby",
        "description": "Hit 20+ HR in a single week",
        "earned": most_hr_week_val >= 20,
        "value": str(most_hr_week_val) + " HR (week " + str(most_hr_week) + ")" if most_hr_week_val >= 20 else (str(most_hr_week_val) + " best" if most_hr_week_val > 0 else None),
        "icon": "baseball",
    })

    # 8. Wheeler Dealer
    achievements.append({
        "name": "Wheeler Dealer",
        "description": "Make 30+ roster moves in a season",
        "earned": my_moves >= 30,
        "value": str(my_moves) + " moves",
        "icon": "handshake",
    })

    # 9. Trade Baron
    achievements.append({
        "name": "Trade Baron",
        "description": "Complete 3+ trades in a season",
        "earned": my_trades >= 3,
        "value": str(my_trades) + " trades",
        "icon": "scales",
    })

    # 10. Top Dog
    achievements.append({
        "name": "Top Dog",
        "description": "Reach 1st place in the standings",
        "earned": my_rank == 1,
        "value": _ordinal(my_rank) + " place" if my_rank > 0 else None,
        "icon": "trophy",
    })

    # 11. Podium Finish
    achievements.append({
        "name": "Podium Finish",
        "description": "Reach top 3 in the standings",
        "earned": 0 < my_rank <= 3,
        "value": _ordinal(my_rank) + " place" if my_rank > 0 else None,
        "icon": "medal",
    })

    # 12. Winning Record
    achievements.append({
        "name": "Winning Record",
        "description": "Have more wins than losses",
        "earned": wins > losses,
        "value": str(wins) + "-" + str(losses) + ("-" + str(ties) if ties else ""),
        "icon": "chart_up",
    })

    # 13. Perfect Week
    total_cats = 20
    try:
        stat_cats = lg.stat_categories()
        total_cats = len(stat_cats) if stat_cats else 20
    except Exception:
        pass
    perfect_week = best_week_cats_won >= total_cats and best_week_cats_won > 0
    achievements.append({
        "name": "Perfect Week",
        "description": "Win every category in a single matchup",
        "earned": perfect_week,
        "value": str(best_week_cats_won) + "/" + str(total_cats) + " cats (week " + str(best_week_cats_won_week) + ")" if best_week_cats_won > 0 else None,
        "icon": "hundred",
    })

    # 14. Comeback Kid
    had_loss_streak = False
    temp_loss = 0
    for wr in weekly_results:
        if wr.get("lost"):
            temp_loss += 1
            if temp_loss >= 2:
                had_loss_streak = True
        else:
            temp_loss = 0
    achievements.append({
        "name": "Comeback Kid",
        "description": "Win 2+ in a row after a 2+ game losing streak",
        "earned": had_loss_streak and current_streak >= 2,
        "value": str(current_streak) + " win streak after slump" if had_loss_streak and current_streak >= 2 else None,
        "icon": "rocket",
    })

    # 15. Season Veteran
    weeks_played = wins + losses + ties
    achievements.append({
        "name": "Season Veteran",
        "description": "Complete 10+ matchup weeks",
        "earned": weeks_played >= 10,
        "value": str(weeks_played) + " weeks played",
        "icon": "calendar",
    })

    # Count earned
    total_earned = len([a for a in achievements if a.get("earned")])
    total_available = len(achievements)

    result = {
        "total_earned": total_earned,
        "total_available": total_available,
        "team_name": my_team_name,
        "record": str(wins) + "-" + str(losses) + ("-" + str(ties) if ties else ""),
        "current_rank": my_rank,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "achievements": achievements,
    }

    if as_json:
        return result

    print("Achievements - " + my_team_name)
    print("=" * 50)
    print("Record: " + str(wins) + "-" + str(losses) + ("-" + str(ties) if ties else ""))
    print("Rank: " + _ordinal(my_rank) + " of " + str(num_teams))
    print("Earned: " + str(total_earned) + " / " + str(total_available))
    print("")

    for a in achievements:
        marker = "[X]" if a.get("earned") else "[ ]"
        val = a.get("value", "")
        val_str = " (" + str(val) + ")" if val else ""
        print("  " + marker + " " + a.get("name", "?").ljust(22) + a.get("description", "") + val_str)


def cmd_weekly_narrative(args, as_json=False):
    """Generate a narrative-style weekly recap with highlights, MVP category, and standings movement"""
    if not as_json:
        print("Weekly Narrative Recap")
        print("=" * 50)

    sc, gm, lg = get_league()

    # ── 1. Stat categories ──
    try:
        stat_cats = lg.stat_categories()
        stat_id_to_name = {}
        for cat in stat_cats:
            sid = str(cat.get("stat_id", ""))
            display = cat.get("display_name", cat.get("name", "Stat " + sid))
            stat_id_to_name[sid] = display
    except Exception as e:
        stat_cats = []
        stat_id_to_name = {}
        if not as_json:
            print("  Warning: could not fetch stat categories: " + str(e))

    # Determine lower-is-better stat IDs
    lower_is_better_sids = set()
    for cat in stat_cats:
        sid = str(cat.get("stat_id", ""))
        sort_order = cat.get("sort_order", "1")
        if str(sort_order) == "0":
            lower_is_better_sids.add(sid)

    # ── 2. Get matchup data ──
    try:
        raw = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching matchup data: " + str(e)}
        print("Error fetching matchup data: " + str(e))
        return

    if not raw:
        if as_json:
            return {"error": "No matchup data available"}
        print("No matchup data available")
        return

    try:
        league_data = raw.get("fantasy_content", {}).get("league", [])
        if len(league_data) < 2:
            if as_json:
                return {"error": "No matchup data in response"}
            print("No matchup data in response")
            return

        sb_data = league_data[1].get("scoreboard", {})
        week = sb_data.get("week", "?")
        matchup_block = sb_data.get("0", {}).get("matchups", {})
        count = int(matchup_block.get("count", 0))

        found_matchup = False
        for i in range(count):
            matchup = matchup_block.get(str(i), {}).get("matchup", {})
            teams_data = matchup.get("0", {}).get("teams", {})
            team1_data = teams_data.get("0", {})
            team2_data = teams_data.get("1", {})

            # Extract team name
            def _get_name_nar(tdata):
                if isinstance(tdata, dict):
                    team_info = tdata.get("team", [])
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                            if isinstance(item, dict) and "name" in item:
                                return item.get("name", "?")
                return "?"

            # Extract team key
            def _get_key_nar(tdata):
                if isinstance(tdata, dict):
                    team_info = tdata.get("team", [])
                    if isinstance(team_info, list) and len(team_info) > 0:
                        for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                            if isinstance(item, dict) and "team_key" in item:
                                return item.get("team_key", "")
                return ""

            name1 = _get_name_nar(team1_data)
            name2 = _get_name_nar(team2_data)
            key1 = _get_key_nar(team1_data)
            key2 = _get_key_nar(team2_data)

            if TEAM_ID not in key1 and TEAM_ID not in key2:
                continue

            found_matchup = True

            # Determine which team is ours
            if TEAM_ID in key1:
                my_data = team1_data
                opp_data = team2_data
                opp_name = name2
                my_name = name1
            else:
                my_data = team2_data
                opp_data = team1_data
                opp_name = name1
                my_name = name2

            my_key = _get_key_nar(my_data)

            # Extract stats
            def _get_stats_nar(tdata):
                stats = {}
                team_info = tdata.get("team", [])
                if isinstance(team_info, list):
                    for block in team_info:
                        if isinstance(block, dict) and "team_stats" in block:
                            raw_stats = block.get("team_stats", {}).get("stats", [])
                            for s in raw_stats:
                                stat = s.get("stat", {})
                                sid = str(stat.get("stat_id", ""))
                                val = stat.get("value", "0")
                                stats[sid] = val
                return stats

            my_stats = _get_stats_nar(my_data)
            opp_stats = _get_stats_nar(opp_data)

            # Extract stat winners
            stat_winners = matchup.get("stat_winners", [])
            cat_results = {}
            for sw in stat_winners:
                w = sw.get("stat_winner", {})
                sid = str(w.get("stat_id", ""))
                if w.get("is_tied"):
                    cat_results[sid] = "tie"
                else:
                    winner_key = w.get("winner_team_key", "")
                    if winner_key == my_key:
                        cat_results[sid] = "win"
                    else:
                        cat_results[sid] = "loss"

            # ── 3. Per-category analysis with margins ──
            categories = []
            wins = 0
            losses = 0
            ties = 0
            best_advantage = None
            best_advantage_margin = -999
            worst_loss = None
            worst_loss_margin = -999

            for sid in sorted(cat_results.keys(), key=lambda x: int(x) if x.isdigit() else 0):
                cat_name = stat_id_to_name.get(sid, "Stat " + sid)
                my_val = my_stats.get(sid, "-")
                opp_val = opp_stats.get(sid, "-")
                cat_result = cat_results.get(sid, "tie")

                if cat_result == "win":
                    wins += 1
                elif cat_result == "loss":
                    losses += 1
                else:
                    ties += 1

                # Calculate normalized margin for MVP/weakness detection
                margin_val = 0
                try:
                    my_num = float(my_val)
                    opp_num = float(opp_val)
                    avg = (abs(my_num) + abs(opp_num)) / 2.0
                    if avg > 0:
                        if sid in lower_is_better_sids:
                            margin_val = (opp_num - my_num) / avg
                        else:
                            margin_val = (my_num - opp_num) / avg
                    else:
                        margin_val = 0
                except (ValueError, TypeError):
                    margin_val = 0

                cat_entry = {
                    "name": cat_name,
                    "your_value": str(my_val),
                    "opp_value": str(opp_val),
                    "result": cat_result,
                }
                categories.append(cat_entry)

                # Track MVP category (biggest relative advantage in a win)
                if cat_result == "win" and margin_val > best_advantage_margin:
                    best_advantage_margin = margin_val
                    best_advantage = cat_entry

                # Track weakness (biggest relative deficit in a loss)
                if cat_result == "loss" and margin_val < worst_loss_margin:
                    worst_loss_margin = margin_val
                    worst_loss = cat_entry

            score_str = str(wins) + "-" + str(losses) + "-" + str(ties)
            if wins > losses:
                result_str = "win"
            elif wins < losses:
                result_str = "loss"
            else:
                result_str = "tie"

            # ── 4. Get current standings ──
            current_rank = "?"
            standings_change = {"from": "?", "to": "?", "direction": "none"}
            try:
                standings = lg.standings()
                for idx, t in enumerate(standings, 1):
                    if TEAM_ID in str(t.get("team_key", "")):
                        current_rank = idx
                        standings_change["to"] = idx
                        break

                # Infer rank change from win/loss records of nearby teams
                if current_rank != "?":
                    my_standing = standings[current_rank - 1]
                    my_wins = int(my_standing.get("outcome_totals", {}).get("wins", 0))
                    my_losses = int(my_standing.get("outcome_totals", {}).get("losses", 0))
                    if result_str == "win":
                        prev_rank = current_rank
                        for idx, t in enumerate(standings, 1):
                            if idx == current_rank:
                                continue
                            t_wins = int(t.get("outcome_totals", {}).get("wins", 0))
                            t_losses = int(t.get("outcome_totals", {}).get("losses", 0))
                            if idx > current_rank and t_wins >= my_wins - 1 and t_losses <= my_losses + 1:
                                prev_rank = max(prev_rank, idx)
                        standings_change = {
                            "from": prev_rank,
                            "to": current_rank,
                            "direction": "up" if prev_rank > current_rank else "none",
                        }
                    elif result_str == "loss":
                        prev_rank = current_rank
                        for idx, t in enumerate(standings, 1):
                            if idx == current_rank:
                                continue
                            t_wins = int(t.get("outcome_totals", {}).get("wins", 0))
                            t_losses = int(t.get("outcome_totals", {}).get("losses", 0))
                            if idx < current_rank and t_wins <= my_wins + 1 and t_losses >= my_losses - 1:
                                prev_rank = min(prev_rank, idx)
                        standings_change = {
                            "from": prev_rank,
                            "to": current_rank,
                            "direction": "down" if prev_rank < current_rank else "none",
                        }
                    else:
                        standings_change = {"from": current_rank, "to": current_rank, "direction": "none"}
            except Exception as e:
                if not as_json:
                    print("  Warning: could not fetch standings: " + str(e))

            # ── 5. Check recent transactions for our team ──
            key_moves = []
            try:
                yf_mod = importlib.import_module("yahoo-fantasy")
                tx_data = yf_mod.cmd_transactions([], as_json=True)
                transactions = tx_data.get("transactions", [])
                for tx in transactions[:20]:
                    tx_team = tx.get("team", "")
                    if tx_team and tx_team == my_name:
                        tx_type = tx.get("type", "?")
                        tx_player = tx.get("player", "?")
                        if tx_type == "add":
                            key_moves.append("Added " + tx_player)
                        elif tx_type == "drop":
                            key_moves.append("Dropped " + tx_player)
                        elif tx_type == "trade":
                            key_moves.append("Traded " + tx_player)
            except Exception as e:
                if not as_json:
                    print("  Warning: could not fetch transactions: " + str(e))

            # ── 6. Build narrative text ──
            narrative_parts = []

            if result_str == "win":
                narrative_parts.append("Week " + str(week) + " Recap: You defeated " + opp_name + " " + score_str + ".")
            elif result_str == "loss":
                narrative_parts.append("Week " + str(week) + " Recap: You fell to " + opp_name + " " + score_str + ".")
            else:
                narrative_parts.append("Week " + str(week) + " Recap: You tied " + opp_name + " " + score_str + ".")

            if best_advantage:
                narrative_parts.append(
                    best_advantage.get("name", "?") + " was your hero at " + best_advantage.get("your_value", "?")
                    + " vs " + best_advantage.get("opp_value", "?") + "."
                )

            if worst_loss:
                narrative_parts.append(
                    worst_loss.get("name", "?") + " let you down at " + worst_loss.get("your_value", "?")
                    + " vs " + worst_loss.get("opp_value", "?") + "."
                )

            if standings_change.get("direction") == "up":
                narrative_parts.append(
                    "You climbed from " + str(standings_change.get("from", "?"))
                    + " to " + str(standings_change.get("to", "?")) + " in the standings."
                )
            elif standings_change.get("direction") == "down":
                narrative_parts.append(
                    "You slipped from " + str(standings_change.get("from", "?"))
                    + " to " + str(standings_change.get("to", "?")) + " in the standings."
                )
            elif current_rank != "?":
                narrative_parts.append("You held steady at " + str(current_rank) + " in the standings.")

            if key_moves:
                narrative_parts.append("Key move: " + key_moves[0] + ".")

            narrative = " ".join(narrative_parts)

            # Build MVP/weakness output dicts
            mvp_category = {}
            if best_advantage:
                mvp_category = {
                    "name": best_advantage.get("name", "?"),
                    "your_value": best_advantage.get("your_value", "?"),
                    "opp_value": best_advantage.get("opp_value", "?"),
                }

            weakness = {}
            if worst_loss:
                weakness = {
                    "name": worst_loss.get("name", "?"),
                    "your_value": worst_loss.get("your_value", "?"),
                    "opp_value": worst_loss.get("opp_value", "?"),
                }

            result_data = {
                "week": week,
                "result": result_str,
                "score": score_str,
                "opponent": opp_name,
                "categories": categories,
                "mvp_category": mvp_category,
                "weakness": weakness,
                "standings_change": standings_change,
                "current_rank": current_rank,
                "key_moves": key_moves,
                "narrative": narrative,
            }

            if as_json:
                return result_data

            # CLI output
            print("")
            print(narrative)
            print("")
            print("Category Breakdown:")
            for cat in categories:
                marker = "W" if cat.get("result") == "win" else ("L" if cat.get("result") == "loss" else "T")
                print("  [" + marker + "] " + cat.get("name", "?").ljust(12) + str(cat.get("your_value", "")).rjust(8) + " vs " + str(cat.get("opp_value", "")).rjust(8))
            print("")
            if key_moves:
                print("Key Moves: " + ", ".join(key_moves))
            print("Current Rank: " + str(current_rank))
            return

        if not found_matchup:
            if as_json:
                return {"error": "Could not find your matchup"}
            print("Could not find your matchup")
    except Exception as e:
        if as_json:
            return {"error": "Error building weekly narrative: " + str(e)}
        print("Error building weekly narrative: " + str(e))


def _safe(fn, args=None):
    """Call a function with as_json=True, returning error dict on failure."""
    try:
        return fn(args or [], as_json=True) or {}
    except Exception as e:
        return {"_error": str(e)}


def _extract_category_impact(sim):
    """Extract category impact and net improvement from simulation result."""
    net_improvement = 0
    category_impact = []
    for cat in sim.get("simulated_ranks", []):
        change = cat.get("change", 0)
        if change != 0:
            category_impact.append(cat.get("name", "") + " " + ("+" if change > 0 else "") + str(change))
            net_improvement += change
    return category_impact, net_improvement


def _grade_trade(net_z):
    """Grade a trade based on z-score differential (matches cmd_trade_eval scale)."""
    if net_z > 3.0:
        return "Strong Accept"
    elif net_z > 1.0:
        return "Accept"
    elif net_z > -1.0:
        return "Fair Trade"
    elif net_z > -3.0:
        return "Decline"
    return "Strong Decline"


def cmd_game_day_manager(args, as_json=False):
    """Game-day pipeline: schedule, weather, injuries, lineup, streaming"""
    mlb = importlib.import_module("mlb-data")

    schedule = _safe(mlb.cmd_schedule)
    weather = _safe(mlb.cmd_weather)
    injuries = _safe(cmd_injury_report)
    lineup = _safe(cmd_lineup_optimize)
    streaming = _safe(cmd_streaming)

    # Build weather risks
    weather_risks = []
    for g in weather.get("games", []):
        if g.get("weather_risk", "none") != "none" and not g.get("is_dome", False):
            weather_risks.append({
                "game": str(g.get("away", "")) + " @ " + str(g.get("home", "")),
                "risk": g.get("weather_risk", ""),
                "note": g.get("weather_note", ""),
            })

    # Build lineup changes
    lineup_changes = []
    for s in lineup.get("suggested_swaps", []):
        lineup_changes.append({
            "bench": s.get("bench_player", ""),
            "start": s.get("start_player", ""),
            "position": s.get("position", ""),
        })

    # Streaming suggestion
    streaming_suggestion = None
    recs = streaming.get("recommendations", [])
    if recs:
        top = recs[0]
        streaming_suggestion = {
            "name": top.get("name", ""),
            "team": top.get("team", ""),
            "games": top.get("games", 0),
            "score": top.get("score", 0),
        }

    # Summary
    parts = []
    parts.append(str(len(lineup_changes)) + " lineup swap(s)")
    parts.append(str(len(weather_risks)) + " weather risk(s)")
    injured_count = len(injuries.get("injured_active", []))
    if injured_count:
        parts.append(str(injured_count) + " injured starter(s)")
    summary = " | ".join(parts)

    result = {
        "schedule": schedule,
        "weather_risks": weather_risks,
        "injuries": injuries,
        "lineup_changes": lineup_changes,
        "streaming_suggestion": streaming_suggestion,
        "summary": summary,
    }

    if as_json:
        return result
    print(json.dumps(result, indent=2))


def cmd_waiver_deadline_prep(args, as_json=False):
    """Pre-deadline waiver analysis with FAAB bids and simulation"""
    count = args[0] if args else "5"

    cat_check = _safe(cmd_category_check)
    waiver_b = _safe(cmd_waiver_analyze, ["B", count])
    waiver_p = _safe(cmd_waiver_analyze, ["P", count])
    injury = _safe(cmd_injury_report)

    # Build weak categories list
    weak_categories = cat_check.get("weakest", [])

    # Simulate top candidates
    ranked_claims = []
    all_recs = []
    for label, waiver in [("B", waiver_b), ("P", waiver_p)]:
        for rec in (waiver or {}).get("recommendations", [])[:3]:
            all_recs.append((label, rec))

    # Check if this is a FAAB league (uses_faab defaults to False in get_league_settings)
    league_settings = get_league_settings()
    is_faab = league_settings.get("uses_faab", False)

    for label, rec in all_recs:
        name = rec.get("name", "")
        pid = rec.get("pid", "")
        score = rec.get("score", 0)
        pct = rec.get("pct", 0)

        sim = _safe(cmd_category_simulate, [name])
        category_impact, net_improvement = _extract_category_impact(sim)

        claim = {
            "player": name,
            "player_id": pid,
            "pos_type": label,
            "percent_owned": pct,
            "score": score,
            "net_rank_improvement": net_improvement,
            "category_impact": category_impact,
        }
        if is_faab:
            claim["faab_bid"] = max(1, min(50, int(score * 3)))
        ranked_claims.append(claim)

    # Sort by score descending
    ranked_claims.sort(key=lambda x: x.get("score", 0), reverse=True)

    # Roster issues check
    roster_issues = []
    for p in injury.get("injured_active", []):
        roster_issues.append("Injured starter: " + str(p.get("name", "")))
    for p in injury.get("healthy_il", []):
        roster_issues.append("Healthy on IL: " + str(p.get("name", "")))

    result = {
        "weak_categories": weak_categories,
        "ranked_claims": ranked_claims,
        "roster_issues": roster_issues,
        "category_check": cat_check,
        "waiver_batters": waiver_b,
        "waiver_pitchers": waiver_p,
    }

    if as_json:
        return result
    print(json.dumps(result, indent=2))


def cmd_trade_pipeline(args, as_json=False):
    """End-to-end trade search, evaluation, and proposal prep"""
    from valuations import get_player_zscore

    finder = _safe(cmd_trade_finder)

    partners = []
    for p in (finder.get("partners") or [])[:3]:
        team_name = p.get("team_name", "")
        team_key = p.get("team_key", "")
        comp_cats = p.get("complementary_categories", [])

        proposals = []
        for pkg in (p.get("packages") or [])[:2]:
            give_names = [player.get("name", "") for player in pkg.get("give", [])]
            get_names = [player.get("name", "") for player in pkg.get("get", [])]

            # Get z-score values for each player
            give_value = 0
            get_value = 0
            for name in give_names:
                z_info = get_player_zscore(name)
                if z_info:
                    give_value += z_info.get("z_final", 0)
            for name in get_names:
                z_info = get_player_zscore(name)
                if z_info:
                    get_value += z_info.get("z_final", 0)

            net_value = get_value - give_value
            grade = _grade_trade(net_value)

            # Simulate category impact for the first get player
            category_impact = []
            if get_names:
                sim = _safe(cmd_category_simulate, get_names[:1])
                category_impact, _ = _extract_category_impact(sim)

            proposals.append({
                "give": give_names,
                "get": get_names,
                "give_value": round(give_value, 2),
                "get_value": round(get_value, 2),
                "net_value": round(net_value, 2),
                "grade": grade,
                "category_impact": category_impact,
            })

        partners.append({
            "team": team_name,
            "team_key": team_key,
            "complementary_categories": comp_cats,
            "proposals": proposals,
        })

    result = {
        "weak_categories": finder.get("weak_categories", []),
        "strong_categories": finder.get("strong_categories", []),
        "partners": partners,
    }

    if as_json:
        return result
    print(json.dumps(result, indent=2))


def cmd_weekly_digest(args, as_json=False):
    """End-of-week summary with narrative"""
    yf = importlib.import_module("yahoo-fantasy")

    standings = _safe(yf.cmd_standings)
    matchup = _safe(yf.cmd_matchup_detail)
    transactions = _safe(yf.cmd_transactions, ["", "10"])
    whats_new = _safe(cmd_whats_new)
    roster_stats = _safe(cmd_roster_stats)
    achievements = _safe(cmd_achievements)

    # Build matchup result text
    score = matchup.get("score", {})
    matchup_result = str(score.get("wins", 0)) + "-" + str(score.get("losses", 0)) + "-" + str(score.get("ties", 0))
    opponent = matchup.get("opponent", "Unknown")

    # Count roster moves this week
    move_count = len(transactions.get("transactions", []))

    # Achievements earned
    earned = []
    for a in achievements.get("achievements", []):
        if a.get("earned"):
            earned.append(a.get("name", ""))

    # Use existing weekly narrative command for richer prose
    narr_data = _safe(cmd_weekly_narrative)
    narrative = narr_data.get("narrative", "")
    if not narrative:
        narrative = "Week " + str(matchup.get("week", "?")) + " vs " + opponent + ": " + matchup_result + "."

    result = {
        "week": matchup.get("week", "?"),
        "opponent": opponent,
        "matchup_result": matchup_result,
        "standings": standings,
        "transactions": transactions,
        "move_count": move_count,
        "achievements_earned": earned,
        "narrative": narrative,
        "matchup": matchup,
        "roster_stats": roster_stats,
        "whats_new": whats_new,
    }

    if as_json:
        return result
    print(json.dumps(result, indent=2))


def cmd_season_checkpoint(args, as_json=False):
    """Monthly strategic assessment with playoff path"""
    yf = importlib.import_module("yahoo-fantasy")

    standings = _safe(yf.cmd_standings)
    pace = _safe(cmd_season_pace)
    playoff = _safe(cmd_playoff_planner)
    trends = _safe(cmd_category_trends)
    trade_finder = _safe(cmd_trade_finder)

    # Strategic assessment
    current_rank = playoff.get("current_rank", "?")
    playoff_prob = playoff.get("playoff_probability", 0)
    target_cats = playoff.get("target_categories", [])
    punt_cats = playoff.get("punt_categories", [])

    # Category trajectory
    improving = []
    declining = []
    for cat in trends.get("categories", []):
        trend_dir = cat.get("trend", "")
        if trend_dir == "improving":
            improving.append(cat.get("name", ""))
        elif trend_dir == "declining":
            declining.append(cat.get("name", ""))

    # Trade recommendations
    trade_recs = []
    for p in (trade_finder.get("partners") or [])[:2]:
        trade_recs.append(p.get("team_name", "") + " (complementary: " + ", ".join(p.get("complementary_categories", [])) + ")")

    # Build summary
    summary_parts = []
    summary_parts.append("Rank " + str(current_rank) + " | Playoff probability: " + str(playoff_prob) + "%")
    if target_cats:
        summary_parts.append("Target: " + ", ".join(target_cats[:3]))
    if punt_cats:
        summary_parts.append("Punt: " + ", ".join(punt_cats[:2]))
    if declining:
        summary_parts.append("DECLINING: " + ", ".join(declining[:3]))
    if improving:
        summary_parts.append("Improving: " + ", ".join(improving[:3]))
    summary = " | ".join(summary_parts)

    result = {
        "current_rank": current_rank,
        "playoff_probability": playoff_prob,
        "target_categories": target_cats,
        "punt_categories": punt_cats,
        "category_trajectory": {
            "improving": improving,
            "declining": declining,
        },
        "trade_recommendations": trade_recs,
        "summary": summary,
        "standings": standings,
        "pace": pace,
        "playoff_planner": playoff,
        "category_trends": trends,
        "trade_finder": trade_finder,
    }

    if as_json:
        return result
    print(json.dumps(result, indent=2))


COMMANDS = {
    "lineup-optimize": cmd_lineup_optimize,
    "category-check": cmd_category_check,
    "injury-report": cmd_injury_report,
    "waiver-analyze": cmd_waiver_analyze,
    "streaming": cmd_streaming,
    "trade-eval": cmd_trade_eval,
    "daily-update": cmd_daily_update,
    "category-simulate": cmd_category_simulate,
    "scout-opponent": cmd_scout_opponent,
    "matchup-strategy": cmd_matchup_strategy,
    "set-lineup": cmd_set_lineup,
    "pending-trades": cmd_pending_trades,
    "propose-trade": cmd_propose_trade,
    "accept-trade": cmd_accept_trade,
    "reject-trade": cmd_reject_trade,
    "whats-new": cmd_whats_new,
    "trade-finder": cmd_trade_finder,
    "power-rankings": cmd_power_rankings,
    "week-planner": cmd_week_planner,
    "season-pace": cmd_season_pace,
    "closer-monitor": cmd_closer_monitor,
    "pitcher-matchup": cmd_pitcher_matchup,
    "roster-stats": cmd_roster_stats,
    "faab-recommend": cmd_faab_recommend,
    "ownership-trends": cmd_ownership_trends,
    "category-trends": cmd_category_trends,
    "punt-advisor": cmd_punt_advisor,
    "il-stash": cmd_il_stash_advisor,
    "optimal-moves": cmd_optimal_moves,
    "playoff-planner": cmd_playoff_planner,
    "trash-talk": cmd_trash_talk,
    "rival-history": cmd_rival_history,
    "achievements": cmd_achievements,
    "weekly-narrative": cmd_weekly_narrative,
    "game-day-manager": cmd_game_day_manager,
    "waiver-deadline-prep": cmd_waiver_deadline_prep,
    "trade-pipeline": cmd_trade_pipeline,
    "weekly-digest": cmd_weekly_digest,
    "season-checkpoint": cmd_season_checkpoint,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Yahoo Fantasy Baseball In-Season Manager")
        print("Usage: season-manager.py <command> [args]")
        print("")
        print("Commands:")
        print("  lineup-optimize [--apply]   Optimize daily lineup (bench off-day players)")
        print("  category-check              Show category rankings vs league")
        print("  injury-report               Check roster for injury issues")
        print("  waiver-analyze [B|P] [N]    Score free agents for weak categories")
        print("  streaming [week]            Recommend streaming pitchers")
        print("  trade-eval <give> <get>     Evaluate a trade (comma-separated IDs)")
        print("  daily-update                Run all daily checks")
        print("  scout-opponent              Scout your current matchup opponent")
        print("  matchup-strategy           Build category-by-category game plan")
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd in COMMANDS:
        COMMANDS[cmd](args)
    else:
        print("Unknown command: " + cmd)
        print("Available: " + ", ".join(COMMANDS.keys()))
        sys.exit(1)
