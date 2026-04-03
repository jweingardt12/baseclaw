#!/usr/bin/env python3
"""Yahoo Fantasy Baseball Historical Records"""

import sys
import os
import json
from datetime import datetime
import yahoo_fantasy_api as yfa

from shared import get_connection, get_team_key, LEAGUE_ID, TEAM_ID

# Record book file cache
_DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"))
RECORD_BOOK_CACHE = os.path.join(_DATA_DIR, "record-book-cache.json")
RECORD_BOOK_TTL = 86400  # 24 hours
API_SUPPLEMENT_CACHE = os.path.join(_DATA_DIR, "record-book-api-cache.json")
API_SUPPLEMENT_TTL = 604800  # 7 days (champions/careers rarely change)


def _get_file_cache(path, ttl):
    """Return cached data from a JSON file if within TTL, else None."""
    try:
        if not os.path.exists(path):
            return None
        with open(path, "r") as f:
            cache = json.load(f)
        fetched = cache.get("fetched_at", "")
        if not fetched:
            return None
        age = (datetime.now() - datetime.fromisoformat(fetched)).total_seconds()
        if age > ttl:
            return None
        return cache.get("data")
    except Exception:
        return None


def _save_file_cache(path, data):
    """Save data to a JSON file cache with timestamp."""
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump({"fetched_at": datetime.now().isoformat(), "data": data}, f)
    except Exception:
        pass


def _load_league_keys():
    """Load league keys from config file, falling back to current year"""
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config", "league-history.json")
    try:
        with open(config_path, "r") as f:
            data = json.load(f)
        return {int(k): v for k, v in data.items()}
    except Exception:
        if LEAGUE_ID:
            return {datetime.now().year: LEAGUE_ID}
        return {}


LEAGUE_KEYS = _load_league_keys()


def _get_past_league(year):
    """Get a League object for a past season (creates its own connection)"""
    year = int(year)
    if year not in LEAGUE_KEYS:
        print("Invalid year: " + str(year))
        print("Available: " + ", ".join(str(y) for y in sorted(LEAGUE_KEYS.keys())))
        return None
    sc = get_connection()
    gm = yfa.Game(sc, "mlb")
    return gm.to_league(LEAGUE_KEYS[year])


def _get_manager_info(team):
    """Extract (nickname, guid) from team data"""
    managers = team.get("managers", [])
    if isinstance(managers, list):
        for mgr in managers:
            if isinstance(mgr, dict):
                m = mgr.get("manager", mgr)
                return str(m.get("nickname", "Unknown")), str(m.get("guid", ""))
    elif isinstance(managers, dict):
        m = managers.get("manager", managers)
        if isinstance(m, dict):
            return str(m.get("nickname", "Unknown")), str(m.get("guid", ""))
    return "Unknown", ""


def _extract_team_name(team_data):
    """Extract team name from Yahoo's nested team structure (for matchups)"""
    if isinstance(team_data, dict):
        team_info = team_data.get("team", [])
        if isinstance(team_info, list) and len(team_info) > 0:
            for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                if isinstance(item, dict) and "name" in item:
                    return item.get("name", "?")
    return "?"


def _safe_int(val, default=0):
    """Safely convert a value to int"""
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _build_manager_map(lg):
    """Build team_key -> (nickname, guid) map from teams() data"""
    mgr_map = {}
    try:
        teams = lg.teams()
        for tk, td in teams.items():
            nickname, guid = _get_manager_info(td)
            mgr_map[str(tk)] = (nickname, guid)
    except Exception:
        pass
    return mgr_map


def _ordinal(n):
    """Return ordinal string for a number (1st, 2nd, 3rd, etc.)"""
    n = int(n)
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return str(n) + suffix


