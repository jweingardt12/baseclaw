#!/usr/bin/env python3
"""Yahoo Fantasy Baseball CLI for OpenClaw - Docker Version"""

import sys
import json
import os
import datetime
import yahoo_fantasy_api as yfa
from mlb_id_cache import get_mlb_id
from shared import (
    get_connection, get_league, get_league_context, get_team_key,
    get_league_settings,
    LEAGUE_ID, TEAM_ID, GAME_KEY, DATA_DIR,
    enrich_with_intel, enrich_with_trends, enrich_with_context,
)


def _get_stat_lookup(lg):
    """Build stat_id -> display_name lookup from raw league settings."""
    stat_lookup = {}
    try:
        handler = lg.yhandler
        league_key = lg.league_id
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
    except Exception as e:
        print("Warning: could not build stat lookup: " + str(e))
    return stat_lookup


_game_info_cache = {"data": None, "time": 0}
_GAME_INFO_TTL = 60  # seconds

_snapshot_cache = {"data": None, "time": 0}
_SNAPSHOT_TTL = 300  # 5 minutes


def get_league_snapshot_cached():
    """Return cached league snapshot (settings + standings + season stats +
    positional ranks + trade partners for all 12 teams).
    Shared accessor for season-manager and other consumers."""
    import time as _time
    now = _time.time()
    if (_snapshot_cache["data"] is not None
            and (now - _snapshot_cache["time"]) < _SNAPSHOT_TTL):
        return _snapshot_cache["data"]
    data = cmd_league_snapshot([], as_json=True)
    if data and not data.get("error"):
        _snapshot_cache["data"] = data
        _snapshot_cache["time"] = now
    return data


_redzone_cache = {"data": None, "time": 0}
_REDZONE_TTL = 120  # 2 minutes — live-week data needs to be fresh

_REDZONE_URL = "https://pub-api.fantasysports.yahoo.com/fantasy/v3/redzone/mlb"


def get_redzone_cached():
    """Return cached redzone data (live matchup stats, per-player weekly numbers,
    remaining games, isStarting flags, stat metadata with isNegative).
    Uses Yahoo v3 public API with our OAuth session."""
    import time as _time
    now = _time.time()
    if (_redzone_cache["data"] is not None
            and (now - _redzone_cache["time"]) < _REDZONE_TTL):
        return _redzone_cache["data"]
    data = _fetch_redzone()
    if data and not data.get("error"):
        _redzone_cache["data"] = data
        _redzone_cache["time"] = now
    return data


def _fetch_redzone():
    """Fetch and parse the v3 redzone endpoint."""
    league_num = LEAGUE_ID.split(".")[-1] if "." in LEAGUE_ID else LEAGUE_ID
    try:
        sc, gm, lg = get_league()
        resp = sc.session.get(_REDZONE_URL + "?league_id=" + league_num + "&format=json")
        if resp.status_code != 200:
            return {"error": "Redzone API returned " + str(resp.status_code)}
        raw = resp.json()
    except Exception as e:
        return {"error": "Failed to fetch redzone: " + str(e)}

    try:
        service = raw.get("service", {})
        league = service.get("leagues", {}).get(league_num, {})
        if not league:
            return {"error": "League not found in redzone response"}

        return _parse_redzone(league, service.get("players", {}))
    except Exception as e:
        return {"error": "Failed to parse redzone: " + str(e)}


def _parse_redzone(league, player_lookup):
    """Parse redzone response into a clean structure."""
    # Stat metadata
    stat_meta = {}
    negative_stat_ids = set()
    scoring_stat_ids = set()
    for s in league.get("stats", []):
        sid = str(s.get("id", ""))
        stat_meta[sid] = {
            "id": sid,
            "group": s.get("group", ""),
            "is_negative": bool(s.get("isNegative")),
            "is_scoring": bool(s.get("isScoring")),
            "position_type": s.get("positionType", ""),
        }
        if s.get("isNegative"):
            negative_stat_ids.add(sid)
        if s.get("isScoring"):
            scoring_stat_ids.add(sid)

    # Build stat_id -> display_name from already-cached snapshot (don't trigger a fetch)
    sid_to_name = {}
    if _snapshot_cache["data"] and not _snapshot_cache["data"].get("error"):
        try:
            for cat in _snapshot_cache["data"].get("settings", {}).get("stat_categories", []):
                sid_to_name[str(cat.get("stat_id", ""))] = cat.get("display_name", "")
        except Exception:
            pass

    # Week info
    week_info = league.get("weekInfo", {})

    # Matchup pairings
    matchups = []
    for group in league.get("matchupGroups", []):
        for pair in group.get("matchups", []):
            if len(pair) == 2:
                matchups.append({"team1_id": str(pair[0]), "team2_id": str(pair[1])})

    # Teams with player stats
    teams = {}
    for tid, tdata in league.get("teams", {}).items():
        team_players = []
        for p in tdata.get("players", []):
            pid = str(p.get("id", ""))
            pinfo = player_lookup.get(pid, {})
            stats = p.get("stats", {})
            # Only include scoring stats
            scoring_stats = {}
            for sid, val in (stats.items() if isinstance(stats, dict) else []):
                if str(sid) in scoring_stat_ids:
                    name = sid_to_name.get(str(sid), str(sid))
                    scoring_stats[name] = val

            player_entry = {
                "id": pid,
                "name": pinfo.get("name", "Player " + pid),
                "position": p.get("position", ""),
                "position_type": p.get("positionType", ""),
                "team": pinfo.get("team", ""),
                "status": p.get("status", ""),
                "is_starting": pinfo.get("isStarting"),
                "has_new_notes": pinfo.get("hasNewPlayerNotes", False),
                "stats": scoring_stats,
            }
            team_players.append(player_entry)

        remaining = tdata.get("remainingGames", {})
        rg = remaining.get(tid, {}) if isinstance(remaining, dict) else {}

        teams[tid] = {
            "id": tid,
            "name": tdata.get("name", ""),
            "rank": tdata.get("rank", ""),
            "wins": tdata.get("wins", 0),
            "losses": tdata.get("losses", 0),
            "ties": tdata.get("ties", 0),
            "remaining_games": rg.get("remaining_games", 0),
            "live_games": rg.get("live_games", 0),
            "completed_games": rg.get("completed_games", 0),
            "players": team_players,
        }

    # Find our team and opponent
    my_team_num = TEAM_ID.split(".")[-1] if "." in TEAM_ID else TEAM_ID
    my_matchup = None
    for m in matchups:
        if m["team1_id"] == my_team_num or m["team2_id"] == my_team_num:
            opp_id = m["team2_id"] if m["team1_id"] == my_team_num else m["team1_id"]
            my_matchup = {
                "my_team_id": my_team_num,
                "opponent_id": opp_id,
                "opponent_name": teams.get(opp_id, {}).get("name", ""),
            }
            break

    return {
        "week": week_info.get("week"),
        "week_start": week_info.get("start"),
        "week_end": week_info.get("end"),
        "my_matchup": my_matchup,
        "matchups": matchups,
        "teams": teams,
        "stat_meta": stat_meta,
        "negative_stat_ids": list(negative_stat_ids),
        "scoring_stat_ids": list(scoring_stat_ids),
    }


def get_negative_stat_ids():
    """Return set of stat IDs where lower is better, from redzone metadata.
    Falls back to hardcoded set if redzone unavailable."""
    try:
        rz = get_redzone_cached()
        if rz and not rz.get("error") and rz.get("negative_stat_ids"):
            return set(rz["negative_stat_ids"])
    except Exception:
        pass
    # Fallback: hardcoded (matches _LOWER_IS_BETTER_STATS in season-manager)
    return {"21", "29", "37", "26", "27"}


def _get_today_opponents():
    """Build a team->opponent map for today's MLB games."""
    info = _get_today_game_info()
    return {k: v.get("opponent", "") for k, v in info.items() if v.get("opponent")}


def _get_today_game_info():
    """Build a team->game info map for today's MLB games.
    Returns dict of team_abbrev -> {opponent, time, status, score, home}.
    Cached with 60s TTL so live scores refresh but we don't spam the API."""
    import time as _time
    now = _time.time()
    if _game_info_cache["data"] is not None and (now - _game_info_cache["time"]) < _GAME_INFO_TTL:
        return _game_info_cache["data"]
    result = _fetch_game_info()
    _game_info_cache["data"] = result
    _game_info_cache["time"] = now
    return result


def _fetch_game_info():
    """Fetch game info from MLB Stats API."""
    try:
        from shared import mlb_fetch
        data = mlb_fetch("/schedule?sportId=1&date=" + datetime.date.today().isoformat() + "&hydrate=team,linescore,weather,officials")
        result = {}
        dates = data.get("dates", [])
        if dates:
            for game in dates[0].get("games", []):
                away = game.get("teams", {}).get("away", {}).get("team", {})
                home = game.get("teams", {}).get("home", {}).get("team", {})
                away_abbrev = away.get("abbreviation", "")
                home_abbrev = home.get("abbreviation", "")
                if not away_abbrev or not home_abbrev:
                    continue

                # Game time
                game_date = game.get("gameDate", "")
                time_str = ""
                if game_date:
                    try:
                        dt = datetime.datetime.fromisoformat(game_date.replace("Z", "+00:00"))
                        local = dt.astimezone()
                        time_str = local.strftime("%-I:%M%p")
                    except Exception:
                        pass

                # Game status
                status_obj = game.get("status", {})
                detailed = status_obj.get("detailedState", "Scheduled")

                # Live score from linescore
                score = None
                linescore = game.get("linescore", {})
                if linescore and detailed not in ("Scheduled", "Pre-Game", "Warmup"):
                    away_runs = linescore.get("teams", {}).get("away", {}).get("runs", 0)
                    home_runs = linescore.get("teams", {}).get("home", {}).get("runs", 0)
                    score = str(away_runs) + "-" + str(home_runs)

                # Inning info for in-progress games
                inning = ""
                if detailed == "In Progress":
                    inn_num = linescore.get("currentInning", "")
                    inn_half = linescore.get("inningHalf", "")
                    if inn_num:
                        half_label = "Top" if "top" in str(inn_half).lower() else "Bot"
                        inning = half_label + " " + str(inn_num)

                game_entry = {
                    "time": time_str,
                    "status": detailed,
                    "score": score,
                    "inning": inning,
                }

                result[away_abbrev] = {**game_entry, "opponent": "@" + home_abbrev, "home": False}
                result[home_abbrev] = {**game_entry, "opponent": "vs " + away_abbrev, "home": True}
        return result
    except Exception as e:
        print("Warning: could not fetch today's game info: " + str(e))
        return {}


def _parse_enriched_data(raw, stat_lookup):
    """Parse enriched roster data from Yahoo raw API response.

    Returns dict keyed by player_id with enriched fields.
    """
    result = {}
    if not raw:
        return result

    # Navigate to players list - Yahoo's JSON structure varies
    players_raw = None
    roster_data = {}
    try:
        fc = raw.get("fantasy_content", raw)
        team_data = fc.get("team", {})
        if isinstance(team_data, list):
            for item in team_data:
                if isinstance(item, dict) and "roster" in item:
                    roster_data = item.get("roster", {})
                    if isinstance(roster_data, dict):
                        players_raw = roster_data.get("players", {})
                    break
        elif isinstance(team_data, dict):
            roster_data = team_data.get("roster", {})
            if isinstance(roster_data, dict):
                players_raw = roster_data.get("players", {})
    except Exception:
        return result

    # Yahoo sometimes wraps players under a numeric key like {"0": {"players": {...}}}
    if not players_raw and isinstance(roster_data, dict):
        for key, val in roster_data.items():
            if isinstance(val, dict) and "players" in val:
                players_raw = val.get("players", {})
                break

    if not players_raw:
        return result

    # Players can be dict with numeric keys or a list
    player_list = []
    if isinstance(players_raw, dict):
        for key, val in players_raw.items():
            if key == "count":
                continue
            if isinstance(val, dict) and "player" in val:
                player_list.append(val.get("player"))
    elif isinstance(players_raw, list):
        for item in players_raw:
            if isinstance(item, dict) and "player" in item:
                player_list.append(item.get("player"))

    for player_data in player_list:
        try:
            parsed = _parse_single_player(player_data, stat_lookup)
            if parsed and parsed.get("player_id"):
                result[str(parsed.get("player_id"))] = parsed
        except Exception:
            continue

    return result


