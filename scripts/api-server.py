#!/usr/bin/env python3
"""Yahoo Fantasy Baseball JSON API Server

Routes match the TypeScript MCP Apps server's python-client.ts expectations.
"""

import sys
import os
import importlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request

# Import modules (some have hyphens, need importlib)
yahoo_fantasy = importlib.import_module("yahoo-fantasy")
draft_assistant = importlib.import_module("draft-assistant")
mlb_data = importlib.import_module("mlb-data")
season_manager = importlib.import_module("season-manager")
import valuations
import history
import intel
import news
import yahoo_browser
import prospects
import prospect_news

app = Flask(__name__)


# --- JSON sanitization helper ---

import re
_CTRL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')


def _sanitize_for_json(obj):
    """Recursively strip control characters (0x00-0x1F except \\n \\r \\t)
    from all string values in a dict/list structure.
    This prevents invalid JSON from reaching the client."""
    if isinstance(obj, str):
        return _CTRL_RE.sub('', obj)
    elif isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_for_json(item) for item in obj]
    return obj


def safe_jsonify(data, status_code=200):
    """jsonify wrapper that sanitizes all string values to remove control chars."""
    clean = _sanitize_for_json(data)
    resp = jsonify(clean)
    if status_code != 200:
        resp.status_code = status_code
    return resp


# --- Session heartbeat (keeps Yahoo cookies alive) ---

HEARTBEAT_INTERVAL = int(os.environ.get("BROWSER_HEARTBEAT_HOURS", "6")) * 3600


def _run_heartbeat():
    """Background loop that refreshes the browser session periodically"""
    import time

    # Wait a bit for startup to settle
    time.sleep(30)
    while True:
        try:
            status = yahoo_browser.is_session_valid()
            if status.get("valid"):
                yahoo_browser.refresh_session()
        except Exception as e:
            print("Heartbeat error: " + str(e))
        time.sleep(HEARTBEAT_INTERVAL)


import threading

_heartbeat_thread = threading.Thread(target=_run_heartbeat, daemon=True)
_heartbeat_thread.start()


# --- Startup projection fetch ---

def _startup_projections():
    """Background thread to ensure projections are loaded on startup"""
    import time
    time.sleep(5)  # Let other startup tasks settle
    try:
        valuations.ensure_projections()
        print("Startup projections loaded successfully")
    except Exception as e:
        print("Startup projections failed: " + str(e))


_proj_thread = threading.Thread(target=_startup_projections, daemon=True)
_proj_thread.start()


def _startup_news_tables():
    """Background thread to initialize prospect news tables"""
    import time
    time.sleep(3)
    try:
        prospect_news.init_news_tables()
        print("Prospect news tables initialized")
    except Exception as e:
        print("Prospect news tables init failed: " + str(e))

_news_thread = threading.Thread(target=_startup_news_tables, daemon=True)
_news_thread.start()


def _startup_catcher_premium():
    """Background thread to pre-warm Yahoo connection and set catcher premium."""
    import time
    time.sleep(8)  # Wait for other startup tasks
    try:
        from shared import get_league_settings, get_league, get_cached_teams, get_cached_standings
        # Pre-warm Yahoo connection + league objects
        sc, gm, lg = get_league()
        print("Pre-warm: Yahoo connection ready")
        # Pre-warm teams/standings caches
        try:
            get_cached_teams(lg)
            get_cached_standings(lg)
            print("Pre-warm: teams/standings cached")
        except Exception as e:
            print("Pre-warm: teams/standings failed (non-fatal): " + str(e))
        # Set catcher premium from league roster config
        settings = get_league_settings()
        roster_positions = settings.get("roster_positions") if settings else None
        if roster_positions:
            valuations.set_catcher_premium(roster_positions)
            c_premium = valuations.POS_BONUS.get("C", 1.5)
            print("Catcher premium set to " + str(c_premium) + " based on league roster")
        else:
            print("No roster positions available, using default catcher premium")
    except Exception as e:
        print("Startup pre-warm failed (using defaults): " + str(e))


_catcher_thread = threading.Thread(target=_startup_catcher_premium, daemon=True)
_catcher_thread.start()


# --- Response caching + timeout for slow endpoints ---

import concurrent.futures
from shared import cache_get, cache_set

_response_cache = {}
_timeout_pool = concurrent.futures.ThreadPoolExecutor(max_workers=10)
_workflow_pool = concurrent.futures.ThreadPoolExecutor(max_workers=20)


def _get_future(future, timeout=30):
    """Harvest a future result, returning error dict on failure."""
    try:
        return future.result(timeout=timeout)
    except Exception as e:
        return {"_error": str(e)}


def _cached_endpoint(cache_key, fn, ttl_seconds, timeout_sec=25):
    """Cache + timeout wrapper for slow endpoints.
    Returns cached response if available. Otherwise runs fn in a thread
    with timeout, caches the result, and returns it. On timeout the function
    keeps running in the background and populates the cache for next call."""
    cached = cache_get(_response_cache, cache_key, ttl_seconds)
    if cached is not None:
        return safe_jsonify(cached)
    future = _timeout_pool.submit(fn)
    try:
        result = future.result(timeout=timeout_sec)
        if result and not (isinstance(result, dict) and result.get("error")):
            cache_set(_response_cache, cache_key, result)
        return safe_jsonify(result or {})
    except concurrent.futures.TimeoutError:
        # Background: let the future finish and populate cache for next caller
        def _on_done(f):
            try:
                result = f.result()
                if result and not (isinstance(result, dict) and result.get("error")):
                    cache_set(_response_cache, cache_key, result)
            except Exception:
                pass
        future.add_done_callback(_on_done)
        return safe_jsonify({
            "error": "Request timed out after " + str(timeout_sec) + "s. Data is being cached in background \u2014 retry in 30s.",
            "_timeout": True,
        }, 504)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Health check ---


@app.route("/api/health")
def health():
    return safe_jsonify({"status": "ok"})


@app.route("/api/endpoints")
def api_endpoints():
    """List all registered API endpoints with methods"""
    endpoints = []
    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
        if rule.rule.startswith("/api/"):
            methods = sorted(rule.methods - {"OPTIONS", "HEAD"})
            endpoints.append({
                "path": rule.rule,
                "methods": methods,
            })
    return safe_jsonify({"endpoints": endpoints})


@app.route("/api/browser-login-status")
def api_browser_login_status():
    try:
        result = yahoo_browser.is_session_valid()
        result["heartbeat"] = yahoo_browser.get_heartbeat_state()
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"valid": False, "reason": str(e)}, 500)


@app.route("/api/change-team-name", methods=["POST"])
def api_change_team_name():
    try:
        data = request.get_json(force=True) if request.is_json else request.form
        new_name = data.get("new_name", "")
        if not new_name:
            return safe_jsonify({"error": "Missing new_name"}, 400)
        result = yahoo_browser.change_team_name(new_name)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/change-team-logo", methods=["POST"])
def api_change_team_logo():
    try:
        data = request.get_json(force=True) if request.is_json else request.form
        image_path = data.get("image_path", "")
        if not image_path:
            return safe_jsonify({"error": "Missing image_path"}, 400)
        result = yahoo_browser.change_team_logo(image_path)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Yahoo Fantasy (yahoo-fantasy.py) ---
# TS tools call: /api/roster, /api/free-agents, /api/standings, etc.


@app.route("/api/roster")
def api_roster():
    return _cached_endpoint("roster",
        lambda: yahoo_fantasy.cmd_roster([], as_json=True), 15)