def cmd_league_history(args, as_json=False):
    """Show all-time season results: champions and your finishes"""
    sc = get_connection()
    gm = yfa.Game(sc, "mlb")

    # Get my manager guid from the current league
    my_guid = ""
    try:
        current_year = max(LEAGUE_KEYS.keys()) if LEAGUE_KEYS else datetime.now().year
        lg_current = gm.to_league(LEAGUE_KEYS[current_year])
        teams = lg_current.teams()
        for tk, td in teams.items():
            if TEAM_ID in str(tk):
                _, my_guid = _get_manager_info(td)
                break
    except Exception as e:
        if not as_json:
            print("Warning: could not determine your manager ID: " + str(e))

    seasons = []

    for year in sorted(LEAGUE_KEYS.keys()):
        try:
            lg = gm.to_league(LEAGUE_KEYS[year])
            standings = lg.standings()

            if not standings:
                seasons.append({
                    "year": year,
                    "champion": "(no standings data)",
                    "your_finish": "",
                    "your_record": "",
                })
                continue

            # Build team_key -> manager map from teams()
            mgr_map = _build_manager_map(lg)

            champ_name = "?"
            my_finish = "?"
            my_record = ""

            for rank, team in enumerate(standings, 1):
                name = team.get("name", "Unknown")
                wins = str(team.get("outcome_totals", {}).get("wins", "0"))
                losses = str(team.get("outcome_totals", {}).get("losses", "0"))
                ties = str(team.get("outcome_totals", {}).get("ties", "0"))
                team_key = str(team.get("team_key", ""))
                _, guid = mgr_map.get(team_key, ("Unknown", ""))

                if rank == 1:
                    champ_name = name

                if my_guid and guid == my_guid:
                    my_finish = _ordinal(rank)
                    my_record = wins + "-" + losses + "-" + ties

            seasons.append({
                "year": year,
                "champion": champ_name,
                "your_finish": my_finish,
                "your_record": my_record,
            })
        except Exception as e:
            seasons.append({
                "year": year,
                "champion": "Error: " + str(e),
                "your_finish": "",
                "your_record": "",
            })

    if as_json:
        return {"seasons": seasons}

    # Get league name dynamically
    league_name = "League History"
    try:
        current_year = max(LEAGUE_KEYS.keys()) if LEAGUE_KEYS else datetime.now().year
        current_key = LEAGUE_KEYS.get(current_year, "")
        if current_key:
            lg_temp = gm.to_league(current_key)
            league_name = lg_temp.settings().get("name", "League") + " History"
    except Exception:
        pass
    print(league_name)
    print("=" * 75)
    print("")
    header = "  " + "Year".ljust(6) + "Champion".ljust(30) + "Your Finish".ljust(14) + "Your Record"
    print(header)
    print("  " + "-" * 70)

    for s in seasons:
        line = ("  " + str(s.get("year", "")).ljust(6)
                + str(s.get("champion", "")).ljust(30)
                + str(s.get("your_finish", "")).ljust(14)
                + str(s.get("your_record", "")))
        print(line)


def cmd_record_book(args, as_json=False, force_refresh=False):
    """Compile all-time records across all seasons.

    Primary path: scrapes Yahoo's recordbook page (fast, accurate).
    Fallback: queries API per-season (slow but works without browser session).
    Results are cached for 24 hours.
    """
    # Check file cache first
    if not force_refresh:
        cached = _get_file_cache(RECORD_BOOK_CACHE, RECORD_BOOK_TTL)
        if cached:
            if as_json:
                return cached
            _print_record_book(cached)
            return

    # Try browser scrape first (fast: ~3-5 seconds vs ~60 seconds for API)
    scraped_records = None
    try:
        from yahoo_browser import scrape_record_book
        scraped = scrape_record_book()
        if scraped.get("success"):
            scraped_records = {
                "batting_records": scraped.get("batting_records", []),
                "pitching_records": scraped.get("pitching_records", []),
                "h2h_records": scraped.get("h2h_records", []),
            }
        else:
            if not as_json:
                print("Browser scrape failed: " + str(scraped.get("error", "unknown")))
                print("Falling back to API queries...")
    except Exception as e:
        if not as_json:
            print("Browser scrape unavailable: " + str(e))
            print("Falling back to API queries...")

    # Use cached API supplement (7-day TTL) to avoid the slow 16-season loop
    result = _get_file_cache(API_SUPPLEMENT_CACHE, API_SUPPLEMENT_TTL)
    if result is None:
        if not as_json:
            print("Building career/champion data from API...")
        result = _build_api_record_book()
        _save_file_cache(API_SUPPLEMENT_CACHE, result)

    # Merge scraped category records into result
    if scraped_records:
        result["batting_records"] = scraped_records.get("batting_records", [])
        result["pitching_records"] = scraped_records.get("pitching_records", [])
        result["h2h_records"] = scraped_records.get("h2h_records", [])
        result["source"] = "browser"
    else:
        result["source"] = "api"

    # Cache the combined result
    _save_file_cache(RECORD_BOOK_CACHE, result)

    if as_json:
        return result

    _print_record_book(result)