def _parse_single_player(player_data, stat_lookup):
    """Parse a single player's enriched data from Yahoo raw format."""
    info = {}

    if not isinstance(player_data, list):
        return info

    # Flatten: OAuth wraps metadata as a nested list in [0]
    flat_items = []
    for item in player_data:
        if isinstance(item, list):
            for sub in item:
                if isinstance(sub, dict):
                    flat_items.append(sub)
        elif isinstance(item, dict):
            flat_items.append(item)

    for item in flat_items:
        for key, val in item.items():
            if key == "player_id":
                info["player_id"] = str(val)
            elif key == "editorial_team_abbr":
                info["team"] = val
            elif key == "headshot":
                if isinstance(val, dict):
                    info["headshot"] = val.get("url", "")
            elif key == "percent_started":
                if isinstance(val, list):
                    for sub in val:
                        if isinstance(sub, dict) and "value" in sub:
                            try:
                                info["percent_started"] = round(float(sub.get("value", 0)))
                            except (ValueError, TypeError):
                                pass
                elif isinstance(val, dict):
                    try:
                        info["percent_started"] = round(float(val.get("value", 0)))
                    except (ValueError, TypeError):
                        pass
            elif key == "percent_owned":
                if isinstance(val, list):
                    for sub in val:
                        if isinstance(sub, dict) and "value" in sub:
                            try:
                                info["percent_owned"] = round(float(sub.get("value", 0)))
                            except (ValueError, TypeError):
                                pass
                elif isinstance(val, dict):
                    try:
                        info["percent_owned"] = round(float(val.get("value", 0)))
                    except (ValueError, TypeError):
                        pass
            elif key == "draft_analysis":
                if isinstance(val, list):
                    for sub in val:
                        if isinstance(sub, dict):
                            if "average_pick" in sub:
                                try:
                                    info["current_pick"] = round(float(sub.get("average_pick", 0)), 1)
                                except (ValueError, TypeError):
                                    pass
                            if "preseason_average_pick" in sub:
                                try:
                                    info["preseason_pick"] = round(float(sub.get("preseason_average_pick", 0)), 1)
                                except (ValueError, TypeError):
                                    pass
                elif isinstance(val, dict):
                    try:
                        info["current_pick"] = round(float(val.get("average_pick", 0)), 1)
                    except (ValueError, TypeError):
                        pass
                    try:
                        info["preseason_pick"] = round(float(val.get("preseason_average_pick", 0)), 1)
                    except (ValueError, TypeError):
                        pass
            elif key == "player_stats":
                stats = {}
                stats_data = val
                if isinstance(stats_data, dict):
                    stats_data = stats_data.get("stats", [])
                if isinstance(stats_data, list):
                    for stat_entry in stats_data:
                        if isinstance(stat_entry, dict):
                            stat_obj = stat_entry.get("stat", stat_entry)
                            sid = str(stat_obj.get("stat_id", ""))
                            sval = stat_obj.get("value", "")
                            stat_name = stat_lookup.get(sid, "")
                            if stat_name and sval != "":
                                stats[stat_name] = sval
                info["stats"] = stats

    return info


def cmd_roster(args, as_json=False):
    """Show current roster"""
    sc, gm, lg, team = get_league_context()
    roster = team.roster()

    if not roster:
        if as_json:
            return {"players": []}
        print("Roster is empty (predraft)")
        return

    if as_json:
        # Get stat ID map for translating stat IDs to names
        try:
            stat_id_map = lg.stat_categories()
            stat_lookup = {}
            if isinstance(stat_id_map, list):
                for cat in stat_id_map:
                    if isinstance(cat, dict):
                        sid = str(cat.get("stat_id", ""))
                        name = cat.get("display_name", cat.get("name", ""))
                        if sid and name:
                            stat_lookup[sid] = name
        except Exception:
            stat_lookup = {}

        # Try to fetch enriched data via raw API call
        enriched_data = {}
        try:
            handler = lg.yhandler
            uri = ("/team/" + team.team_key
                   + "/roster/players;out=percent_started,percent_owned,draft_analysis"
                   + "/stats;type=season;season=" + str(datetime.date.today().year))
            raw = handler.get(uri)
            enriched_data = _parse_enriched_data(raw, stat_lookup)
        except Exception as e:
            print("Warning: enriched roster fetch failed: " + str(e))

        # Get today's game info (opponents + times + status)
        game_info = _get_today_game_info()

        players = []
        for p in roster:
            name = p.get("name", "Unknown")
            team_abbrev = p.get("editorial_team_abbr", "")
            player_data = {
                "name": name,
                "player_id": p.get("player_id", ""),
                "position": p.get("selected_position", "?") if isinstance(p.get("selected_position"), str) else p.get("selected_position", {}).get("position", "?"),
                "eligible_positions": p.get("eligible_positions", []),
                "status": p.get("status", ""),
                "team": team_abbrev,
                "headshot": p.get("headshot", {}).get("url", "") if isinstance(p.get("headshot"), dict) else "",
                "mlb_id": get_mlb_id(name),
            }

            # Merge enriched data if available
            pid = str(p.get("player_id", ""))
            if pid in enriched_data:
                ed = enriched_data.get(pid, {})
                if not player_data.get("team") and ed.get("team"):
                    player_data["team"] = ed.get("team")
                if not player_data.get("headshot") and ed.get("headshot"):
                    player_data["headshot"] = ed.get("headshot")
                player_data["percent_started"] = ed.get("percent_started")
                player_data["percent_owned"] = ed.get("percent_owned")
                player_data["preseason_pick"] = ed.get("preseason_pick")
                player_data["current_pick"] = ed.get("current_pick")
                player_data["stats"] = ed.get("stats", {})

            # Add game info (opponent + time + status)
            gi = game_info.get(player_data.get("team", ""))
            if gi:
                player_data["opponent"] = gi.get("opponent")
                player_data["game_time"] = gi.get("time")
                player_data["game_status"] = gi.get("status")
                if gi.get("score"):
                    player_data["game_score"] = gi.get("score")
                if gi.get("inning"):
                    player_data["game_inning"] = gi.get("inning")

            players.append(player_data)

        enrich_with_intel(players)
        try:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as _ctx_pool:
                _ctx_future = _ctx_pool.submit(enrich_with_context, players)
                _ctx_future.result(timeout=8)
        except concurrent.futures.TimeoutError:
            pass
        except Exception:
            pass
        return {"players": players}

    print("Current Roster:")
    for p in roster:
        pos = p.get("selected_position", "?") if isinstance(p.get("selected_position"), str) else p.get("selected_position", {}).get("position", "?")
        name = p.get("name", "Unknown")
        status = p.get("status", "")
        elig = ",".join(p.get("eligible_positions", []))
        line = "  " + pos.ljust(4) + " " + name.ljust(25) + " " + elig
        if status:
            line += " [" + status + "]"
        print(line)


def cmd_free_agents(args, as_json=False):
    """List free agents (B=batters, P=pitchers)"""
    pos_type = args[0] if args else "B"
    count = int(args[1]) if len(args) > 1 else 20
    sc, gm, lg = get_league()

    fa = lg.free_agents(pos_type)[:count]

    if as_json:
        players = []
        for p in fa:
            players.append(
                {
                    "name": p.get("name", "Unknown"),
                    "player_id": p.get("player_id", "?"),
                    "positions": p.get("eligible_positions", ["?"]),
                    "percent_owned": p.get("percent_owned", 0),
                    "status": p.get("status", ""),
                    "team": p.get("editorial_team_abbr", ""),
                    "headshot": p.get("headshot", {}).get("url", "") if isinstance(p.get("headshot"), dict) else "",
                    "mlb_id": get_mlb_id(p.get("name", "")),
                }
            )

        # Batch enrich with headshot, team, percent_owned from Yahoo raw API
        try:
            stat_lookup = _get_stat_lookup(lg)
            handler = lg.yhandler
            league_key = lg.league_id
            game_id = str(gm.game_id())
            player_keys = [game_id + ".p." + str(p.get("player_id", "")) for p in players if p.get("player_id")]
            batch_size = 25
            enriched_data = {}
            for i in range(0, len(player_keys), batch_size):
                batch = player_keys[i:i + batch_size]
                keys_str = ",".join(batch)
                uri = ("/league/" + league_key
                       + "/players;player_keys=" + keys_str
                       + ";out=percent_started,percent_owned,draft_analysis"
                       + "/stats;type=season;season=" + str(datetime.date.today().year))
                raw = handler.get(uri)
                batch_enriched = _parse_league_players_enriched(raw, stat_lookup)
                enriched_data.update(batch_enriched)

            for p in players:
                pid = str(p.get("player_id", ""))
                if pid in enriched_data:
                    ed = enriched_data[pid]
                    if not p.get("team") and ed.get("team"):
                        p["team"] = ed["team"]
                    if not p.get("headshot") and ed.get("headshot"):
                        p["headshot"] = ed["headshot"]
                    if ed.get("percent_owned") is not None:
                        p["percent_owned"] = ed["percent_owned"]
        except Exception as e:
            print("Warning: free-agents enrichment failed: " + str(e))

        enrich_with_intel(players)
        enrich_with_trends(players)
        enrich_with_context(players)

        try:
            from valuations import get_player_zscore
            for p in players:
                z_info = get_player_zscore(p.get("name", ""))
                if z_info:
                    p["z_score"] = round(z_info.get("z_final", 0), 2)
                    p["tier"] = z_info.get("tier", "")
        except Exception as e:
            print("Warning: free-agents z-score enrichment failed: " + str(e))

        # Game info (opponent + time + live status)
        try:
            gi = _get_today_game_info()
            for p in players:
                info = gi.get(p.get("team", ""))
                if info:
                    p["opponent"] = info.get("opponent")
                    p["game_time"] = info.get("time")
                    p["game_status"] = info.get("status")
                    if info.get("score"):
                        p["game_score"] = info.get("score")
                    if info.get("inning"):
                        p["game_inning"] = info.get("inning")
        except Exception as e:
            print("Warning: free-agents game info failed: " + str(e))

        # FanGraphs advanced stats
        try:
            from intel import _fetch_fangraphs_regression_batting, _fetch_fangraphs_regression_pitching
            fg_bat = _fetch_fangraphs_regression_batting()
            fg_pit = _fetch_fangraphs_regression_pitching()
            for p in players:
                name_lower = p.get("name", "").lower()
                fg = fg_bat.get(name_lower) or fg_pit.get(name_lower)
                if fg:
                    p["advanced"] = fg
        except Exception as e:
            print("Warning: free-agents FanGraphs enrichment failed: " + str(e))

        return {"pos_type": pos_type, "count": count, "players": players}

    label = "Batters" if pos_type == "B" else "Pitchers"
    print("Top " + str(count) + " Free Agent " + label + ":")
    for p in fa:
        name = p.get("name", "Unknown")
        positions = ",".join(p.get("eligible_positions", ["?"]))
        pct = p.get("percent_owned", 0)
        pid = p.get("player_id", "?")
        status = p.get("status", "")
        if status:
            status = " [" + status + "]"
        line = (
            "  "
            + name.ljust(25)
            + " "
            + positions.ljust(12)
            + " "
            + str(pct).rjust(3)
            + "% owned  (id:"
            + str(pid)
            + ")"
            + status
        )
        print(line)


def cmd_standings(args, as_json=False):
    """Show league standings"""
    sc, gm, lg = get_league()
    standings = lg.standings()

    if as_json:
        # Fetch teams for logo/avatar data
        team_meta = {}
        team_key_map = {}
        try:
            teams = lg.teams()
            for tk, td in teams.items():
                tname = td.get("name", "")
                logo_url, mgr_image = _extract_team_meta(td)
                team_meta[tname] = {"team_logo": logo_url, "manager_image": mgr_image}
                team_key_map[tname] = tk
        except Exception:
            pass
        result = []
        for i, team in enumerate(standings, 1):
            name = team.get("name", "Unknown")
            meta = team_meta.get(name, {})
            result.append(
                {
                    "rank": i,
                    "name": name,
                    "team_key": team_key_map.get(name, ""),
                    "wins": team.get("outcome_totals", {}).get("wins", 0),
                    "losses": team.get("outcome_totals", {}).get("losses", 0),
                    "points_for": team.get("points_for", ""),
                    "team_logo": meta.get("team_logo", ""),
                    "manager_image": meta.get("manager_image", ""),
                }
            )
        return {"standings": result}

    print("League Standings:")
    for i, team in enumerate(standings, 1):
        name = team.get("name", "Unknown")
        wins = team.get("outcome_totals", {}).get("wins", 0)
        losses = team.get("outcome_totals", {}).get("losses", 0)
        pts = team.get("points_for", "")
        line = (
            "  "
            + str(i).rjust(2)
            + ". "
            + name.ljust(30)
            + " "
            + str(wins)
            + "-"
            + str(losses)
        )
        if pts:
            line += " (" + str(pts) + " pts)"
        print(line)