@app.route("/api/free-agents")
def api_free_agents():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "20")
        result = yahoo_fantasy.cmd_free_agents([pos_type, count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/standings")
def api_standings():
    return _cached_endpoint("standings",
        lambda: yahoo_fantasy.cmd_standings([], as_json=True), 60)


@app.route("/api/standings-detailed")
def api_standings_detailed():
    """Standings with per-team category stat values from current week matchups."""
    def _build():
        from shared import get_league
        sc, gm, lg = get_league()
        sid_map = lg.stats_id_map

        # Get stat categories to know which stats are scoring categories
        cats = lg.stat_categories()
        scoring_names = [c.get("display_name", "") for c in cats]

        # Build reverse map: stat_id -> display_name (only for scoring cats)
        scoring_set = set(scoring_names)
        id_to_name = {str(sid): name for sid, name in sid_map.items() if name in scoring_set}

        # Get standings for W-L and rank
        standings_raw = yahoo_fantasy.cmd_standings([], as_json=True)
        standings_list = standings_raw.get("standings", [])
        team_map = {}
        for s in standings_list:
            team_map[s.get("team_key", "")] = s

        # Get current week matchups for team stats
        raw = lg.matchups()
        fc = raw.get("fantasy_content", {}).get("league", [{}])
        scoreboard = {}
        for block in fc:
            if isinstance(block, dict) and "scoreboard" in block:
                scoreboard = block.get("scoreboard", {})
                break

        # Extract all team stats from matchups
        team_stats = {}
        matchups_data = scoreboard.get("0", {}).get("matchups", {})
        for i in range(int(matchups_data.get("count", 20))):
            matchup_wrapper = matchups_data.get(str(i))
            if matchup_wrapper is None:
                break
            matchup = matchup_wrapper.get("matchup", {})
            teams_block = matchup.get("0", {}).get("teams", {})
            for ti in range(2):
                team_entry = teams_block.get(str(ti))
                if team_entry is None:
                    break
                team_info = team_entry.get("team", [])
                team_key = ""
                stats = {}
                for block in team_info:
                    if isinstance(block, list):
                        for item in block:
                            if isinstance(item, dict) and "team_key" in item:
                                team_key = item.get("team_key", "")
                    if isinstance(block, dict) and "team_stats" in block:
                        raw_stats = block.get("team_stats", {}).get("stats", [])
                        for stat_entry in raw_stats:
                            stat = stat_entry.get("stat", {})
                            sid = str(stat.get("stat_id", ""))
                            val = stat.get("value", "0")
                            if sid in id_to_name:
                                name = id_to_name[sid]
                                try:
                                    stats[name] = float(val) if val != "-" else 0
                                except (ValueError, TypeError):
                                    stats[name] = 0
                if team_key:
                    team_stats[team_key] = stats

        # Merge standings with stats
        result = []
        for s in standings_list:
            tk = s.get("team_key", "")
            entry = dict(s)
            entry["stats"] = team_stats.get(tk, {})
            result.append(entry)

        return {"standings": result, "categories": scoring_names}
    return _cached_endpoint("standings-detailed", _build, 120)


@app.route("/api/info")
def api_info():
    try:
        result = yahoo_fantasy.cmd_info([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/league-context")
def api_league_context():
    try:
        from shared import get_league_settings, get_league_context, normalize_team_details
        settings = get_league_settings()
        result = {
            "waiver_type": settings.get("waiver_type", "unknown"),
            "uses_faab": settings.get("uses_faab", False),
            "scoring_type": settings.get("scoring_type", ""),
            "stat_categories": settings.get("stat_categories", []),
            "roster_positions": settings.get("roster_positions", []),
            "num_teams": settings.get("num_teams", 0),
            "max_weekly_adds": settings.get("max_weekly_adds", 0),
        }
        # Include FAAB balance only for FAAB leagues
        if settings.get("uses_faab"):
            try:
                sc, gm, lg, team = get_league_context()
                d = normalize_team_details(team)
                fb = d.get("faab_balance")
                if fb is not None:
                    result["faab_balance"] = fb
            except Exception as e:
                print("Warning: could not fetch FAAB balance for league-context: " + str(e))
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/search")
def api_search():
    try:
        # TS tool sends "name" param
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        result = yahoo_fantasy.cmd_search([name], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/add", methods=["POST"])
def api_add():
    try:
        # TS tool sends JSON body: { player_id: "..." }
        data = request.get_json(silent=True) or {}
        player_id = data.get("player_id", "")
        if not player_id:
            player_id = request.args.get("player_id", "")
        if not player_id:
            return safe_jsonify({"error": "Missing player_id"}, 400)
        result = yahoo_fantasy.cmd_add([player_id], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/drop", methods=["POST"])
def api_drop():
    try:
        data = request.get_json(silent=True) or {}
        player_id = data.get("player_id", "")
        if not player_id:
            player_id = request.args.get("player_id", "")
        if not player_id:
            return safe_jsonify({"error": "Missing player_id"}, 400)
        result = yahoo_fantasy.cmd_drop([player_id], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/swap", methods=["POST"])
def api_swap():
    try:
        data = request.get_json(silent=True) or {}
        add_id = data.get("add_id", "")
        drop_id = data.get("drop_id", "")
        if not add_id:
            add_id = request.args.get("add_id", "")
        if not drop_id:
            drop_id = request.args.get("drop_id", "")
        if not add_id or not drop_id:
            return safe_jsonify({"error": "Missing add_id and/or drop_id"}, 400)
        result = yahoo_fantasy.cmd_swap([add_id, drop_id], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/matchups")
def api_matchups():
    try:
        args = []
        week = request.args.get("week", "")
        if week:
            args.append(week)
        result = yahoo_fantasy.cmd_matchups(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/scoreboard")
def api_scoreboard():
    try:
        args = []
        week = request.args.get("week", "")
        if week:
            args.append(week)
        result = yahoo_fantasy.cmd_scoreboard(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/transactions")
def api_transactions():
    tx_type = request.args.get("type", "")
    count = request.args.get("count", "")
    cache_key = "transactions:" + tx_type + ":" + count
    args = [tx_type or "", count or "25"]
    return _cached_endpoint(cache_key,
        lambda: yahoo_fantasy.cmd_transactions(args, as_json=True), 60)


@app.route("/api/stat-categories")
def api_stat_categories():
    try:
        result = yahoo_fantasy.cmd_stat_categories([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/transaction-trends")
def api_transaction_trends():
    try:
        result = yahoo_fantasy.cmd_transaction_trends([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/matchup-detail")
def api_matchup_detail():
    return _cached_endpoint("matchup-detail",
        lambda: yahoo_fantasy.cmd_matchup_detail([], as_json=True), 60)


# --- Draft Assistant (draft-assistant.py) ---
# TS tools call: /api/draft-status, /api/draft-recommend, /api/draft-cheatsheet, /api/best-available


@app.route("/api/draft-status")
def api_draft_status():
    try:
        da = draft_assistant.DraftAssistant()
        result = da.status(as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/draft-recommend")
def api_draft_recommend():
    try:
        da = draft_assistant.DraftAssistant()
        result = da.recommend(as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/draft-cheatsheet")
def api_draft_cheatsheet():
    try:
        result = draft_assistant.cmd_cheatsheet([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/best-available")
def api_best_available():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "25")
        result = draft_assistant.cmd_best_available([pos_type, count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Valuations (valuations.py) ---
# TS tools call: /api/rankings, /api/compare, /api/value


@app.route("/api/rankings")
def api_rankings():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "25")
        result = valuations.cmd_rankings([pos_type, count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/compare")
def api_compare():
    try:
        # TS tool sends player1 and player2 params
        player1 = request.args.get("player1", "")
        player2 = request.args.get("player2", "")
        if not player1 or not player2:
            return safe_jsonify({"error": "Missing player1 and/or player2 parameters"}, 400)
        result = valuations.cmd_compare([player1, player2], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/value")
def api_value():
    try:
        # TS tool sends "player_name" param
        name = request.args.get("player_name", "")
        if not name:
            name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing player_name parameter"}, 400)
        result = valuations.cmd_value([name], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/projections-update", methods=["POST"])
def api_projections_update():
    try:
        data = request.get_json(silent=True) or {}
        proj_type = data.get("proj_type", "steamer")
        result = valuations.ensure_projections(proj_type=proj_type, force=True)
        return safe_jsonify({"status": "ok", "result": result})
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/projection-disagreements", methods=["GET"])
def api_projection_disagreements():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = int(request.args.get("count", "20"))
        stats_type = "bat" if pos_type == "B" else "pit"
        result = valuations.compute_projection_disagreements(stats_type=stats_type, count=count)
        return safe_jsonify({"pos_type": pos_type, "disagreements": result})
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/zscore-shifts", methods=["GET"])
def api_zscore_shifts():
    try:
        count = int(request.args.get("count", "25"))
        result = valuations.compute_zscore_shifts(count=count)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/park-factors", methods=["GET"])
def api_park_factors():
    try:
        factors = []
        for team, factor in sorted(valuations.PARK_FACTORS.items()):
            factors.append({"team": team, "factor": factor})
        return safe_jsonify({"park_factors": factors})
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Season Manager (season-manager.py) ---
# TS tools call: /api/lineup-optimize, /api/category-check, etc.


@app.route("/api/lineup-optimize")
def api_lineup_optimize():
    try:
        args = []
        apply_flag = request.args.get("apply", "false")
        if apply_flag.lower() == "true":
            args.append("--apply")
        result = season_manager.cmd_lineup_optimize(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/category-check")
def api_category_check():
    return _cached_endpoint("category-check",
        lambda: season_manager.cmd_category_check([], as_json=True), 120)


@app.route("/api/injury-report")
def api_injury_report():
    return _cached_endpoint("injury-report",
        lambda: season_manager.cmd_injury_report([], as_json=True), 120)


@app.route("/api/waiver-analyze")
def api_waiver_analyze():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "15")
        result = season_manager.cmd_waiver_analyze([pos_type, count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/streaming")
def api_streaming():
    try:
        args = []
        week = request.args.get("week", "")
        if week:
            args.append(week)
        result = season_manager.cmd_streaming(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/trade-eval", methods=["POST"])
def api_trade_eval():
    try:
        # TS tool sends JSON body: { give_ids: "...", get_ids: "..." }
        data = request.get_json(silent=True) or {}
        give_ids = data.get("give_ids", "")
        get_ids = data.get("get_ids", "")
        if not give_ids or not get_ids:
            return safe_jsonify({"error": "Missing give_ids and/or get_ids"}, 400)
        result = season_manager.cmd_trade_eval([give_ids, get_ids], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/category-simulate")
def api_category_simulate():
    try:
        add_name = request.args.get("add_name", "")
        drop_name = request.args.get("drop_name", "")
        if not add_name:
            return safe_jsonify({"error": "Missing add_name parameter"}, 400)
        args = [add_name]
        if drop_name:
            args.append(drop_name)
        result = season_manager.cmd_category_simulate(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/scout-opponent")
def api_scout_opponent():
    return _cached_endpoint("scout-opponent",
        lambda: season_manager.cmd_scout_opponent([], as_json=True), 300)


@app.route("/api/matchup-strategy")
def api_matchup_strategy():
    return _cached_endpoint("matchup-strategy",
        lambda: season_manager.cmd_matchup_strategy([], as_json=True), 300)


@app.route("/api/daily-update")
def api_daily_update():
    try:
        result = season_manager.cmd_daily_update([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/pending-trades")
def api_pending_trades():
    try:
        result = season_manager.cmd_pending_trades([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/propose-trade", methods=["POST"])
def api_propose_trade():
    try:
        data = request.get_json(silent=True) or {}
        their_team_key = data.get("their_team_key", "")
        your_player_ids = data.get("your_player_ids", "")
        their_player_ids = data.get("their_player_ids", "")
        note = data.get("note", "")
        if not their_team_key or not your_player_ids or not their_player_ids:
            return safe_jsonify(
                {
                    "error": "Missing their_team_key, your_player_ids, or their_player_ids"
                }
            ), 400
        args = [their_team_key, your_player_ids, their_player_ids]
        if note:
            args.append(note)
        result = season_manager.cmd_propose_trade(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/accept-trade", methods=["POST"])
def api_accept_trade():
    try:
        data = request.get_json(silent=True) or {}
        transaction_key = data.get("transaction_key", "")
        note = data.get("note", "")
        if not transaction_key:
            return safe_jsonify({"error": "Missing transaction_key"}, 400)
        args = [transaction_key]
        if note:
            args.append(note)
        result = season_manager.cmd_accept_trade(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/reject-trade", methods=["POST"])
def api_reject_trade():
    try:
        data = request.get_json(silent=True) or {}
        transaction_key = data.get("transaction_key", "")
        note = data.get("note", "")
        if not transaction_key:
            return safe_jsonify({"error": "Missing transaction_key"}, 400)
        args = [transaction_key]
        if note:
            args.append(note)
        result = season_manager.cmd_reject_trade(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/set-lineup", methods=["POST"])
def api_set_lineup():
    try:
        data = request.get_json(silent=True) or {}
        moves = data.get("moves", [])
        if not moves:
            return safe_jsonify({"error": "Missing moves array"}, 400)
        # Convert moves to "player_id:position" arg format
        args = []
        for m in moves:
            pid = m.get("player_id", "")
            pos = m.get("position", "")
            if pid and pos:
                args.append(str(pid) + ":" + str(pos))
        if not args:
            return safe_jsonify({"error": "No valid moves provided"}, 400)
        result = season_manager.cmd_set_lineup(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Waiver Claims (yahoo-fantasy.py) ---


@app.route("/api/waiver-claim", methods=["POST"])
def api_waiver_claim():
    try:
        data = request.get_json(silent=True) or {}
        player_id = data.get("player_id", "")
        if not player_id:
            return safe_jsonify({"error": "Missing player_id"}, 400)
        args = [player_id]
        faab = data.get("faab")
        if faab is not None:
            args.append(str(faab))
        result = yahoo_fantasy.cmd_waiver_claim(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/waiver-claim-swap", methods=["POST"])
def api_waiver_claim_swap():
    try:
        data = request.get_json(silent=True) or {}
        add_id = data.get("add_id", "")
        drop_id = data.get("drop_id", "")
        if not add_id or not drop_id:
            return safe_jsonify({"error": "Missing add_id and/or drop_id"}, 400)
        args = [add_id, drop_id]
        faab = data.get("faab")
        if faab is not None:
            args.append(str(faab))
        result = yahoo_fantasy.cmd_waiver_claim_swap(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Who Owns / League Pulse (yahoo-fantasy.py) ---


@app.route("/api/who-owns")
def api_who_owns():
    try:
        player_id = request.args.get("player_id", "")
        if not player_id:
            return safe_jsonify({"error": "Missing player_id parameter"}, 400)
        result = yahoo_fantasy.cmd_who_owns([player_id], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/percent-owned")
def api_percent_owned():
    try:
        ids = request.args.get("ids", "")
        if not ids:
            return safe_jsonify({"error": "Missing ids parameter (comma-separated player IDs)"}, 400)
        args = [pid.strip() for pid in ids.split(",") if pid.strip()]
        result = yahoo_fantasy.cmd_percent_owned(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/league-pulse")
def api_league_pulse():
    return _cached_endpoint("league-pulse",
        lambda: yahoo_fantasy.cmd_league_pulse([], as_json=True), 120)


# --- Phase 3: What's New & Trade Finder ---


@app.route("/api/whats-new")
def api_whats_new():
    try:
        result = season_manager.cmd_whats_new([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/trade-finder")
def api_trade_finder():
    try:
        target = request.args.get("target", "")
        timeout = int(request.args.get("timeout", "120"))
        args = [target] if target else []
        future = _timeout_pool.submit(season_manager.cmd_trade_finder, args, as_json=True)
        try:
            result = future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            return safe_jsonify({"error": "Trade finder timed out after " + str(timeout) + "s. Try with a specific target player name."}, 504)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Phase 4: Power Rankings, Week Planner, Season Pace ---


@app.route("/api/power-rankings")
def api_power_rankings():
    return _cached_endpoint("power-rankings",
        lambda: season_manager.cmd_power_rankings([], as_json=True), 300)


@app.route("/api/league-intel")
def api_league_intel():
    return _cached_endpoint("league-intel",
        lambda: season_manager.cmd_league_intel([], as_json=True), 300)


@app.route("/api/week-planner")
def api_week_planner():
    try:
        args = []
        week = request.args.get("week", "")
        if week:
            args.append(week)
        result = season_manager.cmd_week_planner(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/season-pace")
def api_season_pace():
    return _cached_endpoint("season-pace",
        lambda: season_manager.cmd_season_pace([], as_json=True), 120)


# --- Phase 5: Closer Monitor ---


@app.route("/api/closer-monitor")
def api_closer_monitor():
    return _cached_endpoint("closer-monitor",
        lambda: season_manager.cmd_closer_monitor([], as_json=True), 300)


# --- Phase 5: Pitcher Matchup ---


@app.route("/api/pitcher-matchup")
def api_pitcher_matchup():
    try:
        week = request.args.get("week", "")
        args = [week] if week else []
        result = season_manager.cmd_pitcher_matchup(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- New Yahoo API Tools ---


@app.route("/api/player-stats")
def api_player_stats():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        period = request.args.get("period", "season")
        week = request.args.get("week", "")
        date_str = request.args.get("date", "")
        args = [name, period]
        if period == "week" and week:
            args.append(week)
        elif period == "date" and date_str:
            args.append(date_str)
        result = yahoo_fantasy.cmd_player_stats(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/roster-stats")
def api_roster_stats():
    try:
        period = request.args.get("period", "season")
        week = request.args.get("week", "")
        team_key = request.args.get("team_key", "")
        args = []
        if period:
            args.append("--period=" + period)
        if week:
            args.append("--week=" + week)
        if team_key:
            args.append("--team=" + team_key)
        result = season_manager.cmd_roster_stats(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/faab-recommend")
def api_faab_recommend():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "name parameter required"}, 400)
        result = season_manager.cmd_faab_recommend([name], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/ownership-trends")
def api_ownership_trends():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "name parameter required"}, 400)
        result = season_manager.cmd_ownership_trends([name], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/category-trends")
def api_category_trends():
    try:
        result = season_manager.cmd_category_trends([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/punt-advisor")
def api_punt_advisor():
    try:
        result = season_manager.cmd_punt_advisor([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/il-stash-advisor")
def api_il_stash_advisor():
    try:
        result = season_manager.cmd_il_stash_advisor([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/playoff-planner")
def api_playoff_planner():
    try:
        result = season_manager.cmd_playoff_planner([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/optimal-moves")
def api_optimal_moves():
    try:
        count = request.args.get("count", "5")
        result = season_manager.cmd_optimal_moves([count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/weekly-narrative")
def api_weekly_narrative():
    try:
        result = season_manager.cmd_weekly_narrative([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/roster-history")
def api_roster_history():
    try:
        week = request.args.get("week", "")
        date_str = request.args.get("date", "")
        team_key = request.args.get("team_key", "")
        lookup = week or date_str
        if not lookup:
            return safe_jsonify({"error": "Missing week or date parameter"}, 400)
        args = [lookup]
        if team_key:
            args.append(team_key)
        result = yahoo_fantasy.cmd_roster_history(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/waivers")
def api_waivers():
    try:
        result = yahoo_fantasy.cmd_waivers([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/taken-players")
def api_taken_players():
    try:
        position = request.args.get("position", "")
        args = [position] if position else []
        result = yahoo_fantasy.cmd_taken_players(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/player-list")
def api_player_list():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "50")
        status = request.args.get("status", "FA")
        result = yahoo_fantasy.cmd_player_list([pos_type, count, status], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/positional-ranks")
def api_positional_ranks():
    try:
        result = yahoo_fantasy.cmd_positional_ranks([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- MLB Data (mlb-data.py) ---
# TS tools call: /api/mlb/teams, /api/mlb/roster, etc. (these already match)


@app.route("/api/mlb/teams")
def api_mlb_teams():
    try:
        result = mlb_data.cmd_teams([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/mlb/roster")
def api_mlb_roster():
    try:
        team = request.args.get("team", "")
        if not team:
            return safe_jsonify({"error": "Missing team parameter"}, 400)
        result = mlb_data.cmd_roster([team], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/mlb/player")
def api_mlb_player():
    try:
        player_id = request.args.get("player_id", "")
        if not player_id:
            return safe_jsonify({"error": "Missing player_id parameter"}, 400)
        result = mlb_data.cmd_player([player_id], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/mlb/stats")
def api_mlb_stats():
    try:
        player_id = request.args.get("player_id", "")
        if not player_id:
            return safe_jsonify({"error": "Missing player_id parameter"}, 400)
        args = [player_id]
        season = request.args.get("season", "")
        if season:
            args.append(season)
        result = mlb_data.cmd_stats(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/mlb/injuries")
def api_mlb_injuries():
    try:
        result = mlb_data.cmd_injuries([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/mlb/standings")
def api_mlb_standings():
    try:
        result = mlb_data.cmd_standings([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/mlb/draft")
def api_mlb_draft():
    try:
        year = request.args.get("year", "")
        args = [year] if year else []
        result = mlb_data.cmd_draft(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/mlb/schedule")
def api_mlb_schedule():
    try:
        args = []
        date_arg = request.args.get("date", "")
        if date_arg:
            args.append(date_arg)
        result = mlb_data.cmd_schedule(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/mlb/weather")
def api_mlb_weather():
    try:
        game_date = request.args.get("date", "")
        args = [game_date] if game_date else []
        result = mlb_data.cmd_weather(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- History (history.py) ---
# TS tools call: /api/league-history, /api/record-book, /api/past-standings, etc.


@app.route("/api/league-history")
def api_league_history():
    try:
        result = history.cmd_league_history([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/record-book")
def api_record_book():
    try:
        result = history.cmd_record_book([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/past-standings")
def api_past_standings():
    try:
        year = request.args.get("year", "")
        if not year:
            return safe_jsonify({"error": "Missing year parameter"}, 400)
        result = history.cmd_past_standings([year], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/past-draft")
def api_past_draft():
    try:
        year = request.args.get("year", "")
        if not year:
            return safe_jsonify({"error": "Missing year parameter"}, 400)
        args = [year]
        count = request.args.get("count", "")
        if count:
            args.append(count)
        result = history.cmd_past_draft(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/past-teams")
def api_past_teams():
    try:
        year = request.args.get("year", "")
        if not year:
            return safe_jsonify({"error": "Missing year parameter"}, 400)
        result = history.cmd_past_teams([year], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/past-trades")
def api_past_trades():
    try:
        year = request.args.get("year", "")
        if not year:
            return safe_jsonify({"error": "Missing year parameter"}, 400)
        args = [year]
        count = request.args.get("count", "")
        if count:
            args.append(count)
        result = history.cmd_past_trades(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/past-matchup")
def api_past_matchup():
    try:
        year = request.args.get("year", "")
        week = request.args.get("week", "")
        if not year or not week:
            return safe_jsonify({"error": "Missing year and/or week parameters"}, 400)
        result = history.cmd_past_matchup([year, week], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Intel (intel.py) ---


@app.route("/api/intel/player")
def api_intel_player():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        result = intel.cmd_player_report([name], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/breakouts")
def api_intel_breakouts():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "15")
        result = intel.cmd_breakouts([pos_type, count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/busts")
def api_intel_busts():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "15")
        result = intel.cmd_busts([pos_type, count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/reddit")
def api_intel_reddit():
    try:
        result = intel.cmd_reddit_buzz([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/trending")
def api_intel_trending():
    try:
        result = intel.cmd_trending([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/prospects")
def api_intel_prospects():
    try:
        result = intel.cmd_prospect_watch([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/transactions")
def api_intel_transactions():
    try:
        days = request.args.get("days", "7")
        result = intel.cmd_transactions([days], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/player-intel")
def api_player_intel():
    """Unified qualitative intelligence for a single player."""
    player = request.args.get("player", "")
    if not player:
        return safe_jsonify({"error": "player parameter required"}, 400)

    result = {"player": player}

    # 1. News context (headlines, transactions, flags, injury severity, reddit)
    try:
        from news import get_player_context
        ctx = get_player_context(player)
        result["news_context"] = ctx
    except Exception as e:
        result["news_context"] = {"error": str(e)}

    # 2. Statcast + game log trends (hot/cold, splits) + percentiles + discipline
    try:
        from intel import batch_intel
        intel_data = batch_intel([player], include=["statcast", "trends", "percentiles", "discipline"])
        player_intel = intel_data.get(player, {})
        result["statcast"] = player_intel.get("statcast", {})
        result["trends"] = player_intel.get("trends", {})
        result["percentiles"] = player_intel.get("percentiles", {})
        result["discipline"] = player_intel.get("discipline", {})
    except Exception as e:
        result["statcast"] = {"error": str(e)}
        result["trends"] = {"error": str(e)}

    # 3. Google News sentiment
    try:
        from shared import search_player_news
        news_search = search_player_news(player, max_results=5)
        result["news_sentiment"] = news_search
    except Exception as e:
        result["news_sentiment"] = {"error": str(e)}

    # 4. Yahoo add/drop trends
    try:
        from shared import get_trend_lookup
        trends_lookup = get_trend_lookup()
        trend = trends_lookup.get(player)
        result["yahoo_trend"] = trend or {"direction": "none", "note": "Not in top adds/drops"}
    except Exception as e:
        result["yahoo_trend"] = {"error": str(e)}

    # 5. Role change detection
    try:
        from shared import detect_role_change
        role = detect_role_change(player)
        result["role_change"] = role
    except Exception as e:
        result["role_change"] = {"error": str(e)}

    # 6. Build summary status
    status = "active"
    status_reason = ""
    flags = result.get("news_context", {}).get("flags", [])
    for flag in flags:
        if flag.get("type") == "DEALBREAKER":
            status = "dealbreaker"
            status_reason = flag.get("message", "")
            break
        elif flag.get("type") == "WARNING" and status == "active":
            status = "warning"
            status_reason = flag.get("message", "")

    hot_cold = result.get("trends", {}).get("status", "neutral")
    if status == "active" and hot_cold in ("hot", "warm"):
        status = "trending_up"
        status_reason = "Recent performance: " + hot_cold
    elif status == "active" and hot_cold in ("cold", "ice"):
        status = "trending_down"
        status_reason = "Recent performance: " + hot_cold

    result["status"] = status
    result["status_reason"] = status_reason
    result["injury_severity"] = result.get("news_context", {}).get("injury_severity")

    # 7. Z-score valuation and league rank
    try:
        from valuations import get_player_zscore
        zdata = get_player_zscore(player)
        if zdata:
            result["valuation"] = zdata
    except Exception as e:
        result["valuation"] = {"error": str(e)}

    return safe_jsonify(result)


@app.route("/api/intel/batch")
def api_intel_batch():
    try:
        names = request.args.get("names", "")
        if not names:
            return safe_jsonify({"error": "Missing names parameter (comma-separated)"}, 400)
        name_list = [n.strip() for n in names.split(",") if n.strip()]
        include_str = request.args.get("include", "statcast")
        include = [s.strip() for s in include_str.split(",") if s.strip()]
        result = intel.batch_intel(name_list, include=include)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/statcast-history")
def api_intel_statcast_history():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        days = request.args.get("days", "30")
        result = intel.cmd_statcast_compare([name, days], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Next-Gen Analytics ---

@app.route("/api/valuations/projection-confidence")
def api_projection_confidence():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        result = valuations.compute_projection_confidence(name)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/statcast-leaders")
def api_statcast_leaders():
    try:
        metric = request.args.get("metric", "exit_velocity")
        player_type = request.args.get("player_type", "batter")
        count = int(request.args.get("count", "20"))
        result = intel.statcast_leaderboard(metric, player_type=player_type, count=count)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/bat-tracking-breakouts")
def api_bat_tracking_breakouts():
    try:
        count = request.args.get("count", "20")
        result = intel.cmd_bat_tracking_breakouts([count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/intel/pitch-mix-breakouts")
def api_pitch_mix_breakouts():
    try:
        count = request.args.get("count", "20")
        result = intel.cmd_pitch_mix_breakouts([count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/travel-fatigue")
def api_travel_fatigue():
    try:
        game_date = request.args.get("date", "")
        args = [game_date] if game_date else []
        result = season_manager.cmd_travel_fatigue(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Prospect Intelligence ---

@app.route("/api/prospects/report")
def api_prospect_report():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        result = prospects.cmd_prospect_report([name], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/rankings")
def api_prospect_rankings():
    try:
        args = []
        position = request.args.get("position", "")
        if position:
            args.append("--position=" + position)
        level = request.args.get("level", "")
        if level:
            args.append("--level=" + level)
        team = request.args.get("team", "")
        if team:
            args.append("--team=" + team)
        count = request.args.get("count", "")
        if count:
            args.append("--count=" + count)
        result = prospects.cmd_prospect_rankings(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/callup-wire")
def api_prospect_callup_wire():
    try:
        days = request.args.get("days", "14")
        result = prospects.cmd_callup_wire([days], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/stash-advisor")
def api_prospect_stash_advisor():
    try:
        count = request.args.get("count", "5")
        result = prospects.cmd_stash_advisor([count], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/compare")
def api_prospect_compare():
    try:
        p1 = request.args.get("player1", "")
        p2 = request.args.get("player2", "")
        if not p1 or not p2:
            return safe_jsonify({"error": "Missing player1 and/or player2 parameters"}, 400)
        result = prospects.cmd_prospect_compare([p1, p2], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/buzz")
def api_prospect_buzz():
    try:
        result = prospects.cmd_prospect_buzz([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/eta-tracker")
def api_prospect_eta_tracker():
    try:
        result = prospects.cmd_eta_tracker([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/trade-targets")
def api_prospect_trade_targets():
    try:
        result = prospects.cmd_prospect_trade_targets([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/watch-add")
def api_prospect_watch_add():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        action = request.args.get("action", "add")
        args = [name]
        if action == "remove":
            args.append("remove")
        result = prospects.cmd_prospect_watch_add(args, as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/prospects/news")
def api_prospect_news():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        days = int(request.args.get("days", "7"))

        # Load prospect DB for name matching
        prospect_db = prospects._load_prospect_rankings()

        # Fetch and analyze news
        news_report = prospect_news.get_prospect_news(
            name, prospect_db, days=days)

        # Store signals for future reference (signals carry all needed metadata)
        prospect_news.store_signals(
            name,
            news_report.get("active_signals", []),
            [])

        # Get stat-only probability (skip_news avoids redundant news overlay)
        stat_prob = 30.0
        try:
            from mlb_id_cache import get_mlb_id
            from shared import normalize_player_name
            pid = get_mlb_id(name)
            if pid:
                rk = prospects._get_rank_lookup().get(
                    normalize_player_name(name))
                eval_data = prospects._evaluate_prospect_by_id(
                    pid, rk, skip_news=True)
                if eval_data:
                    stat_prob = eval_data.get("callup", {}).get(
                        "probability", 30.0)
        except Exception:
            pass

        # Compute ensemble
        active_signals = news_report.get("active_signals", [])
        ensemble = {}
        if active_signals:
            ensemble = prospect_news.compute_ensemble_callup_probability(
                stat_based_probability=stat_prob,
                news_signals=active_signals,
            )

        result = {
            "prospect_name": news_report.get("prospect_name", name),
            "articles_found": news_report.get("articles_found", 0),
            "signals_extracted": news_report.get("signals_extracted", 0),
            "article_summaries": news_report.get("article_summaries", []),
            "overall_sentiment": news_report.get("overall_sentiment", {}),
        }

        if ensemble:
            result["ensemble_probability"] = ensemble.get("ensemble_probability")
            result["stat_based_probability"] = ensemble.get("stat_based_probability")
            result["news_adjusted_probability"] = ensemble.get("news_adjusted_probability")
            result["news_delta"] = ensemble.get("news_delta")
            result["news_weight_used"] = ensemble.get("news_weight_used")
            result["signal_contributions"] = ensemble.get("signal_contributions", [])
            result["has_strong_signal"] = ensemble.get("has_strong_signal", False)

        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Workflow endpoints (aggregate multiple calls for token efficiency) ---


def _safe_call(fn, args=None):
    """Call a cmd_* function with as_json=True, returning error dict on failure"""
    try:
        return fn(args or [], as_json=True)
    except Exception as e:
        return {"_error": str(e)}


def _synthesize_morning_actions(injury, lineup, whats_new, waiver_b, waiver_p):
    """Build priority-ranked action items from morning briefing data"""
    actions = []

    # Critical: injured players in active slots
    for p in (injury or {}).get("injured_active", []):
        actions.append({
            "priority": 1,
            "type": "injury",
            "message": str(p.get("name", "?")) + " (" + str(p.get("status", ""))
                + ") injured in active slot - move to IL or bench",
            "player_id": str(p.get("player_id", "")),
        })

    # Lineup: off-day starters or bench with games
    off_day = (lineup or {}).get("active_off_day", [])
    bench_playing = (lineup or {}).get("bench_playing", [])
    if off_day or bench_playing:
        msg = str(len(off_day)) + " starter(s) off today"
        if bench_playing:
            msg += ", " + str(len(bench_playing)) + " bench player(s) have games"
        actions.append({
            "priority": 2,
            "type": "lineup",
            "message": msg + " - run yahoo_auto_lineup",
        })

    # Pending trades need attention
    for t in (whats_new or {}).get("pending_trades", []):
        actions.append({
            "priority": 2,
            "type": "trade",
            "message": "Pending trade from " + str(t.get("trader_team_name", "?"))
                + " - review and respond",
            "transaction_key": str(t.get("transaction_key", "")),
        })

    # Waiver opportunities: top picks
    for label, waiver in [("batter", waiver_b), ("pitcher", waiver_p)]:
        recs = (waiver or {}).get("recommendations", [])
        if recs:
            top = recs[0]
            tier = top.get("tier", "")
            helps = top.get("helps_categories", [])
            desc = str(top.get("name", "?"))
            if top.get("positions"):
                desc += " (" + str(top.get("positions")) + ")"
            if tier:
                desc += " [" + tier + "]"
            if helps:
                desc += " — improves " + ", ".join(helps)
            actions.append({
                "priority": 3,
                "type": "waiver",
                "message": "Top " + label + " pickup: " + desc,
                "player_id": str(top.get("pid", "")),
            })

    # Healthy players stuck on IL
    for p in (injury or {}).get("healthy_il", []):
        actions.append({
            "priority": 3,
            "type": "il_activation",
            "message": str(p.get("name", "?"))
                + " on IL with no injury status - may be activatable",
            "player_id": str(p.get("player_id", "")),
        })

    actions.sort(key=lambda a: a.get("priority", 99))
    return actions


def _briefing_league_context():
    """Fetch edit_date, roster_context, and season_context in one shot (shares league conn)."""
    from news import get_player_context
    result = {"edit_date": None, "roster_context": [], "season_context": {}}
    try:
        _sc, _gm, _lg = yahoo_fantasy.get_league()
        result["edit_date"] = str(_lg.edit_date())
    except Exception:
        return result

    # Season phase context
    try:
        result["season_context"] = season_manager._get_season_context(_lg)
    except Exception as e:
        result["season_context"] = {"phase": "midseason", "phase_note": "", "week": 1}
        print("Warning: season context failed: " + str(e))

    # Roster player context — parallel per-player news/injuries/streaks
    try:
        _team2 = _lg.to_team(yahoo_fantasy.TEAM_ID)
        _roster2 = _team2.roster()
        players_with_names = [(p, p.get("name", "")) for p in _roster2 if p.get("name", "")]
        ctx_futures = {name: _workflow_pool.submit(get_player_context, name) for _, name in players_with_names}
        _NA_EXPECTED = {"optioned", "sent to minors", "minor league", "assigned to"}
        roster_context = []
        for p, name in players_with_names:
            try:
                ctx = ctx_futures[name].result(timeout=5)
            except Exception:
                continue
            if ctx.get("flags") or ctx.get("injury_severity"):
                sel_pos = p.get("selected_position", "")
                is_na = (sel_pos if isinstance(sel_pos, str) else sel_pos.get("position", "")) == "NA"
                flags = ctx.get("flags", [])
                if is_na and flags:
                    flags = [f for f in flags
                             if not any(kw in f.get("message", "").lower() for kw in _NA_EXPECTED)]
                if not flags and not ctx.get("injury_severity"):
                    continue
                entry = {"name": name, "status": p.get("status", "")}
                if flags:
                    entry["flags"] = flags
                if ctx.get("injury_severity"):
                    entry["injury_severity"] = ctx.get("injury_severity")
                if ctx.get("headlines"):
                    entry["latest_headline"] = ctx.get("headlines", [{}])[0].get("title", "")
                reddit = ctx.get("reddit", {})
                if reddit.get("mentions", 0) >= 3:
                    entry["reddit"] = reddit
                roster_context.append(entry)
        result["roster_context"] = roster_context
    except Exception as e:
        print("Warning: roster context for morning briefing failed: " + str(e))

    return result


def _briefing_cat_trajectory():
    """Fetch category trajectory from stored history."""
    try:
        db = season_manager._get_db()
        return season_manager._get_category_trajectory(db)
    except Exception as e:
        print("Warning: category trajectory failed: " + str(e))
        return {}


def _run_briefing():
    import datetime
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

    # Run ALL sub-calls in parallel including league context and trajectory
    futures = {
        "injury": _workflow_pool.submit(_safe_call, season_manager.cmd_injury_report),
        "lineup": _workflow_pool.submit(_safe_call, season_manager.cmd_lineup_optimize),
        "matchup": _workflow_pool.submit(_safe_call, yahoo_fantasy.cmd_matchup_detail),
        "strategy": _workflow_pool.submit(_safe_call, season_manager.cmd_matchup_strategy),
        "whats_new": _workflow_pool.submit(_safe_call, season_manager.cmd_whats_new),
        "waiver_b": _workflow_pool.submit(_safe_call, season_manager.cmd_waiver_analyze, ["B", "5"]),
        "waiver_p": _workflow_pool.submit(_safe_call, season_manager.cmd_waiver_analyze, ["P", "5"]),
        "yesterday": _workflow_pool.submit(_safe_call, season_manager.cmd_roster_stats, ["--period=date", "--date=" + yesterday]),
        "competitors": _workflow_pool.submit(_safe_call, season_manager.cmd_competitor_tracker),
        "arms_race": _workflow_pool.submit(_safe_call, season_manager.cmd_category_arms_race),
        "watchlist": _workflow_pool.submit(_safe_call, season_manager.cmd_watchlist_check),
        "league_ctx": _workflow_pool.submit(_briefing_league_context),
        "cat_trajectory": _workflow_pool.submit(_briefing_cat_trajectory),
    }
    injury = _get_future(futures["injury"])
    lineup = _get_future(futures["lineup"])
    matchup = _get_future(futures["matchup"])
    strategy = _get_future(futures["strategy"])
    whats_new = _get_future(futures["whats_new"])
    waiver_b = _get_future(futures["waiver_b"])
    waiver_p = _get_future(futures["waiver_p"])
    yesterday_stats = _get_future(futures["yesterday"])
    competitors = _get_future(futures["competitors"])
    arms_race = _get_future(futures["arms_race"])
    watchlist = _get_future(futures["watchlist"])
    league_ctx = _get_future(futures["league_ctx"])
    cat_trajectory = _get_future(futures["cat_trajectory"])

    # Unpack league context (edit_date, roster_context, season_context)
    if isinstance(league_ctx, dict) and not league_ctx.get("_error"):
        edit_date = league_ctx.get("edit_date")
        roster_context = league_ctx.get("roster_context", [])
        season_ctx = league_ctx.get("season_context", {})
    else:
        edit_date = None
        roster_context = []
        season_ctx = {"phase": "midseason", "phase_note": "", "week": 1}

    if isinstance(cat_trajectory, dict) and cat_trajectory.get("_error"):
        cat_trajectory = {}

    action_items = _synthesize_morning_actions(
        injury, lineup, whats_new, waiver_b, waiver_p
    )

    # Add trajectory-based alerts to action items
    for cat_name, traj in cat_trajectory.items():
        if traj.get("alert"):
            action_items.append({
                "priority": 2,
                "type": "category_alert",
                "message": cat_name + " rank declining for "
                    + str(traj.get("weeks_declining", 0)) + " weeks ("
                    + str(traj.get("history", [{}])[0].get("rank", "?"))
                    + " -> " + str(traj.get("current_rank", "?"))
                    + "). Projected: " + str(traj.get("projected_rank", "?"))
                    + "th by season end. Target " + cat_name + " contributors.",
            })
    # Add competitor alerts to action items
    if competitors:
        for alert in (competitors.get("alerts") or []):
            action_items.append({
                "priority": 2,
                "type": "competitor_alert",
                "message": alert.get("message", ""),
            })
        for rec in (competitors.get("recommendations") or [])[:2]:
            action_items.append({
                "priority": 3,
                "type": "strategic_recommendation",
                "message": rec,
            })
        for inj in (competitors.get("rival_injuries") or [])[:3]:
            action_items.append({
                "priority": 3,
                "type": "rival_injury",
                "message": inj.get("rival", "") + " lost " + inj.get("player", "") + " (" + inj.get("status", "") + ", z=" + str(inj.get("z_score", 0)) + ") — exploit their weakness",
            })

    # Add watchlist alerts
    if watchlist:
        for alert in (watchlist.get("alerts") or []):
            action_items.append({
                "priority": 2,
                "type": "watchlist_alert",
                "message": alert.get("message", ""),
            })

    action_items.sort(key=lambda a: a.get("priority", 99))

    return {
        "action_items": action_items,
        "injury": injury,
        "lineup": lineup,
        "matchup": matchup,
        "strategy": strategy,
        "whats_new": whats_new,
        "waiver_batters": waiver_b,
        "waiver_pitchers": waiver_p,
        "edit_date": edit_date,
        "roster_context": roster_context,
        "yesterday": yesterday_stats,
        "season_context": season_ctx,
        "category_trajectory": cat_trajectory,
        "competitors": competitors,
        "category_arms_race": arms_race,
        "watchlist": watchlist,
    }


@app.route("/api/workflow/morning-briefing")
def workflow_morning_briefing():
    return _cached_endpoint("wf-morning-briefing", _run_briefing, 300, timeout_sec=45)


@app.route("/api/workflow/league-landscape")
def workflow_league_landscape():
    def _run():
        futures = {
            "standings": _workflow_pool.submit(_safe_call, yahoo_fantasy.cmd_standings),
            "pace": _workflow_pool.submit(_safe_call, season_manager.cmd_season_pace),
            "power": _workflow_pool.submit(_safe_call, season_manager.cmd_power_rankings),
            "pulse": _workflow_pool.submit(_safe_call, yahoo_fantasy.cmd_league_pulse),
            "transactions": _workflow_pool.submit(_safe_call, yahoo_fantasy.cmd_transactions, ["", "15"]),
            "trade_finder": _workflow_pool.submit(_safe_call, season_manager.cmd_trade_finder),
            "scoreboard": _workflow_pool.submit(_safe_call, yahoo_fantasy.cmd_scoreboard),
        }
        return {
            "standings": _get_future(futures["standings"]),
            "pace": _get_future(futures["pace"]),
            "power_rankings": _get_future(futures["power"]),
            "league_pulse": _get_future(futures["pulse"]),
            "transactions": _get_future(futures["transactions"]),
            "trade_finder": _get_future(futures["trade_finder"]),
            "scoreboard": _get_future(futures["scoreboard"]),
        }
    return _cached_endpoint("wf-landscape", _run, 600)


def _synthesize_roster_issues(injury, lineup, roster, busts):
    """Build severity-ranked roster issues"""
    issues = []

    # Critical: injured in active slots
    for p in (injury or {}).get("injured_active", []):
        issues.append({
            "severity": "critical",
            "type": "injury",
            "message": str(p.get("name", "?")) + " (" + str(p.get("status", ""))
                + ") injured in active slot",
            "fix": "Move to IL or bench",
            "player_id": str(p.get("player_id", "")),
        })

    # Warning: healthy players on IL
    for p in (injury or {}).get("healthy_il", []):
        issues.append({
            "severity": "warning",
            "type": "il_waste",
            "message": str(p.get("name", "?")) + " on IL with no injury status",
            "fix": "Activate to free IL slot",
            "player_id": str(p.get("player_id", "")),
        })

    # Warning: off-day starters
    for p in (lineup or {}).get("active_off_day", []):
        issues.append({
            "severity": "warning",
            "type": "off_day",
            "message": str(p.get("name", "?")) + " starting but has no game today",
            "fix": "Bench and start an active player",
        })

    # Info: bust candidates on roster
    roster_names = set()
    for p in (roster or {}).get("players", []):
        roster_names.add(str(p.get("name", "")).lower())
    for b in (busts or {}).get("candidates", []):
        if str(b.get("name", "")).lower() in roster_names:
            issues.append({
                "severity": "info",
                "type": "bust_risk",
                "message": str(b.get("name", "?"))
                    + " is a bust candidate (underperforming Statcast metrics)",
                "fix": "Consider replacing if better options available",
            })

    return issues


@app.route("/api/workflow/roster-health")
def workflow_roster_health():
    def _run():
        futures = {
            "injury": _workflow_pool.submit(_safe_call, season_manager.cmd_injury_report),
            "lineup": _workflow_pool.submit(_safe_call, season_manager.cmd_lineup_optimize),
            "roster": _workflow_pool.submit(_safe_call, yahoo_fantasy.cmd_roster),
            "busts": _workflow_pool.submit(_safe_call, intel.cmd_busts, ["B", "20"]),
        }
        injury = _get_future(futures["injury"])
        lineup = _get_future(futures["lineup"])
        roster = _get_future(futures["roster"])
        busts = _get_future(futures["busts"])
        issues = _synthesize_roster_issues(injury, lineup, roster, busts)
        return {
            "issues": issues,
            "injury": injury,
            "lineup": lineup,
            "roster": roster,
            "busts": busts,
        }
    return _cached_endpoint("wf-roster-hp", _run, 300)


def _synthesize_waiver_pairs(waiver_b, waiver_p, cat_check=None, recent_add_ids=None, recent_add_names=None):
    """Pair waiver recommendations with position type labels, filtering recently-taken players."""
    pairs = []
    filtered_taken = []
    taken_ids = recent_add_ids or set()
    taken_names = recent_add_names or set()

    # Fallback weak categories from cat_check when waiver source is empty
    fallback_weak = []
    if cat_check:
        fallback_weak = [str(c) for c in cat_check.get("weakest", [])]

    for label, waiver in [("B", waiver_b), ("P", waiver_p)]:
        for rec in (waiver or {}).get("recommendations", [])[:5]:
            name = str(rec.get("name", "?"))
            rec_pid = str(rec.get("pid", ""))

            # Skip players recently added by league rivals (ID match preferred, name fallback)
            if (rec_pid and rec_pid in taken_ids) or name.lower() in taken_names:
                filtered_taken.append(name)
                continue

            # Per-player category impact (preferred) vs team-level fallback
            per_player_helps = rec.get("helps_categories", [])
            if per_player_helps:
                weak_cats = per_player_helps
            else:
                raw_weak = (waiver or {}).get("weak_categories", [])
                if raw_weak:
                    weak_cats = [c.get("name", "") for c in raw_weak]
                else:
                    weak_cats = fallback_weak

            pair = {
                "add": {
                    "name": name,
                    "player_id": str(rec.get("pid", "")),
                    "positions": str(rec.get("positions", "")),
                    "score": rec.get("score", 0),
                    "percent_owned": rec.get("pct", 0),
                    "context_line": rec.get("context_line", ""),
                },
                "pos_type": label,
                "weak_categories": weak_cats,
            }
            pairs.append(pair)

    return pairs, filtered_taken


@app.route("/api/workflow/waiver-recommendations")
def workflow_waiver_recommendations():
    count = request.args.get("count", "5")
    def _run():
        futures = {
            "cat_check": _workflow_pool.submit(_safe_call, season_manager.cmd_category_check),
            "waiver_b": _workflow_pool.submit(_safe_call, season_manager.cmd_waiver_analyze, ["B", count]),
            "waiver_p": _workflow_pool.submit(_safe_call, season_manager.cmd_waiver_analyze, ["P", count]),
            "roster": _workflow_pool.submit(_safe_call, yahoo_fantasy.cmd_roster),
            "transactions": _workflow_pool.submit(_safe_call, yahoo_fantasy.cmd_transactions, ["", "25"]),
        }
        cat_check = _get_future(futures["cat_check"])
        waiver_b = _get_future(futures["waiver_b"])
        waiver_p = _get_future(futures["waiver_p"])
        roster = _get_future(futures["roster"])
        txns = _get_future(futures["transactions"])

        # Reconcile adds/drops: only filter players whose latest action was "add"
        latest_action = {}  # name -> (action, player_id)
        txns_list = (txns or {}).get("transactions", [])
        for tx in sorted(txns_list, key=lambda t: t.get("timestamp", "")):
            for p in tx.get("players", []):
                name = str(p.get("name", "")).lower()
                if name:
                    latest_action[name] = (p.get("action", ""), str(p.get("player_id", "")))
        recent_add_ids = set()
        recent_add_names = set()
        for name, (action, pid) in latest_action.items():
            if action == "add":
                recent_add_names.add(name)
                if pid:
                    recent_add_ids.add(pid)

        pairs, filtered_taken = _synthesize_waiver_pairs(waiver_b, waiver_p, cat_check=cat_check, recent_add_ids=recent_add_ids, recent_add_names=recent_add_names)
        return {
            "pairs": pairs,
            "filtered_taken": filtered_taken,
            "category_check": cat_check,
            "waiver_batters": waiver_b,
            "waiver_pitchers": waiver_p,
            "roster": roster,
        }
    return _cached_endpoint("wf-waiver-recs-" + count, _run, 300)


def _compute_positional_impact(roster_players, get_players, give_players):
    """Compare incoming players to current roster starters for positional context."""
    from valuations import get_player_zscore
    try:
        # Build position -> best starter map from current roster
        # Exclude players being given away
        give_names_lower = set()
        for p in give_players:
            name = p.get("name", "")
            if name:
                give_names_lower.add(str(name).lower())

        pos_starters = {}  # position -> {name, z_score}
        for rp in roster_players:
            rp_name = str(rp.get("name", ""))
            if rp_name.lower() in give_names_lower:
                continue
            positions = rp.get("eligible_positions", [])
            z_info = get_player_zscore(rp_name)
            z_val = z_info.get("z_final", 0) if z_info else 0
            for pos in positions:
                if pos in ("BN", "IL", "IL+", "DL", "NA"):
                    continue
                current = pos_starters.get(pos)
                if current is None or z_val > current.get("z_score", 0):
                    pos_starters[pos] = {"name": rp_name, "z_score": round(z_val, 2)}

        upgrades = []
        redundancies = []
        new_positions = []

        for gp in get_players:
            if "_error" in gp:
                continue
            gp_name = gp.get("name", "Unknown")
            # Prefer eligible_positions (from Yahoo), fall back to pos string
            gp_positions = gp.get("eligible_positions", [])
            if not gp_positions:
                gp_pos = str(gp.get("pos", ""))
                gp_positions = [p.strip() for p in gp_pos.split(",") if p.strip()] if gp_pos else []
            z_scores = gp.get("z_scores", {})
            gp_z = float(z_scores.get("Final", 0))

            best_upgrade = None
            is_redundant = True

            for pos in gp_positions:
                if pos in ("BN", "IL", "IL+", "DL", "NA", "Util"):
                    continue
                current = pos_starters.get(pos)
                if current is None:
                    new_positions.append({"position": pos, "player": gp_name, "z_score": round(gp_z, 2)})
                    is_redundant = False
                else:
                    is_upgrade = gp_z > current.get("z_score", 0)
                    entry = {
                        "position": pos,
                        "current": current.get("name", "?") + " (" + str(current.get("z_score", 0)) + "z)",
                        "new": gp_name + " (" + str(round(gp_z, 2)) + "z)",
                        "upgrade": is_upgrade,
                    }
                    if is_upgrade:
                        if best_upgrade is None or gp_z - current.get("z_score", 0) > best_upgrade.get("_diff", 0):
                            entry["_diff"] = gp_z - current.get("z_score", 0)
                            best_upgrade = entry
                        is_redundant = False
                    else:
                        redundancies.append(entry)

            if best_upgrade:
                best_upgrade.pop("_diff", None)
                upgrades.append(best_upgrade)

        # Build summary
        if upgrades:
            summary = ", ".join(u.get("new", "?") + " upgrades " + u.get("position", "?") for u in upgrades)
        elif new_positions:
            summary = "Fills new position(s): " + ", ".join(p.get("position", "") for p in new_positions)
        elif redundancies:
            summary = "Would NOT start — blocked at " + ", ".join(r.get("position", "") for r in redundancies[:3])
        else:
            summary = "No positional impact data available"

        return {
            "upgrades": upgrades,
            "redundancies": redundancies,
            "new_positions": new_positions,
            "net_starting_impact": summary,
        }
    except Exception as e:
        return {"_error": str(e), "upgrades": [], "redundancies": [], "new_positions": [], "net_starting_impact": ""}


def _compute_category_impact(give_players, get_players):
    """Compare per-category z-scores between give and get sides."""
    try:
        give_cats = {}
        get_cats = {}

        for p in give_players:
            if "_error" in p:
                continue
            z_scores = p.get("z_scores", {})
            for cat, val in z_scores.items():
                if cat == "Final":
                    continue
                try:
                    give_cats[cat] = give_cats.get(cat, 0) + float(val)
                except (ValueError, TypeError):
                    pass

        for p in get_players:
            if "_error" in p:
                continue
            z_scores = p.get("z_scores", {})
            for cat, val in z_scores.items():
                if cat == "Final":
                    continue
                try:
                    get_cats[cat] = get_cats.get(cat, 0) + float(val)
                except (ValueError, TypeError):
                    pass

        all_cats = sorted(set(list(give_cats.keys()) + list(get_cats.keys())))
        categories_gained = []
        categories_lost = []
        details = []

        for cat in all_cats:
            give_val = round(give_cats.get(cat, 0), 2)
            get_val = round(get_cats.get(cat, 0), 2)
            diff = round(get_val - give_val, 2)
            details.append({"category": cat, "give_z": give_val, "get_z": get_val, "diff": diff})
            if diff > 0.1:
                categories_gained.append(cat)
            elif diff < -0.1:
                categories_lost.append(cat)

        return {
            "categories_gained": categories_gained,
            "categories_lost": categories_lost,
            "details": details,
        }
    except Exception as e:
        return {"_error": str(e), "categories_gained": [], "categories_lost": [], "details": []}


@app.route("/api/workflow/trade-analysis", methods=["POST"])
def workflow_trade_analysis():
    data = request.get_json(silent=True) or {}
    give_names = data.get("give_names", [])
    get_names = data.get("get_names", [])
    if not give_names or not get_names:
        return safe_jsonify({"error": "Missing give_names and/or get_names arrays"}, 400)
    try:

        # Resolve player names to IDs via value lookup
        give_players = []
        get_players = []
        give_ids = []
        get_ids = []

        # Fetch roster once for give-player ID lookups
        roster = _safe_call(yahoo_fantasy.cmd_roster)
        roster_players = (roster or {}).get("players", [])

        for name in give_names:
            try:
                val = valuations.cmd_value([name], as_json=True)
                players = val.get("players", [])
                if players:
                    p = players[0]
                    give_players.append(p)
                    for rp in roster_players:
                        if str(rp.get("name", "")).lower() == str(p.get("name", "")).lower():
                            give_ids.append(str(rp.get("player_id", "")))
                            break
                else:
                    give_players.append({"name": name, "_error": "Player not found in projections"})
            except Exception:
                give_players.append({"name": name, "_error": "Player not found in projections"})

        for name in get_names:
            try:
                val = valuations.cmd_value([name], as_json=True)
                players = val.get("players", [])
                if players:
                    p = players[0]
                    # Try search in free agents for player ID and position data
                    search = _safe_call(yahoo_fantasy.cmd_search, [name])
                    found_in_search = False
                    for rp in (search or {}).get("results", []):
                        if str(rp.get("name", "")).lower() == str(p.get("name", "")).lower():
                            get_ids.append(str(rp.get("player_id", "")))
                            # Enrich with position data from Yahoo
                            positions = rp.get("eligible_positions") or rp.get("positions")
                            if positions:
                                p["eligible_positions"] = positions
                                if not p.get("pos"):
                                    p["pos"] = ",".join(
                                        pos for pos in positions
                                        if pos not in ("BN", "IL", "IL+", "DL", "NA", "Util")
                                    )
                            found_in_search = True
                            break
                    # If not found in free agents (player is rostered), scan all team rosters
                    if not found_in_search:
                        try:
                            _sc, _gm, _lg = yahoo_fantasy.get_league()
                            all_teams = _lg.teams()  # dict: team_key -> team_info
                            for team_key in all_teams:
                                try:
                                    team_obj = _lg.to_team(team_key)
                                    team_roster = team_obj.roster()
                                    for tp in team_roster:
                                        if str(tp.get("name", "")).lower() == str(p.get("name", "")).lower():
                                            get_ids.append(str(tp.get("player_id", "")))
                                            positions = tp.get("eligible_positions", [])
                                            if positions:
                                                p["eligible_positions"] = positions
                                                if not p.get("pos"):
                                                    p["pos"] = ",".join(
                                                        pos for pos in positions
                                                        if pos not in ("BN", "IL", "IL+", "DL", "NA", "Util")
                                                    )
                                            found_in_search = True
                                            break
                                except Exception:
                                    continue
                                if found_in_search:
                                    break
                        except Exception:
                            pass
                    get_players.append(p)
                else:
                    get_players.append({"name": name, "_error": "Player not found in projections"})
            except Exception:
                get_players.append({"name": name, "_error": "Player not found in projections"})

        # Phase 2: parallel — trade_eval, intel, news, competitive context all at once
        all_names = give_names + get_names

        trade_eval_future = None
        if give_ids and get_ids:
            trade_eval_future = _workflow_pool.submit(
                _safe_call, season_manager.cmd_trade_eval,
                [",".join(give_ids), ",".join(get_ids)]
            )

        intel_futures = {
            name: _workflow_pool.submit(_safe_call, intel.cmd_player_report, [name])
            for name in all_names
        }

        try:
            from news import get_player_context
            news_futures = {
                name: _workflow_pool.submit(get_player_context, name)
                for name in all_names
            }
        except Exception:
            news_futures = {}

        # Competitive context: use cached results if available, else fetch fresh
        _cached_arms = cache_get(_response_cache, "cat-arms-race", 300)
        _cached_comp = cache_get(_response_cache, "competitor-tracker", 180)
        arms_race_future = _workflow_pool.submit(lambda: _cached_arms or _safe_call(season_manager.cmd_category_arms_race))
        competitor_future = _workflow_pool.submit(lambda: _cached_comp or _safe_call(season_manager.cmd_competitor_tracker))

        # Phase 3: gather results
        trade_eval = _get_future(trade_eval_future) if trade_eval_future else None

        intel_data = {}
        for name in all_names:
            intel_data[name] = _get_future(intel_futures[name])

        news_context = {}
        for name in all_names:
            if name in news_futures:
                result = _get_future(news_futures[name])
                news_context[name] = result if not isinstance(result, dict) or "_error" not in result else {"headlines": [], "transactions": [], "flags": []}
            else:
                news_context[name] = {"headlines": [], "transactions": [], "flags": []}

        arms_race = _get_future(arms_race_future)
        competitors = _get_future(competitor_future)

        # Phase 4: compute impacts (depend on trade_eval + player data)
        positional_impact = _compute_positional_impact(roster_players, get_players, give_players)
        category_impact = _compute_category_impact(give_players, get_players)

        # Phase 5: build strategic trade context
        trade_strategy = {}
        try:
            cats_gained = category_impact.get("categories_gained", [])
            cats_lost = category_impact.get("categories_lost", [])
            arms_cats = {c.get("name"): c for c in (arms_race or {}).get("categories", [])} if arms_race else {}

            strategic_gains = []
            strategic_losses = []
            for cat in cats_gained:
                arm = arms_cats.get(cat, {})
                if arm:
                    strategic_gains.append({
                        "category": cat,
                        "current_rank": arm.get("rank"),
                        "could_improve_to": max(1, arm.get("rank", 99) - 1) if arm.get("above") and arm.get("above", {}).get("gap", 99) < 5 else arm.get("rank"),
                    })
            for cat in cats_lost:
                arm = arms_cats.get(cat, {})
                if arm:
                    strategic_losses.append({
                        "category": cat,
                        "current_rank": arm.get("rank"),
                        "could_drop_to": arm.get("rank", 0) + 1 if arm.get("below") else arm.get("rank"),
                    })

            # Rival injury exploitation — use categories_weakened already on rival_injuries
            rival_injuries = (competitors or {}).get("rival_injuries", [])
            injury_relevant = []
            for inj in rival_injuries:
                inj_cats = inj.get("categories_weakened", [])
                overlap = [c for c in cats_gained if c in inj_cats]
                if overlap:
                    injury_relevant.append({
                        "rival": inj.get("rival"),
                        "injured_player": inj.get("player"),
                        "categories_weakened": inj_cats,
                        "trade_helps_exploit": overlap,
                    })

            trade_strategy = {
                "strategic_gains": strategic_gains,
                "strategic_losses": strategic_losses,
                "rival_injury_exploitation": injury_relevant,
                "net_rank_impact": len(strategic_gains) - len(strategic_losses),
            }
        except Exception as e:
            print("Warning: trade strategy context failed: " + str(e))
            trade_strategy = {"_error": str(e)}

        return safe_jsonify({
            "give_players": give_players,
            "get_players": get_players,
            "give_ids": give_ids,
            "get_ids": get_ids,
            "trade_eval": trade_eval,
            "intel": intel_data,
            "news_context": news_context,
            "positional_impact": positional_impact,
            "category_impact": category_impact,
            "trade_strategy": trade_strategy,
            "category_arms_race": arms_race,
        })
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/workflow/game-day-manager")
def workflow_game_day_manager():
    return _cached_endpoint("wf-gameday",
        lambda: season_manager.cmd_game_day_manager([], as_json=True), 300)


@app.route("/api/workflow/waiver-deadline-prep")
def workflow_waiver_deadline_prep():
    count = request.args.get("count", "5")
    return _cached_endpoint("wf-waiver-prep-" + count,
        lambda: season_manager.cmd_waiver_deadline_prep([count], as_json=True), 600)


@app.route("/api/workflow/trade-pipeline")
def workflow_trade_pipeline():
    return _cached_endpoint("wf-trade-pipe",
        lambda: season_manager.cmd_trade_pipeline([], as_json=True), 600)


@app.route("/api/workflow/weekly-digest")
def workflow_weekly_digest():
    return _cached_endpoint("wf-digest",
        lambda: season_manager.cmd_weekly_digest([], as_json=True), 1800)


@app.route("/api/workflow/season-checkpoint")
def workflow_season_checkpoint():
    return _cached_endpoint("wf-checkpoint",
        lambda: season_manager.cmd_season_checkpoint([], as_json=True), 1800)


# --- News (RotoWire RSS) ---


@app.route("/api/news")
def api_news():
    try:
        limit = request.args.get("limit", "20")
        result = news.cmd_news([limit], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/news/player")
def api_news_player():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        result = news.cmd_news_player([name], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/news/feed")
def api_news_feed():
    try:
        sources = request.args.get("sources", None)
        player = request.args.get("player", None)
        limit = int(request.args.get("limit", "30"))
        entries = news.fetch_aggregated_news(sources=sources, player=player, limit=limit)
        source_set = sorted(set(e.get("source", "") for e in entries if e.get("source")))
        return safe_jsonify({"entries": entries, "sources": source_set, "count": len(entries)})
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/news/sources")
def api_news_sources():
    try:
        result = news.cmd_news_sources([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# --- Strategy / Advanced Analysis ---


@app.route("/api/probable-pitchers")
def api_probable_pitchers():
    try:
        days = request.args.get("days", "7")
        result = season_manager.fetch_probable_pitchers(int(days))
        return safe_jsonify({"pitchers": result})
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/schedule-analysis")
def api_schedule_analysis():
    try:
        team_name = request.args.get("team", "")
        days = request.args.get("days", "14")
        if not team_name:
            return safe_jsonify({"error": "Missing team parameter"}, 400)
        result = season_manager.analyze_schedule_density(team_name, int(days))
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/category-impact", methods=["POST"])
def api_category_impact():
    try:
        data = request.get_json(silent=True) or {}
        add_players = data.get("add_players", [])
        drop_players = data.get("drop_players", [])
        result = valuations.project_category_impact(add_players, drop_players)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/regression-candidates")
def api_regression_candidates():
    try:
        result = intel.detect_regression_candidates()
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/player-tier")
def api_player_tier():
    try:
        name = request.args.get("name", "")
        if not name:
            return safe_jsonify({"error": "Missing name parameter"}, 400)
        result = valuations.get_player_zscore(name)
        if result is None:
            return safe_jsonify({"error": "Player not found: " + name}, 404)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/cache-stats", methods=["GET"])
def api_cache_stats():
    try:
        from intel import _cache_manager
        return safe_jsonify(_cache_manager.stats())
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/cache-clear", methods=["POST"])
def api_cache_clear():
    try:
        from intel import _cache_manager
        data = request.get_json(silent=True) or {}
        key = data.get("key")
        _cache_manager.clear(key)
        return safe_jsonify({"cleared": key or "all"})
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/trash-talk")
def api_trash_talk():
    try:
        intensity = request.args.get("intensity", "competitive")
        result = season_manager.cmd_trash_talk([intensity], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/rival-history")
def api_rival_history():
    opponent = request.args.get("opponent", "")
    args = [opponent] if opponent else []
    cache_key = "rival-history-" + opponent
    return _cached_endpoint(cache_key,
        lambda: season_manager.cmd_rival_history(args, as_json=True), 1800)


@app.route("/api/achievements")
def api_achievements():
    try:
        result = season_manager.cmd_achievements([], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# ============================================================
# Competitive Analysis & Research Tracking
# ============================================================


@app.route("/api/competitor-tracker")
def api_competitor_tracker():
    return _cached_endpoint("competitor-tracker",
        lambda: season_manager.cmd_competitor_tracker([], as_json=True), 180)


@app.route("/api/watchlist-add", methods=["POST"])
def api_watchlist_add():
    data = request.get_json(silent=True) or {}
    name = data.get("name") or request.args.get("name", "")
    reason = data.get("reason", "")
    target_type = data.get("type", "monitor")
    if not name:
        return safe_jsonify({"error": "name required"}, 400)
    try:
        result = season_manager.cmd_watchlist_add([name, reason, target_type], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/watchlist-remove", methods=["POST"])
def api_watchlist_remove():
    data = request.get_json(silent=True) or {}
    name = data.get("name") or request.args.get("name", "")
    if not name:
        return safe_jsonify({"error": "name required"}, 400)
    try:
        result = season_manager.cmd_watchlist_remove([name], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


@app.route("/api/watchlist")
def api_watchlist_check():
    return _cached_endpoint("watchlist-check",
        lambda: season_manager.cmd_watchlist_check([], as_json=True), 120)


@app.route("/api/category-arms-race")
def api_category_arms_race():
    return _cached_endpoint("cat-arms-race",
        lambda: season_manager.cmd_category_arms_race([], as_json=True), 300)


@app.route("/api/research-feed")
def api_research_feed():
    filter_type = request.args.get("filter", "all")
    limit = request.args.get("limit", "20")
    try:
        result = season_manager.cmd_research_feed([filter_type, limit], as_json=True)
        return safe_jsonify(result)
    except Exception as e:
        return safe_jsonify({"error": str(e)}, 500)


# ============================================================
# Proactive Roster Monitoring (powers OpenClaw heartbeat/hooks)
# ============================================================

_last_roster_state = {}  # name -> {status, position}
_last_monitor_time = 0
_monitor_lock = threading.Lock()
_monitor_cache = {}  # cached response with TTL
_MONITOR_CACHE_TTL = 60  # seconds — prevents redundant calls from hooks/cron


@app.route("/api/roster-monitor")
def api_roster_monitor():
    """Detect changes since last check: IL movements, role changes, trending FAs, opponent moves.

    Returns only actionable alerts, not the full roster state. Designed to be polled
    by OpenClaw heartbeat (every 30 min) with minimal overhead.
    Response cached for 60 seconds to prevent redundant work from concurrent hook calls.
    """
    global _last_roster_state, _last_monitor_time
    import time as _time

    # Endpoint-level cache: return cached response if fresh
    cached_entry = _monitor_cache.get("result")
    if cached_entry:
        cached_data, cached_at = cached_entry
        if _time.time() - cached_at < _MONITOR_CACHE_TTL:
            return safe_jsonify(cached_data)

    alerts = []
    now = _time.time()
    with _monitor_lock:
        is_first_check = not _last_roster_state
        prev_state = dict(_last_roster_state)

    try:
        # 1. Current roster state
        sc, gm, lg = yahoo_fantasy.get_league()
        team = lg.to_team(yahoo_fantasy.TEAM_ID)
        roster = team.roster()

        current_state = {}
        for p in roster:
            name = p.get("name", "")
            if name:
                current_state[name] = {
                    "status": p.get("status", ""),
                    "position": season_manager.get_player_position(p),
                }

        # 2. Detect status changes (IL placements, activations, new adds)
        if not is_first_check:
            for name, state in current_state.items():
                prev = prev_state.get(name)
                if not prev:
                    alerts.append({
                        "type": "roster_add",
                        "severity": "info",
                        "message": name + " added to roster",
                    })
                elif prev.get("status") != state.get("status"):
                    old_status = prev.get("status", "Healthy")
                    new_status = state.get("status", "Healthy")
                    if new_status in ("IL", "IL+", "IL10", "IL15", "IL60", "DTD"):
                        alerts.append({
                            "type": "injury",
                            "severity": "critical" if "60" in str(new_status) else "warning",
                            "message": name + " status changed: " + old_status + " -> " + new_status,
                            "player": name,
                        })
                    elif old_status in ("IL", "IL+", "IL10", "IL15", "IL60") and not new_status:
                        alerts.append({
                            "type": "activation",
                            "severity": "info",
                            "message": name + " activated from IL — set lineup",
                            "player": name,
                        })

            for name in prev_state:
                if name not in current_state:
                    alerts.append({
                        "type": "roster_drop",
                        "severity": "info",
                        "message": name + " no longer on roster",
                    })

        # 3. Check news context for rostered players with new flags
        try:
            from news import get_player_context
            for p in roster:
                name = p.get("name", "")
                if not name:
                    continue
                ctx = get_player_context(name)
                for f in ctx.get("flags", []):
                    if f.get("type") == "DEALBREAKER":
                        alerts.append({
                            "type": "dealbreaker",
                            "severity": "critical",
                            "message": name + " — " + f.get("message", "unavailable"),
                            "player": name,
                        })
                        break
                if ctx.get("availability") == "minors":
                    alerts.append({
                        "type": "sent_down",
                        "severity": "warning",
                        "message": name + " sent to minors — replace in lineup",
                        "player": name,
                    })
        except Exception as e:
            print("Warning: roster monitor context check failed: " + str(e))

        # 4. Trending FA pickups (ownership spikes the user might want to grab)
        try:
            trend_lookup = season_manager.get_trend_lookup()
            hot_adds = []
            for pname, info in trend_lookup.items():
                direction = info.get("direction", "")
                if direction == "added":
                    rank = info.get("rank", 99)
                    if rank <= 10:
                        hot_adds.append({
                            "name": pname,
                            "rank": rank,
                            "delta": info.get("delta", ""),
                        })
            if hot_adds:
                hot_adds.sort(key=lambda x: x.get("rank", 99))
                for ha in hot_adds[:3]:
                    # Only alert if not already on our roster
                    if ha.get("name") not in current_state:
                        alerts.append({
                            "type": "trending_fa",
                            "severity": "info",
                            "message": ha.get("name", "?") + " trending (#" + str(ha.get("rank", "?")) + " most added) — consider pickup",
                        })
        except Exception:
            pass

        # 5. Update state for next check (thread-safe)
        with _monitor_lock:
            _last_roster_state = current_state
            _last_monitor_time = now

    except Exception as e:
        return safe_jsonify({"error": str(e), "alerts": []}, 500)

    # Deduplicate alerts by message
    seen = set()
    unique_alerts = []
    for a in alerts:
        msg = a.get("message", "")
        if msg not in seen:
            seen.add(msg)
            unique_alerts.append(a)

    # Sort by severity: critical first, then warning, then info
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    unique_alerts.sort(key=lambda a: severity_order.get(a.get("severity", "info"), 3))

    result = {
        "alerts": unique_alerts,
        "alert_count": len(unique_alerts),
        "first_check": is_first_check,
        "roster_size": len(current_state) if 'current_state' in dir() else 0,
    }
    _monitor_cache["result"] = (result, _time.time())
    return safe_jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("API_PORT", "8766"))
    app.run(host="0.0.0.0", port=port)