def _build_api_record_book():
    """Build record book data from Yahoo API (the existing per-season approach)."""
    sc = get_connection()
    gm = yfa.Game(sc, "mlb")

    champions = []
    careers = {}
    season_records = []
    activity_records = []
    first_picks = []

    for year in sorted(LEAGUE_KEYS.keys()):
        try:
            lg = gm.to_league(LEAGUE_KEYS[year])

            # Get standings
            try:
                standings = lg.standings()
            except Exception:
                standings = []

            # Get teams for manager data, activity, and playoff clinch
            teams_data = {}
            try:
                teams_data = lg.teams()
            except Exception:
                pass

            # Build team_key -> manager map
            mgr_map = {}
            for tk, td in teams_data.items():
                tnick, tguid = _get_manager_info(td)
                mgr_map[str(tk)] = (tnick, tguid)

            if standings:
                for rank, team in enumerate(standings, 1):
                    name = team.get("name", "Unknown")
                    wins = _safe_int(team.get("outcome_totals", {}).get("wins", 0))
                    losses = _safe_int(team.get("outcome_totals", {}).get("losses", 0))
                    ties_val = _safe_int(team.get("outcome_totals", {}).get("ties", 0))
                    total = wins + losses + ties_val
                    win_pct = wins / total if total > 0 else 0
                    team_key = str(team.get("team_key", ""))
                    nickname, guid = mgr_map.get(team_key, ("Unknown", ""))

                    if rank == 1 and total > 0:
                        record = str(wins) + "-" + str(losses) + "-" + str(ties_val)
                        champions.append({
                            "year": year,
                            "team_name": name,
                            "manager": nickname,
                            "record": record,
                            "win_pct": round(win_pct * 100, 1),
                        })

                    if total > 0:
                        season_records.append({
                            "year": year,
                            "manager": nickname,
                            "wins": wins,
                            "losses": losses,
                            "ties": ties_val,
                            "win_pct": round(win_pct * 100, 1),
                        })

                    if guid and total > 0:
                        if guid not in careers:
                            careers[guid] = {
                                "nickname": nickname,
                                "wins": 0,
                                "losses": 0,
                                "ties": 0,
                                "seasons": 0,
                                "best_finish": 99,
                                "best_year": 0,
                                "playoffs": 0,
                            }
                        c = careers[guid]
                        c["nickname"] = nickname
                        c["wins"] += wins
                        c["losses"] += losses
                        c["ties"] += ties_val
                        c["seasons"] += 1
                        if rank < c.get("best_finish", 99):
                            c["best_finish"] = rank
                            c["best_year"] = year

            # Process teams for activity data and playoff clinch
            for tk, td in teams_data.items():
                tname = td.get("name", "Unknown")
                tnick, tguid = _get_manager_info(td)
                moves = _safe_int(td.get("number_of_moves", 0))
                trades = _safe_int(td.get("number_of_trades", 0))
                activity_records.append({
                    "year": year,
                    "team_name": tname,
                    "manager": tnick,
                    "moves": moves,
                    "trades": trades,
                })
                if tguid and tguid in careers and td.get("clinched_playoffs", 0):
                    careers[tguid]["playoffs"] += 1

            # Get first draft pick
            try:
                draft = lg.draft_results()
                if draft:
                    first = draft[0]
                    pid = first.get("player_id", "")
                    player_name = "Player " + str(pid)
                    if pid:
                        try:
                            details = lg.player_details([pid])
                            if details:
                                pname = details[0].get("name", "Unknown")
                                if isinstance(pname, dict):
                                    pname = pname.get("full", "Unknown")
                                player_name = str(pname)
                        except Exception:
                            pass
                    first_picks.append({"year": year, "player": player_name})
            except Exception:
                pass

        except Exception:
            pass

    # Build career list sorted by wins
    sorted_careers = sorted(careers.values(), key=lambda x: x.get("wins", 0), reverse=True)
    careers_list = []
    for c in sorted_careers:
        total = c.get("wins", 0) + c.get("losses", 0) + c.get("ties", 0)
        wpct = round((c.get("wins", 0) / total * 100) if total > 0 else 0, 1)
        careers_list.append({
            "manager": c.get("nickname", "?"),
            "wins": c.get("wins", 0),
            "losses": c.get("losses", 0),
            "ties": c.get("ties", 0),
            "win_pct": wpct,
            "seasons": c.get("seasons", 0),
            "best_finish": c.get("best_finish", 99),
            "best_year": c.get("best_year", 0),
            "playoffs": c.get("playoffs", 0),
        })

    # Build season records summary
    best_pct = sorted(season_records, key=lambda x: -x.get("win_pct", 0))
    most_wins = sorted(season_records, key=lambda x: -x.get("wins", 0))
    played_records = [r for r in season_records if (r.get("wins", 0) + r.get("losses", 0) + r.get("ties", 0)) > 0]
    worst_pct = sorted(played_records, key=lambda x: x.get("win_pct", 0))

    season_records_summary = {}
    if best_pct:
        b = best_pct[0]
        season_records_summary["best_win_pct"] = {
            "manager": b.get("manager", "?"),
            "year": b.get("year", 0),
            "wins": b.get("wins", 0),
            "losses": b.get("losses", 0),
            "ties": b.get("ties", 0),
            "win_pct": b.get("win_pct", 0),
        }
    if most_wins:
        m = most_wins[0]
        season_records_summary["most_wins"] = {
            "manager": m.get("manager", "?"),
            "year": m.get("year", 0),
            "wins": m.get("wins", 0),
            "losses": m.get("losses", 0),
            "ties": m.get("ties", 0),
        }
    if worst_pct:
        w = worst_pct[0]
        season_records_summary["worst_win_pct"] = {
            "manager": w.get("manager", "?"),
            "year": w.get("year", 0),
            "wins": w.get("wins", 0),
            "losses": w.get("losses", 0),
            "ties": w.get("ties", 0),
            "win_pct": w.get("win_pct", 0),
        }

    # Build activity records summary
    top_moves_list = sorted(activity_records, key=lambda x: -x.get("moves", 0))
    top_trades_list = sorted(activity_records, key=lambda x: -x.get("trades", 0))
    activity_summary = {}
    if top_moves_list:
        tm = top_moves_list[0]
        activity_summary["most_moves"] = {
            "manager": tm.get("manager", "?"),
            "year": tm.get("year", 0),
            "moves": tm.get("moves", 0),
        }
    if top_trades_list:
        tt = top_trades_list[0]
        activity_summary["most_trades"] = {
            "manager": tt.get("manager", "?"),
            "year": tt.get("year", 0),
            "trades": tt.get("trades", 0),
        }

    # Build playoff appearances
    playoff_managers = []
    for c in careers.values():
        if c.get("playoffs", 0) > 0:
            playoff_managers.append({
                "manager": c.get("nickname", "?"),
                "appearances": c.get("playoffs", 0),
            })
    playoff_managers.sort(key=lambda x: -x.get("appearances", 0))

    return {
        "champions": champions,
        "careers": careers_list,
        "season_records": season_records_summary,
        "activity_records": activity_summary,
        "playoff_appearances": playoff_managers,
        "first_picks": first_picks,
    }