def cmd_info(args, as_json=False):
    """Show league and team info"""
    sc, gm, lg = get_league()
    my_team_key = get_team_key(lg)
    settings = lg.settings()
    team_name = "Unknown"
    try:
        team = lg.to_team(my_team_key)
        if hasattr(team, "team_data"):
            team_name = team.team_data.get("name", "Unknown")
    except Exception:
        pass
    if team_name == "Unknown":
        try:
            teams = lg.teams()
            for tk, td in teams.items():
                if tk == my_team_key:
                    team_name = td.get("name", "Unknown")
                    break
        except Exception:
            pass

    # Get team details (waiver priority, FAAB, moves)
    team_details = {}
    try:
        team = lg.to_team(my_team_key)
        raw_details = team.details() if hasattr(team, "details") else None
        if raw_details:
            if isinstance(raw_details, list) and len(raw_details) > 0:
                d = raw_details[0] if isinstance(raw_details[0], dict) else {}
            elif isinstance(raw_details, dict):
                d = raw_details
            else:
                d = {}
            team_details["waiver_priority"] = d.get("waiver_priority", d.get("priority", None))
            team_details["faab_balance"] = d.get("faab_balance", None)
            team_details["number_of_moves"] = d.get("number_of_moves", None)
            team_details["number_of_trades"] = d.get("number_of_trades", None)
            team_details["clinched_playoffs"] = d.get("clinched_playoffs", None)
    except Exception as e:
        print("Warning: could not fetch team details: " + str(e))

    # Get roster positions from league settings
    roster_positions = []
    try:
        raw_positions = lg.positions() if hasattr(lg, "positions") else None
        if raw_positions:
            for rp in raw_positions:
                pos_name = rp.get("position", "")
                count = int(rp.get("count", 1))
                pos_type = rp.get("position_type", "")
                roster_positions.append({
                    "position": pos_name,
                    "count": count,
                    "position_type": pos_type,
                })
    except Exception as e:
        print("Warning: could not fetch roster positions: " + str(e))

    # Waiver type detection
    league_settings = get_league_settings()
    waiver_type = league_settings.get("waiver_type", "unknown")
    scoring_type = league_settings.get("scoring_type", settings.get("scoring_type", ""))

    if as_json:
        result = {
            "name": settings.get("name", "Unknown"),
            "draft_status": settings.get("draft_status", "unknown"),
            "season": settings.get("season", "?"),
            "start_date": settings.get("start_date", "?"),
            "end_date": settings.get("end_date", "?"),
            "current_week": lg.current_week(),
            "num_teams": settings.get("num_teams", "?"),
            "playoff_teams": settings.get("num_playoff_teams", "?"),
            "max_weekly_adds": settings.get("max_weekly_adds", "?"),
            "team_name": team_name,
            "team_id": my_team_key,
            "waiver_type": waiver_type,
            "scoring_type": scoring_type,
        }
        if roster_positions:
            result["roster_positions"] = roster_positions
        for k, v in team_details.items():
            if v is not None:
                result[k] = v
        return result

    print("League Info:")
    print("  Name: " + settings.get("name", "Unknown"))
    print("  Draft Status: " + settings.get("draft_status", "unknown"))
    print("  Season: " + settings.get("season", "?"))
    print("  Start: " + settings.get("start_date", "?"))
    print("  End: " + settings.get("end_date", "?"))
    print("  Current Week: " + str(lg.current_week()))
    print("  Teams: " + str(settings.get("num_teams", "?")))
    print("  Playoff Teams: " + str(settings.get("num_playoff_teams", "?")))
    print("  Max Weekly Adds: " + str(settings.get("max_weekly_adds", "?")))
    print("  Waiver Type: " + waiver_type)
    print("  Scoring Type: " + scoring_type)
    print("  Your Team: " + team_name + " (" + my_team_key + ")")
    if roster_positions:
        slots = []
        for rp in roster_positions:
            pos = rp.get("position", "?")
            cnt = rp.get("count", 1)
            if cnt > 1:
                slots.append(pos + "x" + str(cnt))
            else:
                slots.append(pos)
        print("  Roster Slots: " + ", ".join(slots))
    if team_details.get("waiver_priority") is not None:
        print("  Waiver Priority: " + str(team_details.get("waiver_priority")))
    if team_details.get("faab_balance") is not None:
        print("  FAAB Balance: $" + str(team_details.get("faab_balance")))
    if team_details.get("number_of_moves") is not None:
        print("  Moves Made: " + str(team_details.get("number_of_moves")))
    if team_details.get("number_of_trades") is not None:
        print("  Trades Made: " + str(team_details.get("number_of_trades")))


def cmd_search(args, as_json=False):
    """Search for a player by name"""
    if not args:
        if as_json:
            return {"query": "", "results": []}
        print("Usage: search PLAYER_NAME")
        return
    name = " ".join(args)
    sc, gm, lg = get_league()

    results = []
    for pos_type in ["B", "P"]:
        fa = lg.free_agents(pos_type)
        for p in fa:
            if name.lower() in p.get("name", "").lower():
                results.append(p)

    if as_json:
        players = []
        for p in results[:10]:
            players.append(
                {
                    "name": p.get("name", "Unknown"),
                    "player_id": p.get("player_id", "?"),
                    "positions": p.get("eligible_positions", ["?"]),
                    "percent_owned": p.get("percent_owned", 0),
                    "mlb_id": get_mlb_id(p.get("name", "")),
                }
            )
        enrich_with_intel(players)
        enrich_with_context(players)
        return {"query": name, "results": players}

    if not results:
        print("No free agents found matching: " + name)
        return

    print("Free agents matching: " + name)
    for p in results[:10]:
        pname = p.get("name", "Unknown")
        positions = ",".join(p.get("eligible_positions", ["?"]))
        pct = p.get("percent_owned", 0)
        pid = p.get("player_id", "?")
        line = (
            "  "
            + pname.ljust(25)
            + " "
            + positions.ljust(12)
            + " "
            + str(pct).rjust(3)
            + "% owned  (id:"
            + str(pid)
            + ")"
        )
        print(line)


from yahoo_browser import (
    is_scope_error as _is_scope_error,
    write_method as _write_method,
)


def cmd_add(args, as_json=False):
    """Add a player by player_id"""
    if not args:
        if as_json:
            return {"success": False, "player_key": "", "message": "Missing player_id"}
        print("Usage: add PLAYER_ID")
        return
    player_id = args[0]
    player_key = GAME_KEY + ".p." + str(player_id)
    method = _write_method()

    # Try API first (unless browser-only mode)
    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            team.add_player(player_key)
            if as_json:
                return {
                    "success": True,
                    "player_key": player_key,
                    "message": "Added player " + player_key,
                }
            print("Added player " + player_key)
            return
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                if as_json:
                    return {
                        "success": False,
                        "player_key": player_key,
                        "message": "Error adding player: " + str(e),
                    }
                print("Error adding player: " + str(e))
                return
            # Fall through to browser

    # Browser fallback
    try:
        from yahoo_browser import add_player

        result = add_player(player_id)
        if as_json:
            result["player_key"] = player_key
            return result
        if result.get("success"):
            print(result.get("message", "Added player " + player_key + " via browser"))
        else:
            print(result.get("message", "Browser add failed"))
    except Exception as e:
        if as_json:
            return {
                "success": False,
                "player_key": player_key,
                "message": "Browser fallback error: " + str(e),
            }
        print("Browser fallback error: " + str(e))


def cmd_drop(args, as_json=False):
    """Drop a player by player_id"""
    if not args:
        if as_json:
            return {"success": False, "player_key": "", "message": "Missing player_id"}
        print("Usage: drop PLAYER_ID")
        return
    player_id = args[0]
    player_key = GAME_KEY + ".p." + str(player_id)
    method = _write_method()

    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            team.drop_player(player_key)
            if as_json:
                return {
                    "success": True,
                    "player_key": player_key,
                    "message": "Dropped player " + player_key,
                }
            print("Dropped player " + player_key)
            return
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                if as_json:
                    return {
                        "success": False,
                        "player_key": player_key,
                        "message": "Error dropping player: " + str(e),
                    }
                print("Error dropping player: " + str(e))
                return

    try:
        from yahoo_browser import drop_player

        result = drop_player(player_id)
        if as_json:
            result["player_key"] = player_key
            return result
        if result.get("success"):
            print(
                result.get("message", "Dropped player " + player_key + " via browser")
            )
        else:
            print(result.get("message", "Browser drop failed"))
    except Exception as e:
        if as_json:
            return {
                "success": False,
                "player_key": player_key,
                "message": "Browser fallback error: " + str(e),
            }
        print("Browser fallback error: " + str(e))


def _extract_team_name(team_data):
    """Extract team name from Yahoo's nested team structure"""
    if isinstance(team_data, dict):
        team_info = team_data.get("team", [])
        if isinstance(team_info, list) and len(team_info) > 0:
            for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                if isinstance(item, dict) and "name" in item:
                    return item["name"]
    return "?"


def _extract_team_key(team_data):
    """Extract team key from Yahoo's nested team structure"""
    if isinstance(team_data, dict):
        team_info = team_data.get("team", [])
        if isinstance(team_info, list) and len(team_info) > 0:
            for item in team_info[0] if isinstance(team_info[0], list) else team_info:
                if isinstance(item, dict) and "team_key" in item:
                    return item.get("team_key", "")
    return ""


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


def cmd_matchups(args, as_json=False):
    """Show weekly H2H matchup preview and scores"""
    sc, gm, lg = get_league()

    try:
        if args:
            week = int(args[0])
            raw = lg.matchups(week=week)
        else:
            raw = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching matchups: " + str(e)}
        print("Error fetching matchups: " + str(e))
        return

    if not raw:
        if as_json:
            return {"week": "", "matchups": []}
        print("No matchups available")
        return

    week_label = args[0] if args else "current"

    # Parse Yahoo's nested format: fantasy_content -> league[1] -> scoreboard -> 0 -> matchups
    try:
        league_data = raw.get("fantasy_content", {}).get("league", [])
        if len(league_data) < 2:
            if as_json:
                return {"week": week_label, "matchups": []}
            print("No matchup data in response")
            return
        sb = league_data[1].get("scoreboard", {})
        matchup_block = sb.get("0", {}).get("matchups", {})
        count = int(matchup_block.get("count", 0))

        # Fetch team logos
        team_meta = {}
        try:
            all_teams = lg.teams()
            for tk, td in all_teams.items():
                tname = td.get("name", "")
                logo_url, mgr_image = _extract_team_meta(td)
                team_meta[tname] = {"team_logo": logo_url, "manager_image": mgr_image}
        except Exception:
            pass

        matchup_list = []
        for i in range(count):
            matchup = matchup_block.get(str(i), {}).get("matchup", {})
            teams_data = matchup.get("0", {}).get("teams", {})
            team1 = teams_data.get("0", {})
            team2 = teams_data.get("1", {})
            name1 = _extract_team_name(team1)
            name2 = _extract_team_name(team2)
            status = matchup.get("status", "")
            m1_meta = team_meta.get(name1, {})
            m2_meta = team_meta.get(name2, {})
            matchup_list.append(
                {
                    "team1": name1,
                    "team2": name2,
                    "status": status,
                    "team1_logo": m1_meta.get("team_logo", ""),
                    "team2_logo": m2_meta.get("team_logo", ""),
                }
            )

        if as_json:
            return {"week": week_label, "matchups": matchup_list}

        print("Matchups (week " + str(week_label) + "):")
        for m in matchup_list:
            line = "  " + m["team1"].ljust(28) + " vs  " + m["team2"]
            if m["status"]:
                line += "  (" + m["status"] + ")"
            print(line)
    except Exception as e:
        if as_json:
            return {"error": "Error parsing matchups: " + str(e)}
        print("Error parsing matchups: " + str(e))


def cmd_scoreboard(args, as_json=False):
    """Show live scoring overview for current week (uses matchups data)"""
    sc, gm, lg = get_league()

    try:
        raw = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching scoreboard: " + str(e)}
        print("Error fetching scoreboard: " + str(e))
        return

    if not raw:
        if as_json:
            return {"week": "", "matchups": []}
        print("No scoreboard data available")
        return

    # Parse Yahoo's nested format (scoreboard comes from matchups endpoint)
    try:
        league_data = raw.get("fantasy_content", {}).get("league", [])
        if len(league_data) < 2:
            if as_json:
                return {"week": "?", "matchups": []}
            print("No scoreboard data in response")
            return
        sb = league_data[1].get("scoreboard", {})
        week = sb.get("week", "?")

        matchup_block = sb.get("0", {}).get("matchups", {})
        count = int(matchup_block.get("count", 0))

        # Fetch team logos
        team_meta = {}
        try:
            all_teams = lg.teams()
            for tk, td in all_teams.items():
                tname = td.get("name", "")
                logo_url, mgr_image = _extract_team_meta(td)
                team_meta[tname] = {"team_logo": logo_url, "manager_image": mgr_image}
        except Exception:
            pass

        matchup_list = []
        for i in range(count):
            matchup = matchup_block.get(str(i), {}).get("matchup", {})
            teams_data = matchup.get("0", {}).get("teams", {})
            team1 = teams_data.get("0", {})
            team2 = teams_data.get("1", {})
            name1 = _extract_team_name(team1)
            name2 = _extract_team_name(team2)

            # Extract win/loss/tie counts from stat_winners
            stat_winners = matchup.get("stat_winners", [])
            wins1 = 0
            wins2 = 0
            ties = 0
            for sw in stat_winners:
                w = sw.get("stat_winner", {})
                if w.get("is_tied"):
                    ties += 1
                elif w.get("winner_team_key", ""):
                    # Count wins per team
                    wins1 += 1  # simplified pre-season

            status = matchup.get("status", "")
            m1_meta = team_meta.get(name1, {})
            m2_meta = team_meta.get(name2, {})
            matchup_list.append(
                {
                    "team1": name1,
                    "team2": name2,
                    "status": status,
                    "team1_logo": m1_meta.get("team_logo", ""),
                    "team2_logo": m2_meta.get("team_logo", ""),
                }
            )

        if as_json:
            return {"week": week, "matchups": matchup_list}

        print("Scoreboard - Week " + str(week) + ":")
        print("")
        for m in matchup_list:
            line = (
                "  "
                + m["team1"].ljust(28)
                + " vs  "
                + m["team2"].ljust(28)
                + m["status"]
            )
            print(line)
    except Exception as e:
        if as_json:
            return {"error": "Error parsing scoreboard: " + str(e)}
        print("Error parsing scoreboard: " + str(e))


_stat_id_to_name_cache = {}

def _get_stat_id_to_name(sc):
    """Fetch stat ID to display name mapping, cached for the process lifetime."""
    global _stat_id_to_name_cache
    if _stat_id_to_name_cache:
        return _stat_id_to_name_cache
    try:
        raw_settings = sc.session.get(
            "https://fantasysports.yahooapis.com/fantasy/v2/league/"
            + LEAGUE_ID + "/settings?format=json"
        )
        settings_data = raw_settings.json()
        settings_league = settings_data.get("fantasy_content", {}).get("league", [{}])
        for item in settings_league:
            if isinstance(item, dict) and "settings" in item:
                raw_cats = item["settings"][0].get("stat_categories", {}).get("stats", [])
                for rc in raw_cats:
                    stat = rc.get("stat", {})
                    sid = str(stat.get("stat_id", ""))
                    display = stat.get("display_name", stat.get("name", "Stat " + sid))
                    if sid:
                        _stat_id_to_name_cache[sid] = display
                break
    except Exception:
        pass
    return _stat_id_to_name_cache


def cmd_matchup_detail(args, as_json=False):
    """Show detailed H2H matchup with per-category comparison"""
    sc, gm, lg = get_league()

    try:
        raw = lg.matchups()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching matchup detail: " + str(e)}
        print("Error fetching matchup detail: " + str(e))
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

        sb = league_data[1].get("scoreboard", {})
        week = sb.get("week", "?")
        matchup_block = sb.get("0", {}).get("matchups", {})
        count = int(matchup_block.get("count", 0))

        # Fetch stat categories (cached after first call)
        stat_id_to_name = _get_stat_id_to_name(sc)

        # Fetch team logos
        team_meta = {}
        try:
            all_teams = lg.teams()
            for tk, td in all_teams.items():
                tname = td.get("name", "")
                logo_url, mgr_image = _extract_team_meta(td)
                team_meta[tname] = {"team_logo": logo_url, "manager_image": mgr_image}
        except Exception:
            pass

        # Find user's matchup
        for i in range(count):
            matchup = matchup_block.get(str(i), {}).get("matchup", {})
            teams_data = matchup.get("0", {}).get("teams", {})
            team1_data = teams_data.get("0", {})
            team2_data = teams_data.get("1", {})
            name1 = _extract_team_name(team1_data)
            name2 = _extract_team_name(team2_data)
            key1 = _extract_team_key(team1_data)
            key2 = _extract_team_key(team2_data)

            # Check if this is our matchup
            if TEAM_ID not in key1 and TEAM_ID not in key2:
                continue

            # Found our matchup - determine which team is ours
            if TEAM_ID in key1:
                my_data = team1_data
                opp_data = team2_data
                my_name = name1
                opp_name = name2
            else:
                my_data = team2_data
                opp_data = team1_data
                my_name = name2
                opp_name = name1

            # Extract team stats - Yahoo nests stats in team -> team_stats -> stats
            def _extract_team_stats(tdata):
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

            my_stats = _extract_team_stats(my_data)
            opp_stats = _extract_team_stats(opp_data)

            # Extract stat_winners for per-category results
            stat_winners = matchup.get("stat_winners", [])
            cat_results = {}
            my_key = _extract_team_key(my_data)
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

            # Build categories list
            categories = []
            wins = 0
            losses = 0
            ties = 0

            for sid in sorted(
                cat_results.keys(), key=lambda x: int(x) if x.isdigit() else 0
            ):
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
                categories.append(
                    {
                        "name": cat_name,
                        "my_value": str(my_val),
                        "opp_value": str(opp_val),
                        "result": result,
                    }
                )

            my_meta = team_meta.get(my_name, {})
            opp_meta = team_meta.get(opp_name, {})
            result_data = {
                "week": week,
                "my_team": my_name,
                "opponent": opp_name,
                "my_team_logo": my_meta.get("team_logo", ""),
                "my_manager_image": my_meta.get("manager_image", ""),
                "opp_team_logo": opp_meta.get("team_logo", ""),
                "opp_manager_image": opp_meta.get("manager_image", ""),
                "score": {"wins": wins, "losses": losses, "ties": ties},
                "categories": categories,
            }

            if as_json:
                return result_data

            print("Week " + str(week) + " Matchup: " + my_name + " vs " + opp_name)
            print("Score: " + str(wins) + "-" + str(losses) + "-" + str(ties))
            for cat in categories:
                marker = (
                    "W"
                    if cat["result"] == "win"
                    else ("L" if cat["result"] == "loss" else "T")
                )
                print(
                    "  ["
                    + marker
                    + "] "
                    + cat["name"].ljust(10)
                    + " "
                    + cat["my_value"].rjust(8)
                    + " vs "
                    + cat["opp_value"].rjust(8)
                )
            return

        # No matchup found
        if as_json:
            return {"error": "Could not find your matchup"}
        print("Could not find your matchup")
    except Exception as e:
        if as_json:
            return {"error": "Error parsing matchup detail: " + str(e)}
        print("Error parsing matchup detail: " + str(e))


def cmd_transactions(args, as_json=False):
    """Show recent league transaction activity"""
    sc, gm, lg = get_league()

    trans_type = args[0] if args else None
    count = int(args[1]) if len(args) > 1 else 25

    try:
        if trans_type:
            transactions = lg.transactions(trans_type, count)
        else:
            transactions = []
            for t in ["add", "drop", "trade"]:
                try:
                    results = lg.transactions(t, min(count, 25))
                    if results:
                        transactions.extend(results)
                except Exception:
                    pass
    except Exception as e:
        if as_json:
            return {"error": "Error fetching transactions: " + str(e)}
        print("Error fetching transactions: " + str(e))
        return

    label = trans_type if trans_type else "all"

    if as_json:
        trans_list = []
        for t in transactions:
            if not isinstance(t, dict):
                trans_list.append({"raw": str(t)})
                continue
            tx_type = t.get("type", "?")
            timestamp = t.get("timestamp", "")
            players_data = t.get("players", {})
            player_count = int(players_data.get("count", 0))
            players = []
            for pi in range(player_count):
                p = players_data.get(str(pi), {}).get("player", [])
                name = "Unknown"
                player_id = ""
                position = ""
                mlb_team = ""
                action = ""
                team_name = ""
                if isinstance(p, list) and len(p) > 0:
                    meta = p[0] if isinstance(p[0], list) else []
                    for item in meta:
                        if isinstance(item, dict):
                            if "name" in item:
                                name = item.get("name", {}).get("full", "Unknown")
                            if "player_id" in item:
                                player_id = str(item.get("player_id", ""))
                            if "display_position" in item:
                                position = item.get("display_position", "")
                            if "editorial_team_abbr" in item:
                                mlb_team = item.get("editorial_team_abbr", "")
                    if len(p) > 1 and isinstance(p[1], dict):
                        td = p[1].get("transaction_data", {})
                        if isinstance(td, list):
                            td = td[0] if td else {}
                        action = td.get("type", "")
                        team_name = td.get("destination_team_name", "") or td.get("source_team_name", "")
                mlb_id = get_mlb_id(name) if name != "Unknown" else None
                players.append({
                    "name": name,
                    "player_id": player_id,
                    "mlb_id": mlb_id,
                    "position": position,
                    "mlb_team": mlb_team,
                    "action": action,
                    "fantasy_team": team_name,
                })
            trans_list.append({
                "type": tx_type,
                "timestamp": timestamp,
                "players": players,
            })
        return {"type": label, "transactions": trans_list}

    if not transactions:
        print("No recent transactions found")
        return

    print("Recent transactions (" + label + "):")
    for t in transactions:
        if isinstance(t, dict):
            ttype = t.get("type", "?")
            player = t.get("player", t.get("name", "Unknown"))
            team = t.get("team", "")
            line = "  " + str(ttype).ljust(8) + " " + str(player).ljust(25)
            if team:
                line += " -> " + str(team)
            print(line)
        else:
            print("  " + str(t))


def cmd_stat_categories(args, as_json=False):
    """Show league scoring categories"""
    sc, gm, lg = get_league()

    try:
        categories = lg.stat_categories()
    except Exception as e:
        if as_json:
            return {"error": "Error fetching stat categories: " + str(e)}
        print("Error fetching stat categories: " + str(e))
        return

    if not categories:
        if as_json:
            return {"categories": []}
        print("No stat categories found")
        return

    if as_json:
        cat_list = []
        if isinstance(categories, list):
            for cat in categories:
                if isinstance(cat, dict):
                    cat_list.append(
                        {
                            "name": cat.get("display_name", cat.get("name", "?")),
                            "position_type": cat.get("position_type", ""),
                        }
                    )
        elif isinstance(categories, dict):
            for key, val in categories.items():
                cat_list.append({"name": str(key), "position_type": str(val)})
        return {"categories": cat_list}

    print("Stat Categories:")
    if isinstance(categories, list):
        for cat in categories:
            if isinstance(cat, dict):
                name = cat.get("display_name", cat.get("name", "?"))
                pos_type = cat.get("position_type", "")
                label = ""
                if pos_type:
                    label = " (" + pos_type + ")"
                print("  " + str(name) + label)
            else:
                print("  " + str(cat))
    elif isinstance(categories, dict):
        for key, val in categories.items():
            print("  " + str(key) + ": " + str(val))
    else:
        print("  " + str(categories))


def _parse_trend_players(raw_json):
    """Parse Yahoo's nested player response from sort=AR/DR endpoints"""
    players = []
    try:
        fc = raw_json.get("fantasy_content", {})
        game_data = fc.get("game", [])
        if len(game_data) < 2:
            return players
        players_block = game_data[1].get("players", {})
        count = int(players_block.get("count", 0))
        for i in range(count):
            p_data = players_block.get(str(i), {}).get("player", [])
            if not p_data or len(p_data) < 2:
                continue
            # First element is a list of info dicts
            info_list = p_data[0] if isinstance(p_data[0], list) else []
            name = ""
            player_id = ""
            team_abbrev = ""
            position = ""
            for item in info_list:
                if isinstance(item, dict):
                    if "name" in item:
                        name = item.get("name", {}).get("full", "")
                    if "player_id" in item:
                        player_id = str(item.get("player_id", ""))
                    if "editorial_team_abbr" in item:
                        team_abbrev = item.get("editorial_team_abbr", "")
                    if "display_position" in item:
                        position = item.get("display_position", "")
            # Second element has percent_owned
            pct_owned = 0
            delta = ""
            ownership = p_data[1] if len(p_data) > 1 else {}
            if isinstance(ownership, dict):
                po = ownership.get("percent_owned", [])
                if isinstance(po, list):
                    for po_item in po:
                        if isinstance(po_item, dict):
                            if "value" in po_item:
                                try:
                                    pct_owned = float(po_item.get("value", 0))
                                except (ValueError, TypeError):
                                    pct_owned = 0
                            if "delta" in po_item:
                                raw_delta = po_item.get("delta", "0")
                                try:
                                    d = float(raw_delta)
                                    delta = ("+" if d > 0 else "") + str(d)
                                except (ValueError, TypeError):
                                    delta = str(raw_delta)
                elif isinstance(po, dict):
                    try:
                        pct_owned = float(po.get("value", 0))
                    except (ValueError, TypeError):
                        pct_owned = 0
                    raw_delta = po.get("delta", "0")
                    try:
                        d = float(raw_delta)
                        delta = ("+" if d > 0 else "") + str(d)
                    except (ValueError, TypeError):
                        delta = str(raw_delta)
            entry = {
                "name": name,
                "player_id": player_id,
                "team": team_abbrev.upper(),
                "position": position,
                "percent_owned": pct_owned,
                "delta": delta,
            }
            mlb_id = get_mlb_id(name)
            if mlb_id:
                entry["mlb_id"] = mlb_id
            players.append(entry)
    except Exception as e:
        print("Warning: error parsing trend players: " + str(e))
    return players