def _format_holder(holder):
    """Format a single record holder dict into a display string."""
    name = str(holder.get("team_name", "?"))
    ctx = str(holder.get("context", ""))
    if ctx:
        return name + " (" + ctx + ")"
    return name


def _print_category_records(records, section_name):
    """Print all-time category records (batting or pitching) to stdout."""
    if not records:
        return
    print("")
    print(section_name)
    print("-" * 75)
    for rec in records:
        rtype = rec.get("record_type", "")
        if "All Time" not in rtype:
            continue
        cat = rec.get("category", "?")
        direction = rec.get("direction", "best")
        val = rec.get("value", "?")
        holders = rec.get("holders", [])
        holder_str = ", ".join(_format_holder(h) for h in holders)
        label = cat
        if direction == "worst":
            label = label + " (worst)"
        scope = "Week" if "Week" in rtype else "Season"
        print("  " + scope.ljust(8) + label.ljust(28) + str(val).rjust(8) + "  " + holder_str)


def _print_record_book(data):
    """Print a record book dict to stdout."""
    print("")
    print("=" * 70)
    print("ALL-TIME RECORD BOOK")
    print("=" * 70)

    # Champions
    champions = data.get("champions", [])
    if champions:
        print("")
        print("CHAMPIONS")
        print("-" * 65)
        for ch in champions:
            line = ("  " + str(ch.get("year", "")).ljust(6)
                    + str(ch.get("team_name", "")).ljust(25)
                    + " (" + str(ch.get("manager", "")) + ")  "
                    + str(ch.get("record", "")) + "  "
                    + str(ch.get("win_pct", "")) + "%")
            print(line)

    # Career Records
    careers_list = data.get("careers", [])
    if careers_list:
        print("")
        print("ALL-TIME CAREER RECORDS")
        print("-" * 75)
        header = ("  " + "Manager".ljust(20) + "W".rjust(5) + "L".rjust(5) + "T".rjust(4)
                  + "Win%".rjust(7) + "Seasons".rjust(8) + "  Best")
        print(header)
        for c in careers_list:
            best = str(c.get("best_finish", "?")) + " (" + str(c.get("best_year", "?")) + ")"
            line = ("  " + str(c.get("manager", "?")).ljust(20)
                    + str(c.get("wins", 0)).rjust(5) + str(c.get("losses", 0)).rjust(5)
                    + str(c.get("ties", 0)).rjust(4)
                    + (str(c.get("win_pct", 0)) + "%").rjust(7)
                    + str(c.get("seasons", 0)).rjust(8) + "  " + best)
            print(line)

    _print_category_records(data.get("batting_records", []), "BATTING CATEGORY RECORDS")
    _print_category_records(data.get("pitching_records", []), "PITCHING CATEGORY RECORDS")

    # H2H Records (from scrape)
    h2h = data.get("h2h_records", [])
    if h2h:
        print("")
        print("HEAD-TO-HEAD RECORDS")
        print("-" * 75)
        for rec in h2h:
            rtype = rec.get("record_type", "?")
            val = rec.get("value", "?")
            holders = rec.get("holders", [])
            holder_str = ", ".join(_format_holder(h) for h in holders[:3])
            if len(holders) > 3:
                holder_str = holder_str + " (+" + str(len(holders) - 3) + " more)"
            print("  " + rtype.ljust(40) + str(val).rjust(6) + "  " + holder_str)

    # Source indicator
    source = data.get("source", "")
    if source:
        print("")
        print("  (source: " + source + ")")