def cmd_transaction_trends(args, as_json=False):
    """Show most added and most dropped players across all Yahoo leagues"""
    sc = get_connection()
    gm = yfa.Game(sc, "mlb")

    count = 25
    try:
        added_raw = gm.yhandler.get(
            "game/mlb/players;sort=AR;count=" + str(count) + "/percent_owned"
        )
        dropped_raw = gm.yhandler.get(
            "game/mlb/players;sort=DR;count=" + str(count) + "/percent_owned"
        )
    except Exception as e:
        if as_json:
            return {"error": "Error fetching transaction trends: " + str(e)}
        print("Error fetching transaction trends: " + str(e))
        return

    most_added = _parse_trend_players(added_raw) if added_raw else []
    most_dropped = _parse_trend_players(dropped_raw) if dropped_raw else []

    # Record ownership snapshots for trend tracking
    try:
        import sqlite3
        db_path = os.path.join(DATA_DIR, "season.db")
        db = sqlite3.connect(db_path)
        for p in most_added + most_dropped:
            pid = str(p.get("player_id", ""))
            pct_val = float(p.get("percent_owned", 0)) if p.get("percent_owned") is not None else 0
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
        return {"most_added": most_added, "most_dropped": most_dropped}

    print("Most Added Players (across all Yahoo leagues):")
    for i, p in enumerate(most_added, 1):
        line = "  " + str(i).rjust(2) + ". " + p.get("name", "?").ljust(25)
        line += " " + p.get("team", "?").ljust(4)
        line += " " + p.get("position", "?").ljust(8)
        line += " " + str(p.get("percent_owned", 0)).rjust(5) + "%"
        line += " (" + p.get("delta", "?") + ")"
        print(line)

    print("")
    print("Most Dropped Players (across all Yahoo leagues):")
    for i, p in enumerate(most_dropped, 1):
        line = "  " + str(i).rjust(2) + ". " + p.get("name", "?").ljust(25)
        line += " " + p.get("team", "?").ljust(4)
        line += " " + p.get("position", "?").ljust(8)
        line += " " + str(p.get("percent_owned", 0)).rjust(5) + "%"
        line += " (" + p.get("delta", "?") + ")"
        print(line)


def cmd_swap(args, as_json=False):
    """Atomic add+drop (swap players)"""
    if len(args) < 2:
        if as_json:
            return {
                "success": False,
                "add_key": "",
                "drop_key": "",
                "message": "Usage: swap ADD_ID DROP_ID",
            }
        print("Usage: swap ADD_ID DROP_ID")
        return
    add_id = args[0]
    drop_id = args[1]
    add_key = GAME_KEY + ".p." + str(add_id)
    drop_key = GAME_KEY + ".p." + str(drop_id)
    method = _write_method()

    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            team.add_and_drop_players(add_key, drop_key)
            msg = "Swapped: added " + add_key + ", dropped " + drop_key
            if as_json:
                return {
                    "success": True,
                    "add_key": add_key,
                    "drop_key": drop_key,
                    "message": msg,
                }
            print(msg)
            return
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                msg = "Error swapping players: " + str(e)
                if as_json:
                    return {
                        "success": False,
                        "add_key": add_key,
                        "drop_key": drop_key,
                        "message": msg,
                    }
                print(msg)
                return

    try:
        from yahoo_browser import swap_players

        result = swap_players(add_id, drop_id)
        if as_json:
            result["add_key"] = add_key
            result["drop_key"] = drop_key
            return result
        if result.get("success"):
            print(result.get("message", "Swap completed via browser"))
        else:
            print(result.get("message", "Browser swap failed"))
    except Exception as e:
        msg = "Browser fallback error: " + str(e)
        if as_json:
            return {
                "success": False,
                "add_key": add_key,
                "drop_key": drop_key,
                "message": msg,
            }
        print(msg)


def cmd_waiver_claim(args, as_json=False):
    """Submit a waiver claim with optional FAAB bid"""
    if not args:
        if as_json:
            return {"success": False, "message": "Missing player_id"}
        print("Usage: waiver-claim PLAYER_ID [FAAB_BID]")
        return
    player_id = args[0]
    player_key = GAME_KEY + ".p." + str(player_id)
    faab = None
    if len(args) > 1:
        try:
            faab = int(args[1])
        except (ValueError, TypeError):
            if as_json:
                return {
                    "success": False,
                    "message": "Invalid FAAB bid: " + str(args[1]),
                }
            print("Invalid FAAB bid: " + str(args[1]))
            return
    method = _write_method()

    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            if faab is not None:
                team.claim_player(player_key, faab=faab)
                msg = (
                    "Waiver claim submitted for "
                    + player_key
                    + " with $"
                    + str(faab)
                    + " FAAB bid"
                )
            else:
                team.claim_player(player_key)
                msg = "Waiver claim submitted for " + player_key
            if as_json:
                return {
                    "success": True,
                    "player_key": player_key,
                    "faab": faab,
                    "message": msg,
                }
            print(msg)
            return
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                msg = "Error submitting waiver claim: " + str(e)
                if as_json:
                    return {
                        "success": False,
                        "player_key": player_key,
                        "faab": faab,
                        "message": msg,
                    }
                print(msg)
                return

    try:
        from yahoo_browser import waiver_claim

        result = waiver_claim(player_id, faab=faab)
        if as_json:
            result["player_key"] = player_key
            result["faab"] = faab
            return result
        if result.get("success"):
            print(result.get("message", "Waiver claim submitted via browser"))
        else:
            print(result.get("message", "Browser waiver claim failed"))
    except Exception as e:
        msg = "Browser fallback error: " + str(e)
        if as_json:
            return {
                "success": False,
                "player_key": player_key,
                "faab": faab,
                "message": msg,
            }
        print(msg)


def cmd_waiver_claim_swap(args, as_json=False):
    """Submit a waiver claim + drop with optional FAAB bid"""
    if len(args) < 2:
        if as_json:
            return {
                "success": False,
                "message": "Usage: waiver-claim-swap ADD_ID DROP_ID [FAAB_BID]",
            }
        print("Usage: waiver-claim-swap ADD_ID DROP_ID [FAAB_BID]")
        return
    add_id = args[0]
    drop_id = args[1]
    add_key = GAME_KEY + ".p." + str(add_id)
    drop_key = GAME_KEY + ".p." + str(drop_id)
    faab = None
    if len(args) > 2:
        try:
            faab = int(args[2])
        except (ValueError, TypeError):
            if as_json:
                return {
                    "success": False,
                    "message": "Invalid FAAB bid: " + str(args[2]),
                }
            print("Invalid FAAB bid: " + str(args[2]))
            return
    method = _write_method()

    if method != "browser":
        try:
            sc, gm, lg, team = get_league_context()
            if faab is not None:
                team.claim_and_drop_players(add_key, drop_key, faab=faab)
                msg = (
                    "Waiver claim+drop submitted: add "
                    + add_key
                    + ", drop "
                    + drop_key
                    + " with $"
                    + str(faab)
                    + " FAAB"
                )
            else:
                team.claim_and_drop_players(add_key, drop_key)
                msg = (
                    "Waiver claim+drop submitted: add " + add_key + ", drop " + drop_key
                )
            if as_json:
                return {
                    "success": True,
                    "add_key": add_key,
                    "drop_key": drop_key,
                    "faab": faab,
                    "message": msg,
                }
            print(msg)
            return
        except Exception as e:
            if method == "api" or not _is_scope_error(e):
                msg = "Error submitting waiver claim+drop: " + str(e)
                if as_json:
                    return {
                        "success": False,
                        "add_key": add_key,
                        "drop_key": drop_key,
                        "faab": faab,
                        "message": msg,
                    }
                print(msg)
                return

    try:
        from yahoo_browser import waiver_claim_swap

        result = waiver_claim_swap(add_id, drop_id, faab=faab)
        if as_json:
            result["add_key"] = add_key
            result["drop_key"] = drop_key
            result["faab"] = faab
            return result
        if result.get("success"):
            print(result.get("message", "Waiver claim+drop submitted via browser"))
        else:
            print(result.get("message", "Browser waiver claim+drop failed"))
    except Exception as e:
        msg = "Browser fallback error: " + str(e)
        if as_json:
            return {
                "success": False,
                "add_key": add_key,
                "drop_key": drop_key,
                "faab": faab,
                "message": msg,
            }
        print(msg)


def cmd_who_owns(args, as_json=False):
    """Check who owns a player by player_id"""
    if not args:
        if as_json:
            return {"error": "Missing player_id"}
        print("Usage: who-owns PLAYER_ID")
        return
    player_id = args[0]
    player_key = GAME_KEY + ".p." + str(player_id)
    sc, gm, lg = get_league()
    try:
        ownership = lg.ownership([player_key])
        if not ownership:
            if as_json:
                return {
                    "player_key": player_key,
                    "ownership_type": "unknown",
                    "owner": "",
                }
            print("No ownership info for " + player_key)
            return
        info = ownership.get(player_key, ownership.get(player_id, {}))
        if not info and len(ownership) == 1:
            info = list(ownership.values())[0]
        own_type = info.get("ownership_type", "unknown")
        owner_name = info.get("owner_team_name", "")
        if as_json:
            return {
                "player_key": player_key,
                "ownership_type": own_type,
                "owner": owner_name,
            }
        if own_type == "team":
            print(player_key + " is owned by: " + owner_name)
        elif own_type == "freeagents":
            print(player_key + " is a free agent")
        elif own_type == "waivers":
            print(player_key + " is on waivers")
        else:
            print(player_key + " ownership: " + own_type)
    except Exception as e:
        if as_json:
            return {"error": "Error checking ownership: " + str(e)}
        print("Error checking ownership: " + str(e))


def cmd_league_pulse(args, as_json=False):
    """Show league activity - moves and trades per team"""
    sc, gm, lg = get_league()
    try:
        teams = lg.teams()
        team_list = []
        for team_key, team_data in teams.items():
            logo_url, mgr_image = _extract_team_meta(team_data)
            team_list.append(
                {
                    "team_key": team_key,
                    "name": team_data.get("name", "Unknown"),
                    "moves": team_data.get("number_of_moves", 0),
                    "trades": team_data.get("number_of_trades", 0),
                    "total": team_data.get("number_of_moves", 0)
                    + team_data.get("number_of_trades", 0),
                    "team_logo": logo_url,
                    "manager_image": mgr_image,
                }
            )
        team_list.sort(key=lambda t: t.get("total", 0), reverse=True)
        if as_json:
            return {"teams": team_list}
        print("League Activity Pulse:")
        print(
            "  "
            + "Team".ljust(30)
            + "Moves".rjust(6)
            + "Trades".rjust(7)
            + "Total".rjust(6)
        )
        print("  " + "-" * 49)
        for t in team_list:
            print(
                "  "
                + t.get("name", "?").ljust(30)
                + str(t.get("moves", 0)).rjust(6)
                + str(t.get("trades", 0)).rjust(7)
                + str(t.get("total", 0)).rjust(6)
            )
    except Exception as e:
        if as_json:
            return {"error": "Error fetching league pulse: " + str(e)}
        print("Error fetching league pulse: " + str(e))


def cmd_discover(args, as_json=False):
    """Discover your Yahoo Fantasy leagues and teams for the current season.
    Does not require LEAGUE_ID or TEAM_ID to be set."""
    sc = OAuth2(None, None, from_file=OAUTH_FILE)
    if not sc.token_is_valid():
        sc.refresh_access_token()
    gm = yfa.Game(sc, "mlb")
    game_id = str(gm.game_id())
    all_ids = gm.league_ids()
    current_ids = [lid for lid in all_ids if lid.startswith(game_id + ".")]

    if not current_ids:
        msg = "No MLB leagues found for the " + game_id + " season."
        if as_json:
            return {"game_id": game_id, "leagues": [], "message": msg}
        print(msg)
        print("Make sure you've joined a Yahoo Fantasy Baseball league for this year.")
        return

    leagues = []
    for lid in current_ids:
        try:
            lg = gm.to_league(lid)
            settings = lg.settings()
            league_name = settings.get("name", "Unknown")
            season = settings.get("season", "?")
            num_teams = settings.get("num_teams", "?")
            teams = lg.teams()
            my_team_key = ""
            my_team_name = ""
            for tk, td in teams.items():
                if td.get("is_owned_by_current_login"):
                    my_team_key = tk
                    my_team_name = td.get("name", "Unknown")
                    break
            leagues.append(
                {
                    "league_id": lid,
                    "league_name": league_name,
                    "season": season,
                    "num_teams": num_teams,
                    "team_id": my_team_key,
                    "team_name": my_team_name,
                }
            )
        except Exception as e:
            leagues.append(
                {
                    "league_id": lid,
                    "league_name": "Error: " + str(e),
                    "season": "?",
                    "num_teams": "?",
                    "team_id": "",
                    "team_name": "",
                }
            )

    if as_json:
        return {"game_id": game_id, "leagues": leagues}

    print("")
    print("Your " + game_id + " MLB Fantasy Leagues:")
    print("")
    for i, lg_info in enumerate(leagues, 1):
        print("  " + str(i) + ". " + lg_info["league_name"])
        print(
            "     Season: "
            + str(lg_info["season"])
            + "  |  Teams: "
            + str(lg_info["num_teams"])
        )
        print("     LEAGUE_ID=" + lg_info["league_id"])
        if lg_info["team_id"]:
            print(
                "     TEAM_ID="
                + lg_info["team_id"]
                + "  ("
                + lg_info["team_name"]
                + ")"
            )
        else:
            print("     (could not identify your team)")
        print("")

    if len(leagues) == 1 and leagues[0]["team_id"]:
        lg_info = leagues[0]
        print("Add these to your .env file:")
        print("")
        print("  LEAGUE_ID=" + lg_info["league_id"])
        print("  TEAM_ID=" + lg_info["team_id"])
        print("")


def cmd_player_stats(args, as_json=False):
    """Get player fantasy stats from Yahoo for a given period"""
    if not args:
        if as_json:
            return {"error": "Usage: player-stats <name> [period] [week|date]"}
        print("Usage: player-stats <name> [period] [week|date]")
        print("  period: season (default), average_season, lastweek, lastmonth, week, date")
        return

    # Parse arguments: name is first, period is optional second, week/date is optional third
    name = args[0]
    period = args[1] if len(args) > 1 else "season"
    extra = args[2] if len(args) > 2 else None

    sc, gm, lg = get_league()

    def _extract_name(p):
        """Extract player name string — handles both str and dict formats"""
        n = p.get("name", "")
        if isinstance(n, dict):
            return n.get("full", n.get("first", "") + " " + n.get("last", ""))
        return str(n)

    # Look up player — try roster first (cheap), then player_details (searches all)
    try:
        found = None

        # Check our own roster first (single API call, most common use case)
        team = lg.to_team(TEAM_ID)
        roster = team.roster()
        if roster:
            for p in roster:
                if name.lower() in _extract_name(p).lower():
                    found = p
                    break

        # Use player_details to search all players (avoids 2x free_agents calls)
        if not found:
            try:
                search_results = lg.player_details(name)
                if search_results:
                    found = search_results[0] if isinstance(search_results, list) else search_results
            except Exception:
                pass

        if not found:
            if as_json:
                return {"error": "Player not found: " + name}
            print("Player not found: " + name)
            return

        player_id = found.get("player_id", "")
        player_name = _extract_name(found) or name

        # Build the player_stats call
        kwargs = {}
        if period == "week" and extra:
            kwargs["req_type"] = "week"
            kwargs["week"] = int(extra)
        elif period == "date" and extra:
            kwargs["req_type"] = "date"
            kwargs["date"] = extra
        else:
            kwargs["req_type"] = period

        stats = lg.player_stats([player_id], **kwargs)
        if not stats:
            if as_json:
                return {"error": "No stats returned for " + player_name}
            print("No stats returned for " + player_name)
            return

        # stats is typically a list of player stat dicts
        player_stats = stats[0] if isinstance(stats, list) else stats

        if as_json:
            return {
                "player_name": player_name,
                "player_id": str(player_id),
                "period": period,
                "week": extra if period == "week" else None,
                "date": extra if period == "date" else None,
                "stats": player_stats,
                "mlb_id": get_mlb_id(player_name),
            }

        print("Stats for " + player_name + " (" + period + "):")
        if isinstance(player_stats, dict):
            for key, val in player_stats.items():
                if key not in ("player_id", "name"):
                    print("  " + str(key).ljust(20) + str(val))
        else:
            print("  " + str(player_stats))

    except Exception as e:
        if as_json:
            return {"error": "Error fetching player stats: " + str(e)}
        print("Error fetching player stats: " + str(e))


def cmd_waivers(args, as_json=False):
    """Show players currently on waivers (not yet free agents)"""
    sc, gm, lg = get_league()
    try:
        waivers = lg.waivers()
        if not waivers:
            if as_json:
                return {"players": []}
            print("No players on waivers")
            return

        if as_json:
            players = []
            for p in waivers:
                players.append({
                    "name": p.get("name", "Unknown"),
                    "player_id": str(p.get("player_id", "")),
                    "eligible_positions": p.get("eligible_positions", []),
                    "percent_owned": p.get("percent_owned", 0),
                    "status": p.get("status", ""),
                    "mlb_id": get_mlb_id(p.get("name", "")),
                })
            enrich_with_intel(players)
            enrich_with_context(players)
            return {"players": players}

        print("Players on Waivers:")
        for p in waivers:
            pname = p.get("name", "Unknown")
            positions = ",".join(p.get("eligible_positions", ["?"]))
            pct = p.get("percent_owned", 0)
            pid = p.get("player_id", "?")
            status = p.get("status", "")
            line = "  " + pname.ljust(25) + " " + positions.ljust(12) + " " + str(pct).rjust(3) + "% owned  (id:" + str(pid) + ")"
            if status:
                line += " [" + status + "]"
            print(line)

    except Exception as e:
        if as_json:
            return {"error": "Error fetching waivers: " + str(e)}
        print("Error fetching waivers: " + str(e))


def cmd_taken_players(args, as_json=False):
    """Show all rostered players across the league"""
    sc, gm, lg = get_league()
    position = args[0] if args else None

    try:
        taken = lg.taken_players()
        if not taken:
            if as_json:
                return {"players": []}
            print("No taken players found")
            return

        # Filter by position if specified
        if position:
            filtered = []
            for p in taken:
                elig = p.get("eligible_positions", [])
                if position.upper() in [pos.upper() for pos in elig]:
                    filtered.append(p)
            taken = filtered

        if as_json:
            players = []
            for p in taken:
                players.append({
                    "name": p.get("name", "Unknown"),
                    "player_id": str(p.get("player_id", "")),
                    "eligible_positions": p.get("eligible_positions", []),
                    "percent_owned": p.get("percent_owned", 0),
                    "status": p.get("status", ""),
                    "owner": p.get("owner", ""),
                    "mlb_id": get_mlb_id(p.get("name", "")),
                })
            return {"players": players, "position": position, "count": len(players)}

        print("All Rostered Players" + (" (" + position + ")" if position else "") + ":")
        for p in taken:
            pname = p.get("name", "Unknown")
            positions = ",".join(p.get("eligible_positions", ["?"]))
            pct = p.get("percent_owned", 0)
            owner = p.get("owner", "")
            line = "  " + pname.ljust(25) + " " + positions.ljust(12) + " " + str(pct).rjust(3) + "% owned"
            if owner:
                line += "  -> " + owner
            print(line)

    except Exception as e:
        if as_json:
            return {"error": "Error fetching taken players: " + str(e)}
        print("Error fetching taken players: " + str(e))


def cmd_roster_history(args, as_json=False):
    """Show roster for a past week or date"""
    if not args:
        if as_json:
            return {"error": "Usage: roster-history <week|date> [team_key]"}
        print("Usage: roster-history <week_number|YYYY-MM-DD> [team_key]")
        return

    lookup = args[0]
    team_key = args[1] if len(args) > 1 else None

    sc, gm, lg = get_league()
    team = lg.to_team(team_key or TEAM_ID)

    try:
        # Determine if lookup is a date or week number
        if "-" in lookup:
            # Date format: YYYY-MM-DD
            d = datetime.date.fromisoformat(lookup)
            roster = team.roster(day=d)
            label = "date " + lookup
        else:
            # Week number
            week = int(lookup)
            roster = team.roster(week=week)
            label = "week " + str(week)

        if not roster:
            if as_json:
                return {"players": [], "lookup": lookup}
            print("No roster data for " + label)
            return

        if as_json:
            players = []
            for p in roster:
                players.append({
                    "name": p.get("name", "Unknown"),
                    "player_id": str(p.get("player_id", "")),
                    "position": p.get("selected_position", "?") if isinstance(p.get("selected_position"), str) else p.get("selected_position", {}).get("position", "?"),
                    "eligible_positions": p.get("eligible_positions", []),
                    "status": p.get("status", ""),
                    "mlb_id": get_mlb_id(p.get("name", "")),
                })
            return {"players": players, "lookup": lookup, "label": label}

        print("Roster for " + label + ":")
        for p in roster:
            pos = p.get("selected_position", "?") if isinstance(p.get("selected_position"), str) else p.get("selected_position", {}).get("position", "?")
            pname = p.get("name", "Unknown")
            status = p.get("status", "")
            elig = ",".join(p.get("eligible_positions", []))
            line = "  " + pos.ljust(4) + " " + pname.ljust(25) + " " + elig
            if status:
                line += " [" + status + "]"
            print(line)

    except Exception as e:
        if as_json:
            return {"error": "Error fetching roster history: " + str(e)}
        print("Error fetching roster history: " + str(e))


def cmd_percent_owned(args, as_json=False):
    """Get percent owned for specific players by player ID"""
    if not args:
        if as_json:
            return {"error": "Usage: percent-owned <player_id> [player_id ...]"}
        print("Usage: percent-owned <player_id> [player_id ...]")
        return
    sc, gm, lg = get_league()
    try:
        player_ids = [int(pid) for pid in args]
        result = lg.percent_owned(player_ids)
        if not result:
            if as_json:
                return {"players": []}
            print("No ownership data returned")
            return
        if as_json:
            players = []
            for p in result:
                players.append({
                    "player_id": str(p.get("player_id", "")),
                    "name": p.get("name", "Unknown"),
                    "percent_owned": p.get("percent_owned", 0),
                })
            return {"players": players}
        print("Percent Owned:")
        for p in result:
            name = p.get("name", "Unknown")
            pct = p.get("percent_owned", 0)
            pid = p.get("player_id", "?")
            print("  " + name.ljust(25) + " " + str(pct).rjust(5) + "%  (id:" + str(pid) + ")")
    except Exception as e:
        if as_json:
            return {"error": "Error fetching percent owned: " + str(e)}
        print("Error fetching percent owned: " + str(e))


def _parse_league_players_enriched(raw, stat_lookup):
    """Parse enriched player data from a league-level players query.

    OAuth API returns: league: [{league_meta}, {players: {0: {player: [...]}, ...}}]
    Returns dict keyed by player_id with enriched fields.
    """
    result = {}
    if not raw:
        return result

    try:
        fc = raw.get("fantasy_content", raw)
        league_data = fc.get("league", {})
        players_raw = None

        if isinstance(league_data, list):
            # OAuth format: list of [meta_dict, {players: ...}]
            for item in league_data:
                if isinstance(item, dict) and "players" in item:
                    players_raw = item.get("players", {})
                    break
        elif isinstance(league_data, dict):
            players_raw = league_data.get("players", {})

        # Also check team-level response (reuse from _parse_enriched_data)
        if not players_raw and isinstance(league_data, list):
            for item in league_data:
                if isinstance(item, dict) and "team" in item:
                    team_data = item.get("team", {})
                    if isinstance(team_data, dict):
                        roster_data = team_data.get("roster", {})
                        if isinstance(roster_data, dict):
                            players_raw = roster_data.get("players", {})
                    break
    except Exception:
        return result

    if not players_raw:
        return result

    player_list = []
    if isinstance(players_raw, dict):
        for key, val in players_raw.items():
            if key == "count":
                continue
            if isinstance(val, dict) and "player" in val:
                player_list.append(val.get("player"))
    elif isinstance(players_raw, list):
        for item in players_raw:
            if isinstance(item, dict) and "player" in item:
                player_list.append(item.get("player"))

    for player_data in player_list:
        try:
            parsed = _parse_single_player(player_data, stat_lookup)
            if parsed and parsed.get("player_id"):
                result[str(parsed.get("player_id"))] = parsed
        except Exception:
            continue

    return result