def cmd_past_standings(args, as_json=False):
    """Show full standings for a given season"""
    if not args:
        if as_json:
            return {"error": "Missing YEAR argument"}
        print("Usage: past-standings YEAR")
        print("Available years: " + ", ".join(str(y) for y in sorted(LEAGUE_KEYS.keys())))
        return
    year = int(args[0])
    lg = _get_past_league(year)
    if not lg:
        if as_json:
            return {"error": "Invalid year: " + str(year)}
        return

    try:
        standings = lg.standings()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching standings: " + str(e)}
        print("Error fetching standings: " + str(e))
        return

    if not standings:
        if as_json:
            return {"year": year, "standings": []}
        print("No standings data for " + str(year))
        return

    # Get manager names from teams()
    mgr_map = _build_manager_map(lg)

    results = []
    for rank, team in enumerate(standings, 1):
        name = team.get("name", "Unknown")
        wins = str(team.get("outcome_totals", {}).get("wins", "0"))
        losses = str(team.get("outcome_totals", {}).get("losses", "0"))
        ties = str(team.get("outcome_totals", {}).get("ties", "0"))
        record = wins + "-" + losses + "-" + ties
        team_key = str(team.get("team_key", ""))
        nickname, _ = mgr_map.get(team_key, ("Unknown", ""))
        results.append({
            "rank": rank,
            "team_name": name,
            "record": record,
            "manager": nickname,
        })

    if as_json:
        return {"year": year, "standings": results}

    print(str(year) + " Standings:")
    print("")
    header = "  " + "Rk".rjust(3) + "  " + "Team".ljust(30) + "Record".ljust(12) + "Manager"
    print(header)
    print("  " + "-" * 65)

    for r in results:
        line = ("  " + str(r.get("rank", "")).rjust(3) + "  "
                + str(r.get("team_name", "")).ljust(30)
                + str(r.get("record", "")).ljust(12)
                + str(r.get("manager", "")))
        print(line)