def cmd_player_list(args, as_json=False):
    """Browse players with position filtering, stats, and enrichment.

    Args: [pos_type, count, status]
    pos_type: B, P, C, 1B, 2B, SS, 3B, OF, SP, RP (default: B)
    count: number of players (default: 50)
    status: FA (free agents only, default), ALL (include rostered)
    """
    pos_type = args[0] if args else "B"
    count = int(args[1]) if len(args) > 1 else 50
    status = args[2].upper() if len(args) > 2 else "FA"

    sc, gm, lg = get_league()

    # Fetch free agents
    fa = lg.free_agents(pos_type)[:count]

    players = []
    for p in fa:
        players.append({
            "name": p.get("name", "Unknown"),
            "player_id": str(p.get("player_id", "?")),
            "eligible_positions": p.get("eligible_positions", []),
            "percent_owned": p.get("percent_owned", 0),
            "status": p.get("status", ""),
            "team": p.get("editorial_team_abbr", ""),
            "headshot": p.get("headshot", {}).get("url", "") if isinstance(p.get("headshot"), dict) else "",
            "mlb_id": get_mlb_id(p.get("name", "")),
            "roster_status": "FA",
        })

    # If ALL, also add rostered players filtered by position
    if status == "ALL":
        try:
            taken = lg.taken_players()
            if taken:
                taken_ids = set(str(p.get("player_id", "")) for p in players)
                for p in taken:
                    pid = str(p.get("player_id", ""))
                    if pid in taken_ids:
                        continue
                    elig = p.get("eligible_positions", [])
                    # Filter by position
                    if pos_type in ("B", "P"):
                        # B/P are broad categories - taken_players returns all
                        pass
                    else:
                        if pos_type.upper() not in [pos.upper() for pos in elig]:
                            continue
                    players.append({
                        "name": p.get("name", "Unknown"),
                        "player_id": pid,
                        "eligible_positions": elig,
                        "percent_owned": p.get("percent_owned", 0),
                        "status": p.get("status", ""),
                        "team": p.get("editorial_team_abbr", ""),
                        "headshot": p.get("headshot", {}).get("url", "") if isinstance(p.get("headshot"), dict) else "",
                        "mlb_id": get_mlb_id(p.get("name", "")),
                        "roster_status": p.get("owner", "Rostered"),
                        "owner": p.get("owner", ""),
                    })
        except Exception as e:
            print("Warning: could not fetch taken players: " + str(e))

    # Batch enrich with stats, ownership, draft analysis
    stat_lookup = _get_stat_lookup(lg)

    # Batch API call for enrichment (25 at a time)
    enriched_data = {}
    try:
        handler = lg.yhandler
        league_key = lg.league_id
        player_keys = [str(gm.game_id()) + ".p." + str(p.get("player_id", "")) for p in players if p.get("player_id")]
        batch_size = 25
        for i in range(0, len(player_keys), batch_size):
            batch = player_keys[i:i + batch_size]
            keys_str = ",".join(batch)
            uri = ("/league/" + league_key
                   + "/players;player_keys=" + keys_str
                   + ";out=percent_started,percent_owned,draft_analysis"
                   + "/stats;type=season;season=" + str(datetime.date.today().year))
            raw = handler.get(uri)
            batch_enriched = _parse_league_players_enriched(raw, stat_lookup)
            enriched_data.update(batch_enriched)
    except Exception as e:
        print("Warning: enrichment failed: " + str(e))

    # Get today's opponents
    opponents = _get_today_opponents()

    # Merge enriched data
    for p in players:
        pid = str(p.get("player_id", ""))
        if pid in enriched_data:
            ed = enriched_data.get(pid, {})
            if not p.get("team") and ed.get("team"):
                p["team"] = ed.get("team")
            if not p.get("headshot") and ed.get("headshot"):
                p["headshot"] = ed.get("headshot")
            p["percent_started"] = ed.get("percent_started")
            if ed.get("percent_owned") is not None:
                p["percent_owned"] = ed.get("percent_owned")
            p["preseason_pick"] = ed.get("preseason_pick")
            p["current_pick"] = ed.get("current_pick")
            p["stats"] = ed.get("stats", {})

        # Add opponent
        if p.get("team") and p.get("team") in opponents:
            p["opponent"] = opponents.get(p.get("team"))

    enrich_with_intel(players)
    enrich_with_trends(players)
    enrich_with_context(players)

    if as_json:
        return {
            "pos_type": pos_type,
            "count": len(players),
            "status": status,
            "players": players,
        }

    label = pos_type if pos_type not in ("B", "P") else ("Batters" if pos_type == "B" else "Pitchers")
    print("Player List - " + label + " (" + str(len(players)) + " players):")
    for p in players:
        name = p.get("name", "Unknown")
        positions = ",".join(p.get("eligible_positions", ["?"]))
        pct = p.get("percent_owned", 0)
        pid = p.get("player_id", "?")
        rs = p.get("roster_status", "FA")
        line = (
            "  "
            + name.ljust(25)
            + " "
            + positions.ljust(12)
            + " "
            + str(pct).rjust(3)
            + "% owned  ["
            + rs
            + "]  (id:"
            + str(pid)
            + ")"
        )
        print(line)


def cmd_positional_ranks(args, as_json=False):
    """Get positional rankings and recommended trade partners for all teams.

    Uses Yahoo's teams;out=positional_ranks,recommended_trade_partners endpoint.
    Returns each team's rank (1-12) at every position with grade and player details.
    """
    sc, gm, lg = get_league()

    try:
        handler = lg.yhandler
        league_key = lg.league_id
        uri = ("/league/" + league_key
               + "/teams;out=positional_ranks,recommended_trade_partners"
               + ";recommended_trade_partners.count=3")
        raw = handler.get(uri)
    except Exception as e:
        if as_json:
            return {"error": "Failed to fetch positional ranks: " + str(e)}
        print("Error: " + str(e))
        return

    # Parse the response
    teams = []
    try:
        fc = raw.get("fantasy_content", raw)
        league_data = fc.get("league", {})

        # League data can be a list or dict
        teams_raw = {}
        if isinstance(league_data, list):
            for item in league_data:
                if isinstance(item, dict) and "teams" in item:
                    teams_raw = item.get("teams", {})
                    break
        elif isinstance(league_data, dict):
            teams_raw = league_data.get("teams", {})

        # Teams can be dict with numeric keys or a list
        team_list = []
        if isinstance(teams_raw, dict):
            for key, val in teams_raw.items():
                if key == "count" or not isinstance(val, dict):
                    continue
                if "team" in val:
                    team_list.append(val.get("team"))
        elif isinstance(teams_raw, list):
            for item in teams_raw:
                if isinstance(item, dict) and "team" in item:
                    team_list.append(item.get("team"))

        for team_data in team_list:
            team_info = _parse_team_positional_ranks(team_data)
            if team_info:
                teams.append(team_info)
    except Exception as e:
        if as_json:
            return {"error": "Failed to parse positional ranks: " + str(e)}
        print("Error parsing: " + str(e))
        return

    if as_json:
        return {"teams": teams}

    # CLI output
    for t in teams:
        print(t.get("name", "Unknown") + " (Team " + str(t.get("team_id", "?")) + "):")
        for pr in t.get("positional_ranks", []):
            pos = pr.get("position", "?")
            rank = pr.get("rank", "?")
            grade = pr.get("grade", "?")
            print("  " + pos.ljust(5) + " Rank: " + str(rank).rjust(2) + "  [" + grade + "]")
        partners = t.get("recommended_trade_partners", [])
        if partners:
            print("  Trade partners: " + ", ".join(partners))
        print()


def _parse_team_positional_ranks(team_data):
    """Parse a single team's positional ranks from Yahoo raw format.

    OAuth API returns team as a list: [
        [meta_item1, meta_item2, ...],  # list of team metadata dicts
        {positional_ranks: [...]},
        {recommended_trade_partners: [...]}
    ]
    Browser json_f API returns team as a flat dict.
    """
    if not team_data:
        return None

    info = {}

    if isinstance(team_data, list):
        # OAuth format: list of [metadata_list, {positional_ranks}, {trade_partners}]
        for item in team_data:
            if isinstance(item, list):
                # This is the metadata list (team_key, name, logos, etc.)
                for meta in item:
                    if isinstance(meta, dict):
                        for key, val in meta.items():
                            if key == "team_key":
                                info["team_key"] = val
                            elif key == "team_id":
                                info["team_id"] = str(val)
                            elif key == "name":
                                info["name"] = val
                            elif key == "team_logos":
                                if isinstance(val, list) and val:
                                    logo = val[0]
                                    if isinstance(logo, dict) and "team_logo" in logo:
                                        info["team_logo"] = logo.get("team_logo", {}).get("url", "")
                            elif key == "managers":
                                if isinstance(val, list) and val:
                                    mgr = val[0]
                                    if isinstance(mgr, dict) and "manager" in mgr:
                                        mgr_data = mgr.get("manager", {})
                                        info["manager"] = mgr_data.get("nickname", "")
                                        info["manager_image"] = mgr_data.get("image_url", "")
            elif isinstance(item, dict):
                if "positional_ranks" in item:
                    info["positional_ranks"] = _parse_positional_ranks_list(
                        item.get("positional_ranks", []))
                if "recommended_trade_partners" in item:
                    info["recommended_trade_partners"] = _parse_trade_partners(
                        item.get("recommended_trade_partners", []))
                # Also handle flat dict items with team metadata
                for key, val in item.items():
                    if key == "team_key":
                        info["team_key"] = val
                    elif key == "team_id":
                        info["team_id"] = str(val)
                    elif key == "name":
                        info["name"] = val
    elif isinstance(team_data, dict):
        # json_f format: flat dict
        info["team_key"] = team_data.get("team_key", "")
        info["team_id"] = str(team_data.get("team_id", ""))
        info["name"] = team_data.get("name", "")
        logos = team_data.get("team_logos", [])
        if logos and isinstance(logos, list):
            logo = logos[0]
            if isinstance(logo, dict) and "team_logo" in logo:
                info["team_logo"] = logo.get("team_logo", {}).get("url", "")
        managers = team_data.get("managers", [])
        if managers and isinstance(managers, list):
            mgr = managers[0]
            if isinstance(mgr, dict) and "manager" in mgr:
                mgr_data = mgr.get("manager", {})
                info["manager"] = mgr_data.get("nickname", "")
                info["manager_image"] = mgr_data.get("image_url", "")
        info["positional_ranks"] = _parse_positional_ranks_list(
            team_data.get("positional_ranks", []))
        info["recommended_trade_partners"] = _parse_trade_partners(
            team_data.get("recommended_trade_partners", []))

    return info if info.get("team_key") else None


def _parse_positional_ranks_list(ranks_data):
    """Parse positional ranks array from Yahoo response.

    OAuth API wraps the list: [[{positional_rank: ...}, ...]]
    json_f API returns flat: [{positional_rank: ...}, ...]
    """
    result = []
    if not isinstance(ranks_data, list):
        return result

    # Unwrap nested list if needed (OAuth format)
    if len(ranks_data) == 1 and isinstance(ranks_data[0], list):
        ranks_data = ranks_data[0]

    for item in ranks_data:
        pr = item.get("positional_rank", item) if isinstance(item, dict) else item
        if not isinstance(pr, dict):
            continue

        starters = []
        for sp in pr.get("starting_players", []):
            p = sp.get("player", sp) if isinstance(sp, dict) else sp
            if isinstance(p, dict):
                starters.append({
                    "player_key": p.get("player_key", ""),
                    "name": (p.get("first_name", "") + " " + p.get("last_name", "")).strip(),
                })

        bench = []
        for bp in pr.get("bench_players", []):
            p = bp.get("player", bp) if isinstance(bp, dict) else bp
            if isinstance(p, dict):
                bench.append({
                    "player_key": p.get("player_key", ""),
                    "name": (p.get("first_name", "") + " " + p.get("last_name", "")).strip(),
                })

        result.append({
            "position": pr.get("position", ""),
            "rank": pr.get("rank"),
            "grade": pr.get("grade", ""),
            "starters": starters,
            "bench": bench,
        })

    return result


def _parse_trade_partners(partners_data):
    """Parse recommended trade partners array."""
    result = []
    if not isinstance(partners_data, list):
        return result
    for item in partners_data:
        rtp = item.get("recommended_trade_partner", item) if isinstance(item, dict) else item
        if isinstance(rtp, dict):
            result.append(rtp.get("team_key", ""))
    return result


def cmd_league_snapshot(args, as_json=False):
    """Full league snapshot: settings, standings with season stats, positional ranks,
    trade partners, and all rosters in a single Yahoo API call.

    Uses the compound endpoint:
    /league/{key};out=settings/standings/teams;out=positional_ranks,
    recommended_trade_partners,standings,players;positional_ranks.starters_only=1;
    recommended_trade_partners.count=3
    """
    sc, gm, lg = get_league()
    include_rosters = "--rosters" in args

    try:
        handler = lg.yhandler
        league_key = lg.league_id
        uri = ("/league/" + league_key
               + ";out=settings/standings/teams"
               + ";out=positional_ranks,recommended_trade_partners,standings"
               + (",players" if include_rosters else "")
               + ";positional_ranks.starters_only=1"
               + ";recommended_trade_partners.count=3")
        raw = handler.get(uri)
    except Exception as e:
        if as_json:
            return {"error": "Failed to fetch league snapshot: " + str(e)}
        print("Error: " + str(e))
        return

    try:
        fc = raw.get("fantasy_content", raw)
        league_data = fc.get("league", {})

        # Parse settings
        settings = _snapshot_parse_settings(league_data)

        # Build stat_id -> {name, group} from settings
        stat_map = {}
        for cat in settings.get("stat_categories", []):
            sid = str(cat.get("stat_id", ""))
            name = cat.get("display_name", cat.get("abbr", ""))
            if sid and name and not cat.get("is_only_display_stat"):
                stat_map[sid] = {"name": name, "group": cat.get("group", "")}

        # Parse standings/teams block
        teams = _snapshot_parse_teams(league_data, stat_map, include_rosters)

        result = {
            "settings": {
                "scoring_type": settings.get("scoring_type", ""),
                "roster_positions": settings.get("roster_positions", []),
                "stat_categories": settings.get("stat_categories", []),
                "max_weekly_adds": settings.get("max_weekly_adds", ""),
                "trade_end_date": settings.get("trade_end_date", ""),
                "playoff_start_week": settings.get("playoff_start_week", ""),
                "num_playoff_teams": settings.get("num_playoff_teams", ""),
            },
            "teams": teams,
        }

        if as_json:
            return result

        # CLI output
        print("League Snapshot (" + str(len(teams)) + " teams)")
        for t in teams:
            rank = str(t.get("rank", "?")).rjust(2)
            name = t.get("name", "Unknown").ljust(35)
            record = (str(t.get("wins", 0)) + "-" + str(t.get("losses", 0))
                       + "-" + str(t.get("ties", 0)))
            print(rank + ". " + name + " " + record)
            if t.get("season_stats"):
                stats_str = "     "
                for cat, val in t.get("season_stats", {}).items():
                    stats_str += cat + ":" + str(val) + " "
                print(stats_str)
            weak = [pr.get("position", "") for pr in t.get("positional_ranks", [])
                    if pr.get("grade") == "weak"]
            if weak:
                print("     Weak: " + ", ".join(weak))

    except Exception as e:
        if as_json:
            return {"error": "Failed to parse league snapshot: " + str(e)}
        print("Error parsing: " + str(e))
        import traceback
        traceback.print_exc()