def cmd_past_draft(args, as_json=False):
    """Show draft results for a past season with player names resolved"""
    if not args:
        if as_json:
            return {"error": "Missing YEAR argument"}
        print("Usage: past-draft YEAR [COUNT]")
        print("Available years: " + ", ".join(str(y) for y in sorted(LEAGUE_KEYS.keys())))
        return
    year = int(args[0])
    count = int(args[1]) if len(args) > 1 else 25
    lg = _get_past_league(year)
    if not lg:
        if as_json:
            return {"error": "Invalid year: " + str(year)}
        return

    try:
        draft = lg.draft_results()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching draft results: " + str(e)}
        print("Error fetching draft results: " + str(e))
        return

    if not draft:
        if as_json:
            return {"year": year, "picks": []}
        print("No draft results for " + str(year))
        return

    # Get team name mapping
    team_names = {}
    try:
        teams = lg.teams()
        for tk, td in teams.items():
            team_names[str(tk)] = td.get("name", "?")
    except Exception:
        pass

    # Limit picks
    picks = draft[:count]

    # Collect player IDs for batch resolution
    player_ids = []
    for pick in picks:
        pid = pick.get("player_id", "")
        if pid and pid not in player_ids:
            player_ids.append(pid)

    # Resolve player names in batches of 25
    player_names = {}
    for i in range(0, len(player_ids), 25):
        batch = player_ids[i:i + 25]
        try:
            details = lg.player_details(batch)
            if details:
                for d in details:
                    pid = d.get("player_id", "")
                    pname = d.get("name", "Unknown")
                    if isinstance(pname, dict):
                        pname = pname.get("full", "Unknown")
                    player_names[str(pid)] = str(pname)
        except Exception:
            pass

    results = []
    for pick in picks:
        rd = pick.get("round", "?")
        pk_num = pick.get("pick", "?")
        team_key = str(pick.get("team_key", ""))
        pid = str(pick.get("player_id", ""))
        team_name = team_names.get(team_key, "?")
        player_name = player_names.get(pid, "Player " + pid)
        results.append({
            "round": rd,
            "pick": pk_num,
            "team_name": team_name,
            "player_name": str(player_name),
        })

    if as_json:
        return {"year": year, "picks": results}

    print(str(year) + " Draft Results (first " + str(count) + " picks):")
    print("")
    header = "  " + "Rd".rjust(3) + " " + "Pick".rjust(4) + "  " + "Team".ljust(30) + "Player"
    print(header)
    print("  " + "-" * 70)

    for r in results:
        line = ("  " + str(r.get("round", "?")).rjust(3) + " "
                + str(r.get("pick", "?")).rjust(4) + "  "
                + str(r.get("team_name", "?")).ljust(30)
                + str(r.get("player_name", "?")))
        print(line)


def cmd_past_teams(args, as_json=False):
    """Show team names and managers for a past season"""
    if not args:
        if as_json:
            return {"error": "Missing YEAR argument"}
        print("Usage: past-teams YEAR")
        print("Available years: " + ", ".join(str(y) for y in sorted(LEAGUE_KEYS.keys())))
        return
    year = int(args[0])
    lg = _get_past_league(year)
    if not lg:
        if as_json:
            return {"error": "Invalid year: " + str(year)}
        return

    try:
        teams = lg.teams()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching teams: " + str(e)}
        print("Error fetching teams: " + str(e))
        return

    if not teams:
        if as_json:
            return {"year": year, "teams": []}
        print("No team data for " + str(year))
        return

    results = []
    for team_key, td in teams.items():
        name = td.get("name", "Unknown")
        nickname, _ = _get_manager_info(td)
        moves = _safe_int(td.get("number_of_moves", 0))
        trades = _safe_int(td.get("number_of_trades", 0))
        results.append({
            "name": name,
            "manager": nickname,
            "moves": moves,
            "trades": trades,
        })

    if as_json:
        return {"year": year, "teams": results}

    print(str(year) + " Teams:")
    print("")
    header = ("  " + "Team".ljust(30) + "Manager".ljust(20)
              + "Moves".rjust(6) + "Trades".rjust(7))
    print(header)
    print("  " + "-" * 65)

    for r in results:
        line = ("  " + str(r.get("name", "")).ljust(30)
                + str(r.get("manager", "")).ljust(20)
                + str(r.get("moves", 0)).rjust(6)
                + str(r.get("trades", 0)).rjust(7))
        print(line)


def cmd_past_trades(args, as_json=False):
    """Show trade history for a past season"""
    if not args:
        if as_json:
            return {"error": "Missing YEAR argument"}
        print("Usage: past-trades YEAR [COUNT]")
        print("Available years: " + ", ".join(str(y) for y in sorted(LEAGUE_KEYS.keys())))
        return
    year = int(args[0])
    count = int(args[1]) if len(args) > 1 else 10
    lg = _get_past_league(year)
    if not lg:
        if as_json:
            return {"error": "Invalid year: " + str(year)}
        return

    try:
        trades = lg.transactions("trade", count)
    except Exception as e:
        if as_json:
            return {"error": "Error fetching trades: " + str(e)}
        print("Error fetching trades: " + str(e))
        return

    if not trades:
        if as_json:
            return {"year": year, "trades": []}
        print("No trades found for " + str(year))
        return

    # Get team names for readable output
    team_names = {}
    try:
        teams_data = lg.teams()
        for tk, td in teams_data.items():
            team_names[str(tk)] = td.get("name", "?")
    except Exception:
        pass

    results = []
    for i, trade in enumerate(trades, 1):
        if not isinstance(trade, dict):
            continue

        trader_name = trade.get("trader_team_name", "?")
        tradee_name = trade.get("tradee_team_name", "?")

        # Parse players from Yahoo's numbered dict format
        players_data = trade.get("players", {})
        players_list = []
        if isinstance(players_data, dict):
            j = 0
            while True:
                p_data = players_data.get(str(j))
                if p_data is None:
                    break
                j += 1

                try:
                    p_info = p_data.get("player", [])
                    if not isinstance(p_info, list) or not p_info:
                        continue

                    pname = "Unknown"
                    src_name = ""
                    dst_name = ""
                    attrs = p_info[0] if isinstance(p_info[0], list) else []
                    for attr in attrs:
                        if isinstance(attr, dict) and "name" in attr:
                            n = attr.get("name", {})
                            if isinstance(n, dict):
                                pname = n.get("full", "Unknown")
                            else:
                                pname = str(n)

                    for item in p_info[1:]:
                        if isinstance(item, dict) and "transaction_data" in item:
                            td_list = item.get("transaction_data", [])
                            if isinstance(td_list, list) and td_list:
                                td_inner = td_list[0] if isinstance(td_list[0], dict) else {}
                            elif isinstance(td_list, dict):
                                td_inner = td_list
                            else:
                                td_inner = {}
                            src_name = td_inner.get("source_team_name", "?")
                            dst_name = td_inner.get("destination_team_name", "?")

                    players_list.append({
                        "name": str(pname),
                        "from": src_name,
                        "to": dst_name,
                    })
                except Exception:
                    pass

        results.append({
            "trader_team": trader_name,
            "tradee_team": tradee_name,
            "players": players_list,
        })

    if as_json:
        return {"year": year, "trades": results}

    print(str(year) + " Trades:")
    print("")

    for i, trade_result in enumerate(results, 1):
        print("  Trade " + str(i) + ": "
              + str(trade_result.get("trader_team", "?")) + " <-> "
              + str(trade_result.get("tradee_team", "?")))
        for p in trade_result.get("players", []):
            print("    " + str(p.get("name", "?")) + ": "
                  + str(p.get("from", "?")) + " -> " + str(p.get("to", "?")))
        print("")