def _snapshot_parse_settings(league_data):
    """Extract settings from the league snapshot response."""
    settings_raw = {}

    if isinstance(league_data, list):
        # OAuth format: league is a list of items
        for item in league_data:
            if isinstance(item, dict) and "settings" in item:
                settings_raw = item.get("settings", {})
                break
    elif isinstance(league_data, dict):
        # json_f format: league is a flat dict
        settings_raw = league_data.get("settings", {})

    # Handle settings as list (OAuth) or dict (json_f)
    if isinstance(settings_raw, list):
        merged = {}
        for s in settings_raw:
            if isinstance(s, dict):
                merged.update(s)
        settings_raw = merged

    # Extract stat categories
    stat_categories = []
    raw_cats = settings_raw.get("stat_categories", {})
    stats_list = raw_cats.get("stats", []) if isinstance(raw_cats, dict) else []
    for entry in stats_list:
        stat = entry.get("stat", entry) if isinstance(entry, dict) else entry
        if isinstance(stat, dict):
            cat = {
                "stat_id": stat.get("stat_id", ""),
                "display_name": stat.get("display_name", stat.get("abbr", "")),
                "group": stat.get("group", ""),
                "sort_order": stat.get("sort_order", "1"),
            }
            if stat.get("is_only_display_stat"):
                cat["is_only_display_stat"] = True
            stat_categories.append(cat)

    # Extract roster positions
    roster_positions = []
    for rp in settings_raw.get("roster_positions", []):
        pos = rp.get("roster_position", rp) if isinstance(rp, dict) else rp
        if isinstance(pos, dict):
            roster_positions.append({
                "position": pos.get("position", ""),
                "count": pos.get("count", 0),
                "is_starting": pos.get("is_starting_position", 0),
            })

    return {
        "scoring_type": settings_raw.get("scoring_type", ""),
        "stat_categories": stat_categories,
        "roster_positions": roster_positions,
        "max_weekly_adds": settings_raw.get("max_weekly_adds", ""),
        "trade_end_date": settings_raw.get("trade_end_date", ""),
        "playoff_start_week": settings_raw.get("playoff_start_week", ""),
        "num_playoff_teams": settings_raw.get("num_playoff_teams", ""),
    }


def _snapshot_parse_teams(league_data, stat_map, include_rosters):
    """Extract teams with standings, season stats, positional ranks from snapshot."""
    teams = []

    # Find the standings/teams block
    standings_block = {}
    if isinstance(league_data, list):
        for item in league_data:
            if isinstance(item, dict) and "standings" in item:
                sb = item.get("standings", {})
                # OAuth wraps standings as a list: [{teams: ...}]
                if isinstance(sb, list):
                    for s in sb:
                        if isinstance(s, dict) and "teams" in s:
                            standings_block = s
                            break
                elif isinstance(sb, dict):
                    standings_block = sb
                break
    elif isinstance(league_data, dict):
        standings_block = league_data.get("standings", {})

    # Parse teams from standings
    teams_raw = standings_block.get("teams", {})
    team_list = []

    if isinstance(teams_raw, dict):
        for key, val in teams_raw.items():
            if key == "count" or not isinstance(val, dict):
                continue
            if "team" in val:
                team_list.append(val.get("team"))
    elif isinstance(teams_raw, list):
        for item in teams_raw:
            if isinstance(item, dict) and "team" in item:
                team_list.append(item.get("team"))

    for team_data in team_list:
        parsed = _snapshot_parse_single_team(team_data, stat_map, include_rosters)
        if parsed:
            teams.append(parsed)

    # Sort by rank
    teams.sort(key=lambda t: t.get("rank", 99))
    return teams


def _snapshot_parse_single_team(team_data, stat_map, include_rosters):
    """Parse a single team from the league snapshot (handles OAuth list + json_f dict)."""
    if not team_data:
        return None

    info = {}

    if isinstance(team_data, dict):
        # json_f format: flat dict with all fields
        info["team_key"] = team_data.get("team_key", "")
        info["team_id"] = str(team_data.get("team_id", ""))
        info["name"] = team_data.get("name", "")
        info["waiver_priority"] = team_data.get("waiver_priority", "")
        info["number_of_moves"] = team_data.get("number_of_moves", 0)
        info["number_of_trades"] = team_data.get("number_of_trades", 0)

        # Manager
        managers = team_data.get("managers", [])
        if managers and isinstance(managers, list):
            mgr = managers[0]
            if isinstance(mgr, dict) and "manager" in mgr:
                mgr_data = mgr.get("manager", {})
                info["manager"] = mgr_data.get("nickname", "")

        # Team standings
        ts = team_data.get("team_standings", {})
        info["rank"] = int(ts.get("rank", 99))
        info["playoff_seed"] = ts.get("playoff_seed", "")
        info["games_back"] = ts.get("games_back", "")
        ot = ts.get("outcome_totals", {})
        info["wins"] = int(ot.get("wins", 0))
        info["losses"] = int(ot.get("losses", 0))
        info["ties"] = int(ot.get("ties", 0))
        info["win_pct"] = ot.get("percentage", "")

        # Season stats
        info["season_stats"] = _parse_team_season_stats(
            team_data.get("team_stats", {}), stat_map)

        # Positional ranks (reuse existing parser)
        info["positional_ranks"] = _parse_positional_ranks_list(
            team_data.get("positional_ranks", []))

        # Recommended trade partners (reuse existing parser)
        info["recommended_trade_partners"] = _parse_trade_partners(
            team_data.get("recommended_trade_partners", []))

        # Players (optional)
        if include_rosters:
            info["players"] = _parse_snapshot_players(
                team_data.get("players", []))

    elif isinstance(team_data, list):
        # OAuth format: list of [metadata_list, {subresource}, ...]
        for item in team_data:
            if isinstance(item, list):
                for meta in item:
                    if isinstance(meta, dict):
                        if "team_key" in meta:
                            info["team_key"] = meta.get("team_key", "")
                        if "team_id" in meta:
                            info["team_id"] = str(meta.get("team_id", ""))
                        if "name" in meta:
                            info["name"] = meta.get("name", "")
                        if "waiver_priority" in meta:
                            info["waiver_priority"] = meta.get("waiver_priority", "")
                        if "number_of_moves" in meta:
                            info["number_of_moves"] = meta.get("number_of_moves", 0)
                        if "managers" in meta:
                            mgrs = meta.get("managers", [])
                            if mgrs and isinstance(mgrs, list):
                                mgr = mgrs[0]
                                if isinstance(mgr, dict) and "manager" in mgr:
                                    info["manager"] = mgr.get("manager", {}).get("nickname", "")
            elif isinstance(item, dict):
                if "team_standings" in item:
                    ts = item.get("team_standings", {})
                    info["rank"] = int(ts.get("rank", 99))
                    info["playoff_seed"] = ts.get("playoff_seed", "")
                    info["games_back"] = ts.get("games_back", "")
                    ot = ts.get("outcome_totals", {})
                    info["wins"] = int(ot.get("wins", 0))
                    info["losses"] = int(ot.get("losses", 0))
                    info["ties"] = int(ot.get("ties", 0))
                    info["win_pct"] = ot.get("percentage", "")
                if "team_stats" in item:
                    info["season_stats"] = _parse_team_season_stats(
                        item.get("team_stats", {}), stat_map)
                if "positional_ranks" in item:
                    info["positional_ranks"] = _parse_positional_ranks_list(
                        item.get("positional_ranks", []))
                if "recommended_trade_partners" in item:
                    info["recommended_trade_partners"] = _parse_trade_partners(
                        item.get("recommended_trade_partners", []))
                if include_rosters and "players" in item:
                    info["players"] = _parse_snapshot_players(
                        item.get("players", []))

    # Defaults
    info.setdefault("rank", 99)
    info.setdefault("wins", 0)
    info.setdefault("losses", 0)
    info.setdefault("ties", 0)
    info.setdefault("season_stats", {})
    info.setdefault("positional_ranks", [])
    info.setdefault("recommended_trade_partners", [])

    return info if info.get("team_key") else None


def _parse_team_season_stats(team_stats_raw, stat_map):
    """Parse team_stats block into {display_name: value} dict.
    Disambiguates duplicate display names (e.g. batting K vs pitching K)
    by appending the group prefix when a collision is detected."""
    result = {}
    if not isinstance(team_stats_raw, dict):
        return result

    # Detect duplicate display names across groups
    name_counts = {}
    for sid, info in stat_map.items():
        name = info if isinstance(info, str) else info.get("name", "")
        name_counts[name] = name_counts.get(name, 0) + 1
    dupes = {n for n, c in name_counts.items() if c > 1}

    stats_list = team_stats_raw.get("stats", [])
    for entry in stats_list:
        stat = entry.get("stat", entry) if isinstance(entry, dict) else entry
        if not isinstance(stat, dict):
            continue
        sid = str(stat.get("stat_id", ""))
        val = stat.get("value")
        if sid in stat_map and val is not None:
            info = stat_map[sid]
            if isinstance(info, str):
                name = info
                group = ""
            else:
                name = info.get("name", "")
                group = info.get("group", "")
            # Disambiguate: "K" -> "K_bat" / "K_pit"
            if name in dupes and group:
                name = name + "_" + group[:3]
            try:
                result[name] = float(val) if val not in (None, "", "-") else 0
            except (ValueError, TypeError):
                result[name] = 0
    return result


def _parse_snapshot_players(players_data):
    """Parse player list from league snapshot into compact format."""
    result = []
    if isinstance(players_data, list):
        items = players_data
    elif isinstance(players_data, dict):
        # dict with numeric keys + "count"
        items = []
        for key, val in players_data.items():
            if key == "count" or not isinstance(val, dict):
                continue
            if "player" in val:
                items.append(val)
    else:
        return result

    for entry in items:
        p = entry.get("player", entry) if isinstance(entry, dict) else entry
        if not isinstance(p, dict):
            # OAuth: player is a list [metadata_list, ...]
            if isinstance(p, list):
                p = _flatten_oauth_player(p)
            else:
                continue

        name_block = p.get("name", {})
        if isinstance(name_block, dict):
            full_name = name_block.get("full", "")
        else:
            full_name = str(name_block)

        player = {
            "player_key": p.get("player_key", ""),
            "name": full_name,
            "position": p.get("display_position", p.get("primary_position", "")),
            "team": p.get("editorial_team_abbr", ""),
        }
        status = p.get("status", "")
        if status:
            player["status"] = status
            injury = p.get("injury_note", "")
            if injury:
                player["injury"] = injury
        result.append(player)

    return result


def _flatten_oauth_player(player_list):
    """Flatten OAuth player format (list of dicts) into a single dict."""
    merged = {}
    for item in player_list:
        if isinstance(item, list):
            for sub in item:
                if isinstance(sub, dict):
                    merged.update(sub)
        elif isinstance(item, dict):
            merged.update(item)
    return merged


COMMANDS = {
    "discover": cmd_discover,
    "roster": cmd_roster,
    "free-agents": cmd_free_agents,
    "standings": cmd_standings,
    "info": cmd_info,
    "search": cmd_search,
    "add": cmd_add,
    "drop": cmd_drop,
    "matchups": cmd_matchups,
    "scoreboard": cmd_scoreboard,
    "matchup-detail": cmd_matchup_detail,
    "transactions": cmd_transactions,
    "stat-categories": cmd_stat_categories,
    "swap": cmd_swap,
    "transaction-trends": cmd_transaction_trends,
    "waiver-claim": cmd_waiver_claim,
    "waiver-claim-swap": cmd_waiver_claim_swap,
    "who-owns": cmd_who_owns,
    "league-pulse": cmd_league_pulse,
    "player-stats": cmd_player_stats,
    "waivers": cmd_waivers,
    "taken-players": cmd_taken_players,
    "roster-history": cmd_roster_history,
    "percent-owned": cmd_percent_owned,
    "player-list": cmd_player_list,
    "positional-ranks": cmd_positional_ranks,
    "league-snapshot": cmd_league_snapshot,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Yahoo Fantasy Baseball CLI (Docker)")
        print("Usage: yahoo-fantasy.py <command> [args]")
        print("\nCommands: " + ", ".join(COMMANDS.keys()))
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd in COMMANDS:
        COMMANDS[cmd](args)
    else:
        print("Unknown command: " + cmd)