def cmd_past_matchup(args, as_json=False):
    """Show matchup results for a specific week and year"""
    if len(args) < 2:
        if as_json:
            return {"error": "Missing YEAR and WEEK arguments"}
        print("Usage: past-matchup YEAR WEEK")
        print("Available years: " + ", ".join(str(y) for y in sorted(LEAGUE_KEYS.keys())))
        return
    year = int(args[0])
    week = int(args[1])
    lg = _get_past_league(year)
    if not lg:
        if as_json:
            return {"error": "Invalid year: " + str(year)}
        return

    try:
        raw = lg.matchups(week=week)
    except Exception as e:
        if as_json:
            return {"error": "Error fetching matchups: " + str(e)}
        print("Error fetching matchups: " + str(e))
        return

    if not raw:
        if as_json:
            return {"year": year, "week": week, "matchups": []}
        print("No matchup data for " + str(year) + " week " + str(week))
        return

    results = []

    try:
        league_data = raw.get("fantasy_content", {}).get("league", [])
        if len(league_data) < 2:
            if as_json:
                return {"year": year, "week": week, "matchups": []}
            print("No matchup data in response")
            return
        sb = league_data[1].get("scoreboard", {})
        matchup_block = sb.get("0", {}).get("matchups", {})
        match_count = _safe_int(matchup_block.get("count", 0))

        for i in range(match_count):
            matchup = matchup_block.get(str(i), {}).get("matchup", {})
            teams_data = matchup.get("0", {}).get("teams", {})
            team1 = teams_data.get("0", {})
            team2 = teams_data.get("1", {})
            name1 = _extract_team_name(team1)
            name2 = _extract_team_name(team2)

            # Get team keys for stat winner counting
            t1_key = ""
            t2_key = ""
            t1_data = team1.get("team", [])
            t2_data = team2.get("team", [])
            if isinstance(t1_data, list) and t1_data:
                items = t1_data[0] if isinstance(t1_data[0], list) else t1_data
                for item in items:
                    if isinstance(item, dict) and "team_key" in item:
                        t1_key = item.get("team_key", "")
                        break
            if isinstance(t2_data, list) and t2_data:
                items = t2_data[0] if isinstance(t2_data[0], list) else t2_data
                for item in items:
                    if isinstance(item, dict) and "team_key" in item:
                        t2_key = item.get("team_key", "")
                        break

            # Count category wins from stat_winners
            stat_winners = matchup.get("stat_winners", [])
            wins1 = 0
            wins2 = 0
            ties_count = 0
            for sw in stat_winners:
                w = sw.get("stat_winner", {})
                if w.get("is_tied"):
                    ties_count += 1
                elif str(w.get("winner_team_key", "")) == str(t1_key):
                    wins1 += 1
                elif str(w.get("winner_team_key", "")) == str(t2_key):
                    wins2 += 1

            score = ""
            if wins1 or wins2 or ties_count:
                score = str(wins1) + "-" + str(wins2) + "-" + str(ties_count)

            status = matchup.get("status", "")

            results.append({
                "team1": name1,
                "team2": name2,
                "score": score,
                "status": status,
            })
    except Exception as e:
        if as_json:
            return {"error": "Error parsing matchups: " + str(e)}
        print("Error parsing matchups: " + str(e))
        return

    if as_json:
        return {"year": year, "week": week, "matchups": results}

    print(str(year) + " Week " + str(week) + " Matchups:")
    print("")

    for r in results:
        score_str = ""
        if r.get("score"):
            score_str = "  " + str(r.get("score", ""))
        line = ("  " + str(r.get("team1", "?")).ljust(28) + " vs  "
                + str(r.get("team2", "?")).ljust(28) + score_str)
        if r.get("status"):
            line += "  (" + str(r.get("status", "")) + ")"
        print(line)


COMMANDS = {
    "league-history": cmd_league_history,
    "record-book": cmd_record_book,
    "past-standings": cmd_past_standings,
    "past-draft": cmd_past_draft,
    "past-teams": cmd_past_teams,
    "past-trades": cmd_past_trades,
    "past-matchup": cmd_past_matchup,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Yahoo Fantasy Baseball Historical Records")
        print("Usage: history.py <command> [args]")
        print("")
        print("Commands:")
        print("  league-history              All-time season results and champions")
        print("  record-book                 All-time records compiled across all seasons")
        print("  past-standings YEAR         Full standings for a given season")
        print("  past-draft YEAR [COUNT]     Draft results with player names (default 25)")
        print("  past-teams YEAR             Team names and managers for a season")
        print("  past-trades YEAR [COUNT]    Trade history for a season (default 10)")
        print("  past-matchup YEAR WEEK      Matchup results for a specific week")
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd in COMMANDS:
        COMMANDS[cmd](args)
    else:
        print("Unknown command: " + cmd)
        print("Available: " + ", ".join(COMMANDS.keys()))
        sys.exit(1)
